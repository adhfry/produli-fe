<script setup lang="ts">
import { motion } from 'motion-v'
import { panduanColor, type PanduanColor } from '~/utils/panduan-colors'

// Langkah bernomor -- dipakai untuk urutan "Cara Mendapatkan Akun"/"Cara Login" di tiap
// sub-halaman /panduan/*. Animasi fade+slide saat scroll ke tiap langkah (while-in-view) --
// transisi ini BERTUJUAN membantu pembaca fokus 1 langkah pada satu waktu, bukan dekorasi.
const props = withDefaults(
  defineProps<{
    number: number
    title?: string
    color?: PanduanColor
    isLast?: boolean
  }>(),
  { color: 'primary', isLast: false }
)

const colorClasses = computed(() => panduanColor(props.color))
</script>

<template>
  <div class="relative flex gap-4 pb-8 last:pb-0">
    <div class="flex flex-col items-center">
      <div
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white shadow-sm"
        :class="colorClasses.solidBg"
      >
        {{ number }}
      </div>
      <div v-if="!isLast" class="mt-1 w-0.5 flex-1 bg-neutral-200" />
    </div>
    <motion.div
      class="flex-1 pt-1"
      :initial="{ opacity: 0, y: 16 }"
      :while-in-view="{ opacity: 1, y: 0 }"
      :in-view-options="{ once: true, amount: 0.5 }"
      :transition="{ duration: 0.45, ease: 'easeOut' }"
    >
      <h4 v-if="title" class="mb-1.5 font-bold text-accent">{{ title }}</h4>
      <div class="leading-relaxed text-neutral-600">
        <slot />
      </div>
      <div class="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
        <slot name="images" />
      </div>
    </motion.div>
  </div>
</template>
