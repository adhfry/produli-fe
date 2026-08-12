// Unduh tile peta wilayah kerja untuk dipakai offline (docs/planning/10 §5, docs/planning/11 §9)
// -- tombol "Unduh Peta Wilayah Kerja" di /app: fetch tile untuk bounding box tugas kader HARI
// INI, zoom 9-16 (docs/planning/11 §4, sama dengan rentang tileset sumenep.mbtiles), tulis
// langsung ke Cache Storage API dengan nama cache YANG SAMA dengan runtimeCaching Workbox
// (nuxt.config.ts) -- supaya unduhan manual ini & caching pasif saat browsing berbagi satu
// cache store, tile yang sudah diunduh manual langsung dipakai peta tanpa perlu online lagi.
import type { VisitAssignment } from '~/types/api'

const CACHE_NAME = 'produli-map-tiles'
const MIN_ZOOM = 9
const MAX_ZOOM = 16
// ~2km buffer di sekitar titik pasien terluar -- kader biasanya perlu sedikit konteks jalan di
// luar titik persis, bukan cuma pixel di atas rumah pasien.
const BBOX_PADDING_DEG = 0.02
const CONCURRENCY = 6

function lon2tileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom)
}
function lat2tileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom)
}

export interface TileDownloadProgress {
  current: number
  total: number
}

export interface TileDownloadResult {
  ok: boolean
  downloaded: number
  total: number
  error?: string
}

export function useMapTileDownload() {
  function computeBoundingBox(assignments: VisitAssignment[]): [number, number, number, number] | null {
    const coords = assignments
      .map((a) => a.patient)
      .filter((p) => !!p && p.latitude !== null && p.longitude !== null) as { latitude: number, longitude: number }[]

    if (coords.length === 0) return null

    let minLat = Infinity
    let maxLat = -Infinity
    let minLon = Infinity
    let maxLon = -Infinity
    for (const c of coords) {
      minLat = Math.min(minLat, c.latitude)
      maxLat = Math.max(maxLat, c.latitude)
      minLon = Math.min(minLon, c.longitude)
      maxLon = Math.max(maxLon, c.longitude)
    }
    return [minLon - BBOX_PADDING_DEG, minLat - BBOX_PADDING_DEG, maxLon + BBOX_PADDING_DEG, maxLat + BBOX_PADDING_DEG]
  }

  function buildTileList(bbox: [number, number, number, number]): { z: number, x: number, y: number }[] {
    const [minLon, minLat, maxLon, maxLat] = bbox
    const tiles: { z: number, x: number, y: number }[] = []
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

  async function fetchAndCache(cache: Cache, url: string): Promise<boolean> {
    try {
      const res = await fetch(url)
      if (!res.ok) return false
      await cache.put(url, res.clone())
      return true
    } catch {
      return false
    }
  }

  /**
   * Assignment HARI INI (tugas kader, docs/planning/11 §9) -- bukan seluruh riwayat, cakupan
   * kecil sesuai wilayah kerja aktual hari itu. Satu tile gagal (mis. area itu tidak ada data,
   * 404) TIDAK menghentikan proses, sama pola partial-success dengan sinkronisasi draft.
   */
  async function downloadTilesForAssignments(
    assignments: VisitAssignment[],
    onProgress?: (progress: TileDownloadProgress) => void
  ): Promise<TileDownloadResult> {
    if (!('caches' in window)) {
      return { ok: false, downloaded: 0, total: 0, error: 'Perangkat/browser ini tidak mendukung penyimpanan offline.' }
    }

    const bbox = computeBoundingBox(assignments)
    if (!bbox) {
      return { ok: false, downloaded: 0, total: 0, error: 'Tidak ada tugas dengan lokasi diketahui untuk diunduh petanya hari ini.' }
    }

    const config = useRuntimeConfig()
    const base = config.public.tileServerUrl as string

    // Style/sprite/TileJSON dulu -- dibutuhkan SEKALI supaya MapLibre bisa render sama sekali
    // saat offline, bukan cuma ubin .pbf mentahnya.
    const baseUrls = [
      `${base}/styles/basemap/style.json`,
      `${base}/styles/basemap/sprite.json`,
      `${base}/styles/basemap/sprite.png`,
      `${base}/styles/basemap/sprite@2x.json`,
      `${base}/styles/basemap/sprite@2x.png`,
      `${base}/data/sumenep.json`,
    ]

    const tiles = buildTileList(bbox)
    const tileUrls = tiles.map((t) => `${base}/data/sumenep/${t.z}/${t.x}/${t.y}.pbf`)
    const allUrls = [...baseUrls, ...tileUrls]

    const cache = await caches.open(CACHE_NAME)
    let downloaded = 0
    let processed = 0

    // Concurrency terbatas (bukan satu-per-satu SEPERTI sync draft, ini tile statis independen
    // bukan operasi tulis sekuensial -- tapi juga bukan semua sekaligus, tetap sopan ke server).
    for (let i = 0; i < allUrls.length; i += CONCURRENCY) {
      const batch = allUrls.slice(i, i + CONCURRENCY)
      const results = await Promise.all(batch.map((url) => fetchAndCache(cache, url)))
      downloaded += results.filter(Boolean).length
      processed += batch.length
      onProgress?.({ current: processed, total: allUrls.length })
    }

    return { ok: true, downloaded, total: allUrls.length }
  }

  async function getCachedTileInfo(): Promise<{ count: number, supported: boolean }> {
    if (!('caches' in window)) return { count: 0, supported: false }
    const cache = await caches.open(CACHE_NAME)
    const keys = await cache.keys()
    return { count: keys.length, supported: true }
  }

  async function clearCachedTiles(): Promise<void> {
    if (!('caches' in window)) return
    await caches.delete(CACHE_NAME)
  }

  return { computeBoundingBox, buildTileList, downloadTilesForAssignments, getCachedTileInfo, clearCachedTiles }
}
