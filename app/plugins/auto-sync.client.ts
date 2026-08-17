// docs/planning/13: timer latar belakang buat useAutoSync().syncNow() -- OPT-IN lewat toggle di
// /app/profil/sinkronisasi-otomatis (default MATI, lihat stores/autoSync.ts). Tiap detak dijaga
// beberapa syarat supaya tidak boros baterai/kuota kader di lapangan: harus enabled, harus
// online, tab harus AKTIF (document.visibilityState -- tidak jalan kalau layar dikunci/app
// diminimize), dan cuma untuk kader/nakes (isMobileOnly, dashboard role tidak butuh ini).
export default defineNuxtPlugin(() => {
  const autoSyncStore = useAutoSyncStore()
  const authStore = useAuthStore()
  const { syncNow } = useAutoSync()

  let timer: ReturnType<typeof setInterval> | null = null

  async function tick() {
    if (!autoSyncStore.enabled) return
    if (!navigator.onLine) return
    if (document.visibilityState !== 'visible') return
    if (!authStore.isAuthenticated || !authStore.isMobileOnly) return
    await syncNow()
  }

  function reschedule() {
    if (timer) clearInterval(timer)
    timer = null
    if (!autoSyncStore.enabled) return
    timer = setInterval(tick, autoSyncStore.intervalMinutes * 60_000)
  }

  reschedule()
  // Ganti interval/toggle di halaman pengaturan langsung berlaku tanpa perlu reload.
  watch(() => [autoSyncStore.enabled, autoSyncStore.intervalMinutes], reschedule)
  // Sinkron oportunistik begitu koneksi pulih (pola sama dengan offline-sync.client.ts &
  // auth.client.ts) -- tick() sendiri sudah menjaga semua syarat di atas, aman dipanggil langsung.
  window.addEventListener('online', tick)
})
