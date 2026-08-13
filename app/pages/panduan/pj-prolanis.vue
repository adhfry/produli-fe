<script setup lang="ts">
import {
  ClipboardCheck,
  Users,
  CalendarCheck,
  CheckCircle2,
  Activity,
} from "@lucide/vue";

definePageMeta({ layout: "public" });

const title = "Panduan PJ Prolanis";
const description =
  "Cara mendapatkan akun, login, dan semua yang bisa dilakukan PJ Prolanis di PRODULI — kelola tenaga lapangan, tugaskan kunjungan, dan tinjau laporan.";

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
      <PanduanHero
        :icon="ClipboardCheck"
        color="primary"
        eyebrow="Panduan Pengguna"
        title="PJ Prolanis"
        subtitle="Penanggung jawab pengawasan langsung di lapangan — menugaskan kunjungan, mengawasi tenaga lapangan, dan meninjau laporan kunjungan."
        show-back
      />

      <!-- Cara Mendapat Akun -->
      <section class="bg-surface px-6 py-16 md:px-12 lg:px-24">
        <div class="mx-auto max-w-3xl">
          <h2 class="mb-8 text-2xl font-bold text-accent sm:text-3xl">
            Cara Mendapatkan Akun
          </h2>

          <PanduanStep :number="1" color="primary" title="Didaftarkan Admin Kabupaten atau Admin Puskesmas">
            Akun PJ Prolanis dibuatkan oleh Administrator Kabupaten (Dinas Kesehatan/Labkesda)
            <strong>atau</strong> oleh Admin Puskesmas tempat Anda bertugas — bukan mendaftar
            sendiri.
          </PanduanStep>

          <PanduanStep :number="2" color="primary" title="Terima email aktivasi & buat password">
            Email aktivasi terkirim ke alamat yang didaftarkan. Klik link di dalamnya, sistem
            akan membuatkan password satu kali tampil, atau Anda langsung diarahkan mengganti
            password sendiri.
            <template #images>
              <PanduanImagePlaceholder label="email aktivasi" />
            </template>
          </PanduanStep>

          <PanduanStep :number="3" color="primary" title="Login" is-last>
            Masuk memakai email dan password yang sudah dibuat. Anda juga bisa menautkan akun
            Google nanti lewat menu Pengaturan untuk login lebih cepat.
            <template #images>
              <PanduanImagePlaceholder label="halaman login" />
            </template>
          </PanduanStep>
        </div>
      </section>

      <!-- Yang Membedakan -->
      <section class="bg-white px-6 py-16 md:px-12 lg:px-24">
        <div class="mx-auto max-w-5xl">
          <div class="mx-auto mb-10 max-w-2xl text-center">
            <h2 class="mb-3 text-2xl font-bold text-accent sm:text-3xl">
              Yang Membedakan dari Admin Puskesmas
            </h2>
            <p class="text-neutral-600">
              PJ Prolanis punya tanggung jawab pengawasan langsung ke tenaga lapangan —
              bukan cuma memantau dari dashboard.
            </p>
          </div>

          <div class="grid gap-5 sm:grid-cols-2">
            <PanduanFeatureItem :icon="Users" title="Kelola Kader & Tenaga Kesehatan" color="primary">
              Daftarkan tenaga lapangan (Kader dan Tenaga Kesehatan) yang bertugas di wilayah
              kerja Anda.
              <template #images>
                <PanduanImagePlaceholder label="halaman Manajemen Kader" />
              </template>
            </PanduanFeatureItem>

            <PanduanFeatureItem :icon="CalendarCheck" title="Tugaskan Kunjungan" color="primary" :delay="0.05">
              Pilih pasien kategori risiko Berat, pilih Tenaga Kesehatan yang bertugas (dan
              Kader pendamping untuk kunjungan pertama), lalu atur jadwalnya.
              <template #images>
                <PanduanImagePlaceholder label="halaman Penugasan Kunjungan" />
              </template>
            </PanduanFeatureItem>

            <PanduanFeatureItem :icon="CheckCircle2" title="Menerima Laporan Kunjungan" color="primary" :delay="0.1">
              Begitu Tenaga Kesehatan atau Kader mengirim laporan, PJ Prolanis adalah yang
              pertama meninjau dan menerimanya sebagai bukti kunjungan benar-benar terjadi.
              <template #images>
                <PanduanImagePlaceholder label="tombol Terima Laporan" />
              </template>
            </PanduanFeatureItem>

            <PanduanFeatureItem :icon="Activity" title="Memantau Progres" color="primary" :delay="0.15">
              Lihat siapa sudah melakukan kunjungan, siapa yang belum, dan laporan mana yang
              masih perlu ditindaklanjuti.
              <template #images>
                <PanduanImagePlaceholder label="dashboard kunjungan" />
              </template>
            </PanduanFeatureItem>
          </div>
        </div>
      </section>

      <PanduanOtherRoles current="pj-prolanis" />
    </main>
    <PublicFooter />
  </div>
</template>
