<script setup lang="ts">
import type { Component } from 'vue'
import { motion } from 'motion-v'
import { panduanColor, type PanduanColor } from '~/utils/panduan-colors'

// Header tiap halaman /panduan/* -- pola sama persis section header tentang-kami.vue/kontak.vue
// (bg-white, px-6 py-24 md:px-12 lg:px-24, motion fade+slide-up sekali saat masuk viewport),
// ditambah lencana ikon berwarna identitas peran dan link "kembali" untuk sub-halaman.
// `icon` WAJIB komponen ter-import dari '@lucide/vue', BUKAN string "LucideXxx" -- lihat
// docblock PanduanRoleMeta (utils/panduan-roles.ts) untuk alasannya.
const props = withDefaults(
  defineProps<{
    icon: Component
    color?: PanduanColor
    eyebrow: string
    title: string
    subtitle: string
    showBack?: boolean
  }>(),
  { color: 'primary', showBack: false }
)

const colorClasses = computed(() => panduanColor(props.color))
</script>

<template>
  <section class="bg-white px-6 py-24 md:px-12 lg:px-24">
    <div class="mx-auto max-w-4xl text-center">
      <motion.div
        :initial="{ opacity: 0, y: 30 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.8, ease: 'easeOut' }"
      >
        <NuxtLink
          v-if="showBack"
          to="/panduan"
          class="mb-8 inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-400 transition-colors hover:text-primary"
        >
          <LucideArrowLeft class="h-4 w-4" />
          Kembali ke Panduan Pengguna
        </NuxtLink>

        <div
          class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
          :class="colorClasses.badgeBg"
        >
          <component :is="icon" class="h-8 w-8" :class="colorClasses.icon" />
        </div>

        <p
          class="mb-3 text-sm font-semibold tracking-wide uppercase"
          :class="colorClasses.text"
        >
          {{ eyebrow }}
        </p>
        <h1
          class="mb-4 text-3xl font-extrabold text-accent sm:text-4xl md:text-5xl"
        >
          {{ title }}
        </h1>
        <p class="mx-auto max-w-2xl text-base text-neutral-600 sm:text-lg">
          {{ subtitle }}
        </p>
      </motion.div>
    </div>
  </section>
</template>
