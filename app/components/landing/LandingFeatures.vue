<script setup lang="ts">
import { motion } from "motion-v";
// PERBAIKAN: Import ikon secara eksplisit dari virtual module Nuxt
import {
  LucideFlaskConical,
  LucideMapPin,
  LucideChartColumn,
  LucideSmartphone,
  LucideLock,
  LucideZap,
} from "#components";

const cards = [
  {
    icon: LucideFlaskConical,
    title: "Health Preventive",
    description:
      "Tindakan pencegahan dan pelayanan aktif berdasarkan bukti dari hasil tes, bukan hanya bereaksi setelah keluhan muncul.",
    badge: "bg-teal-50 text-primary",
  },
  {
    icon: LucideMapPin,
    title: "Pemetaan Jangkauan",
    description:
      "Sistem mencatat lokasi distribusi penugasan untuk memastikan jangkauan pelayanan kesehatan lebih merata di seluruh wilayah.",
    badge: "bg-emerald-50 text-secondary",
  },
  {
    icon: LucideChartColumn,
    title: "Pusat Informasi Terpadu",
    description:
      "Pemantauan visual sebaran risiko kesehatan masyarakat dan kinerja layanan dari tingkat Kabupaten hingga ke pelosok Puskesmas.",
    badge: "bg-purple-50 text-purple-600",
  },
  {
    icon: LucideSmartphone,
    title: "Akses Tanpa Hambatan",
    description:
      "Petugas tetap bisa melakukan pencatatan saat berada di wilayah terpencil tanpa koneksi internet yang memadai.",
    badge: "bg-amber-50 text-warning",
  },
  {
    icon: LucideLock,
    title: "Privasi Data Medis",
    description:
      "Keamanan tingkat tinggi untuk melindungi kerahasiaan informasi pasien dan memastikan integritas data tetap terjaga.",
    badge: "bg-neutral-900 text-white shadow-glow",
  },
  {
    icon: LucideZap,
    title: "Pemantauan Sigap",
    description:
      "Setiap perkembangan status kesehatan di lapangan dapat langsung dipantau untuk pengambilan keputusan medis yang lebih cepat.",
    badge: "bg-rose-50 text-rose-500",
  },
];
</script>

<template>
  <section
    id="platform"
    class="pattern-dots relative isolate bg-surface px-6 py-24 md:px-12 lg:px-24"
  >
    <div class="mx-auto max-w-7xl">
      <motion.div
        class="mx-auto mb-16 max-w-2xl text-center"
        :initial="{ opacity: 0, y: 30 }"
        :while-in-view="{ opacity: 1, y: 0 }"
        :in-view-options="{ once: true, amount: 0.15 }"
        :transition="{ duration: 0.8, ease: 'easeOut' }"
      >
        <h2
          class="mb-3 text-sm font-semibold tracking-wide text-primary uppercase"
        >
          Inovasi Pelayanan Publik
        </h2>
        <h3 class="mb-4 text-3xl font-bold text-accent md:text-4xl">
          Membangun Ekosistem Kesehatan Terpadu
        </h3>
        <p class="text-neutral-600">
          Sistem terpadu yang menghubungkan data kesehatan dengan penanganan
          di lapangan secara cepat, akurat, dan rahasia.
        </p>
      </motion.div>

      <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <motion.div
          v-for="(card, index) in cards"
          :key="card.title"
          class="group rounded-2xl border border-neutral-100 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
          :initial="{ opacity: 0, y: 30 }"
          :while-in-view="{ opacity: 1, y: 0 }"
          :in-view-options="{ once: true, amount: 0.15 }"
          :transition="{ duration: 0.8, ease: 'easeOut', delay: index * 0.1 }"
        >
          <div
            class="mb-6 flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
            :class="card.badge"
          >
            <!-- Render komponen langsung -->
            <component :is="card.icon" class="h-6 w-6" />
          </div>
          <h4 class="mb-3 text-xl font-bold text-accent">{{ card.title }}</h4>
          <p class="text-sm leading-relaxed text-neutral-600">
            {{ card.description }}
          </p>
        </motion.div>
      </div>
    </div>
  </section>
</template>
