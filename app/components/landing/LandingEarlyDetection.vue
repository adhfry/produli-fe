<script setup lang="ts">
import { ref, computed } from "vue";
import { motion } from "motion-v";
import {
  LucideSparkles,
  LucideTrendingUp,
  LucideLayers,
  LucideSlidersHorizontal,
  LucideFlaskConical,
  LucideCalculator,
  LucideX,
  LucideAlertTriangle,
  LucideCheckCircle2,
  LucideArrowRight,
} from "#components";

// 3 sinyal independen -- PERSIS sama dengan RiskClassificationService::evaluateEarlyDetection()
// di backend (rule-based, BUKAN machine learning) -- salah satu SAJA cukup untuk memicu flag,
// termasuk kasus GABUNGAN (kombo cuma "rata-rata sedang" tapi Creatinine sendiri hampir 2 tetap
// ke-flag lewat proximity, lihat evaluateEarlyDetection() docblock backend).
const signals = [
  {
    icon: LucideSlidersHorizontal,
    title: "Kedekatan ke Ambang Berat (Proximity)",
    forWhom: "Khusus parameter bertingkat seperti Creatinine",
    desc: "Menghitung posisi nilai pasien di dalam rentang Sedang sebagai persentase menuju ambang Berat berikutnya -- 1 parameter penting yang dinilai terpisah dari kombo, tidak pernah dilonggarkan.",
    formula: "proximity = (nilai - ambang_bawah) / (ambang_berat - ambang_bawah)",
  },
  {
    icon: LucideLayers,
    title: "Margin Kombinasi Parameter",
    forWhom: "Untuk 5 parameter kombinasi (GDP, Cholesterol, Trigliserida, LDL, Urea)",
    desc: "Bukan lagi sekadar jumlah parameter yang melebihi ambang -- minimal 2 parameter harus melebihi BERSAMAAN, dan SELURUHNYA (bukan cuma rata-ratanya) harus sama-sama jauh di atas nilai rujukan aslinya, bukan cuma 1 parameter menyimpang jauh sementara yang lain nyaris ambang.",
    formula: "hitung(margin) ≥ min_parameter DAN min(margin) ≥ ambang_margin",
  },
  {
    icon: LucideTrendingUp,
    title: "Tren Memburuk Berturut-turut",
    forWhom: "Untuk parameter apa pun yang punya riwayat pemeriksaan",
    desc: "Nilai parameter yang sama terus naik di 3 pemeriksaan terakhir berturut-turut, meski levelnya sendiri belum berubah.",
    formula: "nilai_sekarang > nilai_sebelumnya > nilai_2x_sebelumnya",
  },
];

// --- Simulasi interaktif -- rumus SAMA PERSIS dengan backend, dihitung ulang di sini secara
// reaktif supaya pengunjung bisa menggeser nilai dan melihat langsung kapan flag menyala. Dua
// mode karena dua rumus bekerja sangat berbeda (rasio ke ambang tunggal vs margin gabungan
// beberapa parameter) -- lihat RiskClassificationService::evaluateEarlyDetection()/
// evaluateComboMargin() di backend, kedua mode ini menirunya persis. ---
const AMBANG_SEDANG_BAWAH = 1.7; // Creatinine mg/dL
const AMBANG_BERAT = 2.0; // Creatinine mg/dL
const PROXIMITY_THRESHOLD = 0.6; // config('produli.early_detection.proximity_threshold')
const MAKS_PROXIMITY_TERCAPAI = (1.9 - AMBANG_SEDANG_BAWAH) / (AMBANG_BERAT - AMBANG_SEDANG_BAWAH); // 66,7%

// config('produli.early_detection.combo_min_parameters' / 'combo_margin_threshold_percent')
const COMBO_MIN_PARAMETERS = 2;
const COMBO_MARGIN_THRESHOLD_PERCENT = 50;

const showModal = ref(false);
const simMode = ref<"creatinine" | "combo">("creatinine");
const simCreatinine = ref(1.89); // contoh bawaan -- persis kasus nyata yang ditemukan saat pengujian

