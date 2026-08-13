<script setup lang="ts">
import type { Component } from 'vue'
import { Info } from '@lucide/vue'

// Kotak catatan penting (mis. batasan wewenang peran) -- tone 'info' (biru, netral) atau
// 'warning' (amber, batasan/perhatian khusus). Warna status token resmi (docs/planning/07),
// bukan token identitas peran (PanduanColor) yang dipakai komponen lain di folder ini.
// `icon` WAJIB komponen ter-import dari '@lucide/vue' -- lihat docblock PanduanRoleMeta
// (utils/panduan-roles.ts) soal kenapa string "LucideXxx" tidak bisa dipakai di sini.
withDefaults(
  defineProps<{
    icon?: Component
    tone?: 'info' | 'warning'
  }>(),
  { icon: () => Info, tone: 'info' }
)
</script>

<template>
  <div
    class="flex items-start gap-4 rounded-2xl border p-5"
    :class="
      tone === 'warning'
        ? 'border-warning/30 bg-warning/10'
        : 'border-info/30 bg-info/10'
    "
  >
    <component
      :is="icon"
      class="h-6 w-6 shrink-0"
      :class="tone === 'warning' ? 'text-warning' : 'text-info'"
    />
    <p
      class="text-sm leading-relaxed font-medium"
      :class="tone === 'warning' ? 'text-warning-800' : 'text-info-800'"
    >
      <slot />
    </p>
  </div>
</template>
