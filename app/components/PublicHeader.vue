<script setup lang="ts">
// Port persis dari docs/planning/reference-landing-asli.html (navbar) — struktur/class/icon
// sama persis, cuma kebab-case data-lucide -> komponen LucideXxx dan href jadi route Nuxt.
const { y: scrollY } = useWindowScroll();
const scrolled = computed(() => scrollY.value > 20);

// Menu mobile -- TIDAK ADA di reference-landing-asli.html sekalipun (tombol hamburger di sana
// juga cuma ikon statis tanpa handler/panel), jadi ini implementasi baru, bukan port. Ditutup
// otomatis tiap kali route berubah (klik link/back-forward browser) supaya tidak nyangkut
// terbuka saat pindah halaman.
const mobileMenuOpen = ref(false);
const route = useRoute();
watch(() => route.fullPath, () => {
  mobileMenuOpen.value = false;
});

// KHUSUS branch `dev`/lingkungan simulasi -- geser navbar turun sepersis tinggi
// SimulationBanner.vue supaya tidak ketimpa (keduanya sama-sama fixed di top).
// Tidak berpengaruh sama sekali di build produksi normal (bannerActive selalu false).
const bannerActive = useSimulationBannerActive();
const navTop = computed(() => (bannerActive.value ? `${SIMULATION_BANNER_HEIGHT_PX}px` : "0px"));
</script>

<template>
  <nav
    id="navbar"
    class="fixed z-50 w-full border-b border-transparent px-6 py-4 transition-all duration-300 md:px-12 lg:px-24"
    :class="
      scrolled
        ? 'border-neutral-200 bg-white/90 py-3 shadow-sm backdrop-blur-md'
        : ''
    "
    :style="{ top: navTop }"
  >
    <div class="mx-auto flex max-w-7xl items-center justify-between">
      <!-- Logo -->
      <NuxtLink to="/" class="flex cursor-pointer items-center gap-2">
        <img
          src="/logo/logo-no-text.png"
          alt="PRODULI Logo"
          class="h-14 w-14 object-contain drop-shadow-sm"
        />
        <span class="text-xl font-bold tracking-tight text-accent"
          >PRO<span class="font-light text-primary">DULI</span></span
        >
      </NuxtLink>

      <!-- Desktop Menu -->
      <div
        class="hidden items-center gap-8 text-sm font-medium text-neutral-600 lg:flex"
      >
        <NuxtLink to="/#beranda" class="transition-colors hover:text-primary"
          >Beranda</NuxtLink
        >
        <NuxtLink to="/#platform" class="transition-colors hover:text-primary"
          >Platform</NuxtLink
        >
        <NuxtLink to="/#inovasi" class="transition-colors hover:text-primary"
          >Inovasi</NuxtLink
        >
        <NuxtLink to="/#keamanan" class="transition-colors hover:text-primary"
          >Keamanan</NuxtLink
        >
        <NuxtLink to="/#dampak" class="transition-colors hover:text-primary"
          >Dampak</NuxtLink
        >
      </div>

      <!-- CTA -->
      <div class="hidden items-center gap-4 lg:flex">
        <NuxtLink
          to="/tentang-kami"
          class="text-sm font-medium text-neutral-600 transition-colors hover:text-accent"
          >Tentang</NuxtLink
        >
        <NuxtLink
          to="/panduan"
          class="text-sm font-medium text-neutral-600 transition-colors hover:text-accent"
          >Panduan</NuxtLink
        >
        <NuxtLink
          to="/kontak"
          class="text-sm font-medium text-neutral-600 transition-colors hover:text-accent"
          >Kontak</NuxtLink
        >
        <NuxtLink
          to="/auth/login"
          class="group flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-neutral-800 hover:shadow-xl"
        >
          Masuk Sistem
          <LucideArrowRight
            class="h-4 w-4 transition-transform group-hover:translate-x-1"
          />
        </NuxtLink>
      </div>

      <!-- Mobile: toggle + menu -->
      <div class="flex items-center gap-2 lg:hidden">
        <button
          class="text-accent"
          type="button"
          :aria-expanded="mobileMenuOpen"
          aria-controls="mobile-menu"
          aria-label="Buka menu navigasi"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <LucideX v-if="mobileMenuOpen" class="h-6 w-6" />
          <LucideMenu v-else class="h-6 w-6" />
        </button>
      </div>
    </div>

    <!-- Panel Menu Mobile -->
    <div
      v-if="mobileMenuOpen"
      id="mobile-menu"
      class="mx-auto mt-4 flex max-w-7xl flex-col gap-1 rounded-2xl border border-neutral-200 bg-white p-4 text-sm font-medium text-neutral-600 shadow-lg lg:hidden"
    >
      <NuxtLink to="/#beranda" class="rounded-lg px-3 py-2.5 transition-colors hover:bg-neutral-50 hover:text-primary">Beranda</NuxtLink>
      <NuxtLink to="/#platform" class="rounded-lg px-3 py-2.5 transition-colors hover:bg-neutral-50 hover:text-primary">Platform</NuxtLink>
      <NuxtLink to="/#inovasi" class="rounded-lg px-3 py-2.5 transition-colors hover:bg-neutral-50 hover:text-primary">Inovasi</NuxtLink>
      <NuxtLink to="/#keamanan" class="rounded-lg px-3 py-2.5 transition-colors hover:bg-neutral-50 hover:text-primary">Keamanan</NuxtLink>
      <NuxtLink to="/#dampak" class="rounded-lg px-3 py-2.5 transition-colors hover:bg-neutral-50 hover:text-primary">Dampak</NuxtLink>

      <div class="my-2 border-t border-neutral-100" />

      <NuxtLink to="/tentang-kami" class="rounded-lg px-3 py-2.5 transition-colors hover:bg-neutral-50 hover:text-accent">Tentang</NuxtLink>
      <NuxtLink to="/panduan" class="rounded-lg px-3 py-2.5 transition-colors hover:bg-neutral-50 hover:text-accent">Panduan</NuxtLink>
      <NuxtLink to="/kontak" class="rounded-lg px-3 py-2.5 transition-colors hover:bg-neutral-50 hover:text-accent">Kontak</NuxtLink>
      <NuxtLink
        to="/auth/login"
        class="mt-2 flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-medium text-white shadow-md transition-all hover:bg-neutral-800"
      >
        Masuk Sistem
        <LucideArrowRight class="h-4 w-4" />
      </NuxtLink>
    </div>
  </nav>
</template>
