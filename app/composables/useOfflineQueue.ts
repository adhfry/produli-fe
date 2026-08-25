// IndexedDB draft queue untuk laporan kunjungan (docs/planning/10 §3/§4) — CLAUDE.md:
// "IndexedDB (useOfflineQueue) untuk draft laporan kunjungan, Background Sync API untuk
// auto-upload saat online". Foto disimpan sebagai Blob asli (IndexedDB dukung native, tidak
// perlu base64), field lain disimpan flat supaya gampang direkonstruksi jadi FormData persis
// seperti submitData() normal saat disinkronkan.
//
// DUA object store TERPISAH (revisi -- sebelumnya 1 store gabungan dibedakan lewat field
// `status`, request user eksplisit supaya draft WIP tidak "tercampur" tempatnya dengan antrean
// gagal-sync):
// - visit_report_drafts (DRAFT_STORE): draft WIP murni, status SELALU 'draft' -- user masih
//   mengisi, BELUM PERNAH dicoba dikirim, TIDAK PERNAH ikut sinkron otomatis.
// - visit_report_sync_queue (QUEUE_STORE): pernah dicoba dikirim (submit online yang gagal
//   jaringan, ATAU submit yang memang dari awal offline) tapi belum berhasil -- status
//   'pending_sync' (menunggu retry otomatis) atau 'failed' (sudah dicoba retry, gagal lagi).

const DB_NAME = 'produli-offline'
const DB_VERSION = 2
const DRAFT_STORE = 'visit_report_drafts'
const QUEUE_STORE = 'visit_report_sync_queue'

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
  // Radio eksklusif (revisi -- array 0-1 elemen dipertahankan cuma utk wire format, lihat
  // [id].vue::selectTindakan()).
  tindakan: string[] | null
  cara_rujukan: string | null
  // Detail obat -- HANYA relevan kalau tindakan=['diberi_obat'], bisa >1 obat.
  obat_detail: { nama: string; dosis: string; frekuensi: string }[] | null
  // PMO mingguan kader (revisi Bu Kadis) -- kunjungan kader-only, terpisah dari pemeriksaan
  // klinis di atas yang jadi tanggung jawab tenaga_kesehatan.
  kepatuhan_obat: string | null
  sisa_obat: string | null
  attendeeKaderIds: number[]
  // SubmitVisitReportRequest::patientFieldUpdates() -- string fields + is_bpjs (boolean).
  patientFieldUpdates: Record<string, string | boolean> | null
  // Kader/nakes BENAR-BENAR di lokasi pasien saat submit -- dipakai backend utk update
  // geo_status pasien jadi 'verified' DAN resolusi otomatis desa/kecamatan dari titik GPS
  // (WilayahResolver::resolveByCoordinates()). Lihat komentar di [id].vue::form untuk alasan
  // default TRUE di sisi pemanggil.
  confirmedPatientLocation: boolean
}

