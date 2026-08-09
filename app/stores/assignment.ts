import type { VisitAssignment } from '~/types/api'

// GET /visit-assignments tidak punya endpoint per-id (VisitAssignmentController cuma
// index/store/bulkStore) -- /app/tugas fetch semua sekali lewat store ini, /app/kunjungan/[id]
// cari dari cache yang SAMA (fetchAllPages ulang kalau cache kosong, mis. direct deep-link),
// bukan bikin endpoint GET-per-id yang memang tidak ada.
export const useAssignmentStore = defineStore('assignment', () => {
  const assignments = ref<VisitAssignment[]>([])
  const isLoading = ref(false)
  const loadError = ref('')

  async function fetchAll() {
    isLoading.value = true
    loadError.value = ''
    try {
      const api = useApi()
      assignments.value = await fetchAllPages<VisitAssignment>((page) =>
        api('/visit-assignments', { query: { per_page: 100, page } })
      )
    } catch (e) {
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

  return { assignments, isLoading, loadError, fetchAll, getById, markCompleted }
})
