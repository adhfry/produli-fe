<script setup lang="ts">
// docs/planning/13: pengaturan sinkronisasi otomatis latar belakang -- toggle OPT-IN (default
// mati), modal konfirmasi WAJIB muncul sekali saat DINYALAKAN (bukan tiap siklus -- itu akan
// mengganggu), menjelaskan bahwa data akan disimpan ke penyimpanan perangkat secara berkala.
definePageMeta({
  layout: 'pwa',
  middleware: 'auth'
})
useHead({
  title: 'Sinkronisasi Otomatis'
})

const autoSyncStore = useAutoSyncStore()
const { isRunning, syncNow } = useAutoSync()

const INTERVAL_OPTIONS = [
  { minutes: 1, label: '1 menit' },
  { minutes: 5, label: '5 menit' },
  { minutes: 15, label: '15 menit' },
  { minutes: 30, label: '30 menit' }
]

const showConfirmModal = ref(false)
const pendingIntervalMinutes = ref(autoSyncStore.intervalMinutes)

function requestEnable() {
  pendingIntervalMinutes.value = autoSyncStore.intervalMinutes || 5
  showConfirmModal.value = true
}

function confirmEnable() {
  autoSyncStore.intervalMinutes = pendingIntervalMinutes.value
  autoSyncStore.enabled = true
  showConfirmModal.value = false
}

function disable() {
  autoSyncStore.enabled = false
}

// Ganti interval SAAT SUDAH AKTIF tidak perlu konfirmasi ulang -- persetujuan awal (modal) sudah
// mencakup "disimpan berkala", cuma frekuensinya yang berubah.
function changeInterval(minutes: number) {
  autoSyncStore.intervalMinutes = minutes
}

// "Waktunya berjalan" -- lastSyncLabel SEBELUMNYA computed() murni dari Date.now(), yang BUKAN
// dependency reaktif, jadi labelnya BEKU di nilai saat pertama kali dihitung (cuma berubah
// kalau lastSyncAt sendiri berubah, bukan tiap detik berlalu). `now` di sini sengaja jadi
// dependency reaktif eksplisit yang di-tick tiap 30 detik -- cukup sering supaya "X menit lalu"
// terasa hidup, tidak perlu granularitas per detik untuk label sekasar ini.
const now = ref(Date.now())
useIntervalFn(() => { now.value = Date.now() }, 30_000)

