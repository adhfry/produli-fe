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
    playSafely(getAudio('alarm', '/sfx/alarm-darurat.webm'))
  }

  return { playNormal, playFcm, playAlarm }
}
