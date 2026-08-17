// Pasang lewat definePageMeta({ middleware: 'auth' }) — sengaja opt-in per halaman
// (baru dipakai /dashboard dan /app), bukan middleware global.
// docs/planning/12: selain isAuthenticated (sesi live, accessToken ada), izinkan juga lewat saat
// restoreStatus === 'network-unknown' -- authStore.refresh() gagal MURNI karena jaringan mati
// (bukan ditolak server), tapi ada lastKnownProfile dari sesi sebelumnya yang masih dipercaya.
// Tanpa ini, app-shell yang sudah bisa boot offline (Bagian 1) percuma -- user tetap ditendang ke
// /auth/login walau sungguhan sudah login sebelumnya, cuma karena tidak ada sinyal.
export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()
  if (authStore.isAuthenticated) return
  if (authStore.restoreStatus === 'network-unknown' && authStore.lastKnownProfile) return

  return navigateTo(`/auth/login?redirect=${encodeURIComponent(to.fullPath)}`)
})