const lastSyncLabel = computed(() => {
  if (!autoSyncStore.lastSyncAt) return 'Belum pernah'
  const diffMs = now.value - new Date(autoSyncStore.lastSyncAt).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Baru saja'
  if (diffMin < 60) return `${diffMin} menit lalu`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} jam lalu`
  return new Date(autoSyncStore.lastSyncAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
})

const manualSyncResult = ref('')
async function runManualSync() {
  manualSyncResult.value = ''
  const result = await syncNow()
  manualSyncResult.value = result.ok
    ? `Berhasil, ${result.patientsSynced} riwayat pasien diperbarui.`
    : 'Gagal sinkron -- pastikan Anda online.'
}
</script>

<template>
  <div>
    <div class="px-5 pt-8 pb-4 bg-white dark:bg-slate-900 sticky top-0 z-40 border-b border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
      <div class="flex items-center gap-3">
        <NuxtLink to="/app/profil" class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-all shrink-0">
          <LucideArrowLeft class="w-5 h-5" />
        </NuxtLink>
        <h1 class="text-xl font-extrabold text-accent dark:text-white transition-colors">Sinkronisasi Otomatis</h1>
      </div>
    </div>

    <div class="p-5">
      <div class="bg-primary/10 border border-primary/20 rounded-3xl p-5 mb-6 flex flex-col gap-2 shadow-sm transition-colors duration-300">
        <div class="flex items-center gap-2 text-primary font-bold">
          <LucideRefreshCw class="w-5 h-5" />
          <p>Kenapa fitur ini?</p>
        </div>
        <p class="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
          Menyegarkan daftar tugas & riwayat kunjungan pasien aktif secara berkala saat online,
          supaya saat Anda menyiapkan Mode Offline nanti, data yang tersimpan sudah lebih baru
          dan tidak perlu unduh besar-besaran lagi.
        </p>
      </div>

      <div class="bg-white dark:bg-slate-800 rounded-3xl p-2 shadow-sm border border-slate-100 dark:border-slate-700 mb-6 transition-colors duration-300">
        <div class="flex items-center justify-between p-4">
          <div class="flex-1 pr-4">
            <h3 class="font-bold text-slate-800 dark:text-white mb-0.5">Sinkronisasi Otomatis</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Perbarui data latar belakang setiap {{ autoSyncStore.intervalMinutes }} menit saat online.</p>
          </div>
          <button
            @click="autoSyncStore.enabled ? disable() : requestEnable()"
            class="w-12 h-6 rounded-full transition-colors relative shrink-0 border-2"
            :class="autoSyncStore.enabled ? 'bg-primary border-primary' : 'bg-slate-200 dark:bg-slate-700 border-slate-200 dark:border-slate-700'"
          >
            <div class="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm" :class="autoSyncStore.enabled ? 'left-[calc(100%-1.125rem)]' : 'left-0.5'"></div>
          </button>
        </div>
      </div>

      <div v-if="autoSyncStore.enabled" class="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 mb-6 transition-colors duration-300">
        <h3 class="font-bold text-slate-800 dark:text-white text-sm mb-3">Frekuensi</h3>
        <div class="grid grid-cols-4 gap-2 mb-4">
          <button
            v-for="opt in INTERVAL_OPTIONS"
            :key="opt.minutes"
            type="button"
            @click="changeInterval(opt.minutes)"
            class="py-2.5 rounded-xl border-2 text-center text-xs font-bold transition-colors"
            :class="autoSyncStore.intervalMinutes === opt.minutes ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'"
          >
            {{ opt.label }}
          </button>
        </div>
        <p class="text-xs text-slate-400 mb-4">Disarankan 5 menit -- cukup segar tanpa boros baterai/kuota.</p>

        <div class="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-4">
          <div>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wide">Terakhir disinkronkan</p>
            <p class="text-sm font-bold text-slate-700 dark:text-slate-200">{{ lastSyncLabel }}</p>
          </div>
          <button
            @click="runManualSync"
            :disabled="isRunning"
            class="px-4 py-2.5 bg-primary/10 text-primary rounded-xl font-bold text-xs flex items-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <LucideLoader2 v-if="isRunning" class="w-3.5 h-3.5 animate-spin" />
            <LucideRefreshCw v-else class="w-3.5 h-3.5" />
            {{ isRunning ? 'Menyinkronkan...' : 'Sinkronkan Sekarang' }}
          </button>
        </div>
        <p v-if="manualSyncResult" class="text-xs font-semibold text-slate-500 mt-2 text-center">{{ manualSyncResult }}</p>
      </div>
    </div>

    <!-- Modal Konfirmasi Aktivasi -- root satu elemen sama seperti /app/profil (page transition
         mode 'out-in' butuh satu root per halaman). -->
    <div v-if="showConfirmModal" class="fixed inset-0 z-70 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 sm:zoom-in duration-200">
        <div class="p-6 overflow-y-auto text-center flex flex-col items-center">
          <div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <LucideDatabaseZap class="w-8 h-8" />
          </div>
          <h3 class="font-black text-slate-800 dark:text-white text-lg mb-1">Aktifkan Sinkronisasi Otomatis?</h3>
          <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Data tugas & riwayat kunjungan pasien aktif akan diunduh dan disimpan ke penyimpanan
            perangkat ini setiap <strong class="text-slate-700 dark:text-slate-200">{{ pendingIntervalMinutes }} menit</strong>
            selama Anda online. Ini memakai kuota data & baterai secara berkala.
          </p>
        </div>
        <div class="px-6 py-5 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-3 shrink-0">
          <button
            @click="confirmEnable"
            class="w-full py-4 rounded-2xl font-bold text-white bg-primary active:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            Ya, Aktifkan
          </button>
          <button @click="showConfirmModal = false" class="w-full py-4 rounded-2xl font-bold text-slate-600 dark:text-slate-300 active:bg-slate-100 dark:active:bg-slate-700 transition-colors">
            Batal
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
