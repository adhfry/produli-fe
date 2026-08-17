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
    title: "Tingkat Kedekatan terhadap Ambang Berat (Proximity)",
    forWhom: "Khusus untuk parameter bertingkat, seperti Creatinine",
    desc: "Menghitung posisi nilai pasien di dalam rentang Sedang sebagai persentase menuju ambang Berat berikutnya. Merupakan satu parameter penting yang dinilai secara terpisah dari kombinasi parameter lain, dan ambang penilaiannya tidak pernah dilonggarkan.",
    formula: "proximity = (nilai - ambang_bawah) / (ambang_berat - ambang_bawah)",
  },
  {
    icon: LucideLayers,
    title: "Margin Kombinasi Parameter",
    forWhom: "Untuk lima parameter kombinasi (Gula Darah Puasa, Cholesterol, Trigliserida, LDL, dan Urea)",
    desc: "Penilaian tidak lagi didasarkan semata-mata pada jumlah parameter yang melebihi ambang. Sekurang-kurangnya tiga parameter harus melebihi ambang secara bersamaan, dengan mewajibkan keberadaan Gula Darah Puasa, LDL, dan Trigliserida (pemeriksaan yang dinilai paling signifikan secara klinis; Cholesterol dan Urea berperan sebagai pelengkap yang bersifat opsional). Seluruh parameter tersebut, bukan hanya rata-ratanya, harus sama-sama berada jauh di atas nilai rujukan, sehingga tidak terjadi kondisi satu parameter menyimpang signifikan sementara parameter lainnya masih mendekati ambang.",
    formula: "hitung(margin) ≥ min_parameter DAN min(margin) ≥ ambang_margin",
  },
  {
    icon: LucideTrendingUp,
    title: "Tren Memburuk Berturut-turut",
    forWhom: "Berlaku untuk parameter apa pun yang memiliki riwayat pemeriksaan",
    desc: "Nilai suatu parameter menunjukkan kenaikan berturut-turut pada tiga pemeriksaan terakhir, meskipun tingkat risikonya sendiri belum mengalami perubahan.",
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

// config('produli.early_detection.combo_min_parameters' / 'combo_margin_threshold_percent' /
// 'combo_required_parameters')
const COMBO_MIN_PARAMETERS = 3;
const COMBO_MARGIN_THRESHOLD_PERCENT = 50;
const COMBO_REQUIRED_PARAMETERS = "Gula Darah Puasa, LDL, Trigliserida";

const showModal = ref(false);
const simMode = ref<"creatinine" | "combo">("creatinine");
const simCreatinine = ref(1.89); // contoh bawaan, persis kasus nyata yang ditemukan saat pengujian

const simProximity = computed(() => {
  const raw = (simCreatinine.value - AMBANG_SEDANG_BAWAH) / (AMBANG_BERAT - AMBANG_SEDANG_BAWAH);
  return Math.max(0, Math.min(1, raw));
});
const simProximityPercent = computed(() => Math.round(simProximity.value * 1000) / 10);
const simFlagged = computed(() => simProximity.value >= PROXIMITY_THRESHOLD);

// Simulasi Margin Kombinasi -- 3 parameter wajib (Gula Darah Puasa, LDL, Trigliserida), persis
// combo_required_parameters bawaan. Margin = (nilai - ambang) / ambang * 100, SELURUH parameter
// yang diikutkan harus >= ambang margin, bukan cuma rata-ratanya (lihat evaluateComboMargin()).
const comboGdp = ref({ value: 180, ambang: 130 }); // Gula Darah Puasa mg/dL
const comboLdl = ref({ value: 195, ambang: 130 }); // LDL mg/dL
const comboTrigliserida = ref({ value: 225, ambang: 150 }); // Trigliserida mg/dL

function marginPercent(value: number, ambang: number): number {
  return ((value - ambang) / ambang) * 100;
}

const simMarginGdp = computed(() => Math.max(0, marginPercent(comboGdp.value.value, comboGdp.value.ambang)));
const simMarginLdl = computed(() => Math.max(0, marginPercent(comboLdl.value.value, comboLdl.value.ambang)));
const simMarginTrigliserida = computed(() => Math.max(0, marginPercent(comboTrigliserida.value.value, comboTrigliserida.value.ambang)));
const simMarginMin = computed(() => Math.min(simMarginGdp.value, simMarginLdl.value, simMarginTrigliserida.value));
const simMarginAverage = computed(() => (simMarginGdp.value + simMarginLdl.value + simMarginTrigliserida.value) / 3);
const simComboFlagged = computed(() => simMarginMin.value >= COMBO_MARGIN_THRESHOLD_PERCENT);

function openModal() {
  simMode.value = "creatinine";
  simCreatinine.value = 1.89;
  comboGdp.value = { value: 180, ambang: 130 };
  comboLdl.value = { value: 195, ambang: 130 };
  comboTrigliserida.value = { value: 225, ambang: 150 };
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
          <span class="text-primary">Berisiko Memburuk</span>
        </h2>
        <p class="text-lg text-neutral-600">
          Tidak sekadar mengelompokkan pasien ke dalam kategori Ringan,
          Sedang, atau Berat, sistem ini turut menandai pasien dengan
          klasifikasi Sedang yang kondisinya telah mendekati ambang Berat,
          berdasarkan tiga kaidah objektif (rule-based), bukan berdasarkan
          prediksi model machine learning yang bersifat tertutup (black box).
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
            Mengapa Ambang Proximity Ditetapkan pada 60%, Bukan 70%?
          </h3>
          <p class="mb-3 text-sm leading-relaxed text-neutral-600">
            Rentang klasifikasi Sedang resmi untuk parameter Creatinine adalah
            <strong class="text-accent">1,7&ndash;1,9 mg/dL</strong>, sedangkan
            klasifikasi Berat dimulai pada
            <strong class="text-accent">2,0 mg/dL</strong>. Nilai
            <em>maksimum</em> yang dapat dicapai di dalam rentang Sedang
            (1,9 mg/dL) hanya menempuh
            <strong class="text-primary">{{ (MAKS_PROXIMITY_TERCAPAI * 100).toFixed(1) }}%</strong>
            dari jarak menuju ambang Berat. Apabila ambang ditetapkan pada
            70%, sinyal ini secara matematis
            <strong>tidak akan pernah dapat teraktivasi</strong>. Ambang 60%
            dipilih agar berada sedikit di bawah batas maksimum tersebut,
            sehingga fitur deteksi dini dapat benar-benar aktif memberikan
            peringatan yang bermakna.
          </p>
          <p class="mb-3 text-sm leading-relaxed text-neutral-600">
            Ketentuan untuk kelima parameter kombinasi bersifat berbeda.
            Parameter-parameter ini tidak memiliki tingkatan "Berat" numerik
            bertingkat sebagaimana Creatinine (klasifikasi Berat pada
            kombinasi parameter ditentukan melalui kelengkapan, bukan
            kedalaman nilai), sehingga tidak terdapat batas atas matematis
            yang alami. Sekurang-kurangnya
            <strong class="text-accent">{{ COMBO_MIN_PARAMETERS }} parameter</strong>
            harus melebihi ambang secara bersamaan, dengan mewajibkan
            keberadaan
            <strong class="text-accent">{{ COMBO_REQUIRED_PARAMETERS }}</strong>
            (pemeriksaan yang dinilai paling signifikan secara klinis;
            Cholesterol dan Urea berperan sebagai pelengkap opsional), dan
            seluruh parameter tersebut harus berada
            <strong class="text-primary">&ge; {{ COMBO_MARGIN_THRESHOLD_PERCENT }}%</strong>
            di atas nilai rujukan. Ketiga nilai ambang ini merupakan
            keputusan kebijakan klinis, bukan hasil turunan suatu rumus
            matematis.
          </p>
          <p class="flex items-start gap-2 text-sm text-neutral-500">
            <LucideSlidersHorizontal class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Seluruh nilai ambang tersimpan sebagai konfigurasi, bukan angka
            tetap di dalam kode program, sehingga dapat disesuaikan kembali
            tanpa perlu mengubah aplikasi apabila terdapat evaluasi klinis
            terbaru dari tenaga kesehatan.
          </p>
        </div>

        <div class="flex flex-col items-center justify-center gap-4 rounded-2xl bg-neutral-50 p-6 text-center md:col-span-2">
          <LucideCalculator class="h-8 w-8 text-primary" />
          <p class="text-sm text-neutral-600">
            Ingin melihat perhitungannya secara langsung pada contoh kasus nyata?
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
              <h3 class="text-lg font-bold text-accent">Simulasi Smart Early Detection</h3>
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
                Contoh: pasien dengan tingkat risiko saat ini berada pada
                klasifikasi
                <span class="rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-700">Sedang</span>
                melalui jalur Creatinine. Geser nilai hasil laboratorium
                untuk mengetahui kapan sistem menandainya sebagai
                berpotensi memburuk.
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
                      Pasien tetap diklasifikasikan sebagai <strong>Sedang</strong>, namun
                      kondisinya telah mendekati ambang Berat sebesar {{ simProximityPercent }}%
                      ({{ AMBANG_BERAT.toFixed(1) }} mg/dL). Sistem menandai pasien tersebut untuk
                      pemantauan yang lebih intensif sebelum kondisinya benar-benar berkembang
                      menjadi Berat.
                    </template>
                    <template v-else>
                      Nilai tersebut masih cukup jauh dari ambang Berat sehingga belum ditandai
                      sebagai berpotensi memburuk. Geser penggeser ke kanan untuk melihat titik
                      ambang aktif.
                    </template>
                  </p>
                </div>
              </div>
            </template>

            <template v-else-if="simMode === 'combo'">
              <p class="text-sm text-neutral-500">
                Contoh: tiga parameter wajib (Gula Darah Puasa, LDL, dan
                Trigliserida) dinilai secara bersamaan. Ubah nilainya untuk
                mengetahui kapan <strong>ketiganya</strong>, bukan hanya
                rata-ratanya, melampaui ambang margin.
              </p>

              <div>
                <div class="mb-2 flex items-center justify-between">
                  <label class="text-xs font-bold tracking-wide text-neutral-500 uppercase">Gula Darah Puasa (mg/dL)</label>
                  <span class="font-mono text-lg font-bold text-accent">{{ comboGdp.value }}</span>
                </div>
                <input
                  v-model.number="comboGdp.value"
                  type="range"
                  min="130"
                  max="300"
                  step="5"
                  class="w-full accent-primary"
                />
                <div class="mt-1 flex justify-between text-[10px] text-neutral-400">
                  <span>130 (ambang rujukan)</span>
                  <span>300</span>
                </div>
              </div>

              <div>
                <div class="mb-2 flex items-center justify-between">
                  <label class="text-xs font-bold tracking-wide text-neutral-500 uppercase">LDL (mg/dL)</label>
                  <span class="font-mono text-lg font-bold text-accent">{{ comboLdl.value }}</span>
                </div>
                <input
                  v-model.number="comboLdl.value"
                  type="range"
                  min="130"
                  max="300"
                  step="5"
                  class="w-full accent-primary"
                />
                <div class="mt-1 flex justify-between text-[10px] text-neutral-400">
                  <span>130 (ambang rujukan)</span>
                  <span>300</span>
                </div>
              </div>

              <div>
                <div class="mb-2 flex items-center justify-between">
                  <label class="text-xs font-bold tracking-wide text-neutral-500 uppercase">Trigliserida (mg/dL)</label>
                  <span class="font-mono text-lg font-bold text-accent">{{ comboTrigliserida.value }}</span>
                </div>
                <input
                  v-model.number="comboTrigliserida.value"
                  type="range"
                  min="150"
                  max="350"
                  step="5"
                  class="w-full accent-primary"
                />
                <div class="mt-1 flex justify-between text-[10px] text-neutral-400">
                  <span>150 (ambang rujukan)</span>
                  <span>350</span>
                </div>
              </div>

              <div class="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 font-mono text-xs leading-relaxed text-neutral-600">
                <div>margin = (nilai &minus; ambang_rujukan) / ambang_rujukan &times; 100%</div>
                <div class="mt-1">
                  margin_gdp = ({{ comboGdp.value }} &minus; {{ comboGdp.ambang }}) / {{ comboGdp.ambang }}
                  = <strong class="text-accent">{{ simMarginGdp.toFixed(0) }}%</strong>
                </div>
                <div class="mt-1">
                  margin_ldl = ({{ comboLdl.value }} &minus; {{ comboLdl.ambang }}) / {{ comboLdl.ambang }}
                  = <strong class="text-accent">{{ simMarginLdl.toFixed(0) }}%</strong>
                </div>
                <div class="mt-1">
                  margin_trigliserida = ({{ comboTrigliserida.value }} &minus; {{ comboTrigliserida.ambang }}) / {{ comboTrigliserida.ambang }}
                  = <strong class="text-accent">{{ simMarginTrigliserida.toFixed(0) }}%</strong>
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
                      Ketiga parameter berada jauh di atas nilai rujukan
                      (margin minimum {{ simMarginMin.toFixed(0) }}%). Sistem menandai
                      pasien tersebut berpotensi menuju klasifikasi Berat, bukan
                      disebabkan oleh satu parameter yang melonjak secara tersendiri.
                    </template>
                    <template v-else>
                      Salah satu parameter masih berada di bawah ambang margin
                      {{ COMBO_MARGIN_THRESHOLD_PERCENT }}% sehingga belum ditandai,
                      meskipun rata-ratanya dapat saja tampak tinggi.
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
