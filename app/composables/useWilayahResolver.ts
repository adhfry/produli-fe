// Referensi kecamatan/desa (GET /kecamatan, GET /desa?kecamatan_id=) dipakai fitur unduh peta
// offline (useMapTileDownload.ts) saat kader punya pasien dengan wilayah ambigu (desa_id null).
// Kecamatan BOLEH dipilih bebas -- bukan cuma kecamatan "asal" puskesmas kader -- karena pasien
// bisa lintas kecamatan (mis. Puskesmas Gapura punya pasien di Kec. Kota Sumenep). Pola sama
// dengan dropdown Kel/Desa di app/kunjungan/[id].vue (typeahead kanonik, bukan teks bebas).
//
// Resolusi yang dipilih kader di sini EPHEMERAL (per sesi browser, disimpan di komponen
// pemanggil, TIDAK dikirim ke server) -- murni menentukan area unduhan peta, BUKAN koreksi data
// pasien permanen (itu jalur terpisah: PATCH /patients/{id}/propose-update).
import type { ApiSuccessEnvelope, Desa, Kecamatan } from '~/types/api'

export function useWilayahResolver() {
  const api = useApi()

  const kecamatanList = ref<Kecamatan[]>([])
  const isLoadingKecamatan = ref(false)
  const desaByKecamatan = ref<Record<number, Desa[]>>({})
  const isLoadingDesa = ref(false)

  async function loadKecamatanList(): Promise<void> {
    if (kecamatanList.value.length > 0) return
    isLoadingKecamatan.value = true
    try {
      const res = (await api('/kecamatan')) as ApiSuccessEnvelope<Kecamatan[]>
      kecamatanList.value = res.data
    } catch {
      kecamatanList.value = []
    } finally {
      isLoadingKecamatan.value = false
    }
  }

  async function loadDesaList(kecamatanId: number): Promise<Desa[]> {
    const cached = desaByKecamatan.value[kecamatanId]
    if (cached) return cached

    isLoadingDesa.value = true
    try {
      const res = (await api('/desa', { query: { kecamatan_id: kecamatanId } })) as ApiSuccessEnvelope<Desa[]>
      desaByKecamatan.value = { ...desaByKecamatan.value, [kecamatanId]: res.data }
      return res.data
    } catch {
      return []
    } finally {
      isLoadingDesa.value = false
    }
  }

  return {
    kecamatanList,
    isLoadingKecamatan,
    desaByKecamatan,
    isLoadingDesa,
    loadKecamatanList,
    loadDesaList,
  }
}
