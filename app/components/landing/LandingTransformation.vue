<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { motion } from "motion-v";
// PERBAIKAN 1: Import semua icon yang digunakan, termasuk yang ada di dalam array
import {
  LucideTestTubes,
  LucideFileText,
  LucideArchiveX,
  LucideRefreshCw,
  LucideCpu,
  LucideUserCheck,
  LucideMap,
  LucideHouse,
  LucideChartPie,
  LucideChevronRight,
  LucideZap,
  LucideArrowRight,
} from "#components";

const beforeFlow = [
  { icon: LucideTestTubes, label: "Laboratorium" },
  { icon: LucideFileText, label: "Hasil Keluar" },
  { icon: LucideArchiveX, label: "Selesai (Arsip)" },
];

const afterFlow = [
  {
    icon: LucideRefreshCw,
    label: "Pembaruan Data",
    desc: "Otomatis menarik hasil tes terbaru.",
    highlight: "primary",
  },
  {
    icon: LucideCpu,
    label: "Analisis Risiko",
    desc: "Klasifikasi risiko secara medis.",
  },
  {
    icon: LucideUserCheck,
    label: "Penugasan Kader",
    desc: "Penentuan sasaran pelayanan.",
  },
  {
    icon: LucideMap,
    label: "Pemetaan Area",
    desc: "Penentuan area jangkauan tugas.",
  },
  {
    icon: LucideHouse,
    label: "Layanan Langsung",
    desc: "Kunjungan edukasi dan pencatatan.",
  },
  {
    icon: LucideChartPie,
    label: "Pemantauan Terpadu",
    desc: "Evaluasi hasil secara komprehensif.",
    highlight: "secondary",
  },
];

const riskLevels = [
  {
    level: "Ringan",
    color: "emerald",
    indikator: "Hanya nilai GDP (Gula Darah Puasa) di atas nilai rujukan",
  },
  {
    level: "Sedang",
    color: "amber",
    indikator:
      "Pemeriksaan GDP, Kolesterol Total, Trigliserida, dan LDL di atas nilai rujukan",
  },
  {
    level: "Berat",
    color: "rose",
    indikator:
      "Seluruh parameter (GDP > 120, Creatinine > 1.7, Cholesterol > 200, Trigliserida > 140, LDL > 130, Urea > 46) di atas nilai rujukan",
  },
];

const scrollContainer = ref<HTMLElement | null>(null);
let isTouching = false as any;

onMounted(() => {
  let animationFrameId: number;
  let currentScroll = 0;

  const step = () => {
    if (scrollContainer.value && window.innerWidth < 768 && !isTouching) {
      const el = scrollContainer.value;

      // Sinkronkan currentScroll dengan posisi aktual (jika user scroll manual)
      if (Math.abs(currentScroll - el.scrollLeft) > 2) {
        currentScroll = el.scrollLeft;
      }

      currentScroll += 0.5;
      el.scrollLeft = currentScroll;

      // Jika mentok kanan, reset ke awal dengan mulus
      if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 1) {
        currentScroll = 0;
        el.scrollLeft = 0;
      }
    }
    animationFrameId = requestAnimationFrame(step);
  };

  animationFrameId = requestAnimationFrame(step);

  onUnmounted(() => {
    cancelAnimationFrame(animationFrameId);
  });
});
</script>

