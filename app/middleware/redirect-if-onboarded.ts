// Pasang lewat definePageMeta({ middleware: ['auth', 'redirect-if-onboarded'] }) -- KHUSUS
// /onboarding, kebalikan dari onboarding.global.ts (yang mendorong user BELUM onboarding MASUK
// ke halaman ini). User yang SUDAH login DAN sudah pernah menyelesaikan onboarding
// (onboarding_completed_at terisi) tidak boleh membuka /onboarding lagi -- langsung ditendang
// ke homeRoute (dashboard/app sesuai role), bukan dibiarkan mengulang alur yang sudah selesai.
export default defineNuxtRouteMiddleware(() => {
  const authStore = useAuthStore()

  if (authStore.isAuthenticated && authStore.user?.onboarding_completed_at != null) {
    const target: string = authStore.homeRoute
    return navigateTo(target)
  }
})
