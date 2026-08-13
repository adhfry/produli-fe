<script setup lang="ts">
import { HandHeart, UserPlus, Repeat, Pill, Send } from "@lucide/vue";

definePageMeta({ layout: "public" });

const title = "Panduan Kader (PMO)";
const description =
  "Cara mendapatkan akun, login, dan cara kerja Kader Pendamping Minum Obat (PMO) di aplikasi lapangan PRODULI — kunjungan mingguan dan cek kepatuhan.";

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
        :icon="HandHeart"
        color="info"
        eyebrow="Panduan Pengguna"
        title="Kader (PMO)"
        subtitle="Pendamping Minum Obat — mendampingi kepatuhan minum obat pasien lewat kunjungan rutin mingguan di wilayahnya, langsung dari aplikasi di HP."
        show-back
      />

      <!-- Cara Mendapat Akun -->
      <section class="bg-surface px-6 py-16 md:px-12 lg:px-24">
        <div class="mx-auto max-w-3xl">
          <h2 class="mb-8 text-2xl font-bold text-accent sm:text-3xl">
            Cara Mendapatkan Akun
          </h2>

          <PanduanStep :number="1" color="info" title="Didaftarkan PJ Prolanis atau Admin Puskesmas">
            Sama seperti Tenaga Kesehatan — akun Kader dibuatkan oleh PJ Prolanis
            <strong>atau</strong> Admin Puskesmas, bukan mendaftar sendiri.
          </PanduanStep>

          <PanduanStep :number="2" color="info" title="Buka email aktivasi, dapatkan password">
            Email aktivasi terkirim ke alamat yang didaftarkan. Klik link di dalamnya untuk
            mendapatkan password dan mengaktifkan akun.
            <template #images>
              <PanduanImagePlaceholder label="email aktivasi" />
            </template>
          </PanduanStep>

          <PanduanStep :number="3" color="info" title="Login di HP" is-last>
            Buka aplikasi PRODULI dari HP, masuk memakai email dan password yang sudah dibuat.
            <template #images>
              <PanduanImagePlaceholder label="halaman login" aspect="tall" />
            </template>
          </PanduanStep>
        </div>
      </section>

      <!-- Tugas -->
      <section class="bg-white px-6 py-16 md:px-12 lg:px-24">
        <div class="mx-auto max-w-5xl">
          <div class="mx-auto mb-10 max-w-2xl text-center">
            <h2 class="mb-3 text-2xl font-bold text-accent sm:text-3xl">
              Tugas Paling Ringan & Paling Sering
            </h2>
            <p class="text-neutral-600">
              Kontrol kepatuhan minum obat pasien — kunjungan singkat, tapi rutin tiap
              minggu.
            </p>
          </div>

          <div class="grid gap-5 sm:grid-cols-2">
            <PanduanFeatureItem :icon="UserPlus" title="Kunjungan Pertama Bareng Tenaga Kesehatan" color="info">
              Di kunjungan awal, Kader mendampingi Tenaga Kesehatan — sekalian ikut kenal
              lokasi rumah dan pasiennya.
              <template #images>
                <PanduanImagePlaceholder label="badge &quot;Mendampingi&quot; di daftar tugas" aspect="tall" />
              </template>
            </PanduanFeatureItem>

            <PanduanFeatureItem :icon="Repeat" title="Kunjungan Selanjutnya, Mandiri Tiap Minggu" color="info" :delay="0.05">
              Titik lokasi rumah pasien sudah tersimpan dari kunjungan pertama — Kader tinggal
              datang sendiri sesuai jadwal mingguan.
              <template #images>
                <PanduanImagePlaceholder label="halaman Daftar Tugas Kader" aspect="tall" />
              </template>
            </PanduanFeatureItem>

            <PanduanFeatureItem :icon="Pill" title="Cek Kepatuhan Minum Obat" color="info" :delay="0.1">
              Konfirmasi apakah pasien minum obat sesuai anjuran, dan catat kalau ada kendala
              yang dialami pasien.
              <template #images>
                <PanduanImagePlaceholder label="form PMO mingguan" aspect="tall" />
              </template>
            </PanduanFeatureItem>

            <PanduanFeatureItem :icon="Send" title="Lapor ke PRODULI" color="info" :delay="0.15">
              Setiap kunjungan mingguan tercatat, sehingga riwayat kepatuhan pasien terlihat
              dari waktu ke waktu.
            </PanduanFeatureItem>
          </div>
        </div>
      </section>

      <PanduanOtherRoles current="kader" />
    </main>
    <PublicFooter />
  </div>
</template>
