<script setup lang="ts">
import type { PengirimanSampel } from '~/types/api'

definePageMeta({
  layout: 'pwa',
  middleware: 'auth'
})
useHead({
  title: 'Antar Sampel'
})

const route = useRoute()
const router = useRouter()
const batchId = computed(() => Number(route.params.id))
const authStore = useAuthStore()

const batch = ref<PengirimanSampel | null>(null)
const isLoading = ref(true)
const loadError = ref('')

const STATUS_LABELS: Record<string, string> = {
  ditugaskan: 'Menunggu Diberangkatkan',
  otw: 'Sedang Perjalanan',
  tiba_labkesda: 'Sudah Tiba',
  dikonfirmasi_labkesda: 'Dikonfirmasi Labkesda'
}

async function loadBatch() {
  isLoading.value = true
  loadError.value = ''
  try {
    const api = useApi()
    const res = await api(`/pengiriman-sampel/${batchId.value}`) as { data: PengirimanSampel }
    batch.value = res.data
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Gagal memuat tugas.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadBatch)

// --- Mulai Perjalanan ---
const isStartingOtw = ref(false)

async function startOtw() {
  isStartingOtw.value = true
  try {
    const api = useApi()
    await api(`/pengiriman-sampel/${batchId.value}/start-otw`, { method: 'POST' })
    await loadBatch()
    startHeartbeatLoop()
    useToast().add({ title: 'Perjalanan dimulai', color: 'success' })
  } catch (e) {
    useToast().add({ title: e instanceof ApiError ? e.message : 'Gagal memulai perjalanan', color: 'error' })
  } finally {
    isStartingOtw.value = false
  }
}

// --- Heartbeat GPS (selama status OTW) ---
// Posisi TERKINI dipakai ulang oleh alur konfirmasi tiba di bawah -- SATU sumber fix GPS,
// bukan minta izin/lokasi terpisah lagi saat kamera dibuka (pola sama dgn startGpsWatch()
// kontinu di app/kunjungan/[id].vue, cuma di sini pakai interval getCurrentPosition, bukan
// watchPosition, supaya frekuensi kirim ke server bisa dikontrol persis ~25 detik).
const currentPosition = ref<{ lat: number, lng: number, accuracy: number } | null>(null)
let heartbeatInterval: ReturnType<typeof setInterval> | null = null

function sendHeartbeat() {
  if (!navigator.geolocation) return
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      currentPosition.value = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }
      try {
        const api = useApi()
        await api(`/pengiriman-sampel/${batchId.value}/heartbeat`, {
          method: 'POST',
          body: { latitude: currentPosition.value.lat, longitude: currentPosition.value.lng, accuracy: currentPosition.value.accuracy }
        })
      } catch (e) {
        // Best-effort -- satu ping gagal (mis. jaringan sempat putus di perjalanan) tidak perlu
        // menghentikan loop, coba lagi di interval berikutnya.
        console.error('Gagal kirim heartbeat lokasi', e)
      }
    },
    (err) => console.error('Gagal ambil lokasi GPS', err),
    { enableHighAccuracy: true }
  )
}

function startHeartbeatLoop() {
  if (heartbeatInterval) return
  sendHeartbeat()
  heartbeatInterval = setInterval(sendHeartbeat, 25_000)
}

function stopHeartbeatLoop() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }
}

watch(() => batch.value?.status, (status) => {
  if (status === 'otw') startHeartbeatLoop()
  else stopHeartbeatLoop()
}, { immediate: true })

// --- Kamera + watermark (mirror app/kunjungan/[id].vue, disederhanakan -- tanpa alamat/cuaca/
// pasien, lokasi tujuan SELALU "Labkesda Sumenep" karena memang itu tempat konfirmasi ini
// dilakukan, bukan lokasi variabel seperti kunjungan pasien) ---
const showCamera = ref(false)
const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const isCameraActive = ref(false)
const countdown = ref(0)
let stream: MediaStream | null = null
const nativeVideoWidth = ref(0)
const nativeVideoHeight = ref(0)
const reviewImageUrl = ref<string | null>(null)
const logoImg = ref<HTMLImageElement | null>(null)
const timeNow = ref('')
const dateNow = ref('')
let clockTimer: ReturnType<typeof setInterval> | null = null

