<script setup lang="ts">
import { LucideAlertTriangle } from '#components'

// Satu-satunya modal konfirmasi di seluruh aplikasi -- lihat ~/composables/useConfirm.ts.
// Gaya visual mengikuti persis pola modal konfirmasi yang sudah ada (mis. konfirmasi
// nonaktifkan staf di dashboard/staf/index.vue): kartu putih rounded-3xl, ikon lingkaran,
// judul, deskripsi, tombol Batal + tombol aksi berwarna sesuai tone.
const { state, respond } = useConfirm()

const TONE_CLASSES = {
  danger: { iconBg: 'bg-danger/10 text-danger', button: 'bg-danger hover:bg-danger/90' },
  warning: { iconBg: 'bg-warning/10 text-warning', button: 'bg-warning hover:bg-warning/90' }
}
</script>

<template>
  <div
    v-if="state.isOpen"
    class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
    @click.self="respond(false)"
  >
    <div class="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
      <div class="p-6">
        <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" :class="TONE_CLASSES[state.tone].iconBg">
          <LucideAlertTriangle class="w-7 h-7" />
        </div>
        <h3 class="font-bold text-accent dark:text-white text-lg mb-1">{{ state.title }}</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{{ state.description }}</p>
      </div>
      <div class="px-6 py-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-3 shrink-0">
        <button
          type="button"
          @click="respond(false)"
          class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          {{ state.cancelLabel }}
        </button>
        <button
          type="button"
          @click="respond(true)"
          class="py-2.5 px-6 rounded-xl font-bold text-white transition-colors shadow-sm"
          :class="TONE_CLASSES[state.tone].button"
        >
          {{ state.confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
