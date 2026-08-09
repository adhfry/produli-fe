// Auto-sync draft laporan kunjungan begitu koneksi pulih terdeteksi (docs/planning/10 §4:
// "sinkronisasi otomatis juga jalan diam-diam saat koneksi pulih terdeteksi -- bukan cuma
// manual") -- listener window 'online' GLOBAL (bukan cuma di /app/draft), supaya kader yang
// baru online lagi sementara berada di halaman lain (mis. /app/tugas) tetap ke-sync diam-diam.
// BUKAN Background Sync API service-worker asli (dukungan browser terbatas -- Safari/Firefox
// tidak dukung sama sekali) -- pendekatan foreground ini jalan di semua browser selama tab
// terbuka, cukup untuk kebutuhan nyata alur ini (kader submit lalu lanjut kerja di app yang
// sama, bukan menutup total aplikasi lalu berharap sync jalan sendiri di background OS).
export default defineNuxtPlugin(() => {
  if (import.meta.server) return

  let isSyncing = false
  async function trySync() {
    if (isSyncing || !navigator.onLine) return
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    isSyncing = true
    try {
      const queue = useOfflineQueue()
      const drafts = await queue.getAllDrafts()
      if (drafts.some((d) => d.status === 'pending_sync')) {
        await queue.syncAllDrafts()
      }
    } catch {
      // Diam-diam -- kegagalan auto-sync tidak boleh mengganggu; kader tetap bisa sinkron
      // manual dari /app/draft kalau ini gagal.
    } finally {
      isSyncing = false
    }
  }

  window.addEventListener('online', trySync)
  // Cek juga saat app boot -- menangkap draft yang sudah ada dari sebelum reload/reopen app,
  // pada device yang kebetulan sudah online saat itu.
  setTimeout(trySync, 3000)
})