function updateClock() {
  const now = new Date()
  timeNow.value = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  dateNow.value = now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

const captureAreaRatio = computed(() =>
  nativeVideoWidth.value && nativeVideoHeight.value ? `${nativeVideoWidth.value} / ${nativeVideoHeight.value}` : '3 / 4'
)

function onVideoMetadataLoaded() {
  const video = videoRef.value
  if (!video || !video.videoWidth || !video.videoHeight) return
  nativeVideoWidth.value = video.videoWidth
  nativeVideoHeight.value = video.videoHeight
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1080 }, aspectRatio: { ideal: 3 / 4 } },
      audio: false
    })
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      isCameraActive.value = true
    }
  } catch (e) {
    console.error(e)
    useToast().add({ title: 'Gagal mengakses kamera', color: 'error' })
  }
}

function stopCamera() {
  stream?.getTracks().forEach((track) => track.stop())
  isCameraActive.value = false
}

let miniMapInstance: any = null

function initMiniMap(lat: number, lng: number) {
  const w = window as any
  if (!w.maplibregl) return
  const config = useRuntimeConfig()
  const map = new w.maplibregl.Map({
    container: 'maplibre-mini-pengiriman',
    preserveDrawingBuffer: true,
    style: `${config.public.tileServerUrl}/styles/basemap/style.json`,
    center: [lng, lat],
    zoom: 14,
    minZoom: 9,
    interactive: false
  })
  const el = document.createElement('div')
  el.className = 'custom-map-pin'
  el.innerHTML = '<div class="pulse-ring"></div><div class="pin-core"></div>'
  new w.maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map)
  miniMapInstance?.remove()
  miniMapInstance = map
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let current = words[0]!
  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`
    if (ctx.measureText(candidate).width > maxWidth) {
      lines.push(current)
      current = words[i]!
    } else {
      current = candidate
    }
  }
  lines.push(current)
  return lines
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function buildWatermarkComposite(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = sourceCanvas.width
  out.height = sourceCanvas.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(sourceCanvas, 0, 0)

  const pad = Math.round(out.width * 0.035)
  const radius = Math.round(out.width * 0.025)

  const badgeFont = Math.max(11, Math.round(out.width / 42))
  const badgeIconSize = badgeFont * 1.6
  ctx.font = `bold ${badgeFont}px sans-serif`
  const badgeText = 'PRODULI'
  const badgeTextWidth = ctx.measureText(badgeText).width
  const badgePadX = badgeFont * 0.7
  const hasLogo = !!logoImg.value
  const badgeW = badgePadX + (hasLogo ? badgeIconSize + badgePadX * 0.6 : 0) + badgeTextWidth + badgePadX
  const badgeH = badgeFont * 2.2
  ctx.fillStyle = '#ffffff'
  roundedRectPath(ctx, pad, pad, badgeW, badgeH, radius * 0.5)
  ctx.fill()
  let badgeCursorX = pad + badgePadX
  if (hasLogo && logoImg.value) {
    ctx.drawImage(logoImg.value, badgeCursorX, pad + (badgeH - badgeIconSize) / 2, badgeIconSize, badgeIconSize)
    badgeCursorX += badgeIconSize + badgePadX * 0.6
  }
  ctx.fillStyle = '#0d9488'
  ctx.textBaseline = 'middle'
  ctx.fillText(badgeText, badgeCursorX, pad + badgeH / 2)

  const bodyLines: { text: string, bold?: boolean }[] = [
    { text: `${dateNow.value} · ${timeNow.value} WIB`, bold: true },
    { text: `Pengantar: ${authStore.user?.name ?? '-'}` },
    { text: `Puskesmas: ${batch.value?.puskesmas?.nama ?? '-'}` }
  ]
  if (currentPosition.value) {
    bodyLines.push({ text: `Lat ${currentPosition.value.lat.toFixed(6)}  Long ${currentPosition.value.lng.toFixed(6)}  ±${currentPosition.value.accuracy}m` })
  }

  const titleSize = Math.max(13, Math.round(out.width / 30))
  const bodySize = Math.round(titleSize * 0.78)
  const lineH = bodySize * 1.45
  const thumbSize = Math.round(out.width * 0.18)
  const cardMargin = Math.round(out.width * 0.025)
  const innerPad = Math.round(out.width * 0.03)
  const cardW = out.width - cardMargin * 2
  const cardX = cardMargin
  const textX = cardX + innerPad + thumbSize + innerPad * 0.9
  const textAreaW = cardX + cardW - innerPad - textX

  ctx.font = `${bodySize}px sans-serif`
  const title = 'Sampel Diterima Labkesda Sumenep'
  const titleLines = wrapCanvasText(ctx, title, textAreaW)
  const headTextHeight = titleSize * 1.35 * titleLines.length
  const headRowHeight = Math.max(thumbSize, headTextHeight)
  const cardH = Math.round(innerPad * 1.3 + headRowHeight + innerPad * 1.1 + lineH * bodyLines.length + innerPad * 0.5)
  const cardY = out.height - cardH - cardMargin

  ctx.fillStyle = 'rgba(15, 23, 42, 0.68)'
  roundedRectPath(ctx, cardX, cardY, cardW, cardH, radius)
  ctx.fill()

  const thumbX = cardX + innerPad
  const thumbY = cardY + innerPad * 0.7
  const mapCanvas = document.querySelector<HTMLCanvasElement>('#maplibre-mini-pengiriman canvas')
  ctx.save()
  roundedRectPath(ctx, thumbX, thumbY, thumbSize, thumbSize, radius * 0.7)
  ctx.clip()
  ctx.fillStyle = '#1e293b'
  ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize)
  if (mapCanvas && mapCanvas.width > 0 && mapCanvas.height > 0) {
    try {
      ctx.drawImage(mapCanvas, thumbX, thumbY, thumbSize, thumbSize)
    } catch {
      // fallback warna solid di atas
    }
  }
  ctx.restore()
  const pinX = thumbX + thumbSize / 2
  const pinY = thumbY + thumbSize / 2
  ctx.beginPath()
  ctx.arc(pinX, pinY, thumbSize * 0.16, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(14, 165, 233, 0.3)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(pinX, pinY, thumbSize * 0.08, 0, Math.PI * 2)
  ctx.fillStyle = '#0ea5e9'
  ctx.fill()
  ctx.lineWidth = Math.max(1.5, thumbSize * 0.02)
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()

  let y = thumbY
  ctx.textBaseline = 'top'
  ctx.font = `bold ${titleSize}px sans-serif`
  ctx.fillStyle = '#ffffff'
  for (const line of titleLines) {
    ctx.fillText(line, textX, y)
    y += titleSize * 1.35
  }

  y = thumbY + headRowHeight + innerPad * 1.1
  for (const line of bodyLines) {
    ctx.font = line.bold ? `bold ${bodySize}px sans-serif` : `${bodySize}px sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.fillText(line.text, cardX + innerPad, y)
    y += lineH
  }

  return out
}

