import type { VisitAssignment } from '~/types/api'

// GET /visit-assignments tidak punya endpoint per-id (VisitAssignmentController cuma
// index/store/bulkStore) -- /app/tugas fetch semua sekali lewat store ini, /app/kunjungan/[id]
// cari dari cache yang SAMA (fetchAllPages ulang kalau cache kosong, mis. direct deep-link),
// bukan bikin endpoint GET-per-id yang memang tidak ada.
const CACHE_KEY = 'visit_assignments'

export const useAssignmentStore = defineStore('assignment', () => {
  const assignments = ref<VisitAssignment[]>([])
  const isLoading = ref(false)
  const loadError = ref('')
  // docs/planning/12: true kalau assignments.value sedang berisi data dari cache IndexedDB
  // (fetch terakhir gagal karena jaringan mati), bukan hasil GET yang baru saja sukses -- dipakai
  // /app/tugas & /app/kunjungan/[id].vue buat tampilkan penanda "data tersimpan (offline)".
  const loadedFromCache = ref(false)

  async function fetchAll() {
    isLoading.value = true
    loadError.value = ''
    try {
      const api = useApi()
      assignments.value = await fetchAllPages<VisitAssignment>((page) =>
        api('/visit-assignments', { query: { per_page: 100, page } })
      )
      loadedFromCache.value = false
      await useOfflineCache().setCached(CACHE_KEY, assignments.value)
    } catch (e) {
      // ApiError (401 dkk) = server MENJAWAB, itu bukan alasan buat fallback ke cache basi --
      // tampilkan error apa adanya seperti sebelumnya. Cuma exception jaringan murni yang layak
      // fallback ke data tersimpan terakhir (docs/planning/12).
      if (!(e instanceof ApiError)) {
        const cached = await useOfflineCache().getCached<VisitAssignment[]>(CACHE_KEY)
        if (cached) {
          assignments.value = cached.value
          loadedFromCache.value = true
          isLoading.value = false
          return
        }
      }
      loadError.value = e instanceof ApiError ? e.message : 'Gagal memuat daftar tugas kunjungan.'
    } finally {
      isLoading.value = false
    }
  }

  function getById(id: number): VisitAssignment | null {
    return assignments.value.find((a) => a.id === id) ?? null
  }

  // Dipanggil setelah POST /visit-reports berhasil -- assignment berubah status jadi 'completed'
  // di backend, sinkronkan cache lokal supaya /app/tugas tidak perlu refetch penuh.
  function markCompleted(id: number) {
    const idx = assignments.value.findIndex((a) => a.id === id)
    if (idx !== -1 && assignments.value[idx]) {
      assignments.value[idx] = { ...assignments.value[idx], status: 'completed' }
    }
  }

  return { assignments, isLoading, loadError, loadedFromCache, fetchAll, getById, markCompleted }
})