export interface VisitReportDraft {
  id: string // client_submission_id (crypto.randomUUID()) -- dikirim balik saat sync, dipakai
  // OfflineQueueHandler (Layer 7) & VisitValidationContext.clientSubmissionId.
  patientNama: string
  createdAt: string
  updatedAt: string
  // 'draft' -- HANYA ada di DRAFT_STORE. 'pending_sync'/'failed' -- HANYA ada di QUEUE_STORE.
  // Field ini dipertahankan (bukan dihapus jadi cuma 2 kemungkinan) supaya tipe payload tetap
  // sama persis lintas kedua store & kompatibel dengan draftToFormData() yang sama.
  status: 'draft' | 'pending_sync' | 'failed'
  lastError: string | null
  payload: VisitReportDraftPayload
  // Nullable -- draft tahap awal (auto-save sebelum foto diambil) belum tentu punya foto.
  // syncOneDraft() cuma pernah dipanggil untuk isi QUEUE_STORE, dan itu HANYA tercipta lewat
  // submitData() yang sudah memvalidasi foto ada sebelum sampai situ -- jadi foto null hanya
  // mungkin muncul pada draft WIP di DRAFT_STORE.
  photo: Blob | null
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (event) => {
      const db = req.result
      const tx = req.transaction

      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        db.createObjectStore(DRAFT_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' })
      }

      // Migrasi dari skema versi 1 (1 store gabungan 'visit_report_drafts', dibedakan lewat
      // field `status`) -- device yang sudah lama pakai app ini bisa punya draft TERSIMPAN
      // NYATA di HP yang perlu dipindah, bukan cuma DB baru kosong. Pindahkan baris yang
      // statusnya BUKAN 'draft' ke QUEUE_STORE, sisakan baris 'draft' murni di DRAFT_STORE.
      // event.oldVersion < 2 aman dipakai baik utk upgrade dari v1 asli maupun DB baru sama
      // sekali (oldVersion 0) -- cursor di bawah no-op kalau DRAFT_STORE masih kosong.
      if (event.oldVersion < 2 && event.oldVersion > 0 && tx) {
        const draftStore = tx.objectStore(DRAFT_STORE)
        const queueStore = tx.objectStore(QUEUE_STORE)
        draftStore.openCursor().onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result
          if (!cursor) return
          const record = cursor.value as VisitReportDraft
          if (record.status !== 'draft') {
            queueStore.put(record)
            cursor.delete()
          }
          cursor.continue()
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    const req = fn(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
  })
}

export function useOfflineQueue() {
  // --- Draft WIP (DRAFT_STORE) -- murni disimpan user sendiri, belum pernah dicoba kirim. ---

  async function getAllDrafts(): Promise<VisitReportDraft[]> {
    const all = await withStore<VisitReportDraft[]>(DRAFT_STORE, 'readonly', (store) => store.getAll())
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  // docs/planning/14: SATU draft per assignment_id (bukan bertumpuk) -- auto-save berkala &
  // "Simpan sebagai Draf" manual berkali-kali untuk assignment yang SAMA menimpa entri lama
  // (dicari lewat scan getAllDrafts(), dataset kecil per kader jadi aman), bukan bikin baris
  // baru tiap kali.
  async function getDraftForAssignment(assignmentId: number): Promise<VisitReportDraft | null> {
    const all = await getAllDrafts()
    return all.find((d) => d.payload.assignment_id === assignmentId) ?? null
  }

  async function saveDraft(
    payload: VisitReportDraftPayload,
    photo: Blob | null,
    patientNama: string
  ): Promise<VisitReportDraft> {
    const existing = await getDraftForAssignment(payload.assignment_id)
    const draft: VisitReportDraft = {
      id: existing?.id ?? crypto.randomUUID(),
      patientNama,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      lastError: null,
      payload,
      photo: photo ?? existing?.photo ?? null
    }
    await withStore(DRAFT_STORE, 'readwrite', (store) => store.put(draft))
    return draft
  }

  // --- Antrean sync (QUEUE_STORE) -- pernah dicoba kirim (online gagal jaringan, atau memang
  // dari awal offline), menunggu/gagal disinkron. ---

  async function getPendingDrafts(): Promise<VisitReportDraft[]> {
    const all = await withStore<VisitReportDraft[]>(QUEUE_STORE, 'readonly', (store) => store.getAll())
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async function getQueueEntryForAssignment(assignmentId: number): Promise<VisitReportDraft | null> {
    const all = await getPendingDrafts()
    return all.find((d) => d.payload.assignment_id === assignmentId) ?? null
  }

  // Dipanggil submitData() saat submit GAGAL karena offline/jaringan (BUKAN dari draft WIP
  // manual) -- laporan yang sudah lengkap & siap kirim, cuma menunggu koneksi. Kalau assignment
  // ini kebetulan juga punya draft WIP tersimpan (mis. auto-save sebelumnya), draft itu SEKARANG
  // SUPERSEDED oleh percobaan kirim ini -- dipindah (id-nya dipakai ulang) ke antrean sync,
  // BUKAN dibiarkan nyangkut sebagai draft WIP terpisah dari entri antrean yang baru.
  async function enqueueForSync(
    payload: VisitReportDraftPayload,
    photo: Blob | null,
    patientNama: string
  ): Promise<VisitReportDraft> {
    const existingWip = await getDraftForAssignment(payload.assignment_id)
    const existingQueueEntry = await getQueueEntryForAssignment(payload.assignment_id)

    const draft: VisitReportDraft = {
      id: existingQueueEntry?.id ?? existingWip?.id ?? crypto.randomUUID(),
      patientNama,
      createdAt: existingQueueEntry?.createdAt ?? existingWip?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'pending_sync',
      lastError: null,
      payload,
      photo: photo ?? existingQueueEntry?.photo ?? existingWip?.photo ?? null
    }

    if (existingWip) {
      await withStore(DRAFT_STORE, 'readwrite', (store) => store.delete(existingWip.id))
    }
    await withStore(QUEUE_STORE, 'readwrite', (store) => store.put(draft))
    return draft
  }

  async function markDraftFailed(id: string, error: string): Promise<void> {
    const draft = await withStore<VisitReportDraft | undefined>(QUEUE_STORE, 'readonly', (store) => store.get(id))
    if (!draft) return
    draft.status = 'failed'
    draft.lastError = error
    await withStore(QUEUE_STORE, 'readwrite', (store) => store.put(draft))
  }

  // 1 draft = 1 panggilan POST /visit-reports yang SUDAH ADA (docs/planning/10 §4) -- tidak
  // perlu endpoint baru. Sukses -> entri dihapus dari antrean. Gagal -> ditandai 'failed' +
  // alasannya (bukan dihapus), tetap ada di /app/draft supaya kader bisa coba sinkron ulang.
  async function syncOneDraft(draft: VisitReportDraft): Promise<{ ok: boolean, error?: string }> {
    if (!draft.photo) {
      return { ok: false, error: 'Draft belum siap dikirim.' }
    }
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
      const drafts = await getPendingDrafts()
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

  // Dipakai dari draft WIP MAUPUN entri antrean -- id crypto.randomUUID() unik lintas kedua
  // store, jadi aman dicoba hapus dari keduanya sekaligus (delete pada key yang tidak ada di
  // suatu store adalah no-op, bukan error). Pemanggil (mis. tombol hapus di /app/draft) tidak
  // perlu tahu/peduli draft ini sedang ada di store yang mana.
  async function deleteDraft(id: string): Promise<void> {
    await withStore(DRAFT_STORE, 'readwrite', (store) => store.delete(id))
    await withStore(QUEUE_STORE, 'readwrite', (store) => store.delete(id))
  }

  return {
    getAllDrafts,
    getDraftForAssignment,
    saveDraft,
    getPendingDrafts,
    enqueueForSync,
    deleteDraft,
    markDraftFailed,
    syncOneDraft,
    syncAllDrafts
  }
}

// Membangun FormData POST /visit-reports dari draft tersimpan -- field & urutan SAMA PERSIS
// dengan submitData() di /app/kunjungan/[id].vue supaya draft lama (dibuat sebelum field baru
// ditambah) tetap valid dikirim. Cuma dipanggil dari syncOneDraft() SETELAH draft.photo
// dipastikan ada -- aman non-null di sini.
export function draftToFormData(draft: VisitReportDraft): FormData {
  const fd = new FormData()
  const p = draft.payload
  fd.append('assignment_id', String(p.assignment_id))
  fd.append('photo', draft.photo!, 'kunjungan.jpg')
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
  p.obat_detail?.forEach((o, i) => {
    fd.append(`obat_detail[${i}][nama]`, o.nama)
    fd.append(`obat_detail[${i}][dosis]`, o.dosis)
    fd.append(`obat_detail[${i}][frekuensi]`, o.frekuensi)
  })
  if (p.kepatuhan_obat) fd.append('kepatuhan_obat', p.kepatuhan_obat)
  if (p.sisa_obat) fd.append('sisa_obat', p.sisa_obat)

  p.attendeeKaderIds.forEach((id) => fd.append('attendee_kader_ids[]', String(id)))

  if (p.patientFieldUpdates) {
    for (const [key, value] of Object.entries(p.patientFieldUpdates)) {
      fd.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : value)
    }
  }

  fd.append('confirmed_patient_location', p.confirmedPatientLocation ? '1' : '0')

  return fd
}
