// .global.ts -- jalan otomatis di SETIAP navigasi client-side (pola sama dengan
// onboarding.global.ts). Kader dan tenaga_kesehatan murni (tanpa role lain) cuma pengguna
// mobile-first (/app/**) -- SEBELUMNYA cuma homeRoute yang mengarahkan ke /app saat login/
// onboarding, tapi navigasi langsung ke URL /dashboard/** sesudahnya tetap tembus (middleware
// 'auth' di halaman dashboard cuma cek isAuthenticated, tidak cek role). Gate ini menutup celah
// itu supaya tenaga_kesehatan benar-benar tidak bisa masuk /dashboard sama sekali.
export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()
  if (!authStore.isAuthenticated) return

  if (authStore.isMobileOnly && (to.path === '/dashboard' || to.path.startsWith('/dashboard/'))) {
    return navigateTo('/app')
  }
})