const simProximity = computed(() => {
  const raw = (simCreatinine.value - AMBANG_SEDANG_BAWAH) / (AMBANG_BERAT - AMBANG_SEDANG_BAWAH);
  return Math.max(0, Math.min(1, raw));
});
const simProximityPercent = computed(() => Math.round(simProximity.value * 1000) / 10);
const simFlagged = computed(() => simProximity.value >= PROXIMITY_THRESHOLD);

// Simulasi Margin Kombinasi -- 2 parameter contoh (Gula Darah Puasa & Cholesterol), persis
// combo_min_parameters bawaan (2). Margin = (nilai - ambang) / ambang * 100, SELURUH parameter
// yang diikutkan harus >= ambang margin, bukan cuma rata-ratanya (lihat evaluateComboMargin()).
const comboGdp = ref({ value: 180, ambang: 120 }); // Gula Darah Puasa mg/dL
const comboKolesterol = ref({ value: 300, ambang: 200 }); // Cholesterol mg/dL

function marginPercent(value: number, ambang: number): number {
  return ((value - ambang) / ambang) * 100;
}

const simMarginGdp = computed(() => Math.max(0, marginPercent(comboGdp.value.value, comboGdp.value.ambang)));
const simMarginKolesterol = computed(() => Math.max(0, marginPercent(comboKolesterol.value.value, comboKolesterol.value.ambang)));
const simMarginMin = computed(() => Math.min(simMarginGdp.value, simMarginKolesterol.value));
const simMarginAverage = computed(() => (simMarginGdp.value + simMarginKolesterol.value) / 2);
const simComboFlagged = computed(() => simMarginMin.value >= COMBO_MARGIN_THRESHOLD_PERCENT);

function openModal() {
  simMode.value = "creatinine";
  simCreatinine.value = 1.89;
  comboGdp.value = { value: 180, ambang: 120 };
  comboKolesterol.value = { value: 300, ambang: 200 };
  showModal.value = true;
}
</script>

