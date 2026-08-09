<script setup lang="ts">
import type { VisitReportDraft } from '~/composables/useOfflineQueue'

definePageMeta({
  layout: 'pwa',
  middleware: 'auth'
})
useHead({
  title: 'Kunjungan Belum Terkirim'
})

const queue = useOfflineQueue()
const drafts = ref<VisitReportDraft[]>([])
const isLoading = ref(true)

async function reload() {
  isLoading.value = true
  drafts.value = await queue.getAllDrafts()
  isLoading.value = false
}
onMounted(reload)

function formatSavedAt(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()
  const time = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `Hari ini, ${time}`
  if (isYesterday) return `Kemarin, ${time}`
  return `${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}, ${time}`
}

const isSyncing = ref(false)
const syncProgress = ref({ current: 0, total: 0 })
const lastSyncResult = ref('')

async function startSync() {
  if (drafts.value.length === 0 || isSyncing.value) return
  isSyncing.value = true
  lastSyncResult.value = ''
  syncProgress.value = { current: 0, total: drafts.value.length }

  const result = await queue.syncAllDrafts((current, total) => {
    syncProgress.value = { current, total }
  })

  isSyncing.value = false
  lastSyncResult.value = result.failed === 0
    ? `${result.succeeded} laporan berhasil disinkronkan.`
    : `${result.succeeded} berhasil, ${result.failed} gagal — periksa detail di bawah.`
  await reload()
}

async function removeDraft(id: string) {
  if (!confirm('Hapus draft ini? Data yang sudah diisi akan hilang dan kunjungan perlu diulang dari awal.')) return
  await queue.deleteDraft(id)
  await reload()
}
</script>

<template>
  <div>
    <!-- Sticky Header -->
    <div class="px-5 pt-8 pb-4 bg-white dark:bg-slate-900 sticky top-0 z-40 border-b border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
      <div class="flex items-center gap-3 mb-4">
        <NuxtLink to="/app" class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-all shrink-0">
          <LucideArrowLeft class="w-5 h-5" />
        </NuxtLink>
        <h1 class="text-xl font-extrabold text-accent dark:text-white transition-colors">Belum Terkirim</h1>
      </div>

      <!-- Sync Button & Progress -->
      <div v-if="drafts.length > 0">
        <button
          v-if="!isSyncing"
          @click="startSync"
          class="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm transition-all shadow-sm shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <LucideRefreshCw class="w-4 h-4" />
          Sinkronkan Sekarang ({{ drafts.length }})
        </button>

        <div v-else class="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-bold text-primary flex items-center gap-2">
              <LucideLoader2 class="w-4 h-4 animate-spin" />
              Mengunggah {{ syncProgress.current }} dari {{ syncProgress.total }}...
            </span>
            <span class="text-xs font-bold text-slate-500">{{ Math.round((syncProgress.current / syncProgress.total) * 100) }}%</span>
          </div>
          <div class="h-2 w-full bg-primary/20 rounded-full overflow-hidden">
            <div
              class="h-full bg-primary transition-all duration-300"
              :style="{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }"
            ></div>
          </div>
        </div>

        <p v-if="lastSyncResult" class="text-xs font-semibold text-slate-500 mt-2 text-center">{{ lastSyncResult }}</p>
      </div>
    </div>

    <!-- Draft List -->
    <div class="p-5 space-y-4">
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-16 text-slate-400">
        <LucideLoader2 class="w-8 h-8 animate-spin mb-3" />
        <p class="text-base font-medium">Memuat draft tersimpan...</p>
      </div>

      <div v-else-if="drafts.length === 0" class="text-center py-12 px-4">
        <div class="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4">
          <LucideCheckCircle2 class="w-8 h-8" />
        </div>
        <h3 class="font-bold text-slate-800 dark:text-white text-lg mb-2">Semua Data Terkirim</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">Tidak ada draft kunjungan yang menunggu sinkronisasi.</p>
      </div>

      <div v-for="draft in drafts" :key="draft.id" class="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden transition-all duration-300">
        <!-- Edge Indicator -->
        <div class="absolute left-0 top-0 bottom-0 w-1.5" :class="draft.status === 'failed' ? 'bg-danger' : 'bg-warning'"></div>

        <div class="pl-2">
          <div class="flex items-start justify-between mb-2">
            <h3 class="font-bold text-slate-800 dark:text-white text-lg">{{ draft.patientNama }}</h3>
            <span
              class="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border shrink-0"
              :class="draft.status === 'failed' ? 'text-danger bg-danger/10 border-danger/20' : 'text-warning-700 bg-warning/10 border-warning/20'"
            >
              {{ draft.status === 'failed' ? 'Gagal' : 'Menunggu' }}
            </span>
          </div>

          <div class="flex items-center gap-2 mb-3">
            <LucideSave class="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <p class="text-xs font-medium text-slate-500">Tersimpan: {{ formatSavedAt(draft.createdAt) }}</p>
          </div>

          <div v-if="draft.status === 'failed' && draft.lastError" class="flex items-start gap-2 bg-danger/5 p-3 rounded-xl mb-3">
            <LucideAlertCircle class="w-4 h-4 text-danger shrink-0 mt-0.5" />
            <p class="text-xs font-medium text-danger">{{ draft.lastError }}</p>
          </div>

          <button
            @click="removeDraft(draft.id)"
            class="text-xs font-bold text-slate-400 hover:text-danger transition-colors flex items-center gap-1.5"
          >
            <LucideTrash2 class="w-3.5 h-3.5" />
            Hapus Draft
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
