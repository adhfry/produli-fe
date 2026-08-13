<script setup lang="ts">
// KHUSUS branch `dev`/lingkungan simulasi -- ribbon peringatan kalau
// NUXT_PUBLIC_APP_ENV_LABEL diisi (mis. "SIMULASI"), supaya tidak ada yang salah kira
// data demo sebagai data produksi live saat presentasi/screenshot. Kosong di build
// produksi normal -- render null sama sekali (bukan cuma disembunyikan lewat CSS).
const config = useRuntimeConfig()
const label = config.public.appEnvLabel as string
</script>

<template>
  <div
    v-if="label"
    class="fixed inset-x-0 top-0 z-[100] flex h-9 items-center justify-center gap-2 bg-warning px-4 text-center text-xs font-bold tracking-wide text-warning-950 shadow-sm"
  >
    <LucideFlaskConical class="h-3.5 w-3.5 shrink-0" />
    <span>MODE {{ label }} — DATA BUKAN DATA PRODUKSI LIVE</span>
  </div>
</template>
