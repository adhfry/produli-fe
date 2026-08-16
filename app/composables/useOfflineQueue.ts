// IndexedDB draft queue untuk laporan kunjungan yang gagal terkirim karena offline
// (docs/planning/10 §3/§4) — CLAUDE.md: "IndexedDB (useOfflineQueue) untuk draft laporan
// kunjungan, Background Sync API untuk auto-upload saat online". Foto disimpan sebagai Blob asli
// (IndexedDB dukung native, tidak perlu base64), field lain disimpan flat supaya gampang
// direkonstruksi jadi FormData persis seperti submitData() normal saat disinkronkan.

const DB_NAME = 'produli-offline'
const DB_VERSION = 1
const STORE_NAME = 'visit_report_drafts'

// Lock MODUL (bukan per-pemanggil) -- tombol manual "Sinkronkan Sekarang" di /app/draft dan
// plugin auto-sync (offline-sync.client.ts, jalan tiap app boot + event 'online') bisa mudah
// terpanggil nyaris bersamaan (mis. reload halaman /app/draft persis saat baru online lagi).
// Tanpa lock ini keduanya sync draft yang SAMA sekaligus -- yang kedua akan 422 (assignment
// sudah 'completed' oleh yang pertama), ketahuan lewat pengujian nyata.
let syncInFlight = false

export interface VisitReportDraftPayload {
  assignment_id: number
  latitude: number
  longitude: number
  gps_accuracy_meters: number | null
  gps_captured_at: string
  kondisi: string
  catatan: string | null
  systolic: string | null
  diastolic: string | null
  gda: string | null
  gdp: string | null
  gd2jpp: string | null
  uric_acid: string | null
  cholesterol: string | null
  keluhan: string | null
  // Bisa lebih dari satu tindakan sekaligus (Fase 2, sebelumnya string tunggal).
  tindakan: string[] | null
  cara_rujukan: string | null
  // PMO mingguan kader (revisi Bu Kadis) -- kunjungan kader-only, terpisah dari pemeriksaan
  // klinis di atas yang jadi tanggung jawab tenaga_kesehatan.
  kepatuhan_obat: string | null
  sisa_obat: string | null
  attendeeKaderIds: number[]
  // SubmitVisitReportRequest::patientFieldUpdates() -- string fields + is_bpjs (boolean).
  patientFieldUpdates: Record<string, string | boolean> | null
}

export interface VisitReportDraft {
  id: string // client_submission_id (crypto.randomUUID()) -- dikirim balik saat sync, dipakai
  // OfflineQueueHandler (Layer 7) & VisitValidationContext.clientSubmissionId.
  patientNama: string
  createdAt: string
  status: 'pending_sync' | 'failed'
  lastError: string | null
  payload: VisitReportDraftPayload
  photo: Blob
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const req = fn(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
  })
}

