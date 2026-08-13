<script setup lang="ts">
import {
  Building2,
  Map,
  TrendingUp,
  UserPlus,
  Users,
  BarChart3,
  Info,
} from "@lucide/vue";

definePageMeta({ layout: "public" });

const title = "Panduan Admin Puskesmas";
const description =
  "Cara mendapatkan akun, login, dan semua yang bisa dilakukan Admin Puskesmas di PRODULI — dashboard wilayah kerja, kelola staf, dan laporan kepatuhan.";

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
        :icon="Building2"
        color="accent"
        eyebrow="Panduan Pengguna"
        title="Admin Puskesmas"
        subtitle="Memantau wilayah kerja puskesmas lewat dashboard, dan mendaftarkan staf serta tenaga lapangan yang menjalankan kunjungan."
        show-back
      />

      <!-- Cara Mendapat Akun -->
      <section class="bg-surface px-6 py-16 md:px-12 lg:px-24">
        <div class="mx-auto max-w-3xl">
          <h2 class="mb-8 text-2xl font-bold text-accent sm:text-3xl">
            Cara Mendapatkan Akun
          </h2>

          <PanduanStep :number="1" color="accent" title="Didaftarkan oleh Administrator Kabupaten">
            Akun Admin Puskesmas <strong>tidak bisa didaftarkan sendiri</strong> — akun
            dibuatkan oleh Administrator Kabupaten (Dinas Kesehatan/Labkesda) sesuai puskesmas
            tempat Anda bertugas.
          </PanduanStep>

          <PanduanStep :number="2" color="accent" title="Terima email aktivasi">
            Setelah didaftarkan, email aktivasi otomatis terkirim ke alamat email yang
            didaftarkan.
            <template #images>
              <PanduanImagePlaceholder label="email aktivasi" />
            </template>
          </PanduanStep>

          <PanduanStep :number="3" color="accent" title="Klik link, dapatkan password" is-last>
            Klik link di dalam email → sistem membuatkan password acak yang tampil satu kali
            saja → Anda langsung bisa login, atau langsung diarahkan mengganti password sendiri.
            <template #images>
              <PanduanImagePlaceholder label="halaman aktivasi" />
            </template>
          </PanduanStep>
        </div>
      </section>

      <!-- Cara Login -->
      <section class="bg-white px-6 py-16 md:px-12 lg:px-24">
        <div class="mx-auto max-w-3xl">
          <h2 class="mb-6 text-2xl font-bold text-accent sm:text-3xl">Cara Login</h2>
          <p class="mb-6 leading-relaxed text-neutral-600">
            Masuk memakai email dan password yang sudah dibuat saat aktivasi. Untuk login yang
            lebih cepat di kunjungan berikutnya, Anda bisa menautkan akun Google nanti lewat
            menu Pengaturan.
          </p>
          <PanduanImagePlaceholder label="halaman login" />
        </div>
      </section>

      <!-- Yang Bisa Dilihat & Dilakukan -->
      <section class="bg-surface px-6 py-16 md:px-12 lg:px-24">
        <div class="mx-auto max-w-5xl">
          <h2 class="mb-8 text-center text-2xl font-bold text-accent sm:text-3xl">
            Yang Bisa Dilihat &amp; Dilakukan
          </h2>

          <div class="grid gap-5 sm:grid-cols-2">
            <PanduanFeatureItem :icon="Map" title="Dashboard Wilayah Kerja" color="accent">
              Peta sebaran pasien di area puskesmas Anda, lengkap dengan rincian jumlah pasien
              risiko Berat, Sedang, dan Ringan per kecamatan maupun per desa.
              <template #images>
                <PanduanImagePlaceholder label="dashboard dengan peta" />
              </template>
            </PanduanFeatureItem>

            <PanduanFeatureItem :icon="TrendingUp" title="Top 5 Kecamatan Risiko Tertinggi" color="accent" :delay="0.05">
              Ranking kecamatan yang paling banyak pasien berisikonya, supaya Anda tahu area
              mana yang paling butuh perhatian lebih dulu.
              <template #images>
                <PanduanImagePlaceholder label="kartu top 5 kecamatan" />
              </template>
            </PanduanFeatureItem>

            <PanduanFeatureItem :icon="UserPlus" title="Kelola Staf" color="accent" :delay="0.1">
              Daftarkan PJ Prolanis baru untuk puskesmas Anda langsung dari halaman Manajemen
              Staf.
              <template #images>
                <PanduanImagePlaceholder label="halaman Manajemen Staf" />
              </template>
            </PanduanFeatureItem>

            <PanduanFeatureItem :icon="Users" title="Kelola Tenaga Lapangan" color="accent" :delay="0.15">
              Daftarkan Kader (PMO) dan Tenaga Kesehatan yang akan bertugas di wilayah kerja
              puskesmas Anda.
              <template #images>
                <PanduanImagePlaceholder label="halaman Manajemen Kader" />
              </template>
            </PanduanFeatureItem>

            <PanduanFeatureItem :icon="BarChart3" title="Laporan Tingkat Kepatuhan" color="accent" :delay="0.2" class="sm:col-span-2">
              Persentase kunjungan terjadwal yang benar-benar selesai dilaksanakan, sebagai
              tolok ukur kinerja tenaga lapangan di puskesmas Anda.
              <template #images>
                <PanduanImagePlaceholder label="kartu tingkat kepatuhan" />
              </template>
            </PanduanFeatureItem>
          </div>
        </div>
      </section>

      <!-- Catatan -->
      <section class="bg-white px-6 py-16 md:px-12 lg:px-24">
        <div class="mx-auto max-w-3xl">
          <PanduanCallout :icon="Info" tone="info">
            Peran Admin Puskesmas bersifat <strong>memantau</strong> — tidak punya wewenang
            menyetujui atau menolak laporan kunjungan. Persetujuan laporan dilakukan oleh
            PJ Prolanis dan Administrator Kabupaten.
          </PanduanCallout>
        </div>
      </section>

      <PanduanOtherRoles current="admin-puskesmas" />
    </main>
    <PublicFooter />
  </div>
</template>
