<script setup lang="ts">
import type { ApiSuccessEnvelope, VisitAssignment } from "~/types/api";
import type { ManualResolution, ResolvedArea, AmbiguousPatient } from "~/composables/useMapTileDownload";

// docs/planning/12 Bagian 5 -- alur "siapkan sebelum berangkat": kader/nakes konfirmasi lalu
// sistem mengunduh SEMUA yang dibutuhkan untuk kerja offline penuh (daftar tugas, riwayat
// kunjungan tiap pasien, peta wilayah) dalam satu progress bar bertahap, sebelum mereka
// benar-benar berangkat ke lapangan tanpa sinyal.
definePageMeta({
  layout: "pwa",
  middleware: "auth",
});
useHead({
  title: "Siapkan Mode Offline",
});

const assignmentStore = useAssignmentStore();
const offlineCache = useOfflineCache();
const tileDownload = useMapTileDownload();
const wilayah = useWilayahResolver();

type Scope = "smart" | "kabupaten";
const scope = ref<Scope>("smart");

type Step = "confirm" | "progress" | "done";
const step = ref<Step>("confirm");

const isRunning = ref(false);
const statusText = ref("");
const overallProgress = ref(0); // 0-100
const errorText = ref("");

const summary = ref({ tugas: 0, riwayat: 0, riwayatGagal: 0, peta: 0, petaDilewati: 0, petaBytes: 0 });

// Bobot tahap (docs/planning/12): tugas 10%, riwayat pasien 30%, peta 55%, penyelesaian 5% --
// satu progress bar akumulatif, bukan 4 bar terpisah.
const WEIGHT_TUGAS = 10;
const WEIGHT_RIWAYAT = 30;
const WEIGHT_PETA = 55;
const WEIGHT_DONE = 5;

function setProgress(stageStart: number, stageWeight: number, fraction: number) {
  overallProgress.value = Math.min(100, Math.round(stageStart + stageWeight * fraction));
}

// --- Resolusi wilayah "smart" (revisi -- SEBELUMNYA satu bounding-box tunggal & begitu ada 1
// pasien tanpa koordinat langsung jatuh ke SELURUH Kabupaten Sumenep tanpa info apa pun) ------
const isLoadingAssignments = ref(true);
const manualResolutions = ref<Record<number, ManualResolution>>({});
// Kecamatan yang SEDANG dipilih per pasien ambigu (state UI cascading select, terpisah dari
// manualResolutions yang baru terisi setelah desa juga dipilih).
const pendingKecamatanByPatient = ref<Record<number, number | null>>({});

const resolution = computed(() => tileDownload.resolveAreas(assignmentStore.assignments, manualResolutions.value));
const areas = computed<ResolvedArea[]>(() => resolution.value.areas);
const ambiguousPatients = computed<AmbiguousPatient[]>(() => resolution.value.ambiguousPatients);
const totalPatients = computed(() => resolution.value.totalPatients);
const resolvedPatientCount = computed(() => totalPatients.value - ambiguousPatients.value.length);

const kabupatenArea = ref<ResolvedArea | null>(null);

// Estimasi ukuran (dihitung dari sampel NYATA lewat estimateTileSetSize, bukan angka karangan) --
// recompute setiap kali area berubah (kader menyelesaikan 1 pasien ambigu, atau ganti cakupan).
const isEstimating = ref(false);
const estimate = ref({ fileCount: 0, estimatedBytes: 0 });
let estimateToken = 0;

async function refreshEstimate() {
  const token = ++estimateToken;
  isEstimating.value = true;
  try {
    const targetAreas = scope.value === "kabupaten" ? (kabupatenArea.value ? [kabupatenArea.value] : []) : areas.value;
    const tiles = tileDownload.buildTileSetForAreas(targetAreas);
    const result = await tileDownload.estimateTileSetSize(tiles);
    if (token !== estimateToken) return; // ada perubahan lagi selama sampling berjalan -- buang hasil basi
    estimate.value = { fileCount: result.fileCount, estimatedBytes: result.estimatedBytes };
  } finally {
    if (token === estimateToken) isEstimating.value = false;
  }
}

