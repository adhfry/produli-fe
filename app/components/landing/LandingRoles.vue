<script setup lang="ts">
import { motion } from 'motion-v'
// Port persis reference-landing-asli.html — 4 role, bullet list APA ADANYA dari referensi
// (termasuk "Heatmap"/"Kelola master data"/"Verifikasi laporan" yang belum diverifikasi ke kode).

const roles = [
  {
    key: 'dinas',
    name: 'Dinas Kesehatan',
    subtitle: 'Pimpinan Kabupaten',
    icon: 'LucideBuilding',
    titleColor: 'text-primary',
    title: 'Akses Dinas Kesehatan',
    items: [
      'Memantau rekapitulasi kesehatan Kabupaten',
      'Pemantauan sebaran wilayah berisiko tinggi',
      'Evaluasi kinerja seluruh Puskesmas',
      'Pengelolaan Data Wilayah & Indikator'
    ]
  },
  {
    key: 'puskesmas',
    name: 'Puskesmas',
    subtitle: 'Kepala Instansi',
    icon: 'LucideStore',
    titleColor: 'text-secondary',
    title: 'Akses Kepala Puskesmas',
    items: [
      'Pemantauan kinerja spesifik wilayah Puskesmas',
      'Melihat pencapaian petugas secara menyeluruh',
      'Pantauan data pasien prolanis per desa'
    ]
  },
  {
    key: 'pj',
    name: 'PJ Prolanis',
    subtitle: 'Koordinator Layanan',
    icon: 'LucideUsers',
    titleColor: 'text-purple-600',
    title: 'Akses PJ Prolanis',
    items: [
      'Terima pemberitahuan deteksi dini kesehatan',
      'Tugaskan kunjungan sasaran ke petugas',
      'Verifikasi keabsahan laporan lapangan',
      'Kelola informasi petugas dan sasaran area'
    ]
  },
  {
    key: 'kader',
    name: 'Kader',
    subtitle: 'Petugas Lapangan',
    icon: 'LucideUser',
    titleColor: 'text-amber-600',
    title: 'Akses Petugas Lapangan',
    items: [
      'Lihat daftar tugas layanan lapangan',
      'Penentuan Area Sasaran',
      'Pencatatan edukasi & dokumentasi valid',
      'Pencatatan lancar tanpa sinyal internet'
    ]
  }
]

const activeKey = ref('dinas')
const active = computed(() => roles.find((r) => r.key === activeKey.value)!)
</script>

<template>
  <section class="border-b border-neutral-200 bg-surface px-6 py-24 md:px-12 lg:px-24">
    <div class="mx-auto max-w-7xl">
      <motion.div
        class="mx-auto mb-16 max-w-2xl text-center"
        :initial="{ opacity: 0, y: 30 }"
        :while-in-view="{ opacity: 1, y: 0 }"
        :in-view-options="{ once: true, amount: 0.15 }"
        :transition="{ duration: 0.8, ease: 'easeOut' }"
      >
        <h2 class="mb-4 text-3xl font-bold text-accent">Hak Akses Terpadu</h2>
        <p class="text-neutral-600">Setiap tingkatan petugas memiliki akses informasi sesuai dengan peran dan tanggung jawabnya.</p>
      </motion.div>

      <div class="mb-8 grid gap-4 md:grid-cols-4">
        <button
          v-for="role in roles"
          :key="role.key"
          type="button"
          class="rounded-xl border bg-white p-4 text-left transition-all"
          :class="activeKey === role.key ? 'border-2 border-primary shadow-md' : 'border-neutral-200 opacity-70 hover:border-neutral-300 hover:opacity-100'"
          @click="activeKey = role.key"
        >
          <div class="font-bold text-accent">{{ role.name }}</div>
          <div class="text-xs text-neutral-500">{{ role.subtitle }}</div>
        </button>
      </div>

      <div class="min-h-[200px] rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div :key="active.key" class="animate-fade-in-up">
          <h3 class="mb-4 flex items-center gap-2 text-xl font-bold" :class="active.titleColor">
            <component :is="active.icon" class="h-5 w-5" /> {{ active.title }}
          </h3>
          <ul class="grid gap-3 md:grid-cols-2">
            <li v-for="item in active.items" :key="item" class="flex items-center gap-2 text-neutral-600">
              <LucideCheck class="h-4 w-4 text-secondary" /> {{ item }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
