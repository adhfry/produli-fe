<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'

// Toggle terang/gelap — default situs tetap TERANG (docs/planning/06 §6, nuxt.config.ts
// colorMode.preference), ini cuma opsi manual buat yang mau. Animasi matahari <-> bulan.
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

function toggle() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}
</script>

<template>
  <ClientOnly>
    <button
      type="button"
      class="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-white text-neutral-600 transition-colors hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
      :aria-label="isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'"
      @click="toggle"
    >
      <AnimatePresence mode="wait">
        <motion.span
          :key="isDark ? 'moon' : 'sun'"
          class="flex items-center justify-center"
          :initial="{ opacity: 0, rotate: -90, scale: 0.5 }"
          :animate="{ opacity: 1, rotate: 0, scale: 1 }"
          :exit="{ opacity: 0, rotate: 90, scale: 0.5 }"
          :transition="{ duration: 0.3, ease: 'easeInOut' }"
        >
          <LucideMoon v-if="isDark" class="h-5 w-5" />
          <LucideSun v-else class="h-5 w-5" />
        </motion.span>
      </AnimatePresence>
    </button>

    <template #fallback>
      <div class="h-10 w-10 rounded-full border border-neutral-200 bg-white" />
    </template>
  </ClientOnly>
</template>
