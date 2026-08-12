<script setup lang="ts">
import { motion } from "motion-v";
// Port persis reference-landing-asli.html (Hero) — teks subtitle & angka mockup APA ADANYA
// dari referensi (belum tentu akurat), sesuai instruksi eksplisit user: tampilan dulu, isi
// dikoreksi belakangan.
//
// PENTING: section root WAJIB "isolate" (bukan cuma "relative") — position:relative TANPA
// z-index eksplisit TIDAK membuat stacking context baru, jadi -z-10/-z-20 di pattern-grid/
// animate-blob "lolos" ke ancestor terjauh (div.isolate milik @nuxt/ui di root app) dan
// tenggelam di bawah SEMUA konten halaman, bukan cuma di bawah section ini. Tanpa "isolate"
// di sini, dekorasi itu render tapi 100% tidak terlihat (bukan soal warna/opacity/blend-mode).

const checks = [
  "Integrasi Data Lab",
  "Layanan Preventif",
  "Akses Tanpa Sinyal",
  "Pemetaan Wilayah",
];
</script>

<template>
  <section
    id="beranda"
    class="relative isolate overflow-hidden px-6 pt-32 pb-20 md:px-12 lg:px-24 lg:pt-48 lg:pb-32"
  >
    <div
      class="pattern-grid pointer-events-none absolute inset-0 -z-20 opacity-50"
    />
    <div
      class="animate-blob pointer-events-none absolute top-20 right-0 -z-10 h-96 w-96 rounded-full bg-primary/20 opacity-70 mix-blend-multiply blur-3xl"
    />
    <div
      class="animate-blob pointer-events-none absolute top-40 right-40 -z-10 h-72 w-72 rounded-full bg-secondary/20 opacity-70 mix-blend-multiply blur-3xl"
      style="animation-delay: 2s"
    />

    <div
      class="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-8"
    >
      <!-- Left Text -->
      <motion.div
        class="max-w-2xl"
        :initial="{ opacity: 0, y: 30 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.8, ease: 'easeOut' }"
      >
        <div
          class="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-xs font-semibold tracking-wider text-primary uppercase"
        >
          <span class="h-2 w-2 animate-pulse rounded-full bg-primary" />
          Inovasi Kesehatan Digital
        </div>

        <h1
          class="mb-6 text-5xl leading-[1.1] font-extrabold tracking-tight text-accent lg:text-6xl"
        >
          Mewujudkan Pelayanan Kesehatan yang <br />
          <span
            class="bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent"
            >Proaktif.</span
          >
        </h1>

        <p class="mb-8 max-w-xl text-lg leading-relaxed text-neutral-600">
          PRODULI merupakan platform digital yang mendukung transformasi
          pelayanan kesehatan preventif berbasis data laboratorium — mewujudkan
          pelayanan kesehatan yang proaktif. Melalui
          analisis risiko otomatis, penugasan kader, dan pemantauan kunjungan
          secara real-time, sistem ini membantu tenaga kesehatan memberikan
          layanan yang lebih cepat, tepat sasaran, dan proaktif kepada
          masyarakat.
        </p>

        <div class="mb-10 flex flex-wrap items-center gap-4">
          <NuxtLink
            to="/auth/login"
            class="group flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 font-medium text-white shadow-lg shadow-primary/30 transition-all hover:bg-teal-700"
          >
            Masuk Sistem
            <LucideArrowRight
              class="h-4 w-4 transition-transform group-hover:translate-x-1"
            />
          </NuxtLink>
          <NuxtLink
            to="/#platform"
            class="rounded-full border border-neutral-200 bg-white px-8 py-3.5 font-medium text-neutral-700 shadow-sm transition-all hover:bg-neutral-50"
          >
            Pelajari Inovasi
          </NuxtLink>
        </div>

        <div
          class="grid grid-cols-2 gap-4 text-sm font-medium text-neutral-600 md:grid-cols-4"
        >
          <div
            v-for="check in checks"
            :key="check"
            class="flex items-center gap-2"
          >
            <LucideCircleCheckBig class="h-4 w-4 text-secondary" /> {{ check }}
          </div>
        </div>
      </motion.div>

      <!-- Right Mockups (CSS Art) -->
      <motion.div
        class="relative hidden h-[500px] md:block"
        :initial="{ opacity: 0, y: 30 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.8, ease: 'easeOut' }"
      >
        <!-- Desktop Mockup -->
        <div
          class="glass-panel absolute top-0 right-10 z-10 h-[320px] w-[480px] overflow-hidden rounded-xl border border-white/40 shadow-2xl transition-transform duration-500 hover:-translate-y-2"
        >
          <div
            class="flex h-10 items-center justify-between border-b border-neutral-200/50 bg-white/50 px-4"
          >
            <div class="flex gap-2">
              <div class="h-2.5 w-2.5 rounded-full bg-neutral-300" />
              <div class="h-2.5 w-2.5 rounded-full bg-neutral-300" />
              <div class="h-2.5 w-2.5 rounded-full bg-neutral-300" />
            </div>
            <div class="h-4 w-32 rounded-full bg-neutral-200" />
          </div>
          <div class="flex h-full">
            <div
              class="w-1/4 space-y-3 border-r border-neutral-200/50 bg-white/30 p-4"
            >
              <div class="h-4 w-full rounded bg-primary/20" />
              <div class="h-3 w-3/4 rounded bg-neutral-200" />
              <div class="h-3 w-5/6 rounded bg-neutral-200" />
              <div class="h-3 w-full rounded bg-neutral-200" />
            </div>
            <div class="w-3/4 space-y-4 p-5">
              <div class="flex gap-4">
                <div
                  class="h-20 flex-1 rounded-lg border border-neutral-100 bg-white/60 p-3 shadow-sm"
                >
                  <div class="mb-2 h-8 w-8 rounded bg-primary/10" />
                  <div class="mb-1 h-3 w-16 rounded bg-neutral-300" />
                  <div class="h-4 w-10 rounded bg-accent" />
                </div>
                <div
                  class="h-20 flex-1 rounded-lg border border-neutral-100 bg-white/60 p-3 shadow-sm"
                >
                  <div class="mb-2 h-8 w-8 rounded bg-danger/10" />
                  <div class="mb-1 h-3 w-16 rounded bg-neutral-300" />
                  <div class="h-4 w-10 rounded bg-accent" />
                </div>
              </div>
              <div
                class="flex h-32 items-end justify-between gap-2 rounded-lg border border-neutral-100 bg-white/60 p-4 shadow-sm"
              >
                <div class="h-[40%] w-full rounded-t bg-primary/80" />
                <div class="h-[70%] w-full rounded-t bg-primary/40" />
                <div class="h-[90%] w-full rounded-t bg-danger/80" />
                <div class="h-[50%] w-full rounded-t bg-primary/60" />
                <div class="h-[30%] w-full rounded-t bg-primary/30" />
              </div>
            </div>
          </div>
        </div>

        <!-- Mobile Mockup PWA -->
        <div
          class="absolute top-40 right-80 z-20 h-[400px] w-[200px] overflow-hidden rounded-[2rem] border-[6px] border-neutral-800 bg-white shadow-[0_20px_50px_rgb(15_23_42_/_0.2)] transition-transform duration-500 hover:-translate-y-2"
        >
          <div
            class="absolute inset-x-0 top-0 mx-auto h-6 w-1/2 rounded-b-xl bg-neutral-800"
          />
          <div class="h-full space-y-4 bg-neutral-50 p-4 pt-10">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-xs text-neutral-500">Kunjungan Hari Ini</div>
                <div class="text-sm font-bold text-accent">3 Pasien</div>
              </div>
              <div
                class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"
              >
                <LucideMapPin class="h-4 w-4" />
              </div>
            </div>
            <div class="relative h-32 overflow-hidden rounded-xl bg-teal-100">
              <div class="pattern-grid absolute inset-0 opacity-30" />
              <div
                class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              >
                <div
                  class="h-4 w-4 animate-pulse rounded-full border-2 border-white bg-primary shadow"
                />
              </div>
            </div>
            <div
              class="rounded-xl border border-neutral-100 bg-white p-3 shadow-sm"
            >
              <div class="mb-2 flex items-start justify-between">
                <div class="h-3 w-20 rounded bg-neutral-800" />
                <span
                  class="rounded bg-danger/10 px-2 py-0.5 text-[10px] font-bold text-danger"
                  >Risiko Tinggi</span
                >
              </div>
              <div class="mb-4 h-2 w-32 rounded bg-neutral-300" />
              <div class="h-8 w-full rounded-lg bg-primary" />
            </div>
          </div>
        </div>

        <!-- Floating Element -->
        <div
          class="glass-panel animate-bounce absolute right-0 bottom-10 z-30 flex items-center gap-3 rounded-xl border border-white/60 px-4 py-3 shadow-lg"
        >
          <div
            class="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 text-secondary"
          >
            <LucideShieldCheck class="h-5 w-5" />
          </div>
          <div>
            <div class="text-xs font-medium text-neutral-500">Status Data</div>
            <div class="text-sm font-bold text-accent">
              Tersinkronisasi 100%
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
</template>
