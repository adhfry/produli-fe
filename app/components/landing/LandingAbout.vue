<script setup lang="ts">
import { motion } from "motion-v";
</script>

<template>
  <section
    id="tentang-inovasi"
    class="relative isolate overflow-hidden px-4 py-24 sm:px-6 lg:px-8"
  >
    <div
      class="pattern-dots pointer-events-none absolute inset-0 -z-10 opacity-40"
    />

    <div
      class="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-16"
    >
      <!-- Kiri: elemen visual dekoratif abstrak (bukan foto orang) -->
      <motion.div
        class="relative order-2 flex aspect-square items-center justify-center lg:order-1"
        :initial="{ opacity: 0, x: -24 }"
        :while-in-view="{ opacity: 1, x: 0 }"
        :in-view-options="{ once: true, amount: 0.4 }"
        :transition="{ duration: 0.6, ease: 'easeOut' }"
      >
        <div
          class="animate-blob absolute h-64 w-64 rounded-full bg-linear-to-br from-primary/30 to-secondary/30 blur-2xl"
        />
        <div
          class="glass-panel relative flex h-56 w-56 items-center justify-center rounded-full border border-white/50 shadow-2xl sm:h-72 sm:w-72"
        >
          <NuxtImg
            src="/logo/kopipu-smart-logo-remove-bg.png"
            alt=""
            width="180"
            height="180"
            class="h-32 w-32 object-contain sm:h-44 sm:w-44"
          />
        </div>
      </motion.div>

      <!-- Kanan: kutipan besar -->
      <motion.div
        class="order-1 lg:order-2"
        :initial="{ opacity: 0, x: 24 }"
        :while-in-view="{ opacity: 1, x: 0 }"
        :in-view-options="{ once: true, amount: 0.4 }"
        :transition="{ duration: 0.6, delay: 0.1, ease: 'easeOut' }"
      >
        <h2 class="mb-6 text-3xl font-bold text-accent">Tentang Inovasi</h2>
        <blockquote class="text-xl leading-relaxed text-neutral-600 italic">
          "<span class="font-bold">KOPIPU Smart</span> merupakan inovasi sistem
          pelayanan kesehatan yang digagas oleh Kepala Dinas Kesehatan P2KB
          Kabupaten Sumenep,
          <span class="font-bold">drg. Ellya Fardasah, M.Kes.</span>, sebagai
          upaya memperkuat pelayanan preventif. Inovasi ini hadir dengan
          tujuan utama untuk mewujudkan pelayanan kesehatan yang proaktif
          melalui kunjungan rumah berbasis data laboratorium dan pendekatan keluarga."
        </blockquote>
        <UButton
          to="/tentang-kami"
          size="lg"
          class="mt-8 rounded-full text-stone-50"
        >
          Baca Selengkapnya
          <LucideArrowRight class="h-4 w-4" />
        </UButton>
      </motion.div>
    </div>
  </section>
</template>
