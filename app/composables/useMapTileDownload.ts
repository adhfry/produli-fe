// Unduh tile peta wilayah kerja untuk dipakai offline (docs/planning/10 §5, docs/planning/11 §9)
// -- tombol "Unduh Peta Wilayah Kerja" di /app: fetch tile untuk WILAYAH tugas kader HARI INI,
// zoom 9-16 (sama dengan rentang tileset sumenep.mbtiles), tulis langsung ke Cache Storage API
// dengan nama cache YANG SAMA dengan runtimeCaching Workbox (nuxt.config.ts) -- supaya unduhan
// manual ini & caching pasif saat browsing berbagi satu cache store, tile yang sudah diunduh
// manual langsung dipakai peta tanpa perlu online lagi.
//
// Algoritma "smart" (revisi -- SEBELUMNYA satu bounding-box tunggal mencakup titik pasien
// TERJAUH, dan begitu ada 1 saja pasien tanpa koordinat langsung jatuh diam-diam ke SELURUH
// Kabupaten Sumenep, ~100 ribu tile, tanpa info wilayah apa/berapa MB):
//   1. Setiap pasien di-resolve ke SATU area kecil (titik presisi, atau centroid desa) --
//      BUKAN satu kotak besar yang membentang menutupi jarak kosong antar pasien.
//   2. Pasien tanpa desa yang jelas (desa_id null) TIDAK ditebak otomatis -- masuk daftar
//      "ambigu" supaya kader memilih kecamatan+desa manual (lihat useWilayahResolver.ts).
//      Kecamatan boleh dipilih bebas (bukan cuma kecamatan "asal" puskesmas kader) karena
//      pasien bisa lintas kecamatan.
//   3. Tile dari semua area di-UNION lewat Set z/x/y (dedup otomatis, overlap antar area
//      cuma dihitung/diunduh sekali).
//   4. Sebelum benar-benar mengunduh, ukuran diestimasi dari SAMPEL nyata (bukan angka
//      karangan) supaya kader tahu berapa MB sebelum commit.
//   5. Saat mengunduh, tile yang SUDAH ada di cache dilewati (bukan ditimpa ulang) --
//      hemat kuota & waktu kalau wilayahnya tumpang tindih dengan unduhan sebelumnya.
import type { VisitAssignment } from '~/types/api'

const CACHE_NAME = 'produli-map-tiles'
const BYTES_STORAGE_KEY = 'produli-map-tiles-bytes'
const MIN_ZOOM = 9
const MAX_ZOOM = 16
// ~2km buffer di sekitar titik/kluster pasien -- kader biasanya perlu sedikit konteks jalan di
// luar titik persis, bukan cuma pixel di atas rumah pasien.
const PRECISE_PADDING_DEG = 0.02
// Desa di Sumenep umumnya beberapa km membentang -- radius sedikit lebih besar dari padding titik
// presisi supaya seluruh desa (bukan cuma centroid-nya) tercakup, tapi masih JAUH lebih kecil
// dari kecamatan apalagi kabupaten.
const DESA_RADIUS_DEG = 0.025
const CONCURRENCY = 6
// Sampel per level zoom saat estimasi ukuran -- ukuran vector tile SANGAT bervariasi antar zoom
// (zoom rendah mencakup area lebih luas per tile -> lebih banyak fitur -> lebih besar; zoom
// tinggi di area sepi seringkali cuma ratusan byte), jadi estimasi dihitung per-zoom, bukan rata
// rata gabungan semua level.
const SAMPLE_PER_ZOOM = 4

function lon2tileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom)
}
function lat2tileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom)
}

export interface MapTile { z: number, x: number, y: number }

export interface ResolvedArea {
  key: string
  type: 'precise' | 'desa' | 'kabupaten'
  label: string
  bbox: [number, number, number, number]
  patientCount: number
}

export interface AmbiguousPatient {
  assignmentId: number
  patientId: number
  patientName: string
  kecamatanIdHint: number | null
  kecamatanNamaHint: string | null
}

export interface ManualResolution {
  kecamatanId: number
  kecamatanNama: string
  desaId: number
  desaNama: string
  latitude: number
  longitude: number
}

export interface AreaResolutionResult {
  areas: ResolvedArea[]
  ambiguousPatients: AmbiguousPatient[]
  totalPatients: number
}

export interface TileSizeEstimate {
  fileCount: number
  estimatedBytes: number
  sampledCount: number
}

export interface TileDownloadProgress {
  current: number
  total: number
  skipped: number
}

export interface TileDownloadResult {
  ok: boolean
  downloaded: number
  skipped: number
  total: number
  bytesDownloaded: number
  error?: string
}

