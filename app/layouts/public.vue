<script setup lang="ts">
// Layout untuk halaman publik (landing/about) — SEO aktif.
// docs/planning/03 §5: title pola "{halaman} — PRODULI", OG image default,
// render SSR/universal (bukan SPA) supaya crawler bisa index.
const { origin } = useRequestURL()

useHead({
  titleTemplate: (title) => (title ? `${title} — PRODULI` : 'PRODULI')
})

useSeoMeta({
  ogSiteName: 'PRODULI',
  ogType: 'website',
  ogImage: `${origin}/og-image.png`,
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <div>
    <SimulationBanner />
    <slot />
  </div>
</template>