watch([areas, scope], () => {
  void refreshEstimate();
});

function onKecamatanPick(patientId: number, kecamatanId: number | null) {
  pendingKecamatanByPatient.value = { ...pendingKecamatanByPatient.value, [patientId]: kecamatanId };
  if (kecamatanId !== null) void wilayah.loadDesaList(kecamatanId);
}

function onDesaPick(patient: AmbiguousPatient, desaId: number | null) {
  if (desaId === null) return;
  const kecamatanId = pendingKecamatanByPatient.value[patient.patientId];
  if (!kecamatanId) return;
  const kecamatan = wilayah.kecamatanList.value.find((k) => k.id === kecamatanId);
  const desa = (wilayah.desaByKecamatan.value[kecamatanId] ?? []).find((d) => d.id === desaId);
  if (!kecamatan || !desa || desa.latitude === null || desa.longitude === null) return;

  manualResolutions.value = {
    ...manualResolutions.value,
    [patient.patientId]: {
      kecamatanId: kecamatan.id,
      kecamatanNama: kecamatan.nama,
      desaId: desa.id,
      desaNama: desa.nama,
      latitude: desa.latitude,
      longitude: desa.longitude,
    },
  };
}

async function initConfirmStep() {
  isLoadingAssignments.value = true;
  if (assignmentStore.assignments.length === 0) {
    await assignmentStore.fetchAll();
  }
  // Pra-isi dropdown kecamatan untuk pasien ambigu yang SUDAH punya hint kecamatan (~19,6% kasus
  // -- kecamatan dikenali tapi desa belum) supaya kader tinggal pilih desa, tidak mulai dari nol.
  const prefill: Record<number, number | null> = {};
  for (const p of ambiguousPatients.value) {
    prefill[p.patientId] = p.kecamatanIdHint;
    if (p.kecamatanIdHint !== null) void wilayah.loadDesaList(p.kecamatanIdHint);
  }
  pendingKecamatanByPatient.value = prefill;
  isLoadingAssignments.value = false;
  await wilayah.loadKecamatanList();
  await refreshEstimate();
}

onMounted(() => {
  void initConfirmStep();
});

