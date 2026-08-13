<script setup lang="ts">
import { motion } from "motion-v";
import { PANDUAN_ROLES } from "~/utils/panduan-roles";

definePageMeta({ layout: "public" });

const title = "Panduan Pengguna";
const description =
  "Panduan lengkap penggunaan PRODULI untuk Admin Puskesmas, PJ Prolanis, Tenaga Kesehatan, dan Kader — langkah demi langkah, bahasa sederhana.";

useSeoMeta({
  title,
  description,
  ogTitle: `${title} — PRODULI`,
  ogDescription: description,
  twitterTitle: `${title} — PRODULI`,
  twitterDescription: description,
});
</script>

<template>
  <div
    class="bg-surface text-neutral-800 selection:bg-primary selection:text-white"
  >
    <PublicHeader />
    <main class="overflow-hidden py-24">
      <!-- Header -->
      <section class="bg-white px-6 py-24 md:px-12 lg:px-24">
        <div class="mx-auto max-w-3xl text-center">
          <motion.div
            :initial="{ opacity: 0, y: 30 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ duration: 0.8, ease: 'easeOut' }"
          >
            <p
              class="mb-3 text-sm font-semibold tracking-wide text-primary uppercase"
            >
              Bantuan &amp; Panduan
            </p>
            <h1
              class="mb-6 text-4xl font-extrabold text-accent md:text-5xl lg:text-6xl"
            >
              Panduan Pengguna
              <span
                class="bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent"
                >PRODULI</span
              >
            </h1>
            <p class="mx-auto max-w-2xl text-lg text-neutral-600">
              Pilih peran Anda di bawah untuk melihat panduan lengkap —
              mulai dari cara mendapatkan akun sampai semua yang bisa
              dilakukan, dijelaskan langkah demi langkah tanpa istilah
              teknis.
            </p>
          </motion.div>
        </div>
      </section>

      <!-- Grid Kartu Peran -->
      <section class="bg-surface px-6 py-16 md:px-12 lg:px-24">
        <div class="mx-auto max-w-5xl">
          <div class="grid gap-5 sm:grid-cols-2">
            <PanduanRoleCard
              v-for="(role, index) in PANDUAN_ROLES"
              :key="role.key"
              :to="role.to"
              :icon="role.icon"
              :color="role.color"
              :title="role.title"
              :description="role.description"
              :delay="index * 0.08"
            />
          </div>
        </div>
      </section>

      <!-- Butuh bantuan lain -->
      <section class="bg-white px-6 py-16 md:px-12 lg:px-24">
        <motion.div
          class="mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-3xl border border-neutral-200 bg-surface p-8 text-center sm:flex-row sm:text-left"
          :initial="{ opacity: 0, y: 20 }"
          :while-in-view="{ opacity: 1, y: 0 }"
          :in-view-options="{ once: true, amount: 0.4 }"
          :transition="{ duration: 0.6, ease: 'easeOut' }"
        >
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10"
          >
            <LucideLifeBuoy class="h-6 w-6 text-primary" />
          </div>
          <div class="flex-1">
            <h2 class="mb-1 font-bold text-accent">
              Masih belum menemukan jawaban?
            </h2>
            <p class="text-sm text-neutral-600">
              Hubungi UPTD Laboratorium Kesehatan Daerah Kabupaten Sumenep
              untuk pelaporan kendala teknis.
            </p>
          </div>
          <NuxtLink
            to="/kontak"
            class="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition hover:bg-primary/90"
          >
            Hubungi Kami
            <LucideArrowRight class="h-4 w-4" />
          </NuxtLink>
        </motion.div>
      </section>
    </main>
    <PublicFooter />
  </div>
</template>