export interface CachedTileInfo {
  count: number
  bytes: number
  supported: boolean
}

export function useMapTileDownload() {
  function buildBaseUrls(base: string): string[] {
    // Style/sprite/TileJSON -- dibutuhkan SEKALI supaya MapLibre bisa render sama sekali saat
    // offline, bukan cuma ubin .pbf mentahnya.
    return [
      `${base}/styles/basemap/style.json`,
      `${base}/styles/basemap/sprite.json`,
      `${base}/styles/basemap/sprite.png`,
      `${base}/styles/basemap/sprite@2x.json`,
      `${base}/styles/basemap/sprite@2x.png`,
      `${base}/data/sumenep.json`,
    ]
  }

  function buildTileList(bbox: [number, number, number, number]): MapTile[] {
    const [minLon, minLat, maxLon, maxLat] = bbox
    const tiles: MapTile[] = []
    for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
      const xMin = lon2tileX(minLon, z)
      const xMax = lon2tileX(maxLon, z)
      // Y tile bertambah ke SELATAN (Web Mercator) -- maxLat menghasilkan Y lebih kecil.
      const yMin = lat2tileY(maxLat, z)
      const yMax = lat2tileY(minLat, z)
      for (let x = xMin; x <= xMax; x++) {
        for (let y = yMin; y <= yMax; y++) {
          tiles.push({ z, x, y })
        }
      }
    }
    return tiles
  }

  /**
   * Kelompokkan tugas kader per PASIEN (dedup -- satu pasien bisa muncul di >1 assignment) ke
   * area unduhan sekecil mungkin: titik presisi (kalau geocoded) atau centroid desa (kalau desa
   * match tapi tanpa titik presisi). Pasien tanpa desa yang jelas TIDAK ditebak -- masuk
   * `ambiguousPatients` supaya kader pilih kecamatan+desa manual sebelum diikutkan unduhan.
   */
  function resolveAreas(
    assignments: VisitAssignment[],
    manualResolutions: Record<number, ManualResolution> = {},
  ): AreaResolutionResult {
    const seenPatientIds = new Set<number>()
    const precisePoints: { latitude: number, longitude: number }[] = []
    const desaAreas = new Map<string, { nama: string, latitude: number, longitude: number, count: number }>()
    const ambiguousPatients: AmbiguousPatient[] = []
    let totalPatients = 0

    for (const a of assignments) {
      const p = a.patient
      if (!p || seenPatientIds.has(p.id)) continue
      seenPatientIds.add(p.id)
      totalPatients++

      if (p.latitude !== null && p.longitude !== null) {
        precisePoints.push({ latitude: p.latitude, longitude: p.longitude })
        continue
      }

      const manual = manualResolutions[p.id]
      if (manual) {
        const key = `desa:${manual.desaId}`
        const existing = desaAreas.get(key)
        if (existing) existing.count++
        else desaAreas.set(key, { nama: manual.desaNama, latitude: manual.latitude, longitude: manual.longitude, count: 1 })
        continue
      }

      if (p.desa_id !== null && p.desa_latitude !== null && p.desa_longitude !== null) {
        const key = `desa:${p.desa_id}`
        const existing = desaAreas.get(key)
        if (existing) existing.count++
        else desaAreas.set(key, { nama: p.desa_nama ?? 'Desa', latitude: p.desa_latitude, longitude: p.desa_longitude, count: 1 })
        continue
      }

      // Wilayah ambigu -- desa_id null. kecamatan_id BISA tetap terisi (kasus umum ~19,6% pasien)
      // -- dipakai sbg hint pra-isi dropdown kecamatan, TAPI kecamatan TIDAK dipakai diam-diam
      // sbg area (radius kecamatan terlalu kasar) -- kader wajib pilih desa eksplisit.
      ambiguousPatients.push({
        assignmentId: a.id,
        patientId: p.id,
        patientName: p.nama,
        kecamatanIdHint: p.kecamatan_id,
        kecamatanNamaHint: p.kecamatan_nama,
      })
    }

    const areas: ResolvedArea[] = []

    if (precisePoints.length > 0) {
      let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity
      for (const c of precisePoints) {
        minLat = Math.min(minLat, c.latitude)
        maxLat = Math.max(maxLat, c.latitude)
        minLon = Math.min(minLon, c.longitude)
        maxLon = Math.max(maxLon, c.longitude)
      }
      areas.push({
        key: 'precise',
        type: 'precise',
        label: `Titik lokasi pasien (${precisePoints.length})`,
        bbox: [minLon - PRECISE_PADDING_DEG, minLat - PRECISE_PADDING_DEG, maxLon + PRECISE_PADDING_DEG, maxLat + PRECISE_PADDING_DEG],
        patientCount: precisePoints.length,
      })
    }

    for (const [key, d] of desaAreas) {
      areas.push({
        key,
        type: 'desa',
        label: `Desa ${d.nama}`,
        bbox: [d.longitude - DESA_RADIUS_DEG, d.latitude - DESA_RADIUS_DEG, d.longitude + DESA_RADIUS_DEG, d.latitude + DESA_RADIUS_DEG],
        patientCount: d.count,
      })
    }

    return { areas, ambiguousPatients, totalPatients }
  }

  // Bounding box RESMI dari tile server sendiri (bukan tebak koordinat manual) -- TileJSON
  // sumenep.json punya field standar `.bounds` [west, south, east, north] yang mencerminkan
  // cakupan data yang BENAR-BENAR ada. Dipakai HANYA sebagai opsi eksplisit "Seluruh Kabupaten
  // Sumenep" yang kader pilih sendiri (bukan fallback diam-diam lagi).
  async function resolveKabupatenArea(): Promise<ResolvedArea | null> {
    try {
      const config = useRuntimeConfig()
      const base = config.public.tileServerUrl as string
      const res = await fetch(`${base}/data/sumenep.json`)
      if (!res.ok) return null
      const tileJson = (await res.json()) as { bounds?: [number, number, number, number] }
      if (!tileJson.bounds) return null
      return {
        key: 'kabupaten',
        type: 'kabupaten',
        label: 'Seluruh Kabupaten Sumenep',
        bbox: tileJson.bounds,
        patientCount: 0,
      }
    } catch {
      return null
    }
  }

  /** Union tile dari beberapa area (dedup lewat Map keyed z/x/y) -- overlap antar area cuma
   * dihitung/diunduh sekali, dan area yang berjauhan TIDAK memaksa unduh kotak kosong di antara
   * keduanya (beda dari 1 bounding-box tunggal yang membentang menutupi seluruh jarak). */
  function buildTileSetForAreas(areas: ResolvedArea[]): MapTile[] {
    const set = new Map<string, MapTile>()
    for (const area of areas) {
      for (const t of buildTileList(area.bbox)) {
        const key = `${t.z}/${t.x}/${t.y}`
        if (!set.has(key)) set.set(key, t)
      }
    }
    return [...set.values()]
  }

  async function measureAndCacheSample(cache: Cache, url: string): Promise<number | null> {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const cloned = res.clone()
      await cache.put(url, cloned)
      const blob = await res.blob()
      return blob.size
    } catch {
      return null
    }
  }

  /** Estimasi ukuran unduhan dari SAMPEL nyata (bukan angka karangan) -- tile yang disampel ikut
   * tersimpan ke cache sebagai bonus (tidak sia-sia dipakai kalau kader lanjut ke unduh sungguhan). */
  async function estimateTileSetSize(tiles: MapTile[]): Promise<TileSizeEstimate> {
    if (!('caches' in window)) return { fileCount: tiles.length, estimatedBytes: 0, sampledCount: 0 }

    const config = useRuntimeConfig()
    const base = config.public.tileServerUrl as string
    const baseUrls = buildBaseUrls(base)
    const cache = await caches.open(CACHE_NAME)

    // Ukuran berkas dasar (style/sprite/tileJSON) -- jumlahnya cuma segelintir, ukur PERSIS
    // (bukan sampel) karena murah & jadi biaya satu-kali yang akurat.
    let baseBytes = 0
    for (const url of baseUrls) {
      const cached = await cache.match(url)
      if (cached) {
        baseBytes += (await cached.blob()).size
        continue
      }
      baseBytes += (await measureAndCacheSample(cache, url)) ?? 0
    }

    const byZoom = new Map<number, MapTile[]>()
    for (const t of tiles) {
      if (!byZoom.has(t.z)) byZoom.set(t.z, [])
      byZoom.get(t.z)!.push(t)
    }

    let estimatedTileBytes = 0
    let sampledCount = 0
    for (const zTiles of byZoom.values()) {
      const step = Math.max(1, Math.floor(zTiles.length / SAMPLE_PER_ZOOM))
      const sampledSizes: number[] = []
      for (let i = 0; i < zTiles.length && sampledSizes.length < SAMPLE_PER_ZOOM; i += step) {
        const t = zTiles[i]!
        const url = `${base}/data/sumenep/${t.z}/${t.x}/${t.y}.pbf`
        const cached = await cache.match(url)
        const size = cached ? (await cached.blob()).size : await measureAndCacheSample(cache, url)
        if (size !== null) {
          sampledSizes.push(size)
          sampledCount++
        }
      }
      const avg = sampledSizes.length > 0 ? sampledSizes.reduce((a, b) => a + b, 0) / sampledSizes.length : 0
      estimatedTileBytes += avg * zTiles.length
    }

    return {
      fileCount: tiles.length + baseUrls.length,
      estimatedBytes: Math.round(baseBytes + estimatedTileBytes),
      sampledCount,
    }
  }

  async function fetchAndCacheIfMissing(cache: Cache, url: string): Promise<{ status: 'downloaded' | 'skipped' | 'failed', bytes: number }> {
    // Lewati tile yang SUDAH ada di cache -- hemat kuota & waktu kalau wilayahnya tumpang
    // tindih dengan unduhan sebelumnya (termasuk hasil sampel estimateTileSetSize di atas).
    const existing = await cache.match(url)
    if (existing) return { status: 'skipped', bytes: 0 }

    try {
      const res = await fetch(url)
      if (!res.ok) return { status: 'failed', bytes: 0 }
      const blob = await res.clone().blob()
      await cache.put(url, res)
      return { status: 'downloaded', bytes: blob.size }
    } catch {
      return { status: 'failed', bytes: 0 }
    }
  }

  /** Unduh sungguhan sebuah tile set (hasil buildTileSetForAreas) -- partial-success (satu tile
   * gagal, mis. 404, TIDAK menghentikan proses, pola sama dengan sinkronisasi draft). */
  async function downloadTileSet(
    tiles: MapTile[],
    onProgress?: (progress: TileDownloadProgress) => void,
  ): Promise<TileDownloadResult> {
    if (!('caches' in window)) {
      return { ok: false, downloaded: 0, skipped: 0, total: 0, bytesDownloaded: 0, error: 'Perangkat/browser ini tidak mendukung penyimpanan offline.' }
    }

    const config = useRuntimeConfig()
    const base = config.public.tileServerUrl as string
    const tileUrls = tiles.map((t) => `${base}/data/sumenep/${t.z}/${t.x}/${t.y}.pbf`)
    const allUrls = [...buildBaseUrls(base), ...tileUrls]

    const cache = await caches.open(CACHE_NAME)
    let downloaded = 0
    let skipped = 0
    let bytesDownloaded = 0
    let processed = 0

    for (let i = 0; i < allUrls.length; i += CONCURRENCY) {
      const batch = allUrls.slice(i, i + CONCURRENCY)
      const results = await Promise.all(batch.map((url) => fetchAndCacheIfMissing(cache, url)))
      for (const r of results) {
        if (r.status === 'downloaded') {
          downloaded++
          bytesDownloaded += r.bytes
        } else if (r.status === 'skipped') {
          skipped++
        }
      }
      processed += batch.length
      onProgress?.({ current: processed, total: allUrls.length, skipped })
    }

    // Total byte terunduh AKUMULATIF (bukan reset tiap kali) -- dipakai kartu "/app" utk
    // menampilkan ukuran nyata dalam MB, ganti jumlah file mentah yang tidak informatif.
    const prevBytes = Number(localStorage.getItem(BYTES_STORAGE_KEY) ?? '0')
    localStorage.setItem(BYTES_STORAGE_KEY, String(prevBytes + bytesDownloaded))

    return { ok: true, downloaded, skipped, total: allUrls.length, bytesDownloaded }
  }

  async function getCachedTileInfo(): Promise<CachedTileInfo> {
    if (!('caches' in window)) return { count: 0, bytes: 0, supported: false }
    const cache = await caches.open(CACHE_NAME)
    const keys = await cache.keys()
    const bytes = Number(localStorage.getItem(BYTES_STORAGE_KEY) ?? '0')
    return { count: keys.length, bytes, supported: true }
  }

  async function clearCachedTiles(): Promise<void> {
    if (!('caches' in window)) return
    await caches.delete(CACHE_NAME)
    localStorage.removeItem(BYTES_STORAGE_KEY)
  }

  function formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 MB'
    const mb = bytes / (1024 * 1024)
    if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`
    if (mb < 1000) return `${mb.toFixed(1)} MB`
    return `${(mb / 1024).toFixed(2)} GB`
  }

  return {
    resolveAreas,
    resolveKabupatenArea,
    buildTileSetForAreas,
    estimateTileSetSize,
    downloadTileSet,
    getCachedTileInfo,
    clearCachedTiles,
    formatBytes,
  }
}