async function startDownload() {
  step.value = "progress";
  isRunning.value = true;
  errorText.value = "";
  overallProgress.value = 0;
  summary.value = { tugas: 0, riwayat: 0, riwayatGagal: 0, peta: 0, petaDilewati: 0, petaBytes: 0 };

  try {
    // Tahap 1 -- daftar tugas kunjungan (~10%)
    statusText.value = "Menyiapkan daftar tugas kunjungan...";
    await assignmentStore.fetchAll();
    if (assignmentStore.loadError) {
      errorText.value = assignmentStore.loadError;
      isRunning.value = false;
      return;
    }
    summary.value.tugas = assignmentStore.assignments.length;
    setProgress(0, WEIGHT_TUGAS, 1);

    // Tahap 2 -- riwayat kunjungan tiap pasien unik (~30%), partial-success (satu gagal tidak
    // menghentikan yang lain -- pola sama dengan useOfflineQueue.syncAllDrafts()).
    const patientIds = [
      ...new Set(assignmentStore.assignments.map((a) => a.patient?.id).filter((id): id is number => !!id)),
    ];
    const api = useApi();
    for (let i = 0; i < patientIds.length; i++) {
      const patientId = patientIds[i]!;
      statusText.value = `Mengunduh riwayat kunjungan pasien (${i + 1} dari ${patientIds.length})...`;
      try {
        const res = (await api(`/patients/${patientId}/visit-history`)) as ApiSuccessEnvelope<VisitAssignment[]>;
        await offlineCache.setCached(`visit_history_${patientId}`, res.data);
        summary.value.riwayat++;
      } catch {
        summary.value.riwayatGagal++;
      }
      setProgress(WEIGHT_TUGAS, WEIGHT_RIWAYAT, (i + 1) / Math.max(patientIds.length, 1));
    }
    if (patientIds.length === 0) setProgress(WEIGHT_TUGAS, WEIGHT_RIWAYAT, 1);

    // Tahap 3 -- peta wilayah (~55%) -- union tile dari SEMUA area yang sudah resolve (titik
    // presisi + desa, termasuk hasil pilihan manual kader utk pasien ambigu), ATAU seluruh
    // Kabupaten Sumenep kalau kader eksplisit memilih cakupan itu.
    statusText.value =
      scope.value === "kabupaten"
        ? "Mengunduh peta Seluruh Kabupaten Sumenep..."
        : "Mengunduh peta wilayah tugas...";
    const targetAreas = scope.value === "kabupaten" ? (kabupatenArea.value ? [kabupatenArea.value] : []) : areas.value;
    const tiles = tileDownload.buildTileSetForAreas(targetAreas);

    if (tiles.length > 0) {
      const result = await tileDownload.downloadTileSet(tiles, (progress) => {
        statusText.value = `Mengunduh berkas peta (${progress.current} dari ${progress.total}, ${progress.skipped} sudah tersimpan)...`;
        setProgress(WEIGHT_TUGAS + WEIGHT_RIWAYAT, WEIGHT_PETA, progress.total ? progress.current / progress.total : 1);
      });
      summary.value.peta = result.downloaded;
      summary.value.petaDilewati = result.skipped;
      summary.value.petaBytes = result.bytesDownloaded;
    }
    setProgress(WEIGHT_TUGAS + WEIGHT_RIWAYAT, WEIGHT_PETA, 1);

    // Tahap 4 -- selesai (~5%)
    statusText.value = "Menyelesaikan...";
    setProgress(WEIGHT_TUGAS + WEIGHT_RIWAYAT + WEIGHT_PETA, WEIGHT_DONE, 1);
    step.value = "done";
  } catch (e) {
    errorText.value = e instanceof ApiError ? e.message : "Gagal menyiapkan mode offline. Coba lagi saat koneksi lebih stabil.";
  } finally {
    isRunning.value = false;
  }
}

async function onScopeKabupaten() {
  scope.value = "kabupaten";
  if (!kabupatenArea.value) {
    kabupatenArea.value = await tileDownload.resolveKabupatenArea();
  }
  await refreshEstimate();
}

function reset() {
  step.value = "confirm";
  errorText.value = "";
}
</script>

