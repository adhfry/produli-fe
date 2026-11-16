import type { ApiSuccessEnvelope, KtpScanResult } from '~/types/api'

// Scan KTP pasien (POST /ktp-scans). Foto diperkecil dulu di browser: server production menolak
// unggahan di atas 2 MB, sedangkan foto kamera HP bisa 3-8 MB. 1600 px sisi terpanjang masih
// cukup tajam untuk OCR KTP (SiLAKES memotret di 1280x720).
const MAX_SIDE = 1600
const JPEG_QUALITY = 0.85

async function perkecilFoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const skala = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * skala)
  canvas.height = Math.round(bitmap.height * skala)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Foto gagal diproses.'))), 'image/jpeg', JPEG_QUALITY)
  })
}

export function useKtpScan() {
  async function scan(file: File): Promise<KtpScanResult> {
    if (!file.type.startsWith('image/')) {
      throw new ApiError('Pilih berkas foto (JPG atau PNG).', 422)
    }

    let foto: Blob
    try {
      foto = await perkecilFoto(file)
    } catch {
      throw new ApiError('Foto tidak bisa dibuka. Coba foto ulang atau pilih berkas lain.', 422)
    }

    const body = new FormData()
    body.append('image', foto, 'ktp.jpg')

    const api = useApi()
    const res = await api('/ktp-scans', { method: 'POST', body }) as ApiSuccessEnvelope<KtpScanResult>
    return res.data
  }

  return { scan }
}
