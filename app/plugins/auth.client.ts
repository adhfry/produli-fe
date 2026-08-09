// Client-only & async: Nuxt menunggu plugin ini selesai sebelum navigasi awal di-resolve,
// jadi middleware/auth.ts sudah lihat authStore ter-restore (kalau ada cookie refresh valid)
// sebelum sempat memutuskan redirect. Tidak jalan di SSR — cookie httpOnly kopipu_refresh_token
// baru bisa dibaca lewat request browser sungguhan (docs/planning/03 §3).
export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore()
  try {
    await authStore.refresh()
  } catch {
    // Tidak ada sesi valid (belum login / cookie refresh kedaluwarsa) — biarkan,
    // middleware/auth.ts yang urus redirect ke halaman login kalau perlu.
  }
})
