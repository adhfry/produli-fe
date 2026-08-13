<script setup lang="ts">
import type { Component } from 'vue'
import { motion } from 'motion-v'
import { panduanColor, type PanduanColor } from '~/utils/panduan-colors'

// `icon` WAJIB komponen ter-import dari '@lucide/vue', bukan string "LucideXxx" -- lihat
// docblock PanduanRoleMeta (utils/panduan-roles.ts).
const props = withDefaults(
  defineProps<{
    to: string
    icon: Component
    color?: PanduanColor
    title: string
    description: string
    delay?: number
  }>(),
  { color: 'primary', delay: 0 }
)

const colorClasses = computed(() => panduanColor(props.color))
</script>

<template>
  <motion.div
    :initial="{ opacity: 0, y: 24 }"
    :while-in-view="{ opacity: 1, y: 0 }"
    :in-view-options="{ once: true, amount: 0.3 }"
    :transition="{ duration: 0.5, ease: 'easeOut', delay }"
  >
    <NuxtLink
      :to="to"
      class="group flex h-full flex-col rounded-3xl border-2 border-neutral-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg sm:p-8"
    >
      <div
        class="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
        :class="colorClasses.badgeBg"
      >
        <component :is="icon" class="h-7 w-7" :class="colorClasses.icon" />
      </div>
      <h3 class="mb-2 text-xl font-bold text-accent">{{ title }}</h3>
      <p class="mb-6 flex-1 text-sm leading-relaxed text-neutral-600">
        {{ description }}
      </p>
      <span
        class="inline-flex items-center gap-1.5 text-sm font-bold"
        :class="colorClasses.text"
      >
        Lihat Panduan Lengkap
        <LucideArrowRight
          class="h-4 w-4 transition-transform group-hover:translate-x-1"
        />
      </span>
    </NuxtLink>
  </motion.div>
</template>
