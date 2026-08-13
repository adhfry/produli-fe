<script setup lang="ts">
import {
  Stethoscope,
  Smartphone,
  ListChecks,
  CalendarClock,
  MapPinCheck,
  ClipboardList,
  Send,
} from "@lucide/vue";

definePageMeta({ layout: "public" });

const title = "Panduan Tenaga Kesehatan";
const description =
  "Cara mendapatkan akun, login, dan cara kerja Tenaga Kesehatan di aplikasi lapangan PRODULI — daftar tugas, validasi lokasi, dan pencatatan kunjungan.";

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
        :icon="Stethoscope"
        color="secondary"
        eyebrow="Panduan Pengguna"
        title="Tenaga Kesehatan"
        subtitle="Melakukan kunjungan pemeriksaan lanjutan ke rumah pasien sesuai jadwal yang ditugaskan PJ Prolanis, langsung dari aplikasi di HP."
        show-back
      />

      <!-- Cara Mendapat Akun -->
      <section class="bg-surface px-6 py-16 md:px-12 lg:px-24">
        <div class="mx-auto max-w-3xl">
          <h2 class="mb-8 text-2xl font-bold text-accent sm:text-3xl">
            Cara Mendapatkan Akun
          </h2>

          <PanduanStep :number="1" color="secondary" title="Didaftarkan PJ Prolanis atau Admin Puskesmas">
            Akun Tenaga Kesehatan dibuatkan oleh PJ Prolanis <strong>atau</strong> Admin
            Puskesmas — bukan mendaftar sendiri.
          </PanduanStep>

          <PanduanStep :number="2" color="secondary" title="Buka email aktivasi, dapatkan password">
            Email aktivasi terkirim ke alamat yang didaftarkan. Klik link di dalamnya untuk
            mendapatkan password dan mengaktifkan akun.
            <template #images>
              <PanduanImagePlaceholder label="email aktivasi" />
            </template>
          </PanduanStep>

          <PanduanStep :number="3" color="secondary" title="Login di HP" is-last>
            Buka aplikasi PRODULI dari HP, masuk memakai email dan password yang sudah dibuat.
            <template #images>
              <PanduanImagePlaceholder label="halaman login" aspect="tall" />
            </template>
          </PanduanStep>
        </div>
      </section>

      <!-- Berbeda dari peran lain -->
      <section class="bg-white px-6 py-16 md:px-12 lg:px-24">
        <div class="mx-auto max-w-5xl">
          <div class="mx-auto mb-10 max-w-2xl text-center">
            <h2 class="mb-3 text-2xl font-bold text-accent sm:text-3xl">
              Murni Aplikasi Lapangan, Tanpa Dashboard
            </h2>
            <p class="text-neutral-600">
              Tenaga Kesehatan tidak memakai dashboard kantor seperti peran lain — begitu
              login, Anda langsung berada di halaman kerja lapangan.
            </p>
          </div>

          <div class="grid gap-5 sm:grid-cols-2">
            <PanduanFeatureItem :icon="Smartphone" title="Tidak Ada Akses Dashboard" color="secondary">
              Begitu login, Anda langsung diarahkan ke halaman kerja lapangan — bukan dashboard
              monitoring seperti Admin Puskesmas atau PJ Prolanis.
              <template #images>
                <PanduanImagePlaceholder label="halaman Beranda aplikasi lapangan" aspect="tall" />
              </template>
            </PanduanFeatureItem>

            <PanduanFeatureItem :icon="ListChecks" title="Daftar Tugas Kunjungan" color="secondary" :delay="0.05">
              Hanya pasien yang ditugaskan oleh PJ Prolanis yang muncul di daftar Anda — Anda
              tidak bisa memilih pasien sendiri.
              <template #images>
                <PanduanImagePlaceholder label="halaman Daftar Tugas" aspect="tall" />
              </template>
            </PanduanFeatureItem>

            <PanduanFeatureItem :icon="CalendarClock" title="Jadwal Kunjungan" color="secondary" :delay="0.1">
              Umumnya satu bulan sekali per pasien, tapi Anda bisa ditugaskan kunjungan
              mendadak kalau kondisi pasien mendesak.
            </PanduanFeatureItem>

            <PanduanFeatureItem :icon="MapPinCheck" title="Wajib Berada di Lokasi" color="secondary" :delay="0.15">
              Sistem memverifikasi lokasi GPS Anda saat kunjungan — harus sesuai dengan alamat
              pasien dan wilayah kerja puskesmas Anda sendiri, tidak bisa mengisi laporan dari
              jauh.
              <template #images>
                <PanduanImagePlaceholder label="layar validasi lokasi" aspect="tall" />
              </template>
            </PanduanFeatureItem>

            <PanduanFeatureItem :icon="ClipboardList" title="Catat Kondisi Pasien" color="secondary" :delay="0.2" class="sm:col-span-2">
              Isi hasil pemeriksaan saat kunjungan (gula darah, tensi, keluhan pasien, tindakan
              yang diberikan), lalu ambil foto dokumentasi langsung dari kamera aplikasi —
              bukan dari galeri.
              <template #images>
                <PanduanImagePlaceholder label="form pemeriksaan" aspect="tall" />
                <PanduanImagePlaceholder label="kamera aplikasi" aspect="tall" />
              </template>
            </PanduanFeatureItem>
          </div>
        </div>
      </section>

      <!-- Kirim laporan -->
      <section class="bg-surface px-6 py-16 md:px-12 lg:px-24">
        <div class="mx-auto max-w-3xl">
          <PanduanCallout :icon="Send" tone="info">
            Setelah semua data terisi, kirim laporan sekali saja — PJ Prolanis yang akan
            meninjau dan menerima laporan tersebut sebagai bukti kunjungan.
          </PanduanCallout>
        </div>
      </section>

      <PanduanOtherRoles current="tenaga-kesehatan" />
    </main>
    <PublicFooter />
  </div>
</template>