function captureFrame() {
  const video = videoRef.value
  const canvas = canvasRef.value
  if (!video || !canvas) return
  const vw = video.videoWidth
  const vh = video.videoHeight
  const rect = video.getBoundingClientRect()
  const targetRatio = rect.width / rect.height
  const sourceRatio = vw / vh
  let sx = 0, sy = 0, sw = vw, sh = vh
  if (sourceRatio > targetRatio) {
    sw = vh * targetRatio
    sx = (vw - sw) / 2
  } else {
    sh = vw / targetRatio
    sy = (vh - sh) / 2
  }
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext('2d')
  ctx?.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh)
  nativeVideoWidth.value = sw
  nativeVideoHeight.value = sh

  try {
    const composite = buildWatermarkComposite(canvas)
    reviewImageUrl.value = composite.toDataURL('image/jpeg', 0.92)
  } catch (e) {
    console.error('Gagal membuat komposit watermark:', e)
    reviewImageUrl.value = canvas.toDataURL('image/jpeg', 0.9)
  }
  stopCamera()
}

function takePicture() {
  if (countdown.value > 0) return
  countdown.value = 3
  const interval = setInterval(() => {
    countdown.value--
    if (countdown.value === 0) {
      clearInterval(interval)
      captureFrame()
    }
  }, 1000)
}

function retakePhoto() {
  reviewImageUrl.value = null
  startCamera()
  nextTick(() => {
    if (currentPosition.value) initMiniMap(currentPosition.value.lat, currentPosition.value.lng)
  })
}

