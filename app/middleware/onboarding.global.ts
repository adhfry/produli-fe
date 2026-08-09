// .global.ts -- jalan otomatis di SETIAP navigasi client-side, tidak perlu didaftarkan per
// halaman (beda dari middleware/auth.ts yang opt-in). User yang SUDAH LOGIN tapi belum pernah
// onboarding (onboarding_completed_at masih null) dipaksa ke /onboarding SEBELUM sempat
// menyentuh halaman /dashboard atau /app mana pun (docs/planning/02 §14, pola sama dengan
// must_change_password). Sebelumnya cuma digerbangi reaktif lewat useApi.ts (baru redirect
// SETELAH panggilan API pertama kena 403 ONBOARDING_REQUIRED) -- celah itu muncul kalau halaman
// yang dibuka kebetulan tidak langsung memanggil endpoint tergerbang saat mount.
const GATED_PREFIXES = ['/dashboard', '/app']

export default defineNuxtRouteMiddleware((to) => {
  if (!GATED_PREFIXES.some((prefix) => to.path === prefix || to.path.startsWith(`${prefix}/`))) {
    return
  }

  const authStore = useAuthStore()
  // Belum login sama sekali bukan tanggung jawab gate ini -- biarkan (belum ada middleware auth
  // global yang menjaga /dashboard & /app, itu isu terpisah, di luar cakupan perbaikan ini).
  if (!authStore.isAuthenticated) {
    return
  }

  if (authStore.user?.onboarding_completed_at === null) {
    const target: string = '/onboarding'
    return navigateTo(target)
  }
})
