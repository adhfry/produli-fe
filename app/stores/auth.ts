import type { ApiSuccessEnvelope, AuthTokenResponse, MeResponse, Role, User } from '~/types/api'

// docs/planning/03 §3: token otentikasi TIDAK boleh di-persist (CLAUDE.md — dilarang localStorage).
// Hanya `deviceId` yang disimpan (bukan kredensial, cuma identitas perangkat untuk
// /auth/login & /auth/refresh) — accessToken/user/roles selalu di-memory, dipulihkan lewat
// refresh() (httpOnly cookie) saat app di-reload.
// Profil tampilan non-rahasia yang di-cache untuk mode "sesi tepercaya" saat offline (docs/
// planning/12) -- BUKAN kredensial (tidak ada token/permission granular di sini), aman dipersist
// ke localStorage. Dipakai middleware/auth.ts & role-area.global.ts sebagai fallback SEKALI
// refresh() gagal murni karena jaringan mati (bukan ditolak server).
export interface LastKnownProfile {
  name: string
  avatarUrl: string | null
  homeRoute: string
  roles: Role[]
}

export const useAuthStore = defineStore(
  'auth',
  () => {
    const user = ref<User | null>(null)
    const roles = ref<Role[] | null>(null)
    const accessToken = ref<string | null>(null)
    const expiresAt = ref<string | null>(null)
    const deviceId = ref<string>('')

    // 'idle' -- belum pernah dicoba. 'pending' -- refresh() sedang berjalan. 'ok' -- sesi valid
    // terverifikasi server. 'network-unknown' -- refresh() gagal MURNI karena jaringan mati (tidak
    // ada jawaban server sama sekali), tapi lastKnownProfile ada -- sesi dianggap "tepercaya
    // sementara" sampai bisa diverifikasi ulang. 'rejected' -- server MENJAWAB (401 dkk), sesi
    // benar-benar habis, ini logout sungguhan.
    const restoreStatus = ref<'idle' | 'pending' | 'ok' | 'network-unknown' | 'rejected'>('idle')
    const lastKnownProfile = ref<LastKnownProfile | null>(null)

    const isAuthenticated = computed(() => !!accessToken.value && !!user.value)

    // Kader/tenaga_kesehatan/pengantar_sampel murni (tanpa role lain) -> /app -- ketiganya
    // pengguna lapangan dengan UI mobile-first yang sama (bottom nav di layout 'pwa'), bukan
    // pengguna dashboard. Role apa pun selain itu, termasuk kombinasi dual-role (mis.
    // pj_prolanis+kader) -> /dashboard (dashboard yang menyediakan entry point ke mode kader).
    const MOBILE_ONLY_ROLES: Role[] = ['kader', 'tenaga_kesehatan', 'pengantar_sampel']
    const isMobileOnly = computed(() => {
      const r = roles.value ?? []
      return r.length === 1 && MOBILE_ONLY_ROLES.includes(r[0] as Role)
    })
    const homeRoute = computed(() => (isMobileOnly.value ? '/app' : '/dashboard'))

    function ensureDeviceId() {
      if (!deviceId.value) {
        deviceId.value = crypto.randomUUID()
      }
      return deviceId.value
    }

    function setSession(response: AuthTokenResponse) {
      accessToken.value = response.access_token
      expiresAt.value = response.expires_at
      if (response.user) {
        user.value = response.user
      }
      if (response.roles) {
        roles.value = response.roles
      }
      scheduleProactiveRefresh()
    }

    // BUG KRITIS (laporan user): halaman yang dibiarkan standby (mis. layar monitoring puskesmas)
    // menampilkan error mentah "Anda perlu login..." begitu access token (TTL 30 menit,
    // config('sanctum.expiration')) kedaluwarsa -- sebelumnya TIDAK ADA mekanisme refresh proaktif
    // sama sekali, authStore.refresh() cuma dipanggil reaktif (boot app, event 'online', middleware
    // navigasi) sehingga sesi baru "ketahuan" habis saat request berikutnya gagal, dan tidak ada
    // yang meredirect ke /auth/login (lihat juga fix di useApi.ts onResponseError untuk jaring
    // pengaman kalau proactive refresh ini sendiri gagal/terlewat, mis. laptop baru bangun dari
    // sleep melewati beberapa siklus expiry sekaligus).
    //
    // Refresh dijadwalkan 2 menit SEBELUM expiresAt (bukan tepat saat itu) supaya ada margin utk
    // request yang sedang berjalan + latensi jaringan. Timer di-reset di setSession() (dipanggil
    // dari login/refresh/loginWithGoogleCode) supaya selalu menjadwal ulang dari expiresAt TERBARU,
    // dan dihentikan di clearSession() supaya tidak terus jalan setelah logout.
    let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null
    function scheduleProactiveRefresh() {
      if (proactiveRefreshTimer) clearTimeout(proactiveRefreshTimer)
      if (!expiresAt.value || !import.meta.client) return

      const msUntilExpiry = new Date(expiresAt.value).getTime() - Date.now()
      const REFRESH_MARGIN_MS = 2 * 60 * 1000
      const delay = Math.max(msUntilExpiry - REFRESH_MARGIN_MS, 5000)

      proactiveRefreshTimer = setTimeout(async () => {
        try {
          await refresh()
        } catch {
          // refresh() sendiri sudah membedakan 'rejected' (sesi sungguhan habis) dari
          // 'network-unknown' (offline sementara, jangan logout) -- kalau sungguhan rejected,
          // langsung antar ke /auth/login SEKARANG (bukan menunggu request berikutnya kena 401)
          // supaya halaman standby yang tidak sedang manggil API apa pun tetap ter-redirect.
          if (restoreStatus.value === 'rejected' && import.meta.client) {
            const route = useRoute()
            if (!route.path.startsWith('/auth/login')) {
              void navigateTo(`/auth/login?redirect=${encodeURIComponent(route.fullPath)}`)
            }
          }
        }
      }, delay)
    }

    // Snapshot profil tampilan non-rahasia (docs/planning/12) -- dipanggil setelah user/roles
    // benar-benar terisi (akhir refresh()/login()/loginWithGoogleCode()), JADI homeRoute yang
    // ter-snapshot sudah pasti sesuai roles terbaru.
    function snapshotLastKnownProfile() {
      if (!user.value) return
      lastKnownProfile.value = {
        name: user.value.name,
        avatarUrl: user.value.avatar_url ?? null,
        homeRoute: homeRoute.value,
        roles: roles.value ?? []
      }
    }

    function clearSession() {
      // Putus socket produli-wss di SINI (bukan cuma di logout()) supaya kedua jalur yang
      // mengosongkan sesi -- logout eksplisit DAN refresh-token ditolak server (lihat
      // restoreSession() di bawah) -- sama-sama tidak menyisakan koneksi realtime milik sesi lama.
      useRealtime().disconnect()
      if (proactiveRefreshTimer) {
        clearTimeout(proactiveRefreshTimer)
        proactiveRefreshTimer = null
      }
      accessToken.value = null
      expiresAt.value = null
      user.value = null
      roles.value = null
      lastKnownProfile.value = null
      restoreStatus.value = 'idle'
    }

    async function fetchMe() {
      const api = useApi()
      const res = await api<ApiSuccessEnvelope<MeResponse>>('/auth/me')
      user.value = res.data.user
      roles.value = res.data.roles
    }

    async function login(payload: { email: string, password: string, deviceName?: string }) {
      const api = useApi()
      const res = await api<ApiSuccessEnvelope<AuthTokenResponse>>('/auth/login', {
        method: 'POST',
        body: {
          email: payload.email,
          password: payload.password,
          device_id: ensureDeviceId(),
          device_name: payload.deviceName
        }
      })
      setSession(res.data)
      snapshotLastKnownProfile()
      restoreStatus.value = 'ok'
    }

    async function loginWithGoogleCode(code: string) {
      const api = useApi()
      const res = await api<ApiSuccessEnvelope<AuthTokenResponse>>('/auth/google/exchange', {
        method: 'POST',
        body: {
          code,
          device_id: ensureDeviceId()
        }
      })
      setSession(res.data)
      snapshotLastKnownProfile()
      restoreStatus.value = 'ok'
    }

    // Dipanggil saat app boot (plugins/auth.client.ts) untuk memulihkan sesi dari httpOnly cookie
    // produli_refresh_token, DAN dipanggil ulang tiap kali koneksi kembali (event 'online') supaya
    // user yang mendarat di /auth/login karena boot offline otomatis masuk lagi tanpa refresh
    // manual (docs/planning/12). restoreStatus membedakan "server benar-benar menolak" (rejected,
    // logout sungguhan) dari "jaringan mati, tidak sempat tanya server sama sekali"
    // (network-unknown, sesi lama TETAP dipercaya lewat lastKnownProfile -- middleware/auth.ts
    // yang memakainya).
    async function refresh() {
      restoreStatus.value = 'pending'
      const api = useApi()
      try {
        const res = await api<ApiSuccessEnvelope<AuthTokenResponse>>('/auth/refresh', {
          method: 'POST',
          headers: { 'X-Device-Id': ensureDeviceId() }
        })
        setSession(res.data)
        // /auth/refresh sengaja tidak mengirim ulang user/roles — ambil terpisah kalau belum ada di state.
        if (!user.value) {
          await fetchMe()
        }
        snapshotLastKnownProfile()
        restoreStatus.value = 'ok'
      } catch (err) {
        if (err instanceof ApiError) {
          // Server MENJAWAB (401 dkk) -- refresh token sungguh ditolak/kedaluwarsa, ini logout
          // sungguhan, cache profil lama tidak boleh dipakai lagi.
          clearSession()
          restoreStatus.value = 'rejected'
        } else if (lastKnownProfile.value) {
          // Exception jaringan murni (server tidak sempat menjawab) TAPI ada profil tepercaya
          // dari sesi sebelumnya -- JANGAN treat sebagai logout, biarkan user tetap masuk pakai
          // data cache sampai bisa diverifikasi ulang saat online (accessToken tetap null,
          // panggilan API yang butuh otentikasi tetap akan gagal apa adanya).
          restoreStatus.value = 'network-unknown'
        } else {
          restoreStatus.value = 'rejected'
        }
        throw err
      }
    }

    async function logout() {
      const api = useApi()
      try {
        // Hapus token FCM device ini dulu SEBELUM access token dicabut server (endpoint
        // /fcm-tokens butuh auth) -- mencegah device menerima push untuk sesi yang sudah
        // berakhir & mencegah baris token lama menumpuk (lihat FcmTokenController::store()).
        await useFcm().unregisterToken()
        await api('/auth/logout', { method: 'POST' })
      } finally {
        clearSession()
      }
    }

    return {
      user,
      roles,
      accessToken,
      expiresAt,
      deviceId,
      restoreStatus,
      lastKnownProfile,
      isAuthenticated,
      isMobileOnly,
      homeRoute,
      login,
      loginWithGoogleCode,
      refresh,
      logout,
      fetchMe
    }
  },
  {
    persist: {
      // lastKnownProfile BUKAN kredensial (nama, avatar, homeRoute, roles -- semua sudah tampil
      // di UI mana pun, tidak ada yang rahasia) -- accessToken tetap TIDAK PERNAH masuk sini,
      // CLAUDE.md tetap dipatuhi.
      pick: ['deviceId', 'lastKnownProfile'],
      storage: piniaPluginPersistedstate.localStorage()
    }
  }
)