<template>
  <section
    id="inovasi"
    class="border-t border-neutral-100 bg-white px-6 py-24 md:px-12 lg:px-24"
  >
    <div class="mx-auto max-w-7xl">
      <motion.div
        class="mx-auto mb-20 max-w-3xl text-center"
        :initial="{ opacity: 0, y: 30 }"
        :while-in-view="{ opacity: 1, y: 0 }"
        :in-view-options="{ once: true, amount: 0.15 }"
        :transition="{ duration: 0.8, ease: 'easeOut' }"
      >
        <h2 class="mb-6 text-3xl font-extrabold text-accent md:text-5xl">
          Mengubah Layanan
          <span class="font-light text-neutral-400">Pasif</span> menjadi
          <span class="text-primary">Proaktif</span>
        </h2>
        <p class="text-lg text-neutral-600">
          Pergeseran paradigma dari menunggu pasien sakit menjadi penjangkauan
          proaktif berbasis data objektif laboratorium.
        </p>
      </motion.div>

      <div class="relative mb-24">
        <!-- Sebelum -->
        <div class="mb-12">
          <div
            class="mb-4 text-sm font-bold tracking-widest text-neutral-400 uppercase"
          >
            Sistem Lama (Pasif)
          </div>
          <div
            class="flex w-full items-center rounded-2xl border border-neutral-100 bg-neutral-50 p-6"
          >
            <template v-for="(step, index) in beforeFlow" :key="step.label">
              <div class="flex flex-1 flex-col items-center opacity-60">
                <component
                  :is="step.icon"
                  class="mb-2 h-8 w-8 text-neutral-500"
                />
                <span class="text-xs font-semibold text-neutral-500">{{
                  step.label
                }}</span>
              </div>
              <template v-if="index < beforeFlow.length - 1">
                <div class="h-px w-12 bg-neutral-300" />
                <LucideChevronRight class="mx-2 h-4 w-4 text-neutral-400" />
              </template>
            </template>
          </div>
        </div>

        <!-- Sekarang -->
        <div>
          <div
            class="mb-4 flex items-center gap-2 text-sm font-bold tracking-widest text-primary uppercase"
          >
            <LucideZap class="h-4 w-4" /> KOPIPU Smart (Proaktif)
          </div>
          <!-- PERBAIKAN 2: lg:overflow-x-visible ditambahkan. pt-4 pl-4 -ml-4 ditambahkan agar elemen absolut (angka) tidak terpotong (clipped) oleh overflow-x-auto di mobile -->
          <div
            ref="scrollContainer"
            @touchstart="isTouching = true"
            @touchend="isTouching = false"
            class="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-8 pt-4 pl-4 -ml-4 lg:overflow-x-visible lg:m-0 lg:p-0"
          >
            <template v-for="(step, index) in afterFlow" :key="step.label">
              <!-- PERBAIKAN 3: shrink-0 untuk mobile, lg:flex-1 lg:shrink lg:w-auto untuk desktop agar tidak kepotong -->
              <motion.div
                class="relative w-[260px] shrink-0 snap-start rounded-2xl border p-5 lg:w-auto lg:flex-1 lg:shrink"
                :class="{
                  'border-2 border-primary/20 bg-white shadow-lg shadow-primary/5':
                    step.highlight === 'primary',
                  'border-2 border-secondary/30 bg-secondary/10 shadow-lg shadow-secondary/10':
                    step.highlight === 'secondary',
                  'border-neutral-200 bg-white hover:border-primary/50 transition-colors':
                    !step.highlight,
                }"
                :initial="{ opacity: 0, y: 30 }"
                :while-in-view="{ opacity: 1, y: 0 }"
                :in-view-options="{ once: true, amount: 0.3 }"
                :transition="{ duration: 0.5, delay: index * 0.08 }"
              >
                <div
                  class="absolute -top-3 -left-[2px] flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white shadow-md"
                  :class="
                    step.highlight === 'primary'
                      ? 'bg-primary'
                      : step.highlight === 'secondary'
                        ? 'bg-secondary'
                        : 'bg-neutral-800'
                  "
                >
                  {{ index + 1 }}
                </div>
                <component
                  :is="step.icon"
                  class="mb-3 h-8 w-8"
                  :class="
                    step.highlight === 'primary'
                      ? 'text-primary'
                      : step.highlight === 'secondary'
                        ? 'text-secondary'
                        : 'text-neutral-700'
                  "
                />
                <div class="mb-1 text-sm font-bold text-accent">
                  {{ step.label }}
                </div>
                <div class="text-xs text-neutral-500">{{ step.desc }}</div>
              </motion.div>
              <LucideArrowRight
                v-if="index < afterFlow.length - 1"
                class="hidden shrink-0 self-center text-neutral-300 lg:block"
              />
            </template>
          </div>
        </div>
      </div>

      <!-- Risk Classification Table -->
      <motion.div
        class="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm"
        :initial="{ opacity: 0, y: 30 }"
        :while-in-view="{ opacity: 1, y: 0 }"
        :in-view-options="{ once: true, amount: 0.15 }"
        :transition="{ duration: 0.8, ease: 'easeOut' }"
      >
        <div class="border-b border-neutral-100 bg-neutral-50 px-8 py-6">
          <h3 class="text-xl font-bold text-accent">
            Penilaian Risiko Otomatis
          </h3>
          <p class="mt-1 text-sm text-neutral-500">
            Sistem menganalisis indikator kesehatan dan mengelompokkan secara
            cerdas.
          </p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-left">
            <thead>
              <tr
                class="border-b border-neutral-200 bg-white text-xs tracking-wider text-neutral-500 uppercase"
              >
                <th class="px-8 py-4 font-semibold w-1/4">Tingkat Risiko</th>
                <th class="px-8 py-4 font-semibold">
                  Kriteria Penilaian Klinis
                </th>
              </tr>
            </thead>
            <tbody class="text-sm">
              <tr
                v-for="risk in riskLevels"
                :key="risk.level"
                class="border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
              >
                <td class="px-8 py-5">
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-bold"
                    :class="{
                      'bg-emerald-100 text-emerald-700 border-emerald-200':
                        risk.color === 'emerald',
                      'bg-amber-100 text-amber-700 border-amber-200':
                        risk.color === 'amber',
                      'bg-rose-100 text-rose-700 border-rose-200':
                        risk.color === 'rose',
                    }"
                  >
                    <span
                      class="h-1.5 w-1.5 rounded-full"
                      :class="{
                        'bg-emerald-500': risk.color === 'emerald',
                        'bg-amber-500': risk.color === 'amber',
                        'bg-rose-500 animate-pulse': risk.color === 'rose',
                      }"
                    />
                    {{ risk.level }}
                  </span>
                </td>
                <td class="px-8 py-5 font-medium text-neutral-600">
                  {{ risk.indikator }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  </section>
</template>
