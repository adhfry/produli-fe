<script setup lang="ts">
import type { Component } from 'vue'
import { motion } from 'motion-v'
import { panduanColor, type PanduanColor } from '~/utils/panduan-colors'

// Kartu 1 kemampuan/fitur di seksi "Yang Bisa Dilihat & Dilakukan" (dan sejenisnya) tiap
// sub-halaman /panduan/*. `icon` WAJIB komponen ter-import dari '@lucide/vue' (lihat docblock
// PanduanRoleMeta di utils/panduan-roles.ts) -- BUKAN string "LucideXxx", <component
// :is="'LucideXxx'"> tidak bisa resolve string itu di runtime (cuma tag statis yang di-resolve
// otomatis oleh Nuxt).
const props = withDefaults(
  defineProps<{
    icon: Component
    title: string
    color?: PanduanColor
    delay?: number
  }>(),
  { color: 'primary', delay: 0 }
)

const colorClasses = computed(() => panduanColor(props.color))
</script>

<template>
  <motion.div
    class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
    :initial="{ opacity: 0, y: 20 }"
    :while-in-view="{ opacity: 1, y: 0 }"
    :in-view-options="{ once: true, amount: 0.3 }"
    :transition="{ duration: 0.5, ease: 'easeOut', delay }"
  >
    <div
      class="mb-4 flex h-11 w-11 items-center justify-center rounded-full"
      :class="colorClasses.badgeBg"
    >
      <component :is="icon" class="h-5 w-5" :class="colorClasses.icon" />
    </div>
    <h4 class="mb-2 text-lg font-bold text-accent">{{ title }}</h4>
    <p class="leading-relaxed text-neutral-600">
      <slot />
    </p>
    <div class="mt-4 flex flex-wrap gap-3">
      <slot name="images" />
    </div>
  </motion.div>
</template>
