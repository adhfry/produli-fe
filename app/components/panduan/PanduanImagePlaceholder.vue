<script setup lang="ts">
// Kotak placeholder screenshot -- SENGAJA tidak ada gambar asli, cuma label persis sesuai
// "[Gambar: ...]" yang ditulis user di 12-brief-halaman-panduan-pengguna.md, supaya gampang
// dicari-ganti manual nanti. aspect="tall" untuk tangkapan layar aplikasi mobile (Tenaga
// Kesehatan/Kader, PWA layar HP), "wide" untuk dashboard/halaman web (default).
withDefaults(
  defineProps<{
    label: string
    aspect?: 'wide' | 'tall'
  }>(),
  { aspect: 'wide' }
)
</script>

<template>
  <div
    class="mx-auto w-full overflow-hidden rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50"
    :class="aspect === 'tall' ? 'aspect-9/16 max-w-[220px]' : 'aspect-video'"
  >
    <div class="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
      <div class="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-200 text-neutral-400">
        <LucideImage class="h-5 w-5" />
      </div>
      <p class="text-xs font-medium leading-snug text-neutral-400">
        [Gambar: {{ label }}]
      </p>
    </div>
  </div>
</template>
