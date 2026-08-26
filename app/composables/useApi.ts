import type { ApiErrorEnvelope } from '~/types/api'

// Client HTTP dasar PRODULI — wajib dipakai oleh semua composable/store yang bicara ke backend
// (docs/planning/03 §3: "komponen tidak fetch API langsung, selalu lewat composable").
// credentials: 'include' wajib (CLAUDE.md) — tanpa ini refresh-token cookie tidak pernah terkirim.
export function useApi() {
  const config = useRuntimeConfig()

  return $fetch.create({
    baseURL: config.public.apiBase,
    credentials: 'include',
    onRequest({ options }) {
      // ofetch TIDAK selalu kirim Accept: application/json (terutama request tanpa body,
      // mis. /auth/refresh, /auth/logout) — tanpa ini Laravel expectsJson() gagal deteksi
      // dan balas halaman HTML debug, bukan envelope JSON. Ketahuan lewat smoke test nyata.
      options.headers = new Headers(options.headers)
      if (!options.headers.has('Accept')) {
        options.headers.set('Accept', 'application/json')
      }

      const authStore = useAuthStore()
      if (authStore.accessToken) {
        options.headers.set('Authorization', `Bearer ${authStore.accessToken}`)
      }
    },
    onResponseError({ response }) {
      const body = response._data as ApiErrorEnvelope | undefined

      // 403 { data: { code: 'MUST_CHANGE_PASSWORD' | 'ONBOARDING_REQUIRED' } } bisa muncul dari
      // endpoint mana pun (EnsurePasswordChanged / EnsureOnboardingCompleted backend) — tangani
      // sekali di sini, bukan per-halaman. Redirect target diketik `: string` (bukan literal
      // langsung ke navigateTo) supaya TS tidak mencoba mencocokkan ke union rute typed-pages
      // yang sangat besar di sini (dua literal rute berurutan dalam callback yang sama memicu
      // "excessive stack depth" dari compiler, murni keterbatasan type-checker, bukan bug logika).
      const errorCode = (body?.data as { code?: string } | undefined)?.code
      const route = useRoute()

      if (response.status === 403 && errorCode === 'MUST_CHANGE_PASSWORD' && route.path !== '/ganti-password') {
        const target: string = '/ganti-password'
        void navigateTo(target)
      }

      if (response.status === 403 && errorCode === 'ONBOARDING_REQUIRED' && route.path !== '/onboarding') {
        const target: string = '/onboarding'
        void navigateTo(target)
      }

      // BUG KRITIS (laporan user): sebelumnya 401 tidak ditangani sama sekali di sini -- pesan
      // error mentah backend ("Anda perlu login untuk mengakses resource ini") cuma tampil apa
      // adanya di manapun caller kebetulan menampilkannya (toast/banner), user tersangkut di
      // halaman yang sama sampai refresh manual. authStore sudah punya refresh proaktif
      // (scheduleProactiveRefresh() di stores/auth.ts) yang mencegah SEBAGIAN BESAR 401 ini
      // terjadi sama sekali -- blok ini jaring pengaman utk sisanya (mis. refresh proaktif
      // terlewat karena laptop baru bangun dari sleep, atau token dicabut manual/role berubah
      // di sisi lain). Cuma di area privat (/dashboard, /app -- satu-satunya yang dipasangi
      // middleware 'auth', lihat middleware/auth.ts) supaya TIDAK ikut memicu redirect paksa saat
      // pengunjung anonim membuka halaman publik (refresh() boot-time di auth.client.ts memang
      // sengaja dipanggil di semua halaman dan WAJAR 401 kalau belum pernah login).
      const isPrivateArea = route.path.startsWith('/dashboard') || route.path.startsWith('/app')
      if (response.status === 401 && isPrivateArea && route.path !== '/auth/login') {
        const authStore = useAuthStore()
        authStore.clearSession()
        const target: string = `/auth/login?redirect=${encodeURIComponent(route.fullPath)}`
        void navigateTo(target)
      }

      throw new ApiError(
        body?.message ?? 'Terjadi kesalahan pada server',
        response.status,
        body?.errors
      )
    }
  })
}
