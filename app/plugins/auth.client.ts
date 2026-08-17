// Client-only & async: Nuxt menunggu plugin ini selesai sebelum navigasi awal di-resolve,
// jadi middleware/auth.ts sudah lihat authStore ter-restore (kalau ada cookie refresh valid)
// sebelum sempat memutuskan redirect. Tidak jalan di SSR — cookie httpOnly produli_refresh_token
// baru bisa dibaca lewat request browser sungguhan (docs/planning/03 §3).
//
// docs/planning/12: juga dengarkan event 'online' GLOBAL (pola SAMA dengan
// plugins/offline-sync.client.ts) untuk mencoba authStore.refresh() ULANG begitu koneksi pulih —
// tanpa ini, user yang mendarat di /auth/login karena boot offline (refresh() gagal network,
// authStore.restoreStatus jadi 'network-unknown') akan tersangkut di sana walau sinyal sudah
// kembali, sampai me-refresh halaman manual. Begitu refresh() sukses DAN user masih diam di
// halaman tamu, antar otomatis ke tujuannya (redirect query dari middleware/auth.ts kalau ada,
// fallback homeRoute).
export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore()

  async function tryRestore() {
    if (authStore.isAuthenticated) return
    try {
      await authStore.refresh()
    } catch {
      // Tidak ada sesi valid (belum login / cookie refresh kedaluwarsa), ATAU jaringan masih
      // mati — authStore.restoreStatus sudah mencatat mana yang terjadi, middleware/auth.ts &
      // guest.ts yang urus konsekuensinya. Biarkan di sini.
      return
    }

    const route = useRoute()
    if (route.path !== '/auth/login') return
    const redirectParam = route.query.redirect
    const target = typeof redirectParam === 'string' ? redirectParam : authStore.homeRoute
    await navigateTo(target)
  }

  await tryRestore()
  window.addEventListener('online', tryRestore)
})
