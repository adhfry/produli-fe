import type { ApiSuccessEnvelope, AuthTokenResponse, MeResponse, Role, User } from '~/types/api'

// docs/planning/03 §3: token otentikasi TIDAK boleh di-persist (CLAUDE.md — dilarang localStorage).
// Hanya `deviceId` yang disimpan (bukan kredensial, cuma identitas perangkat untuk
// /auth/login & /auth/refresh) — accessToken/user/roles selalu di-memory, dipulihkan lewat
// refresh() (httpOnly cookie) saat app di-reload.
export const useAuthStore = defineStore(
  'auth',
  () => {
    const user = ref<User | null>(null)
    const roles = ref<Role[] | null>(null)
    const accessToken = ref<string | null>(null)
    const expiresAt = ref<string | null>(null)
    const deviceId = ref<string>('')

    const isAuthenticated = computed(() => !!accessToken.value && !!user.value)

    // Kader murni (tanpa role lain) -> /app. Role apa pun selain itu, termasuk dual-role
    // pj_prolanis+kader -> /dashboard (dashboard yang menyediakan entry point ke mode kader).
    const isKaderOnly = computed(() => {
      const r = roles.value ?? []
      return r.length === 1 && r[0] === 'kader'
    })
    const homeRoute = computed(() => (isKaderOnly.value ? '/app' : '/dashboard'))

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
    }

    function clearSession() {
      accessToken.value = null
      expiresAt.value = null
      user.value = null
      roles.value = null
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
    }

    // Dipanggil saat app boot untuk memulihkan sesi dari httpOnly cookie produli_refresh_token
    // (lihat docs/planning/05 §Auth) — belum di-wire ke plugin/middleware, itu langkah berikutnya.
    async function refresh() {
      const api = useApi()
      const res = await api<ApiSuccessEnvelope<AuthTokenResponse>>('/auth/refresh', {
        method: 'POST',
        headers: { 'X-Device-Id': ensureDeviceId() }
      })
      setSession(res.data)
      // /auth/refresh sengaja tidak mengirim ulang user/roles — ambil terpisah kalau belum ada di state.
      if (!user.value) {
        await fetchMe()
      }
    }

    async function logout() {
      const api = useApi()
      try {
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
      isAuthenticated,
      isKaderOnly,
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
      pick: ['deviceId'],
      storage: piniaPluginPersistedstate.localStorage()
    }
  }
)