<template>
  <div>
    <div class="px-5 pt-8 pb-4 bg-white dark:bg-slate-900 sticky top-0 z-40 border-b border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
      <div class="flex items-center gap-3">
        <NuxtLink to="/app" class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-all shrink-0">
          <LucideArrowLeft class="w-5 h-5" />
        </NuxtLink>
        <h1 class="text-xl font-extrabold text-accent dark:text-white transition-colors">Siapkan Mode Offline</h1>
      </div>
    </div>

    <div class="p-5 space-y-5">
      <!-- Langkah 1: Konfirmasi -->
      <div v-if="step === 'confirm'" class="space-y-5">
        <div class="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div class="w-12 h-12 bg-info/10 text-info rounded-2xl flex items-center justify-center mb-4">
            <LucidePackageCheck class="w-6 h-6" />
          </div>
          <h2 class="font-bold text-slate-800 dark:text-white text-lg mb-2">Unduh Semua Kebutuhan Kerja Offline</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Sistem akan mengunduh daftar tugas kunjungan Anda, riwayat kunjungan tiap pasien, dan
            peta wilayah kerja — supaya Anda tetap bisa bekerja penuh walau nanti tidak ada
            sinyal sama sekali di lapangan.
          </p>
        </div>

        <div v-if="isLoadingAssignments" class="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 text-center text-sm text-slate-400">
          <LucideLoader2 class="w-5 h-5 mx-auto mb-2 animate-spin" />
          Memuat daftar tugas...
        </div>

        <template v-else>
          <!-- Pasien wilayahnya ambigu -- kader WAJIB pilih kecamatan+desa manual, tidak ditebak -->
          <div v-if="ambiguousPatients.length > 0" class="bg-warning/10 border border-warning/20 rounded-3xl p-5 shadow-sm">
            <div class="flex items-center gap-2 mb-1">
              <LucideMapPinOff class="w-4 h-4 text-warning-700 shrink-0" />
              <h3 class="font-bold text-warning-800 dark:text-warning-500 text-sm">
                {{ ambiguousPatients.length }} Pasien Wilayahnya Belum Jelas
              </h3>
            </div>
            <p class="text-xs text-warning-700/80 dark:text-warning-600/80 mb-4">
              Tidak ada desa/kelurahan yang cocok untuk pasien ini. Pilih kecamatan &amp; desa
              secara manual supaya peta wilayahnya ikut terunduh (kecamatan boleh berbeda dari
              puskesmas Anda — pasien bisa lintas kecamatan).
            </p>
            <div class="space-y-3">
              <div v-for="p in ambiguousPatients" :key="p.patientId" class="bg-white dark:bg-slate-800 rounded-2xl p-3.5">
                <p class="font-bold text-slate-800 dark:text-white text-sm mb-2 flex items-center gap-1.5">
                  <span v-if="manualResolutions[p.patientId]" class="text-success"><LucideCheckCircle2 class="w-4 h-4" /></span>
                  {{ p.patientName }}
                </p>
                <div class="grid grid-cols-2 gap-2">
                  <select
                    :value="pendingKecamatanByPatient[p.patientId] ?? ''"
                    @change="onKecamatanPick(p.patientId, ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null)"
                    class="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none appearance-none"
                  >
                    <option value="">Pilih kecamatan...</option>
                    <option v-for="k in wilayah.kecamatanList.value" :key="k.id" :value="k.id">{{ k.nama }}</option>
                  </select>
                  <select
                    :value="manualResolutions[p.patientId]?.desaId ?? ''"
                    :disabled="!pendingKecamatanByPatient[p.patientId]"
                    @change="onDesaPick(p, ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null)"
                    class="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none appearance-none disabled:opacity-50"
                  >
                    <option value="">
                      {{
                        !pendingKecamatanByPatient[p.patientId]
                          ? "Pilih kecamatan dulu"
                          : wilayah.isLoadingDesa.value
                            ? "Memuat..."
                            : "Pilih desa..."
                      }}
                    </option>
                    <option
                      v-for="d in wilayah.desaByKecamatan.value[pendingKecamatanByPatient[p.patientId] ?? -1] ?? []"
                      :key="d.id"
                      :value="d.id"
                    >
                      {{ d.nama }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- Ringkasan wilayah yang akan diunduh -- ganti angka jumlah tile mentah yang tidak
               informatif dengan nama wilayah + ukuran nyata dalam MB. -->
          <div class="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <h3 class="font-bold text-slate-800 dark:text-white text-sm mb-3">Cakupan Peta</h3>
            <div class="space-y-2.5 mb-4">
              <button
                type="button"
                @click="scope = 'smart'; refreshEstimate()"
                class="w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-colors"
                :class="scope === 'smart' ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700'"
              >
                <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0" :class="scope === 'smart' ? 'border-primary' : 'border-slate-300 dark:border-slate-600'">
                  <div v-if="scope === 'smart'" class="w-2.5 h-2.5 rounded-full bg-primary"></div>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="font-bold text-slate-800 dark:text-white text-sm">Wilayah Tugas Saya</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {{ resolvedPatientCount }}/{{ totalPatients }} pasien wilayahnya jelas. Cuma area yang benar-benar dibutuhkan.
                  </p>
                </div>
              </button>
              <button
                type="button"
                @click="onScopeKabupaten"
                class="w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-colors"
                :class="scope === 'kabupaten' ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700'"
              >
                <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0" :class="scope === 'kabupaten' ? 'border-primary' : 'border-slate-300 dark:border-slate-600'">
                  <div v-if="scope === 'kabupaten'" class="w-2.5 h-2.5 rounded-full bg-primary"></div>
                </div>
                <div>
                  <p class="font-bold text-slate-800 dark:text-white text-sm">Seluruh Kabupaten Sumenep</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">Jauh lebih besar, tapi siap dipakai ke mana pun.</p>
                </div>
              </button>
            </div>

            <div v-if="scope === 'smart' && areas.length > 0" class="mb-4 space-y-1.5">
              <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Area yang akan diunduh</p>
              <div v-for="a in areas" :key="a.key" class="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-900 rounded-lg px-3 py-2">
                <span class="font-medium text-slate-700 dark:text-slate-200">{{ a.label }}</span>
                <span v-if="a.patientCount > 0" class="text-slate-400">{{ a.patientCount }} pasien</span>
              </div>
            </div>
            <p v-else-if="scope === 'smart'" class="text-xs text-slate-400 mb-4">
              Belum ada wilayah yang bisa ditentukan — lengkapi pasien ambigu di atas, atau pilih Seluruh Kabupaten Sumenep.
            </p>

            <div class="rounded-2xl bg-info/10 px-4 py-3 flex items-center justify-between">
              <span class="text-xs font-bold text-info">Estimasi ukuran unduhan</span>
              <span class="text-sm font-black text-info">
                <LucideLoader2 v-if="isEstimating" class="w-4 h-4 animate-spin inline" />
                <template v-else>≈ {{ tileDownload.formatBytes(estimate.estimatedBytes) }}</template>
              </span>
            </div>
          </div>
        </template>

        <p v-if="errorText" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-2xl px-4 py-3">{{ errorText }}</p>

        <button
          @click="startDownload"
          :disabled="isLoadingAssignments"
          class="w-full py-4 bg-primary text-white rounded-2xl font-bold text-base transition-all shadow-sm shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
        >
          <LucideDownload class="w-5 h-5" />
          Ya, Unduh Sekarang
        </button>
      </div>

      <!-- Langkah 2: Progress -->
      <div v-else-if="step === 'progress'" class="space-y-5">
        <div class="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 text-center">
          <LucideLoader2 class="w-10 h-10 mx-auto mb-4 text-primary animate-spin" />
          <p class="font-bold text-slate-800 dark:text-white text-base mb-1">{{ statusText }}</p>
          <p class="text-2xl font-black text-primary mb-4">{{ overallProgress }}%</p>
          <div class="h-3 w-full bg-primary/10 rounded-full overflow-hidden">
            <div class="h-full bg-primary transition-all duration-300" :style="{ width: `${overallProgress}%` }"></div>
          </div>
        </div>
        <p class="text-xs text-center text-slate-400">Jangan tutup halaman ini sampai proses selesai.</p>
      </div>

      <!-- Langkah 3: Selesai -->
      <div v-else class="space-y-5">
        <div class="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 text-center">
          <div class="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4">
            <LucideCheckCircle2 class="w-8 h-8" />
          </div>
          <h2 class="font-bold text-slate-800 dark:text-white text-lg mb-1">Siap Dipakai Offline</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            {{ summary.tugas }} tugas, {{ summary.riwayat }} riwayat pasien{{ summary.riwayatGagal > 0 ? ` (${summary.riwayatGagal} gagal)` : '' }},
            dan {{ summary.peta }} berkas peta baru (≈ {{ tileDownload.formatBytes(summary.petaBytes) }})
            <template v-if="summary.petaDilewati > 0">— {{ summary.petaDilewati }} berkas sudah tersimpan sebelumnya, tidak diunduh ulang</template>
            siap dipakai offline.
          </p>
        </div>

        <NuxtLink to="/app" class="w-full py-4 bg-primary text-white rounded-2xl font-bold text-base transition-all shadow-sm shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98]">
          Kembali ke Beranda
        </NuxtLink>
        <button @click="reset" class="w-full py-3 text-slate-500 dark:text-slate-400 font-bold text-sm">
          Unduh Ulang
        </button>
      </div>
    </div>
  </div>
</template>
