// .global.ts -- jalan otomatis di SETIAP navigasi client-side (pola sama dengan
// onboarding.global.ts). Kader dan tenaga_kesehatan murni (tanpa role lain) cuma pengguna
// mobile-first (/app/**) -- SEBELUMNYA cuma homeRoute yang mengarahkan ke /app saat login/
// onboarding, tapi navigasi langsung ke URL /dashboard/** sesudahnya tetap tembus (middleware
// 'auth' di halaman dashboard cuma cek isAuthenticated, tidak cek role). Gate ini menutup celah
// itu supaya tenaga_kesehatan benar-benar tidak bisa masuk /dashboard sama sekali.
// docs/planning/12: kondisi allow-through SAMA persis dengan middleware/auth.ts (mode
// network-unknown pakai lastKnownProfile.roles buat cek isMobileOnly, karena authStore.roles
// sendiri kosong tanpa sesi live).
export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()

  let isMobileOnly: boolean
  if (authStore.isAuthenticated) {
    isMobileOnly = authStore.isMobileOnly
  } else if (authStore.restoreStatus === 'network-unknown' && authStore.lastKnownProfile) {
    const roles = authStore.lastKnownProfile.roles
    isMobileOnly = roles.length === 1 && (roles[0] === 'kader' || roles[0] === 'tenaga_kesehatan')
  } else {
    return
  }

  if (isMobileOnly && (to.path === '/dashboard' || to.path.startsWith('/dashboard/'))) {
    return navigateTo('/app')
  }

  // docs/planning/13: kader/nakes yang SUDAH login (live ATAU network-unknown/sesi tepercaya
  // offline) tidak perlu lihat landing page publik lagi -- terutama saat offline, supaya tidak
  // "terjebak" di halaman marketing statis tanpa jalan balik ke pekerjaan mereka begitu mendarat
  // di '/' (mis. PWA dibuka dari home screen). Dicek lewat to.meta.layout (bukan daftar path
  // manual) supaya otomatis ikut kalau ada halaman publik baru di masa depan.
  if (isMobileOnly && to.meta.layout === 'public') {
    return navigateTo('/app')
  }
})
