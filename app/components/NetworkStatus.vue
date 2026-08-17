<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { LucideCloudOff, LucideShieldAlert } from '#components'

const isOnline = ref(true)
const authStore = useAuthStore()
// docs/planning/12: mode "sesi tepercaya" -- authStore.refresh() gagal murni karena jaringan
// mati, tapi user tetap diizinkan masuk pakai lastKnownProfile (middleware/auth.ts). Banner ini
// yang membuat status itu KELIHATAN, supaya tidak diam-diam terasa seperti online normal.
const isSessionUnverified = computed(() => authStore.restoreStatus === 'network-unknown')

// docs/planning/10 §2: navigator.onLine cukup buat sinyal awal tapi tidak selalu akurat (bisa
// true walau internet sebenarnya mati), jadi ditegaskan dengan ping ringan ke backend.
// BUKAN '/api/up' (path relatif itu nunjuk ke origin Nuxt sendiri, yang tidak punya route itu
// -- selalu 404, ketahuan lewat banner "Mode Offline" yang muncul terus padahal backend hidup)
// MAUPUN root '/up' bawaan Laravel (bootstrap/app.php: health: '/up') -- route itu di luar
// prefix 'api/*' yang di-cover config/cors.php, jadi browser blokir preflight-nya duluan (CORS).
// MAUPUN fetch() mentah ke '/auth/me' TANPA header Accept: application/json -- tanpa itu
// middleware auth:sanctum yang menolak request unauthenticated mencoba redirect ke named route
// 'login' yang tidak ada di app API-only ini, jadi malah 500 (bukan 401 bersih). useApi() sudah
// selalu set header itu (lihat composables/useApi.ts) -- reuse itu, bukan fetch() mentah lagi.
// Respons apa pun (termasuk ApiError 401 belum login) membuktikan koneksi ke backend hidup,
// cuma exception jaringan murni (timeout/offline sungguhan) yang berarti offline.
const checkConnectivity = async () => {
  if (!navigator.onLine) {
    isOnline.value = false
    return
  }
  try {
    const api = useApi()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

    await api('/auth/me', { signal: controller.signal }).catch((err) => {
      // ApiError (401 dkk) = server MENJAWAB, itu tetap bukti koneksi hidup -- cuma exception
      // di luar itu (network-level) yang harus dianggap offline, lempar ulang supaya ketangkap
      // di catch luar.
      if (!(err instanceof ApiError)) throw err
    })

    clearTimeout(timeoutId)
    isOnline.value = true
  } catch (err) {
    isOnline.value = false
  }
}

let pingInterval: ReturnType<typeof setInterval>
// Temuan audit (docs/planning/15): SEBELUMNYA fungsi anonim baru didaftarkan di 'offline'
// listener lalu fungsi anonim BEDA (referensi lain) dipakai saat removeEventListener --
// removeEventListener selalu no-op karena referensinya tidak pernah cocok, listener menumpuk
// tiap komponen ini remount (mis. layout pwa.vue). Referensi bernama di sini supaya
// add/removeEventListener benar-benar menunjuk fungsi yang SAMA.
const handleOffline = () => { isOnline.value = false }

onMounted(() => {
  isOnline.value = navigator.onLine
  checkConnectivity()

  window.addEventListener('online', checkConnectivity)
  window.addEventListener('offline', handleOffline)

  pingInterval = setInterval(checkConnectivity, 15000)
})

onUnmounted(() => {
  window.removeEventListener('online', checkConnectivity)
  window.removeEventListener('offline', handleOffline)
  clearInterval(pingInterval)
})
</script>

<template>
  <div
    class="sticky top-0 z-[100] flex justify-center pointer-events-none transition-all duration-300"
    :class="!isOnline ? 'h-auto pt-0 bg-warning text-warning-950 shadow-md pointer-events-auto'
      : isSessionUnverified ? 'h-auto pt-0 bg-info text-info-950 shadow-md pointer-events-auto'
      : 'h-0 overflow-visible pt-2'"
  >
    <div
      v-if="!isOnline"
      class="w-full px-4 py-2 flex items-center justify-center gap-2 text-[11px] font-bold transition-all"
    >
      <LucideCloudOff class="w-4 h-4 shrink-0" />
      <span>Mode Offline — data akan tersimpan lokal</span>
    </div>
    <!-- docs/planning/12: authStore.restoreStatus 'network-unknown' -- user diizinkan masuk
         pakai profil tersimpan (lastKnownProfile), tapi sesi belum sungguh terverifikasi ke
         server. Beda warna dari banner offline murni supaya tidak dikira status jaringan biasa. -->
    <div
      v-else-if="isSessionUnverified"
      class="w-full px-4 py-2 flex items-center justify-center gap-2 text-[11px] font-bold transition-all"
    >
      <LucideShieldAlert class="w-4 h-4 shrink-0" />
      <span>Sesi belum terverifikasi — data yang tampil mungkin tidak terbaru</span>
    </div>
    <div
      v-else
      class="bg-success/90 backdrop-blur-sm text-white px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5 text-[10px] font-bold pointer-events-auto transition-all"
    >
      <div class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
      Online
    </div>
  </div>
</template>
