<script setup lang="ts">
import { PANDUAN_ROLES } from '~/utils/panduan-roles'
import { panduanColor } from '~/utils/panduan-colors'

// Navigasi silang di bagian bawah tiap sub-halaman /panduan/* -- "lihat peran lain" supaya
// pembaca (mis. Admin Puskesmas yang penasaran alur PJ Prolanis) tidak perlu balik ke /panduan
// dulu. `current` = key role halaman yang sedang dibuka (disembunyikan dari daftar).
const props = defineProps<{ current: string }>()

const otherRoles = computed(() => PANDUAN_ROLES.filter((r) => r.key !== props.current))
</script>

<template>
  <section class="bg-surface px-6 py-16 md:px-12 lg:px-24">
    <div class="mx-auto max-w-5xl">
      <h2 class="mb-6 text-center text-sm font-semibold tracking-wide text-neutral-400 uppercase">
        Lihat Panduan Peran Lain
      </h2>
      <div class="grid gap-3 sm:grid-cols-3">
        <NuxtLink
          v-for="role in otherRoles"
          :key="role.key"
          :to="role.to"
          class="group flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            :class="panduanColor(role.color).badgeBg"
          >
            <component :is="role.icon" class="h-5 w-5" :class="panduanColor(role.color).icon" />
          </div>
          <span class="text-sm font-bold text-accent">{{ role.title }}</span>
          <LucideArrowRight class="ml-auto h-4 w-4 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-1 group-hover:text-neutral-400" />
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
