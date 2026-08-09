// Pasang lewat definePageMeta({ middleware: 'guest' }) -- kebalikan dari auth.ts. Untuk halaman
// yang cuma masuk akal buat tamu (belum login), misalnya /auth/login. User yang SUDAH login tapi
// coba buka halaman ini lagi ditendang ke homeRoute (dashboard/app sesuai role), bukan dibiarkan
// lihat form login sekali lagi.
export default defineNuxtRouteMiddleware(() => {
  const authStore = useAuthStore()
  if (authStore.isAuthenticated) {
    const target: string = authStore.homeRoute
    return navigateTo(target)
  }
})