async function openCamera() {
  if (!currentPosition.value) {
    useToast().add({ title: 'Menunggu sinyal GPS, coba lagi sesaat lagi', color: 'warning' })
    sendHeartbeat()
    return
  }
  showCamera.value = true
  reviewImageUrl.value = null
  await nextTick()
  await startCamera()
  nextTick(() => {
    if (currentPosition.value) initMiniMap(currentPosition.value.lat, currentPosition.value.lng)
  })
}

function closeCamera() {
  stopCamera()
  showCamera.value = false
  reviewImageUrl.value = null
}

function dataUrlToBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(',')
  const header = dataUrl.slice(0, commaIdx)
  const base64 = dataUrl.slice(commaIdx + 1)
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

const isConfirming = ref(false)

async function confirmArrival() {
  if (!reviewImageUrl.value || !currentPosition.value) return
  isConfirming.value = true
  try {
    const api = useApi()
    const fd = new FormData()
    fd.append('photo', dataUrlToBlob(reviewImageUrl.value), 'bukti-serah-terima.jpg')
    fd.append('latitude', String(currentPosition.value.lat))
    fd.append('longitude', String(currentPosition.value.lng))
    fd.append('gps_accuracy_meters', String(currentPosition.value.accuracy))
    fd.append('gps_captured_at', new Date().toISOString())

    await api(`/pengiriman-sampel/${batchId.value}/confirm-arrival`, { method: 'POST', body: fd })

    closeCamera()
    stopHeartbeatLoop()
    await loadBatch()
    useToast().add({ title: 'Sampel berhasil dikonfirmasi tiba', color: 'success' })
    router.push('/app/pengiriman')
  } catch (e) {
    useToast().add({ title: e instanceof ApiError ? e.message : 'Gagal mengonfirmasi kedatangan', color: 'error' })
  } finally {
    isConfirming.value = false
  }
}

onMounted(() => {
  const img = new Image()
  img.onload = () => { logoImg.value = img }
  img.src = '/logo/logo-no-text.png'
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
})

onUnmounted(() => {
  stopCamera()
  stopHeartbeatLoop()
  if (clockTimer) clearInterval(clockTimer)
})
</script>

