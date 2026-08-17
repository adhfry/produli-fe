<script setup lang="ts">
import type { ApiSuccessEnvelope, VisitAssignment } from "~/types/api";

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

type Scope = "today" | "kabupaten";
const scope = ref<Scope>("today");

type Step = "confirm" | "progress" | "done";
const step = ref<Step>("confirm");

const isRunning = ref(false);
const statusText = ref("");
const overallProgress = ref(0); // 0-100
const errorText = ref("");

const summary = ref({ tugas: 0, riwayat: 0, riwayatGagal: 0, peta: 0 });

// Bobot tahap (docs/planning/12): tugas 10%, riwayat pasien 30%, peta 55%, penyelesaian 5% --
// satu progress bar akumulatif, bukan 4 bar terpisah.
const WEIGHT_TUGAS = 10;
const WEIGHT_RIWAYAT = 30;
const WEIGHT_PETA = 55;
const WEIGHT_DONE = 5;

function setProgress(stageStart: number, stageWeight: number, fraction: number) {
  overallProgress.value = Math.min(100, Math.round(stageStart + stageWeight * fraction));
}

async function startDownload() {
  step.value = "progress";
  isRunning.value = true;
  errorText.value = "";
  overallProgress.value = 0;
  summary.value = { tugas: 0, riwayat: 0, riwayatGagal: 0, peta: 0 };

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

    // Tahap 3 -- peta wilayah (~55%), cakupan sesuai pilihan user.
    statusText.value =
      scope.value === "kabupaten"
        ? "Mengunduh peta Seluruh Kabupaten Sumenep..."
        : "Mengunduh peta wilayah tugas hari ini...";
    const bbox =
      scope.value === "kabupaten"
        ? await tileDownload.computeKabupatenBoundingBox()
        : (tileDownload.computeBoundingBox(assignmentStore.assignments) ?? (await tileDownload.computeKabupatenBoundingBox()));

    if (bbox) {
      const result = await tileDownload.downloadTilesForBoundingBox(bbox, (progress) => {
        statusText.value = `Mengunduh berkas peta (${progress.current} dari ${progress.total})...`;
        setProgress(WEIGHT_TUGAS + WEIGHT_RIWAYAT, WEIGHT_PETA, progress.total ? progress.current / progress.total : 1);
      });
      summary.value.peta = result.downloaded;
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

        <div class="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 class="font-bold text-slate-800 dark:text-white text-sm mb-3">Cakupan Peta</h3>
          <div class="space-y-2.5">
            <button
              type="button"
              @click="scope = 'today'"
              class="w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-colors"
              :class="scope === 'today' ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700'"
            >
              <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0" :class="scope === 'today' ? 'border-primary' : 'border-slate-300 dark:border-slate-600'">
                <div v-if="scope === 'today'" class="w-2.5 h-2.5 rounded-full bg-primary"></div>
              </div>
              <div>
                <p class="font-bold text-slate-800 dark:text-white text-sm">Wilayah Tugas Hari Ini</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">Lebih cepat, cakupan kecil sesuai tugas hari ini.</p>
              </div>
            </button>
            <button
              type="button"
              @click="scope = 'kabupaten'"
              class="w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-colors"
              :class="scope === 'kabupaten' ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700'"
            >
              <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0" :class="scope === 'kabupaten' ? 'border-primary' : 'border-slate-300 dark:border-slate-600'">
                <div v-if="scope === 'kabupaten'" class="w-2.5 h-2.5 rounded-full bg-primary"></div>
              </div>
              <div>
                <p class="font-bold text-slate-800 dark:text-white text-sm">Seluruh Kabupaten Sumenep</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">Lebih lama & lebih besar, tapi siap untuk ke mana pun.</p>
              </div>
            </button>
          </div>
        </div>

        <p v-if="errorText" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-2xl px-4 py-3">{{ errorText }}</p>

        <button
          @click="startDownload"
          class="w-full py-4 bg-primary text-white rounded-2xl font-bold text-base transition-all shadow-sm shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98]"
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
            {{ summary.tugas }} tugas, {{ summary.riwayat }} riwayat pasien{{ summary.riwayatGagal > 0 ? ` (${summary.riwayatGagal} gagal)` : '' }}, dan {{ summary.peta }} berkas peta siap dipakai offline.
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
