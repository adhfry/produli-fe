<script setup lang="ts">
// Port persis reference-landing-asli.html (Footer) — alamat "Dinas Kesehatan Kabupaten Sumenep"
// + nomor telepon (0328) 123456 APA ADANYA dari referensi (belum diverifikasi sumbernya).
</script>

<template>
  <footer class="bg-accent px-6 py-16 text-white md:px-12 lg:px-24">
    <div
      class="mx-auto grid max-w-7xl gap-12 border-b border-neutral-700/50 pb-12 md:grid-cols-4"
    >
      <div class="md:col-span-2">
        <div class="mb-6 flex items-center gap-3">
          <div
            class="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1"
          >
            <img
              src="/logo/logo-no-text.png"
              alt="KOPIPU Smart Logo"
              class="h-full w-full object-contain"
            />
          </div>
          <span class="text-2xl font-bold tracking-tight"
            >KOPIPU <span class="font-light">Smart</span></span
          >
        </div>
        <p class="mb-6 max-w-sm text-neutral-400">
          Platform Digital Transformasi Pelayanan Kesehatan Preventif Berbasis
          Data Laboratorium.
        </p>
        <div class="flex gap-4">
          <div
            class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-neutral-800 transition-colors hover:bg-primary"
          >
            <LucideMail class="h-5 w-5" />
          </div>
          <div
            class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-neutral-800 transition-colors hover:bg-primary"
          >
            <LucideGlobe class="h-5 w-5" />
          </div>
        </div>
      </div>

      <div>
        <h4 class="mb-6 text-lg font-bold">Quick Links</h4>
        <ul class="space-y-3 text-neutral-400">
          <li>
            <NuxtLink to="/#platform" class="transition-colors hover:text-white"
              >Platform</NuxtLink
            >
          </li>
          <li>
            <NuxtLink to="/#inovasi" class="transition-colors hover:text-white"
              >Inovasi</NuxtLink
            >
          </li>
          <li>
            <NuxtLink to="/#keamanan" class="transition-colors hover:text-white"
              >Keamanan</NuxtLink
            >
          </li>
          <li>
            <NuxtLink
              to="/#dampak"
              class="transition-colors hover:text-white"
              >Dampak</NuxtLink
            >
          </li>
        </ul>
      </div>

      <div>
        <h4 class="mb-6 text-lg font-bold">Kontak &amp; Dukungan</h4>
        <ul class="space-y-3 text-neutral-400">
          <li class="flex items-start gap-3">
            <LucideMapPin class="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" />
            <span
              >Dinas Kesehatan, Pengendalian Penduduk dan Keluarga Berencana<br />Kabupaten
              Sumenep</span
            >
          </li>
          <li class="flex items-start gap-3">
            <LucideMapPin class="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" />
            <span
              >UPTD Laboratorium Kesehatan Daerah<br />Kabupaten Sumenep</span
            >
          </li>
          <li class="flex items-center gap-3">
            <LucidePhone class="h-5 w-5 text-neutral-500" />
            <span>+62 852-5930-6093</span>
          </li>
        </ul>
      </div>
    </div>
    <div
      class="mx-auto flex max-w-7xl flex-col items-center justify-between pt-8 text-sm text-neutral-500 md:flex-row"
    >
      <div class="text-center text-gray-200 md:text-left">
        <p>
          &copy; 2026 KOPIPU Smart Platform. Hak cipta dilindungi undang-undang.
        </p>
        <p class="mt-1 text-xs text-gray-200">
          Dikembangkan oleh Pengolah Data dan Informasi UPTD Laboratorium
          Kesehatan Daerah<br class="md:hidden" />
          <span class="hidden md:inline"> &mdash; </span>Dinas Kesehatan P2KB
          Kabupaten Sumenep
        </p>
      </div>
      <div class="mt-4 flex gap-4 md:mt-0">
        <a href="#" class="hover:text-white transition-colors"
          >Privacy Policy</a
        >
        <a href="#" class="hover:text-white transition-colors"
          >Terms of Service</a
        >
      </div>
    </div>
  </footer>
</template>
