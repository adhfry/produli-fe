<script setup lang="ts">
import { ref } from "vue";
import { motion } from "motion-v";

definePageMeta({ layout: "public" });

const title = "Kontak & Bantuan";
const description =
  "Hubungi UPTD Laboratorium Kesehatan Daerah Kabupaten Sumenep untuk pelaporan kendala teknis dan informasi platform PRODULI.";

useSeoMeta({
  title,
  description,
  ogTitle: `${title} — PRODULI`,
  ogDescription: description,
  twitterTitle: `${title} — PRODULI`,
  twitterDescription: description,
});

const subject = ref("");
const message = ref("");
</script>

<template>
  <div
    class="bg-surface text-neutral-800 selection:bg-primary selection:text-white"
  >
    <PublicHeader />
    <main class="overflow-hidden py-24">
      <!-- Header Section -->
      <section class="bg-white px-6 py-24 md:px-12 lg:px-24">
        <div class="mx-auto max-w-7xl">
          <motion.div
            class="text-center"
            :initial="{ opacity: 0, y: 30 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ duration: 0.8, ease: 'easeOut' }"
          >
            <h1
              class="mb-6 text-4xl font-extrabold text-accent md:text-5xl lg:text-6xl"
            >
              Hubungi
              <span
                class="bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent"
                >Kami</span
              >
            </h1>
            <p class="mx-auto max-w-2xl text-lg text-neutral-600">
              Pusat bantuan teknis dan informasi kontak resmi penyelenggara
              sistem PRODULI Kabupaten Sumenep.
            </p>
          </motion.div>
        </div>
      </section>

      <!-- Informasi Kontak & Peta (Split) -->
      <section class="px-6 py-16 md:px-12 lg:px-24 bg-surface">
        <div class="mx-auto max-w-7xl grid gap-12 lg:grid-cols-2">
          <!-- Kolom Kiri: Informasi & Form -->
          <motion.div
            :initial="{ opacity: 0, x: -30 }"
            :animate="{ opacity: 1, x: 0 }"
            :transition="{ duration: 0.8, ease: 'easeOut', delay: 0.1 }"
          >
            <h2 class="mb-6 text-3xl font-bold text-accent">
              Konteks Institusi
            </h2>
            <div class="mb-8 space-y-4">
              <div
                class="flex items-start gap-4 rounded-2xl bg-white p-6 shadow-sm border border-neutral-100"
              >
                <div
                  class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10"
                >
                  <LucideBuilding2 class="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 class="mb-1 font-bold text-accent">
                    UPTD Laboratorium Kesehatan Daerah
                  </h3>
                  <p class="text-sm text-neutral-500 leading-relaxed">
                    Dinas Kesehatan, Pengendalian Penduduk dan Keluarga
                    Berencana (DKP2KB) Kabupaten Sumenep.
                  </p>
                </div>
              </div>

              <div
                class="flex items-start gap-4 rounded-2xl bg-white p-6 shadow-sm border border-neutral-100"
              >
                <div
                  class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary/10"
                >
                  <LucideMail class="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <h3 class="mb-1 font-bold text-accent">
                    Pelaporan Kendala Teknis
                  </h3>
                  <p class="mb-2 text-sm text-neutral-500 leading-relaxed">
                    Surel ini dikhususkan untuk kendala teknis sistem/aplikasi,
                    bukan untuk layanan kedaruratan kesehatan.
                  </p>
                  <a
                    href="mailto:labkesmassumenep@gmail.com"
                    class="font-bold text-primary hover:underline transition"
                    >labkesmassumenep@gmail.com</a
                  >
                </div>
              </div>
            </div>

            <!-- Form Kontak (Mailto) -->
            <div
              class="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm"
            >
              <h3 class="mb-6 text-xl font-bold text-accent">
                Kirim Pesan Bantuan
              </h3>
              <form @submit.prevent class="space-y-4">
                <div>
                  <label
                    class="mb-1.5 block text-sm font-medium text-neutral-700"
                    >Subjek Kendala</label
                  >
                  <input
                    v-model="subject"
                    type="text"
                    class="w-full rounded-xl border-neutral-300 bg-neutral-50 px-4 py-3 text-sm outline-hidden transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
                    placeholder="Contoh: Gagal memuat data SiLAKES..."
                  />
                </div>
                <div>
                  <label
                    class="mb-1.5 block text-sm font-medium text-neutral-700"
                    >Penjelasan Detail</label
                  >
                  <textarea
                    v-model="message"
                    rows="4"
                    class="w-full resize-none rounded-xl border-neutral-300 bg-neutral-50 px-4 py-3 text-sm outline-hidden transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
                    placeholder="Tuliskan keluhan atau kendala teknis yang dialami..."
                  ></textarea>
                </div>
                <a
                  :href="`mailto:labkesmassumenep@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`"
                  class="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-semibold text-white shadow-md shadow-primary/20 transition hover:bg-primary/90 hover:-translate-y-0.5"
                >
                  <LucideSend class="h-4 w-4" /> Hubungi via Klien Surel
                </a>
              </form>
            </div>
          </motion.div>

          <!-- Kolom Kanan: Peta Google Maps Embed -->
          <motion.div
            class="space-y-6"
            :initial="{ opacity: 0, x: 30 }"
            :animate="{ opacity: 1, x: 0 }"
            :transition="{ duration: 0.8, ease: 'easeOut', delay: 0.2 }"
          >
            <h2 class="mb-6 text-3xl font-bold text-accent">Lokasi Kami</h2>

            <div
              class="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <div class="border-b border-neutral-100 bg-neutral-50 p-5">
                <h3 class="flex items-center gap-2 font-bold text-accent">
                  <LucideMapPin class="h-5 w-5 text-primary" />
                  UPTD Labkesda Kabupaten Sumenep
                </h3>
              </div>
              <iframe
                src="https://maps.google.com/maps?q=UPTD.%20LABORATORIUM%20KESEHATAN%20DAERAH%20SUMENEP&t=&z=15&ie=UTF8&iwloc=&output=embed"
                width="100%"
                height="260"
                style="border: 0"
                allowfullscreen="false"
                loading="lazy"
                class="w-full object-cover"
              >
              </iframe>
            </div>

            <div
              class="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <div class="border-b border-neutral-100 bg-neutral-50 p-5">
                <h3 class="flex items-center gap-2 font-bold text-accent">
                  <LucideMapPin class="h-5 w-5 text-secondary" />
                  Dinas Kesehatan P2KB Kabupaten Sumenep
                </h3>
              </div>
              <iframe
                src="https://maps.google.com/maps?q=Dinas%20Kesehatan%20P2KB%20Kabupaten%20Sumenep&t=&z=15&ie=UTF8&iwloc=&output=embed"
                width="100%"
                height="260"
                style="border: 0"
                allowfullscreen="false"
                loading="lazy"
                class="w-full object-cover"
              >
              </iframe>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
    <PublicFooter />
  </div>
</template>
