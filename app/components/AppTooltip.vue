<script setup lang="ts">
// SEBELUMNYA UTooltip (Reka UI, hover-only) -- di /app (PWA kader/nakes) tidak ada mouse sama
// sekali, tooltip efektif tidak pernah bisa dibuka di mobile. Lalu diganti UPopover mode="click"
// -- tapi itu menghilangkan hover di desktop yang sebelumnya sudah jalan. Sekarang dukung
// KEDUANYA sekaligus: UPopover di-kontrol manual lewat `isOpen` (bukan pasrah ke mode bawaan
// Popover/HoverCard yang cuma bisa salah satu), mouseenter/mouseleave nambah hover DI ATAS
// klik/tap yang sudah ada (klik tetap jalan lewat update:open bawaan Popover mode="click" --
// termasuk tutup otomatis saat tap di luar/Escape, tidak perlu ditulis ulang). Span pembungkus
// `contents` supaya tidak menambah node layout apa pun -- cuma tempat menempelkan listener hover.
defineProps<{
  text: string
}>()

// BUG: tooltip muncul di pojok kiri atas viewport, bukan di dekat elemen yang di-hover.
// Akar masalah: UPopover.Trigger dipasang `as-child` (Popover.vue Nuxt UI), jadi Floating UI
// pakai elemen span pembungkus `.contents` di bawah sebagai anchor pengukuran posisi -- padahal
// `display:contents` TIDAK PERNAH punya bounding box sendiri (getBoundingClientRect selalu
// {0,0,0,0} di semua browser modern, batasan CSS spec, bukan bug Reka UI/Floating UI). Floating
// UI lalu menghitung posisi relatif ke rect kosong itu, hasilnya "menempel" ke pojok kiri atas.
// Fix: JANGAN andalkan bounding box span pembungkus -- ambil elemen SUNGGUHAN yang di-slot
// (anak pertama span, yang genuine punya geometri) lewat template ref, lalu berikan eksplisit
// ke prop `reference` UPopover (PopperContent.vue: `reference = props.reference ?? rootContext.
// anchor.value` -- reference eksplisit SELALU menang atas auto-detect dari Trigger). Span tetap
// `display:contents` seperti semula (supaya tidak menambah node layout apa pun, perilaku lama
// dipertahankan persis), cuma dipakai utk listener hover + referensi elemen, bukan lagi diandalkan
// geometrinya.
const wrapperRef = useTemplateRef<HTMLElement>('wrapper')
const anchorEl = computed(() => wrapperRef.value?.firstElementChild ?? undefined)

const isOpen = ref(false)
let hoverCloseTimer: ReturnType<typeof setTimeout> | null = null

function handleMouseEnter() {
  if (hoverCloseTimer) {
    clearTimeout(hoverCloseTimer)
    hoverCloseTimer = null
  }
  isOpen.value = true
}

// Delay kecil sebelum menutup -- mencegah tooltip berkedip kalau kursor sekilas keluar-masuk
// area pemicu (jitter mouse wajar, bukan benar-benar "sudah tidak hover").
function handleMouseLeave() {
  hoverCloseTimer = setTimeout(() => {
    isOpen.value = false
  }, 100)
}
</script>

<template>
  <UPopover
    mode="click"
    :open="isOpen"
    @update:open="isOpen = $event"
    :arrow="true"
    :reference="anchorEl"
    :content="{ side: 'top' }"
    :ui="{
      content: 'max-w-xs bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium rounded-lg px-3 py-2 shadow-lg ring-0 whitespace-normal text-left leading-relaxed z-[200]',
      arrow: 'fill-slate-800 dark:fill-slate-700'
    }"
  >
    <span ref="wrapper" class="contents" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
      <slot />
    </span>
    <template #content>
      <span @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">{{ text }}</span>
    </template>
  </UPopover>
</template>
