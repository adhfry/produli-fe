// Pasang lewat definePageMeta({ middleware: 'auth' }) — sengaja opt-in per halaman
// (baru dipakai /dashboard dan /app), bukan middleware global.
export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()
  if (!authStore.isAuthenticated) {
    return navigateTo(`/auth/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
