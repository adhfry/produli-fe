// 3 sfx berbeda untuk 3 kategori notifikasi (permintaan eksplisit user):
// - Notifikasi biasa (bel/database, tipe apa pun selain FCM/rujukan): tung-nang.mp3
// - Notifikasi FCM (push browser, foreground onMessage): ti-nung.mp3
// - Alarm darurat (halaman /dashboard/rujukan, HANYA saat ada rujukan BARU muncul): alarm-darurat.webm
//
// Instance Audio dibuat SEKALI per key (module-level cache, bukan `new Audio()` tiap panggil)
// supaya browser tidak perlu re-fetch file tiap notifikasi. `.play()` dibungkus try/catch --
// kebijakan autoplay browser bisa menolak play() sebelum ada interaksi user sama sekali (jarang
// terjadi di sini karena notifikasi baru dicek SETELAH user login, tapi tetap dijaga defensif
// supaya tidak ada unhandled promise rejection di console).
const audioCache: Record<string, HTMLAudioElement> = {}

// Switch "Notifikasi Darurat" (permintaan user, default AKTIF) -- /dashboard/profil/pengaturan.vue
// yang mengubahnya. localStorage (BUKAN token/kredensial, jadi tidak melanggar larangan
// localStorage di CLAUDE.md -- itu cuma soal token auth) supaya preferensi per-DEVICE ini tetap
// tersimpan lintas sesi tanpa perlu endpoint backend baru (murni preferensi bunyi/UI lokal, tidak
// ada nilai buat siapa pun kalau disinkron ke server/device lain). Default true kalau belum
// pernah diatur -- staf yang benar-benar butuh alarm ini (respons cepat rujukan) tidak boleh
// diam-diam nonaktif tanpa mereka sadar.
const EMERGENCY_ALARM_STORAGE_KEY = 'produli_emergency_alarm_enabled'

export function isEmergencyAlarmEnabled(): boolean {
  if (import.meta.server) return true
  try {
    const stored = localStorage.getItem(EMERGENCY_ALARM_STORAGE_KEY)
    return stored === null ? true : stored === '1'
  } catch {
    return true
  }
}

export function setEmergencyAlarmEnabled(enabled: boolean) {
  if (import.meta.server) return
  try {
    localStorage.setItem(EMERGENCY_ALARM_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // Storage penuh/diblokir (private browsing dsb) -- preferensi cuma gagal tersimpan, bukan
    // error yang perlu menghentikan apa pun.
  }
}

function getAudio(key: string, src: string): HTMLAudioElement | null {
  if (import.meta.server) return null
  if (!audioCache[key]) {
    audioCache[key] = new Audio(src)
  }
  return audioCache[key]
}

function playSafely(audio: HTMLAudioElement | null) {
  if (!audio) return
  audio.currentTime = 0
  audio.play().catch(() => {
    // Autoplay diblokir browser (belum ada interaksi user) -- diamkan, bukan error nyata.
  })
}

export function useNotificationSound() {
  function playNormal() {
    playSafely(getAudio('normal', '/sfx/tung-nang.mp3'))
  }

  function playFcm() {
    playSafely(getAudio('fcm', '/sfx/ti-nung.mp3'))
  }

  function playAlarm() {
    if (!isEmergencyAlarmEnabled()) return
    playSafely(getAudio('alarm', '/sfx/alarm-darurat.webm'))
  }

  return { playNormal, playFcm, playAlarm }
}
