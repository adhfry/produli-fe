<script setup lang="ts">
import { motion } from "motion-v";
// Port persis reference-landing-asli.html — radius 50m & deskripsi Face Detection APA ADANYA
// dari referensi (belum dikoreksi ke 150m/3000m atau catatan "opsional").
</script>

<template>
  <!-- Kontras gelap SENGAJA 1 section saja (docs/planning/06 §6) -->
  <section
    id="keamanan"
    class="relative isolate overflow-hidden bg-accent px-6 py-24 text-white md:px-12 lg:px-24"
  >
    <div
      class="pattern-grid pointer-events-none absolute inset-0 top-0 left-0 h-full w-full opacity-10"
    />
    <div
      class="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary opacity-30 mix-blend-screen blur-[100px]"
    />
    <div
      class="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-secondary opacity-20 mix-blend-screen blur-[100px]"
    />

    <div class="relative z-10 mx-auto max-w-7xl">
      <motion.div
        class="mx-auto mb-16 max-w-2xl text-center"
        :initial="{ opacity: 0, y: 30 }"
        :while-in-view="{ opacity: 1, y: 0 }"
        :in-view-options="{ once: true, amount: 0.15 }"
        :transition="{ duration: 0.8, ease: 'easeOut' }"
      >
        <LucideShieldAlert class="mx-auto mb-6 h-12 w-12 text-primary" />
        <h2 class="mb-4 text-3xl font-bold md:text-5xl">
          Keamanan & Privasi Terjamin
        </h2>
        <p class="text-neutral-400">
          Arsitektur keamanan yang dirancang untuk melindungi data medis
          sensitif dan mencegah manipulasi pelaporan di lapangan.
        </p>
      </motion.div>

      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <!-- Card 1 (Large) -->
        <motion.div
          class="glass-dark group col-span-2 row-span-2 rounded-3xl p-8 transition-colors hover:border-primary/50"
          :initial="{ opacity: 0, y: 30 }"
          :while-in-view="{ opacity: 1, y: 0 }"
          :in-view-options="{ once: true, amount: 0.15 }"
          :transition="{ duration: 0.8, ease: 'easeOut' }"
        >
          <div class="flex h-full flex-col justify-between">
            <div>
              <LucideMap
                class="shadow-glow mb-4 h-10 w-10 rounded-full text-primary"
              />
              <h3 class="mb-2 text-2xl font-bold">Validasi Lokasi Geografis</h3>
              <p class="text-sm text-neutral-400">
                Sistem mendeteksi dan memvalidasi kecocokan koordinat kunjungan
                dengan area domisili untuk menjamin keaslian data.
              </p>
            </div>
            <div
              class="relative mt-8 h-24 overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800/50"
            >
              <div
                class="absolute top-1/2 left-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-primary/50 bg-primary/20"
              >
                <div class="shadow-glow h-2 w-2 rounded-full bg-primary" />
              </div>
            </div>
          </div>
        </motion.div>

        <!-- Card 2 -->
        <motion.div
          class="glass-dark group rounded-3xl p-6 transition-colors hover:border-secondary/50"
          :initial="{ opacity: 0, y: 30 }"
          :while-in-view="{ opacity: 1, y: 0 }"
          :in-view-options="{ once: true, amount: 0.15 }"
          :transition="{ duration: 0.8, ease: 'easeOut' }"
        >
          <LucideCamera class="mb-4 h-8 w-8 text-secondary" />
          <h3 class="mb-1 text-lg font-bold">Kamera Terintegrasi</h3>
          <p class="text-xs text-neutral-400">
            Mencegah unggahan laporan lama.
          </p>
        </motion.div>

        <!-- Card 3 -->
        <motion.div
          class="glass-dark group rounded-3xl p-6 transition-colors hover:border-purple-500/50"
          :initial="{ opacity: 0, y: 30 }"
          :while-in-view="{ opacity: 1, y: 0 }"
          :in-view-options="{ once: true, amount: 0.15 }"
          :transition="{ duration: 0.8, ease: 'easeOut' }"
        >
          <LucideFingerprintPattern class="mb-4 h-8 w-8 text-purple-400" />
          <h3 class="mb-1 text-lg font-bold">Tanda Terenkripsi</h3>
          <p class="text-xs text-neutral-400">
            Mencetak waktu dan lokasi akurat pada laporan.
          </p>
        </motion.div>

        <!-- Card 4 -->
        <motion.div
          class="glass-dark group rounded-3xl p-6 transition-colors hover:border-blue-400/50"
          :initial="{ opacity: 0, y: 30 }"
          :while-in-view="{ opacity: 1, y: 0 }"
          :in-view-options="{ once: true, amount: 0.15 }"
          :transition="{ duration: 0.8, ease: 'easeOut' }"
        >
          <LucideFileCode class="mb-4 h-8 w-8 text-blue-400" />
          <h3 class="mb-1 text-lg font-bold">Integritas Data</h3>
          <p class="text-xs text-neutral-400">
            Informasi pendukung rekam medis dikunci.
          </p>
        </motion.div>

        <!-- Card 5 -->
        <motion.div
          class="glass-dark group rounded-3xl p-6 transition-colors hover:border-pink-500/50"
          :initial="{ opacity: 0, y: 30 }"
          :while-in-view="{ opacity: 1, y: 0 }"
          :in-view-options="{ once: true, amount: 0.15 }"
          :transition="{ duration: 0.8, ease: 'easeOut' }"
        >
          <LucideScanFace class="mb-4 h-8 w-8 text-pink-400" />
          <h3 class="mb-1 text-lg font-bold">Verifikasi Petugas</h3>
          <p class="text-xs text-neutral-400">
            Memastikan kader yang melaporkan adalah petugas berwenang.
          </p>
        </motion.div>

        <!-- Card 6 -->
        <motion.div
          class="glass-dark group col-span-2 flex items-center gap-6 rounded-3xl p-6 transition-colors hover:border-amber-500/50 md:col-span-1 lg:col-span-2"
          :initial="{ opacity: 0, y: 30 }"
          :while-in-view="{ opacity: 1, y: 0 }"
          :in-view-options="{ once: true, amount: 0.15 }"
          :transition="{ duration: 0.8, ease: 'easeOut' }"
        >
          <div class="rounded-full bg-neutral-800 p-4 text-warning">
            <LucideWifiOff class="h-8 w-8" />
          </div>
          <div>
            <h3 class="mb-1 text-xl font-bold">
              Penyimpanan Sementara Terlindungi
            </h3>
            <p class="text-sm text-neutral-400">
              Data laporan tetap aman meskipun perangkat berada di luar
              jaringan, dan akan disinkronisasikan secara rahasia.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
</template>
