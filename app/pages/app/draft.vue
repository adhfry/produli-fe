<script setup lang="ts">
import type { VisitReportDraft } from '~/composables/useOfflineQueue'

definePageMeta({
  layout: 'pwa',
  middleware: 'auth'
})
useHead({
  title: 'Draf & Belum Terkirim'
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

// docs/planning/14: dua kelompok BEDA makna -- 'draft' murni WIP milik user (belum pernah dicoba
// kirim, tidak ikut sinkron otomatis), 'pending_sync'/'failed' pernah dicoba kirim tapi gagal
// karena jaringan (ikut sinkron otomatis begitu online). Dipisah jadi dua seksi supaya kader
// tidak bingung mana yang "menunggu koneksi" vs mana yang "masih saya kerjakan".
const wipDrafts = computed(() => drafts.value.filter((d) => d.status === 'draft'))
const pendingDrafts = computed(() => drafts.value.filter((d) => d.status !== 'draft'))

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
  if (pendingDrafts.value.length === 0 || isSyncing.value) return
  isSyncing.value = true
  lastSyncResult.value = ''
  syncProgress.value = { current: 0, total: pendingDrafts.value.length }

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
  const confirmed = await useConfirm().confirm({
    title: 'Hapus Draf Ini?',
    description: 'Data yang sudah diisi akan hilang dan kunjungan perlu diulang dari awal.',
    confirmLabel: 'Ya, Hapus'
  })
  if (!confirmed) return

  await queue.deleteDraft(id)
  await reload()
  useToast().add({ title: 'Draf dihapus', color: 'success' })
}

// Draft WIP ('draft') belum pernah dicoba kirim -- "kirim sekarang" berarti buka lagi halaman
// kunjungannya (form akan otomatis menawarkan pulihkan, lihat kunjungan/[id].vue), BUKAN
// langsung POST dari sini (form itu sendiri yang tahu cara membangun payload lengkap terkini).
function continueDraft(draft: VisitReportDraft) {
  navigateTo(`/app/kunjungan/${draft.payload.assignment_id}`)
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
        <h1 class="text-xl font-extrabold text-accent dark:text-white transition-colors">Draf & Belum Terkirim</h1>
      </div>

      <!-- Sync Button & Progress -- cuma untuk pendingDrafts (draft WIP tidak pernah disinkron) -->
      <div v-if="pendingDrafts.length > 0">
        <button
          v-if="!isSyncing"
          @click="startSync"
          class="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm transition-all shadow-sm shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <LucideRefreshCw class="w-4 h-4" />
          Sinkronkan Sekarang ({{ pendingDrafts.length }})
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

    <div class="p-5 space-y-6">
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-16 text-slate-400">
        <LucideLoader2 class="w-8 h-8 animate-spin mb-3" />
        <p class="text-base font-medium">Memuat draft tersimpan...</p>
      </div>

      <div v-else-if="wipDrafts.length === 0 && pendingDrafts.length === 0" class="text-center py-12 px-4">
        <div class="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4">
          <LucideCheckCircle2 class="w-8 h-8" />
        </div>
        <h3 class="font-bold text-slate-800 dark:text-white text-lg mb-2">Semua Data Terkirim</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">Tidak ada draf maupun laporan yang menunggu sinkronisasi.</p>
      </div>

      <template v-else>
        <!-- Draf WIP -- belum pernah dicoba kirim, murni disimpan user sendiri (manual/auto-save) -->
        <div v-if="wipDrafts.length > 0">
          <h2 class="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Draf Saya ({{ wipDrafts.length }})</h2>
          <div class="space-y-4">
            <div v-for="draft in wipDrafts" :key="draft.id" class="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden transition-all duration-300">
              <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-info"></div>
              <div class="pl-2">
                <div class="flex items-start justify-between mb-2">
                  <h3 class="font-bold text-slate-800 dark:text-white text-lg">{{ draft.patientNama }}</h3>
                  <span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border shrink-0 text-info bg-info/10 border-info/20">Draf</span>
                </div>
                <div class="flex items-center gap-2 mb-3">
                  <LucideSave class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <p class="text-xs font-medium text-slate-500">Diperbarui: {{ formatSavedAt(draft.updatedAt) }}</p>
                </div>
                <div class="flex gap-2">
                  <button @click="continueDraft(draft)" class="flex-1 py-2.5 bg-info/10 text-info rounded-xl font-bold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-1.5">
                    <LucidePencil class="w-4 h-4" />
                    Lanjutkan Isi
                  </button>
                  <button @click="removeDraft(draft.id)" class="px-4 py-2.5 text-slate-400 hover:text-danger transition-colors" aria-label="Hapus draf">
                    <LucideTrash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Menunggu Sinkron -- pernah dicoba kirim, gagal karena jaringan, otomatis dicoba lagi -->
        <div v-if="pendingDrafts.length > 0">
          <h2 class="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Menunggu Sinkron ({{ pendingDrafts.length }})</h2>
          <div class="space-y-4">
            <div v-for="draft in pendingDrafts" :key="draft.id" class="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden transition-all duration-300">
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
                  class="text-base font-bold text-slate-400 hover:text-danger transition-colors flex items-center gap-1.5"
                >
                  <LucideTrash2 class="w-4 h-4" />
                  Hapus Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
