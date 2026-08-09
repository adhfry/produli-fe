<script setup lang="ts">
import { motion } from "motion-v";

definePageMeta({ layout: "public" });

const title = "Tentang Kami";
const description =
  "Mengenal lebih dalam latar belakang, visi, misi, dan inovasi pelayanan kesehatan proaktif KOPIPU Smart di Kabupaten Sumenep.";

useSeoMeta({
  title,
  description,
  ogTitle: `${title} — KOPIPU Smart`,
  ogDescription: description,
  twitterTitle: `${title} — KOPIPU Smart`,
  twitterDescription: description,
});
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
              Tentang Inovasi <br /><span
                class="bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent"
                >KOPIPU Smart</span
              >
            </h1>
            <p class="mx-auto max-w-2xl text-lg text-neutral-600">
              Menyinergikan teknologi digital dan data laboratorium untuk
              mewujudkan pelayanan kesehatan preventif yang proaktif dan
              terukur.
            </p>
          </motion.div>
        </div>
      </section>

      <!-- Latar Belakang (Split 2 Column) -->
      <section class="px-6 py-20 md:px-12 lg:px-24 bg-surface">
        <div
          class="mx-auto flex max-w-7xl flex-col items-center gap-12 lg:flex-row"
        >
          <motion.div
            class="w-full lg:w-1/2"
            :initial="{ opacity: 0, x: -30 }"
            :while-in-view="{ opacity: 1, x: 0 }"
            :in-view-options="{ once: true, amount: 0.3 }"
          >
            <h2
              class="mb-4 text-sm font-semibold tracking-wide text-primary uppercase"
            >
              Latar Belakang
            </h2>
            <h3 class="mb-6 text-3xl font-bold text-accent md:text-4xl">
              Tantangan Penyakit Kronis & Pelayanan Pasif
            </h3>
            <p class="text-lg leading-relaxed text-neutral-600">
              Penyakit kronis seperti Diabetes Mellitus, Hipertensi,
              Dislipidemia, dan Gangguan Ginjal merupakan penyebab terbesar
              komplikasi kesehatan masyarakat. Laboratorium Kesehatan Daerah
              Kabupaten Sumenep telah memiliki data pemeriksaan laboratorium
              pasien melalui SiLAKES, namun selama ini hasil pemeriksaan
              tersebut belum dimanfaatkan secara maksimal sebagai dasar
              pelayanan kesehatan aktif di lapangan. Sebagian besar pelayanan
              kesehatan masih bersifat menunggu pasien datang (Passive
              Healthcare).
            </p>
          </motion.div>
          <motion.div
            class="w-full lg:w-1/2"
            :initial="{ opacity: 0, x: 30 }"
            :while-in-view="{ opacity: 1, x: 0 }"
            :in-view-options="{ once: true, amount: 0.3 }"
          >
            <div
              class="aspect-4/3 w-full overflow-hidden rounded-3xl bg-neutral-100 flex items-center justify-center relative"
            >
              <LucideActivity
                class="h-32 w-32 text-neutral-300 relative z-10"
              />
              <div
                class="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl"
              ></div>
              <div
                class="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-secondary/20 blur-3xl"
              ></div>
            </div>
          </motion.div>
        </div>
      </section>

      <!-- Visi & Misi (Split 2 Column, Zigzag) -->
      <section class="bg-white px-6 py-20 md:px-12 lg:px-24">
        <div
          class="mx-auto flex max-w-7xl flex-col-reverse items-center gap-12 lg:flex-row"
        >
          <motion.div
            class="w-full lg:w-1/2"
            :initial="{ opacity: 0, x: -30 }"
            :while-in-view="{ opacity: 1, x: 0 }"
            :in-view-options="{ once: true, amount: 0.3 }"
          >
            <div
              class="aspect-4/3 w-full overflow-hidden rounded-3xl bg-neutral-100 flex items-center justify-center relative"
            >
              <LucideTarget class="h-32 w-32 text-neutral-300 relative z-10" />
              <div
                class="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-3xl"
              ></div>
            </div>
          </motion.div>
          <motion.div
            class="w-full lg:w-1/2"
            :initial="{ opacity: 0, x: 30 }"
            :while-in-view="{ opacity: 1, x: 0 }"
            :in-view-options="{ once: true, amount: 0.3 }"
          >
            <h2
              class="mb-4 text-sm font-semibold tracking-wide text-primary uppercase"
            >
              Visi & Misi
            </h2>
            <h3 class="mb-6 text-3xl font-bold text-accent md:text-4xl">
              Visi Kami
            </h3>
            <p
              class="mb-8 text-lg font-medium leading-relaxed text-neutral-700"
            >
              Mewujudkan pelayanan kesehatan preventif yang cepat, tepat
              sasaran, berbasis data laboratorium, dan terintegrasi secara
              digital untuk meningkatkan kualitas hidup masyarakat Kabupaten
              Sumenep.
            </p>

            <h3 class="mb-4 text-2xl font-bold text-accent">Misi Kami</h3>
            <ul class="space-y-3">
              <li class="flex items-center gap-3">
                <LucideCheckCircle2 class="h-6 w-6 shrink-0 text-primary" />
                <span class="text-neutral-600"
                  >Digitalisasi kunjungan rumah.</span
                >
              </li>
              <li class="flex items-center gap-3">
                <LucideCheckCircle2 class="h-6 w-6 shrink-0 text-primary" />
                <span class="text-neutral-600"
                  >Integrasi hasil laboratorium.</span
                >
              </li>
              <li class="flex items-center gap-3">
                <LucideCheckCircle2 class="h-6 w-6 shrink-0 text-primary" />
                <span class="text-neutral-600">Monitoring real-time.</span>
              </li>
              <li class="flex items-center gap-3">
                <LucideCheckCircle2 class="h-6 w-6 shrink-0 text-primary" />
                <span class="text-neutral-600"
                  >Decision Support bagi Dinas Kesehatan.</span
                >
              </li>
              <li class="flex items-center gap-3">
                <LucideCheckCircle2 class="h-6 w-6 shrink-0 text-primary" />
                <span class="text-neutral-600"
                  >Peningkatan kualitas pelayanan Kesehatan.</span
                >
              </li>
            </ul>
          </motion.div>
        </div>
      </section>

      <!-- Tujuan Sistem (Split) -->
      <section class="px-6 py-20 md:px-12 lg:px-24 bg-surface">
        <div
          class="mx-auto flex max-w-7xl flex-col items-center gap-12 lg:flex-row"
        >
          <motion.div
            class="w-full lg:w-1/2"
            :initial="{ opacity: 0, x: -30 }"
            :while-in-view="{ opacity: 1, x: 0 }"
            :in-view-options="{ once: true, amount: 0.3 }"
          >
            <h2
              class="mb-4 text-sm font-semibold tracking-wide text-primary uppercase"
            >
              Tujuan Sistem
            </h2>
            <h3 class="mb-6 text-3xl font-bold text-accent md:text-4xl">
              Mengapa Dibangun?
            </h3>
            <div class="grid gap-4 sm:grid-cols-2">
              <div
                class="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div
                  class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10"
                >
                  <LucideBrain class="h-5 w-5 text-secondary" />
                </div>
                <p class="font-medium text-neutral-700">
                  Mengidentifikasi pasien risiko tinggi otomatis.
                </p>
              </div>
              <div
                class="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div
                  class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10"
                >
                  <LucideDatabase class="h-5 w-5 text-primary" />
                </div>
                <p class="font-medium text-neutral-700">
                  Mengintegrasikan data Lab SiLAKES.
                </p>
              </div>
              <div
                class="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div
                  class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10"
                >
                  <LucideUsers class="h-5 w-5 text-purple-500" />
                </div>
                <p class="font-medium text-neutral-700">
                  Mengelola penugasan kader efektif.
                </p>
              </div>
              <div
                class="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div
                  class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10"
                >
                  <LucideMapPin class="h-5 w-5 text-rose-500" />
                </div>
                <p class="font-medium text-neutral-700">
                  Memastikan kunjungan benar dilakukan.
                </p>
              </div>
              <div
                class="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div
                  class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10"
                >
                  <LucideFileImage class="h-5 w-5 text-amber-500" />
                </div>
                <p class="font-medium text-neutral-700">
                  Mendokumentasikan hasil kunjungan.
                </p>
              </div>
              <div
                class="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div
                  class="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10"
                >
                  <LucideLayoutDashboard class="h-5 w-5 text-emerald-500" />
                </div>
                <p class="font-medium text-neutral-700">
                  Menjadi dashboard monitoring terpadu.
                </p>
              </div>
            </div>
          </motion.div>
          <motion.div
            class="w-full lg:w-1/2"
            :initial="{ opacity: 0, x: 30 }"
            :while-in-view="{ opacity: 1, x: 0 }"
            :in-view-options="{ once: true, amount: 0.3 }"
          >
            <div
              class="aspect-4/3 w-full overflow-hidden rounded-3xl bg-neutral-100 flex items-center justify-center relative"
            >
              <LucideLayers class="h-32 w-32 text-neutral-300 relative z-10" />
              <div
                class="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl"
              ></div>
              <div
                class="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl"
              ></div>
            </div>
          </motion.div>
        </div>
      </section>

      <!-- Tentang Inovasi (versi lengkap) -->
      <section class="bg-white px-6 py-20 md:px-12 lg:px-24">
        <div
          class="mx-auto flex max-w-7xl flex-col-reverse items-center gap-12 lg:flex-row"
        >
          <motion.div
            class="w-full lg:w-1/2"
            :initial="{ opacity: 0, x: -30 }"
            :while-in-view="{ opacity: 1, x: 0 }"
            :in-view-options="{ once: true, amount: 0.3 }"
          >
            <div
              class="aspect-4/3 w-full overflow-hidden rounded-3xl bg-neutral-100 flex items-center justify-center relative"
            >
              <LucideShieldCheck
                class="h-32 w-32 text-neutral-300 relative z-10"
              />
              <div
                class="absolute inset-0 opacity-[0.03]"
                style="
                  background-image: radial-gradient(
                    circle at 1px 1px,
                    black 1px,
                    transparent 0
                  );
                  background-size: 20px 20px;
                "
              ></div>
            </div>
          </motion.div>
          <motion.div
            class="w-full lg:w-1/2"
            :initial="{ opacity: 0, x: 30 }"
            :while-in-view="{ opacity: 1, x: 0 }"
            :in-view-options="{ once: true, amount: 0.3 }"
          >
            <h2
              class="mb-4 text-sm font-semibold tracking-wide text-primary uppercase"
            >
              Inovasi Pelayanan Publik
            </h2>
            <blockquote
              class="mb-6 text-xl font-medium leading-relaxed text-neutral-700 italic border-l-4 border-primary pl-6"
            >
              "<span class="font-bold">KOPIPU Smart</span> merupakan inovasi
              sistem pelayanan kesehatan yang digagas oleh Kepala Dinas
              Kesehatan P2KB Kabupaten Sumenep,
              <span class="font-bold text-accent"
                >drg. Ellya Fardasah, M.Kes.</span
              >, sebagai upaya memperkuat pelayanan kesehatan preventif melalui
              kunjungan rumah berbasis data laboratorium dan pendekatan
              keluarga."
            </blockquote>
            <h3 class="mb-4 text-2xl font-bold text-accent">
              Fitur Utama & Keunggulan
            </h3>
            <p class="text-neutral-600 leading-relaxed text-justify">
              Sistem ini dilengkapi dengan sinkronisasi data pasien otomatis
              dari SiLAKES dan dashboard analitik yang terpisah menyesuaikan
              kewenangan antara Dinas Kesehatan, Puskesmas, PJ Prolanis, hingga
              Kader.
            </p>
            <p class="mt-4 text-neutral-600 leading-relaxed text-justify">
              Operasional kunjungan <i>door-to-door</i> diperkuat dengan
              validasi titik GPS, penguncian wajib foto langsung lewat kamera
              aplikasi (bukan unggahan galeri), analitik kategori risiko
              terotomatisasi (Berat, Sedang, Ringan), serta monitoring seluruh
              pelaksanaan kegiatan secara langsung (<i>real-time</i>).
            </p>
          </motion.div>
        </div>
      </section>
    </main>
    <PublicFooter />
  </div>
</template>
