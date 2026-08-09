<script setup lang="ts">
import { motion } from 'motion-v'
// Port persis reference-landing-asli.html — termasuk "Integrasi SATUSEHAT Kemenkes" & tahun
// spesifik yang BELUM PERNAH dikonfirmasi di dokumen proyek manapun. Tampilan dulu sesuai
// instruksi eksplisit user, isi menyusul dikoreksi kalau/kapan dikonfirmasi.
const milestones = [
  {
    year: 'Fase 1',
    title: 'Penerapan & Uji Coba Terpadu',
    desc: 'Pengujian sistem secara menyeluruh di fasilitas kesehatan percontohan untuk memastikan kelancaran operasional petugas di lapangan.',
    dot: 'bg-primary shadow-sm',
    yearColor: 'text-primary'
  },
  {
    year: 'Fase 2',
    title: 'Perluasan Jangkauan Layanan',
    desc: 'Penerapan sistem ke seluruh wilayah untuk mendukung petugas kesehatan dalam memberikan edukasi dan pemantauan proaktif secara berkesinambungan.',
    dot: 'bg-neutral-300',
    yearColor: 'text-neutral-500'
  },
  {
    year: 'Fase 3',
    title: 'Penguatan Integrasi Data',
    desc: 'Penyelarasan data dengan sistem informasi kesehatan daerah maupun nasional guna memperkuat landasan pengambilan kebijakan pelayanan.',
    dot: 'bg-neutral-300',
    yearColor: 'text-neutral-500'
  },
  {
    year: 'Fase 4',
    title: 'Inovasi Berkelanjutan',
    desc: 'Pengembangan fitur dan layanan berdasarkan masukan dari masyarakat serta petugas kesehatan demi kualitas pelayanan yang semakin optimal.',
    dot: 'bg-secondary shadow-glow',
    yearColor: 'text-secondary'
  }
]
</script>

<template>
  <section class="border-t border-neutral-200 bg-surface px-6 py-24 md:px-12 lg:px-24">
    <div class="mx-auto max-w-4xl">
      <motion.h2
        class="mb-16 text-center text-3xl font-bold text-accent"
        :initial="{ opacity: 0, y: 30 }"
        :while-in-view="{ opacity: 1, y: 0 }"
        :in-view-options="{ once: true, amount: 0.15 }"
        :transition="{ duration: 0.8, ease: 'easeOut' }"
      >
        Roadmap Integrasi &amp; Pengembangan
      </motion.h2>

      <div class="relative ml-3 space-y-12 border-l-2 border-neutral-200 md:ml-6">
        <motion.div
          v-for="(item, index) in milestones"
          :key="item.year"
          class="relative pl-8"
          :initial="{ opacity: 0, y: 30 }"
          :while-in-view="{ opacity: 1, y: 0 }"
          :in-view-options="{ once: true, amount: 0.15 }"
          :transition="{ duration: 0.8, ease: 'easeOut', delay: index * 0.1 }"
        >
          <div class="absolute top-1 -left-[9px] h-4 w-4 rounded-full border-4 border-white" :class="item.dot" />
          <div class="mb-1 text-sm font-bold" :class="item.yearColor">{{ item.year }}</div>
          <h4 class="mb-2 text-lg font-bold text-accent">{{ item.title }}</h4>
          <p class="text-sm text-neutral-600">{{ item.desc }}</p>
        </motion.div>
      </div>
    </div>
  </section>
</template>