<template>
  <section
    id="deteksi-dini"
    class="border-t border-neutral-100 bg-neutral-50 px-6 py-24 md:px-12 lg:px-24"
  >
    <div class="mx-auto max-w-7xl">
      <motion.div
        class="mx-auto mb-16 max-w-3xl text-center"
        :initial="{ opacity: 0, y: 30 }"
        :while-in-view="{ opacity: 1, y: 0 }"
        :in-view-options="{ once: true, amount: 0.15 }"
        :transition="{ duration: 0.8, ease: 'easeOut' }"
      >
        <div class="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-bold tracking-widest text-primary uppercase">
          <LucideSparkles class="h-3.5 w-3.5" /> Smart Early Detection
        </div>
        <h2 class="mb-6 text-3xl font-extrabold text-accent md:text-5xl">
          Mendeteksi Pasien yang
          <span class="text-primary">Hampir Memburuk</span>
        </h2>
        <p class="text-lg text-neutral-600">
          Bukan sekadar mengelompokkan Ringan/Sedang/Berat -- sistem juga
          menandai pasien berisiko Sedang yang kondisinya diam-diam sudah
          mendekati ambang Berat, berbasis 3 aturan objektif (rule-based),
          bukan tebakan model machine learning kotak hitam.
        </p>
      </motion.div>

      <!-- 3 Sinyal -->
      <div class="mb-16 grid grid-cols-1 gap-6 md:grid-cols-3">
        <motion.div
          v-for="(signal, index) in signals"
          :key="signal.title"
          class="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"
          :initial="{ opacity: 0, y: 30 }"
          :while-in-view="{ opacity: 1, y: 0 }"
          :in-view-options="{ once: true, amount: 0.2 }"
          :transition="{ duration: 0.6, delay: index * 0.1, ease: 'easeOut' }"
        >
          <div class="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <component :is="signal.icon" class="h-5.5 w-5.5" />
          </div>
          <h3 class="mb-1 text-base font-bold text-accent">{{ signal.title }}</h3>
          <p class="mb-3 text-xs font-semibold text-neutral-400">{{ signal.forWhom }}</p>
          <p class="mb-4 text-sm text-neutral-600">{{ signal.desc }}</p>
          <div class="rounded-xl bg-neutral-50 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-neutral-500">
            {{ signal.formula }}
          </div>
        </motion.div>
      </div>

      <!-- Kenapa threshold 0,6 + tunable + tombol simulasi -->
      <motion.div
        class="grid grid-cols-1 items-center gap-8 rounded-3xl border border-primary/15 bg-white p-8 shadow-sm md:grid-cols-5 md:p-10"
        :initial="{ opacity: 0, y: 30 }"
        :while-in-view="{ opacity: 1, y: 0 }"
        :in-view-options="{ once: true, amount: 0.15 }"
        :transition="{ duration: 0.8, ease: 'easeOut' }"
      >
        <div class="md:col-span-3">
          <h3 class="mb-3 text-xl font-bold text-accent">
            Kenapa ambang proximity 60%, bukan 70%?
          </h3>
          <p class="mb-3 text-sm leading-relaxed text-neutral-600">
            Untuk Creatinine, rentang Sedang resmi adalah
            <strong class="text-accent">1,7&ndash;1,9 mg/dL</strong> dan
            Berat dimulai dari
            <strong class="text-accent">2,0 mg/dL</strong>. Nilai
            <em>maksimum</em> yang mungkin dicapai di dalam rentang Sedang
            (1,9 mg/dL) hanya menempuh
            <strong class="text-primary">{{ (MAKS_PROXIMITY_TERCAPAI * 100).toFixed(1) }}%</strong>
            perjalanan menuju ambang Berat -- kalau threshold di-set 70%,
            sinyal ini secara matematis
            <strong>tidak akan pernah bisa menyala</strong>. Ambang 60%
            dipilih supaya berada sedikit di bawah batas maksimum itu,
            sehingga early detection benar-benar bisa aktif memberi
            peringatan bermakna.
          </p>
          <p class="mb-3 text-sm leading-relaxed text-neutral-600">
            Untuk 5 parameter kombinasi, ceritanya beda -- parameter ini
            tidak punya tier "Berat" numerik bertingkat seperti Creatinine
            (Berat kombo ditentukan lewat kelengkapan, bukan kedalaman),
            jadi tidak ada batas atas matematis alami. Minimal
            <strong class="text-accent">{{ COMBO_MIN_PARAMETERS }} parameter</strong>
            harus melebihi ambang bersamaan (bukan cuma 1 parameter
            menyimpang jauh sendirian), dan SELURUHNYA harus sama-sama
            <strong class="text-primary">&ge; {{ COMBO_MARGIN_THRESHOLD_PERCENT }}%</strong>
            di atas nilai rujukan aslinya -- kedua angka ini murni
            keputusan kebijakan klinis, bukan hasil turunan rumus.
          </p>
          <p class="flex items-start gap-2 text-sm text-neutral-500">
            <LucideSlidersHorizontal class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Ketiga nilai ambang ini tersimpan sebagai konfigurasi (bukan
            angka tetap di kode) -- dapat disetel ulang tanpa mengubah
            aplikasi kalau ada evaluasi klinis baru dari tenaga kesehatan.
          </p>
        </div>

        <div class="flex flex-col items-center justify-center gap-4 rounded-2xl bg-neutral-50 p-6 text-center md:col-span-2">
          <LucideCalculator class="h-8 w-8 text-primary" />
          <p class="text-sm text-neutral-600">
            Ingin lihat perhitungannya langsung pada contoh kasus nyata?
          </p>
          <button
            type="button"
            @click="openModal"
            class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-primary-600"
          >
            Coba Simulasi <LucideArrowRight class="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </div>

    <!-- Modal Simulasi -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
        @click.self="showModal = false"
      >
        <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
          <div class="flex items-center justify-between border-b border-neutral-100 px-6 py-5">
            <div class="flex items-center gap-2">
              <LucideFlaskConical class="h-5 w-5 text-primary" />
              <h3 class="text-lg font-bold text-accent">Simulasi Early Detection</h3>
            </div>
            <button type="button" @click="showModal = false" class="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600">
              <LucideX class="h-5 w-5" />
            </button>
          </div>

          <div class="space-y-5 px-6 py-6">
            <div class="grid grid-cols-2 gap-2 rounded-2xl bg-neutral-100 p-1">
              <button
                type="button"
                @click="simMode = 'creatinine'"
                class="rounded-xl px-3 py-2 text-xs font-bold transition-colors"
                :class="simMode === 'creatinine' ? 'bg-white text-primary shadow-sm' : 'text-neutral-500 hover:text-neutral-700'"
              >
                Creatinine (Proximity)
              </button>
              <button
                type="button"
                @click="simMode = 'combo'"
                class="rounded-xl px-3 py-2 text-xs font-bold transition-colors"
                :class="simMode === 'combo' ? 'bg-white text-primary shadow-sm' : 'text-neutral-500 hover:text-neutral-700'"
              >
                Kombinasi Parameter (Margin)
              </button>
            </div>

            <template v-if="simMode === 'creatinine'">
              <p class="text-sm text-neutral-500">
                Contoh: pasien dengan level risiko saat ini
                <span class="rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-700">Sedang</span>
                lewat jalur Creatinine. Geser nilai hasil lab untuk melihat
                kapan sistem menandainya sebagai "berpotensi memburuk".
              </p>

              <div>
                <div class="mb-2 flex items-center justify-between">
                  <label class="text-xs font-bold tracking-wide text-neutral-500 uppercase">Nilai Creatinine (mg/dL)</label>
                  <span class="font-mono text-lg font-bold text-accent">{{ simCreatinine.toFixed(2) }}</span>
                </div>
                <input
                  v-model.number="simCreatinine"
                  type="range"
                  min="1.70"
                  max="1.99"
                  step="0.01"
                  class="w-full accent-primary"
                />
                <div class="mt-1 flex justify-between text-[10px] text-neutral-400">
                  <span>1,70 (batas bawah Sedang)</span>
                  <span>1,99 (mendekati Berat)</span>
                </div>
              </div>

              <div class="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 font-mono text-xs leading-relaxed text-neutral-600">
                <div>proximity = (nilai &minus; ambang_bawah) / (ambang_berat &minus; ambang_bawah)</div>
                <div class="mt-1">
                  proximity = ({{ simCreatinine.toFixed(2) }} &minus; {{ AMBANG_SEDANG_BAWAH.toFixed(1) }}) / ({{ AMBANG_BERAT.toFixed(1) }} &minus; {{ AMBANG_SEDANG_BAWAH.toFixed(1) }})
                </div>
                <div class="mt-1">
                  proximity = {{ (simCreatinine - AMBANG_SEDANG_BAWAH).toFixed(2) }} / {{ (AMBANG_BERAT - AMBANG_SEDANG_BAWAH).toFixed(1) }}
                  = <strong class="text-accent">{{ simProximityPercent }}%</strong>
                </div>
              </div>

              <div
                class="flex items-start gap-3 rounded-2xl border p-4"
                :class="simFlagged ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'"
              >
                <LucideAlertTriangle v-if="simFlagged" class="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                <LucideCheckCircle2 v-else class="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p class="text-sm font-bold" :class="simFlagged ? 'text-rose-700' : 'text-emerald-700'">
                    {{ simProximityPercent }}% {{ simFlagged ? '≥' : '<' }} ambang {{ (PROXIMITY_THRESHOLD * 100).toFixed(0) }}%
                    &mdash; Early Detection {{ simFlagged ? 'AKTIF' : 'tidak aktif' }}
                  </p>
                  <p class="mt-1 text-xs" :class="simFlagged ? 'text-rose-600' : 'text-emerald-600'">
                    <template v-if="simFlagged">
                      Pasien tetap diklasifikasikan <strong>Sedang</strong>, tapi kondisinya sudah
                      {{ simProximityPercent }}% mendekati ambang Berat ({{ AMBANG_BERAT.toFixed(1) }} mg/dL) --
                      sistem menandai untuk pemantauan lebih intensif sebelum benar-benar menjadi Berat.
                    </template>
                    <template v-else>
                      Nilai masih cukup jauh dari ambang Berat -- belum ditandai sebagai
                      berpotensi memburuk. Geser slider ke kanan untuk melihat titik ambang aktif.
                    </template>
                  </p>
                </div>
              </div>
            </template>

            <template v-else-if="simMode === 'combo'">
              <p class="text-sm text-neutral-500">
                Contoh: 2 dari 5 parameter kombinasi (Gula Darah Puasa &amp;
                Cholesterol) sama-sama dinilai. Ubah nilainya untuk melihat
                kapan <strong>keduanya</strong> -- bukan cuma rata-ratanya --
                melewati ambang margin.
              </p>

              <div>
                <div class="mb-2 flex items-center justify-between">
                  <label class="text-xs font-bold tracking-wide text-neutral-500 uppercase">Gula Darah Puasa (mg/dL)</label>
                  <span class="font-mono text-lg font-bold text-accent">{{ comboGdp.value }}</span>
                </div>
                <input
                  v-model.number="comboGdp.value"
                  type="range"
                  min="120"
                  max="300"
                  step="5"
                  class="w-full accent-primary"
                />
                <div class="mt-1 flex justify-between text-[10px] text-neutral-400">
                  <span>120 (ambang rujukan)</span>
                  <span>300</span>
                </div>
              </div>

              <div>
                <div class="mb-2 flex items-center justify-between">
                  <label class="text-xs font-bold tracking-wide text-neutral-500 uppercase">Cholesterol (mg/dL)</label>
                  <span class="font-mono text-lg font-bold text-accent">{{ comboKolesterol.value }}</span>
                </div>
                <input
                  v-model.number="comboKolesterol.value"
                  type="range"
                  min="200"
                  max="400"
                  step="5"
                  class="w-full accent-primary"
                />
                <div class="mt-1 flex justify-between text-[10px] text-neutral-400">
                  <span>200 (ambang rujukan)</span>
                  <span>400</span>
                </div>
              </div>

              <div class="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 font-mono text-xs leading-relaxed text-neutral-600">
                <div>margin = (nilai &minus; ambang_rujukan) / ambang_rujukan &times; 100%</div>
                <div class="mt-1">
                  margin_gdp = ({{ comboGdp.value }} &minus; {{ comboGdp.ambang }}) / {{ comboGdp.ambang }}
                  = <strong class="text-accent">{{ simMarginGdp.toFixed(0) }}%</strong>
                </div>
                <div class="mt-1">
                  margin_kolesterol = ({{ comboKolesterol.value }} &minus; {{ comboKolesterol.ambang }}) / {{ comboKolesterol.ambang }}
                  = <strong class="text-accent">{{ simMarginKolesterol.toFixed(0) }}%</strong>
                </div>
                <div class="mt-1">
                  min(margin) = <strong class="text-accent">{{ simMarginMin.toFixed(0) }}%</strong>
                  &middot; rata-rata = {{ simMarginAverage.toFixed(0) }}%
                </div>
              </div>

              <div
                class="flex items-start gap-3 rounded-2xl border p-4"
                :class="simComboFlagged ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'"
              >
                <LucideAlertTriangle v-if="simComboFlagged" class="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                <LucideCheckCircle2 v-else class="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p class="text-sm font-bold" :class="simComboFlagged ? 'text-rose-700' : 'text-emerald-700'">
                    min(margin) {{ simMarginMin.toFixed(0) }}% {{ simComboFlagged ? '≥' : '<' }} ambang {{ COMBO_MARGIN_THRESHOLD_PERCENT }}%
                    &mdash; Early Detection {{ simComboFlagged ? 'AKTIF' : 'tidak aktif' }}
                  </p>
                  <p class="mt-1 text-xs" :class="simComboFlagged ? 'text-rose-600' : 'text-emerald-600'">
                    <template v-if="simComboFlagged">
                      Kedua parameter sama-sama sudah jauh di atas nilai rujukan
                      (minimum {{ simMarginMin.toFixed(0) }}%) -- sistem menandai
                      pasien ini berpotensi menuju Berat, bukan cuma karena 1
                      parameter yang melonjak sendirian.
                    </template>
                    <template v-else>
                      Salah satu parameter masih di bawah ambang margin
                      {{ COMBO_MARGIN_THRESHOLD_PERCENT }}% -- belum ditandai,
                      meski rata-ratanya bisa saja sudah terlihat tinggi.
                    </template>
                  </p>
                </div>
              </div>
            </template>
          </div>

          <div class="border-t border-neutral-100 px-6 py-4 text-right">
            <button
              type="button"
              @click="showModal = false"
              class="rounded-xl bg-neutral-100 px-5 py-2.5 text-sm font-bold text-neutral-600 transition-colors hover:bg-neutral-200"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>