<template>
  <div class="p-4 space-y-4 pb-24">
    <div v-if="isLoading" class="py-16 text-center text-slate-400">
      <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
      Memuat...
    </div>

    <template v-else-if="batch">
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800">
        <h1 class="text-lg font-black text-slate-800 dark:text-white">{{ batch.puskesmas?.nama }}</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">{{ batch.jumlah_pasien ?? batch.pasien?.length ?? 0 }} pasien Prolanis ke Labkesda Sumenep</p>
        <span class="inline-block mt-3 text-xs font-bold px-3 py-1.5 rounded-full bg-primary/10 text-primary">
          {{ STATUS_LABELS[batch.status] ?? batch.status }}
        </span>
      </div>

      <!-- Menunggu diberangkatkan -->
      <button
        v-if="batch.status === 'ditugaskan'"
        @click="startOtw"
        :disabled="isStartingOtw"
        class="w-full py-4 bg-primary text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50 shadow-lg shadow-primary/30"
      >
        <LucideLoader2 v-if="isStartingOtw" class="w-5 h-5 animate-spin" />
        <LucideNavigation v-else class="w-5 h-5" />
        Mulai Perjalanan
      </button>

      <!-- Sedang OTW -->
      <template v-if="batch.status === 'otw'">
        <div class="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center gap-3">
          <LucideMapPin class="w-5 h-5 text-primary shrink-0" />
          <p class="text-sm text-slate-600 dark:text-slate-300">Lokasi Anda sedang dibagikan ke Puskesmas dan Super Admin selama perjalanan.</p>
        </div>
        <button
          @click="openCamera"
          class="w-full py-4 bg-success text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-success/30"
        >
          <LucideCamera class="w-5 h-5" />
          Konfirmasi Tiba di Labkesda
        </button>
      </template>

      <div v-if="batch.status === 'tiba_labkesda' || batch.status === 'dikonfirmasi_labkesda'" class="bg-success/5 border border-success/20 rounded-2xl p-5 text-center">
        <LucideCircleCheck class="w-10 h-10 text-success mx-auto mb-2" />
        <p class="font-bold text-slate-800 dark:text-white">Sampel sudah dikonfirmasi tiba</p>
      </div>
    </template>

    <canvas ref="canvasRef" class="hidden"></canvas>

    <!-- Modal Kamera Layar Penuh (mirror app/kunjungan/[id].vue) -->
    <Teleport to="body">
      <div v-if="showCamera" class="fixed inset-0 z-[95] bg-black overflow-hidden" style="height: 100dvh">
        <button
          type="button"
          @click="closeCamera"
          class="absolute left-4 z-30 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white active:scale-95 transition-transform"
          style="top: calc(1rem + env(safe-area-inset-top, 0px))"
        >
          <LucideX class="w-5 h-5" />
        </button>

        <template v-if="!reviewImageUrl">
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="relative w-full" style="aspect-ratio: 3 / 4">
              <video ref="videoRef" autoplay playsinline @loadedmetadata="onVideoMetadataLoaded" class="absolute inset-0 w-full h-full object-cover"></video>
            </div>
          </div>

          <div v-if="countdown > 0" class="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <span class="text-8xl font-black text-white drop-shadow-2xl animate-pulse">{{ countdown }}</span>
          </div>

          <div
            class="absolute inset-0 flex flex-col justify-between p-4 z-10 pointer-events-none"
            style="padding-top: calc(4.5rem + env(safe-area-inset-top, 0px)); padding-bottom: calc(6.5rem + env(safe-area-inset-bottom, 0px))"
          >
            <div class="flex items-center gap-2 self-start bg-white rounded-md px-2.5 py-1.5 shadow-sm">
              <img src="/logo/logo-no-text.png" class="w-5 h-5" />
              <span class="text-[11px] font-black text-primary tracking-widest uppercase">PRODULI</span>
            </div>

            <div class="w-full bg-black/40 rounded-xl overflow-hidden">
              <div class="flex gap-3 p-3">
                <div id="maplibre-mini-pengiriman" class="w-20 h-20 bg-slate-800 rounded-lg shrink-0 overflow-hidden border border-white/20 relative"></div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-black text-white uppercase leading-tight">Labkesda Sumenep</p>
                  <p class="text-xs font-mono text-slate-300 mt-1" v-if="currentPosition">
                    Lat {{ currentPosition.lat.toFixed(6) }}&nbsp;&nbsp;Long {{ currentPosition.lng.toFixed(6) }}
                  </p>
                </div>
              </div>
              <div class="px-3 pb-2 pt-1.5 border-t border-white/20">
                <p class="text-sm font-bold text-white">{{ dateNow }} &middot; {{ timeNow }} WIB</p>
                <p class="text-xs text-slate-300 mt-0.5">Pengantar: {{ authStore.user?.name }}</p>
              </div>
            </div>
          </div>

          <div class="absolute inset-x-0 bottom-0 z-20 p-5 bg-gradient-to-t from-black/80 to-transparent" style="padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px))">
            <button
              @click="takePicture"
              :disabled="!isCameraActive || countdown > 0"
              class="w-full py-4 bg-indigo-500 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50 shadow-lg shadow-indigo-500/30"
            >
              <LucideCamera class="w-5 h-5" />
              Ambil Gambar
            </button>
          </div>
        </template>

        <template v-else>
          <div class="absolute inset-0 flex items-center justify-center bg-black">
            <img :src="reviewImageUrl" class="w-full" :style="{ aspectRatio: captureAreaRatio }" style="object-fit: cover" />
          </div>
          <div class="absolute inset-x-0 bottom-0 z-20 p-5 bg-gradient-to-t from-black/80 to-transparent flex gap-3" style="padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px))">
            <button
              @click="retakePhoto"
              class="flex-1 py-4 bg-white/10 text-white rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <LucideRefreshCw class="w-5 h-5" />
              Ulangi
            </button>
            <button
              @click="confirmArrival"
              :disabled="isConfirming"
              class="flex-[2] py-4 bg-success text-white rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
            >
              <LucideLoader2 v-if="isConfirming" class="w-5 h-5 animate-spin" />
              <LucideCheck v-else class="w-5 h-5" />
              Kirim Konfirmasi
            </button>
          </div>
        </template>
      </div>
    </Teleport>
  </div>
</template>
