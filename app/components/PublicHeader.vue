<script setup lang="ts">
// Port persis dari docs/planning/reference-landing-asli.html (navbar) — struktur/class/icon
// sama persis, cuma kebab-case data-lucide -> komponen LucideXxx dan href jadi route Nuxt.
const { y: scrollY } = useWindowScroll();
const scrolled = computed(() => scrollY.value > 20);
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
        <button class="text-accent" type="button">
          <LucideMenu class="h-6 w-6" />
        </button>
      </div>
    </div>
  </nav>
</template>
