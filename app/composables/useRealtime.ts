import { Socket, type Channel } from 'phoenix'
import type { ApiSuccessEnvelope } from '~/types/api'

// Satu koneksi socket dipakai BERSAMA seluruh app (bel notifikasi + dashboard/kunjungan +
// dashboard/rujukan), bukan 1 socket per composable caller -- module-level (bukan useState),
// instance Socket bukan data reaktif yang perlu SSR-safe. Reconnect otomatis (exponential
// backoff) sudah bawaan phoenix.js, tidak perlu logic reconnect manual di sini.
let socket: Socket | null = null
const channels = new Map<string, Channel>()
let tokenRefreshTimer: ReturnType<typeof setInterval> | null = null
let currentToken = ''

async function fetchToken(): Promise<string> {
  const api = useApi()
  const res = (await api('/ws-token')) as ApiSuccessEnvelope<{ token: string }>
  return res.data.token
}

// Token umur pendek (config produli.realtime.token_ttl_seconds sisi backend, default 1 jam) --
// direfresh proaktif tiap 45 menit supaya reconnect (mis. laptop baru bangun dari sleep) tidak
// pernah kena token basi. `params` di konstruktor Socket berupa FUNCTION (bukan object statis)
// supaya phoenix.js membaca currentToken TERBARU di setiap percobaan connect, termasuk reconnect.
function startTokenRefresh() {
  if (tokenRefreshTimer) clearInterval(tokenRefreshTimer)
  tokenRefreshTimer = setInterval(async () => {
    try {
      currentToken = await fetchToken()
    } catch {
      // Biarkan -- socket yang sedang terhubung tetap jalan pakai token lama sampai reconnect
      // berikutnya sempat coba fetch lagi (graceful degrade, sama prinsipnya dgn channel notifikasi lain).
    }
  }, 45 * 60 * 1000)
}

async function ensureSocket(): Promise<Socket | null> {
  const authStore = useAuthStore()
  if (!authStore.isAuthenticated) return null
  if (socket) return socket

  try {
    currentToken = await fetchToken()
  } catch {
    return null
  }

  const config = useRuntimeConfig()
  socket = new Socket(`${config.public.wssBase}/socket`, { params: () => ({ token: currentToken }) })
  socket.connect()
  startTokenRefresh()

  return socket
}

export function useRealtime() {
  // Handler dikembalikan lewat fungsi unsubscribe -- WAJIB dipanggil di onUnmounted() halaman
  // (bukan layout, itu hidup sepanjang sesi) supaya listener tidak menumpuk tiap kali halaman
  // dashboard/kunjungan atau dashboard/rujukan dibuka-tutup berulang.
  async function subscribe(topic: string, event: string, handler: (payload: unknown) => void): Promise<() => void> {
    const s = await ensureSocket()
    if (!s) return () => {}

    let channel = channels.get(topic)
    if (!channel) {
      channel = s.channel(topic, {})
      channel.join()
      channels.set(topic, channel)
    }
    const ref = channel.on(event, handler)

    return () => channel?.off(event, ref)
  }

  // Topic dashboard sesuai role user login -- dipakai halaman dashboard/kunjungan &
  // dashboard/rujukan buat tahu topic mana yang menyiarkan sinyal "daftar berubah" (lihat
  // RealtimeBroadcastService sisi backend). null = role ini memang tidak relevan (mis. kader).
  function dashboardTopic(): string | null {
    const authStore = useAuthStore()
    const roles = authStore.roles ?? []

    if (roles.includes('super_admin')) return 'role:super_admin'
    if ((roles.includes('admin_puskesmas') || roles.includes('pj_prolanis')) && authStore.user?.puskesmas_id) {
      return `puskesmas:${authStore.user.puskesmas_id}`
    }

    return null
  }

  function userTopic(): string | null {
    const authStore = useAuthStore()
    return authStore.user ? `user:${authStore.user.id}` : null
  }

  // WAJIB dipanggil saat logout (lihat authStore.clearSession()) -- tanpa ini socket module-level
  // di atas tetap hidup lintas sesi: kalau user lain login di tab/device yang sama tanpa reload
  // penuh, ensureSocket() akan melihat `socket` sudah truthy dan memakainya apa adanya, sehingga
  // user baru itu tetap "nyangkut" dengar topic milik user LAMA (uid/puskesmas beda) sampai
  // reconnect berikutnya. disconnect() total mereset state modul supaya ensureSocket() berikutnya
  // (dipanggil layout user baru via startRealtime()) minta token & connect dari nol.
  function disconnect() {
    if (tokenRefreshTimer) {
      clearInterval(tokenRefreshTimer)
      tokenRefreshTimer = null
    }
    channels.forEach((channel) => channel.leave())
    channels.clear()
    socket?.disconnect()
    socket = null
    currentToken = ''
  }

  return { subscribe, dashboardTopic, userTopic, disconnect }
}
