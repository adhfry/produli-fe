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
    :content="{ side: 'top' }"
    :ui="{
      content: 'max-w-xs bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium rounded-lg px-3 py-2 shadow-lg ring-0 whitespace-normal text-left leading-relaxed z-[200]',
      arrow: 'fill-slate-800 dark:fill-slate-700'
    }"
  >
    <span class="contents" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
      <slot />
    </span>
    <template #content>
      <span @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">{{ text }}</span>
    </template>
  </UPopover>
</template>