export function useOfflineQueue() {
  async function addDraft(payload: VisitReportDraftPayload, photo: Blob, patientNama: string): Promise<VisitReportDraft> {
    const draft: VisitReportDraft = {
      id: crypto.randomUUID(),
      patientNama,
      createdAt: new Date().toISOString(),
      status: 'pending_sync',
      lastError: null,
      payload,
      photo
    }
    await withStore('readwrite', (store) => store.put(draft))
    return draft
  }

  async function getAllDrafts(): Promise<VisitReportDraft[]> {
    const all = await withStore<VisitReportDraft[]>('readonly', (store) => store.getAll())
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async function deleteDraft(id: string): Promise<void> {
    await withStore('readwrite', (store) => store.delete(id))
  }

  async function markDraftFailed(id: string, error: string): Promise<void> {
    const draft = await withStore<VisitReportDraft>('readonly', (store) => store.get(id))
    if (!draft) return
    draft.status = 'failed'
    draft.lastError = error
    await withStore('readwrite', (store) => store.put(draft))
  }

  // 1 draft = 1 panggilan POST /visit-reports yang SUDAH ADA (docs/planning/10 §4) -- tidak
  // perlu endpoint baru. Sukses -> draft dihapus dari IndexedDB. Gagal -> ditandai 'failed' +
  // alasannya (bukan dihapus), tetap ada di /app/draft supaya kader bisa coba sinkron ulang.
  async function syncOneDraft(draft: VisitReportDraft): Promise<{ ok: boolean, error?: string }> {
    try {
      const api = useApi()
      await api('/visit-reports', { method: 'POST', body: draftToFormData(draft) })
      await deleteDraft(draft.id)
      return { ok: true }
    } catch (err) {
      // "Assignment ini sudah berstatus completed" (VisitReportService::submit) -- draft ini
      // SUDAH terkirim lewat jalur lain (auto-sync di tab/plugin lain yang menang duluan,
      // sync manual dobel-klik, dst). Tujuan draft ini (laporan benar-benar tersimpan di
      // server) SUDAH tercapai -- perlakukan sebagai sukses (hapus), BUKAN kegagalan yang
      // menyuruh kader repot menyelidiki "Gagal" padahal datanya sudah aman.
      if (err instanceof ApiError && err.errors?.assignment) {
        await deleteDraft(draft.id)
        return { ok: true }
      }
      const message = err instanceof ApiError ? err.message : 'Gagal terkirim — periksa koneksi.'
      await markDraftFailed(draft.id, message)
      return { ok: false, error: message }
    }
  }

  // Upload SATU PER SATU (bukan paralel semua sekaligus, docs/planning/10 §4 -- koneksi
  // lapangan biasanya lemah, upload serentak berisiko semua gagal bareng). Partial success:
  // gagal di satu draft TIDAK menghentikan proses, lanjut ke draft berikutnya. syncInFlight
  // mencegah pemanggil BERBEDA (tombol manual vs plugin auto-sync) sinkron draft yang sama
  // dua kali bersamaan -- lihat catatan lock di atas.
  async function syncAllDrafts(onProgress?: (current: number, total: number) => void): Promise<{ succeeded: number, failed: number }> {
    if (syncInFlight) return { succeeded: 0, failed: 0 }
    syncInFlight = true
    try {
      const drafts = await getAllDrafts()
      let succeeded = 0
      let failed = 0
      for (let i = 0; i < drafts.length; i++) {
        onProgress?.(i + 1, drafts.length)
        const result = await syncOneDraft(drafts[i]!)
        if (result.ok) succeeded++
        else failed++
      }
      return { succeeded, failed }
    } finally {
      syncInFlight = false
    }
  }

  return { addDraft, getAllDrafts, deleteDraft, markDraftFailed, syncOneDraft, syncAllDrafts }
}

// Membangun FormData POST /visit-reports dari draft tersimpan -- field & urutan SAMA PERSIS
// dengan submitData() di /app/kunjungan/[id].vue supaya draft lama (dibuat sebelum field baru
// ditambah) tetap valid dikirim.
export function draftToFormData(draft: VisitReportDraft): FormData {
  const fd = new FormData()
  const p = draft.payload
  fd.append('assignment_id', String(p.assignment_id))
  fd.append('photo', draft.photo, 'kunjungan.jpg')
  fd.append('latitude', String(p.latitude))
  fd.append('longitude', String(p.longitude))
  if (p.gps_accuracy_meters !== null) fd.append('gps_accuracy_meters', String(p.gps_accuracy_meters))
  fd.append('gps_captured_at', p.gps_captured_at)
  fd.append('captured_live', '1')
  fd.append('is_offline', '1')
  fd.append('client_submission_id', draft.id)
  fd.append('kondisi', p.kondisi)
  if (p.catatan) fd.append('catatan', p.catatan)

  const pemeriksaanKeys = ['systolic', 'diastolic', 'gda', 'gdp', 'gd2jpp', 'uric_acid', 'cholesterol'] as const
  for (const key of pemeriksaanKeys) {
    const value = p[key]
    if (value !== null && value !== '') fd.append(key, value)
  }
  if (p.keluhan) fd.append('keluhan', p.keluhan)
  p.tindakan?.forEach((t) => fd.append('tindakan[]', t))
  if (p.cara_rujukan) fd.append('cara_rujukan', p.cara_rujukan)
  if (p.kepatuhan_obat) fd.append('kepatuhan_obat', p.kepatuhan_obat)
  if (p.sisa_obat) fd.append('sisa_obat', p.sisa_obat)

  p.attendeeKaderIds.forEach((id) => fd.append('attendee_kader_ids[]', String(id)))

  if (p.patientFieldUpdates) {
    for (const [key, value] of Object.entries(p.patientFieldUpdates)) {
      fd.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : value)
    }
  }

  return fd
}
