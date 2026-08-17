import type { ApiSuccessEnvelope, VisitAssignment } from '~/types/api'

// docs/planning/13: sinkronisasi latar belakang berkala (opsional, lihat stores/autoSync.ts) --
// dipanggil baik oleh timer (plugins/auto-sync.client.ts) maupun tombol manual "Sinkronkan
// Sekarang" di /app/profil/sinkronisasi-otomatis. SENGAJA beda dari wizard "Siapkan Mode
// Offline" (mode-offline.vue, unduh SEMUA riwayat pasien sekali di awal) -- di sini cuma pasien
// dengan tugas AKTIF (pending/in_progress) yang riwayatnya disegarkan, supaya tiap siklus tetap
// ringan cukup buat dijalankan tiap beberapa menit tanpa menghabiskan kuota/baterai.
//
// isSyncingRef MODULE-SCOPED (bukan dibuat ulang tiap panggilan useAutoSync()) -- supaya timer
// latar belakang & tombol manual di halaman pengaturan saling tahu status masing-masing (tidak
// dobel-jalan bersamaan), pola sama dengan syncInFlight di useOfflineQueue.ts tapi dibuat
// reaktif karena UI perlu menampilkannya.
const isSyncingRef = ref(false)

export function useAutoSync() {
  async function syncNow(): Promise<{ ok: boolean, patientsSynced: number }> {
    if (isSyncingRef.value) return { ok: false, patientsSynced: 0 }
    isSyncingRef.value = true
    try {
      const assignmentStore = useAssignmentStore()
      await assignmentStore.fetchAll()
      if (assignmentStore.loadError) return { ok: false, patientsSynced: 0 }

      const offlineCache = useOfflineCache()
      const api = useApi()
      const activePatientIds = [
        ...new Set(
          assignmentStore.assignments
            .filter((a) => a.status === 'pending' || a.status === 'in_progress')
            .map((a) => a.patient?.id)
            .filter((id): id is number => !!id)
        )
      ]

      let synced = 0
      for (const patientId of activePatientIds) {
        try {
          const res = (await api(`/patients/${patientId}/visit-history`)) as ApiSuccessEnvelope<VisitAssignment[]>
          await offlineCache.setCached(`visit_history_${patientId}`, res.data)
          synced += 1
        } catch {
          // Partial-success -- satu pasien gagal tidak menghentikan yang lain (pola sama dengan
          // useOfflineQueue.syncAllDrafts() & wizard mode-offline).
        }
      }

      useAutoSyncStore().lastSyncAt = new Date().toISOString()
      return { ok: true, patientsSynced: synced }
    } finally {
      isSyncingRef.value = false
    }
  }

  return { isRunning: isSyncingRef, syncNow }
}
