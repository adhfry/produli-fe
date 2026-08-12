<script setup lang="ts">
// Pembungkus tipis UTooltip (Nuxt UI) -- default TIDAK truncate isinya, beda dari tema bawaan
// Nuxt UI yang truncate 1 baris (.nuxt/ui/tooltip.ts: slots.text = "truncate"). Tooltip di
// aplikasi ini SELALU dipakai untuk menampilkan teks yang SUDAH terpotong secara visual di
// elemen pemicunya (nama puskesmas/pasien yang truncate di tabel, penjelasan Tingkat
// Kepatuhan, rincian transisi kinerja puskesmas, dsb.) -- kalau isi tooltip-nya sendiri ikut
// ke-truncate, seluruh tujuan menambahkan tooltip itu gagal (ditemukan lewat verifikasi
// visual: "Tingkat Kepatuhan = persentase kunjungan yang su..." di kartu dashboard).
defineProps<{
  text: string
}>()
</script>

<template>
  <UTooltip :text="text" :content="{ side: 'top' }" :ui="{ content: 'max-w-xs', text: 'whitespace-normal text-left' }">
    <slot />
  </UTooltip>
</template>
