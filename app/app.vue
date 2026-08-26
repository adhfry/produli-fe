<template>
  <UApp :toaster="{ position: 'top-right' }">
    <!-- @vite-pwa/nuxt TIDAK otomatis menyisipkan <link rel="manifest"> ke <head> -- komponen
         ini WAJIB dirender eksplisit di suatu tempat (paling tepat di sini, root universal utk
         semua route) supaya useHead() di dalamnya benar-benar jalan. Tanpa ini, manifest.webmanifest
         & sw.js tetap valid/ke-generate tapi Chrome tidak pernah menganggap situsnya installable
         (cuma tawarkan "Buat pintasan", bukan "Instal aplikasi") -- tidak me-render apa pun secara
         visual (return () => null), aman ditaruh di mana saja dalam tree. -->
    <VitePwaManifest />
    <NuxtLoadingIndicator color="#00A59A" :height="4" />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: translateY(10px);
  filter: blur(2px);
}
</style>
