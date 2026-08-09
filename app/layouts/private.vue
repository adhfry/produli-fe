<script setup lang="ts">
// Layout untuk semua halaman privat (dashboard Dinkes/Puskesmas/PJ + app kader) — no-SEO.
// docs/planning/03 §5: noindex otomatis di sini supaya tidak ada human-error lupa
// menonaktifkan SEO per halaman. Kepadatan tampilan (dashboard data-dense vs kader
// sederhana) diatur di level halaman/komponen, bukan di layout ini.
useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} - KOPIPU Smart` : 'App - KOPIPU Smart'
  },
  meta: [
    { name: 'robots', content: 'noindex, nofollow' }
  ]
})
</script>

<template>
  <div>
    <slot />
  </div>
</template>
