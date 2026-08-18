// docs/planning/15 (temuan audit: nol test coverage frontend) -- fokus ke bagian IndexedDB murni
// (saveDraft/enqueueForSync/getDraftForAssignment/draftToFormData), BUKAN syncOneDraft/
// syncAllDrafts yang butuh useApi()+ApiError (auto-import Nuxt, perlu konteks
// @nuxt/test-utils terpisah -- di luar cakupan scaffold ringan ini).
//
// Revisi -- DUA object store terpisah sekarang (visit_report_drafts utk WIP murni,
// visit_report_sync_queue utk pending_sync/failed), bukan 1 store gabungan dibedakan field
// `status`. Test di sini memverifikasi kedua store benar-benar independen & enqueueForSync
// memindahkan record antar store dengan benar (bukan cuma update field di tempat).
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { draftToFormData, useOfflineQueue, type VisitReportDraftPayload } from '../../app/composables/useOfflineQueue'

function makePayload(overrides: Partial<VisitReportDraftPayload> = {}): VisitReportDraftPayload {
  return {
    assignment_id: 10,
    latitude: -7.0123,
    longitude: 113.8456,
    gps_accuracy_meters: 12,
    gps_captured_at: new Date().toISOString(),
    kondisi: 'Stabil',
    catatan: null,
    systolic: null,
    diastolic: null,
    gda: null,
    gdp: null,
    gd2jpp: null,
    uric_acid: null,
    cholesterol: null,
    keluhan: null,
    tindakan: null,
    cara_rujukan: null,
    kepatuhan_obat: null,
    sisa_obat: null,
    attendeeKaderIds: [],
    patientFieldUpdates: null,
    ...overrides
  }
}

describe('useOfflineQueue', () => {
  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('produli-offline')
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
      req.onblocked = () => resolve()
    })
  })

  it('saveDraft membuat draft baru berstatus draft secara default', async () => {
    const { saveDraft, getAllDrafts } = useOfflineQueue()

    const draft = await saveDraft(makePayload(), null, 'Pasien Uji')

    expect(draft.status).toBe('draft')
    expect(draft.photo).toBeNull()
    expect(await getAllDrafts()).toHaveLength(1)
  })

  it('saveDraft dipanggil dua kali untuk assignment yang sama menimpa, bukan menduplikasi (docs/planning/14)', async () => {
    const { saveDraft, getAllDrafts } = useOfflineQueue()

    const first = await saveDraft(makePayload({ kondisi: 'Awal' }), null, 'Pasien Uji')
    const second = await saveDraft(makePayload({ kondisi: 'Diperbarui' }), null, 'Pasien Uji')

    const all = await getAllDrafts()
    expect(all).toHaveLength(1)
    expect(second.id).toBe(first.id)
    expect(all[0]!.payload.kondisi).toBe('Diperbarui')
  })

  it('saveDraft (WIP) dan entri antrean sync utk assignment yang sama hidup independen di dua store terpisah', async () => {
    const { saveDraft, enqueueForSync, markDraftFailed, getDraftForAssignment, getPendingDrafts } = useOfflineQueue()

    // Percobaan kirim pertama gagal -> masuk antrean sync (QUEUE_STORE), statusnya 'failed'.
    const queued = await enqueueForSync(makePayload(), new Blob(['x']), 'Pasien Uji')
    await markDraftFailed(queued.id, 'Gagal terkirim — periksa koneksi.')

    // Kader kembali ke halaman kunjungan yang SAMA, auto-save WIP baru jalan lagi -- ini HARUS
    // masuk DRAFT_STORE sebagai record BARU, TIDAK BOLEH menimpa/menurunkan entri 'failed' yang
    // sudah ada di QUEUE_STORE (dua store independen, beda dari desain lama 1-store-gabungan).
    await saveDraft(makePayload({ kondisi: 'Diedit lagi' }), new Blob(['y']), 'Pasien Uji')

    const wip = await getDraftForAssignment(10)
    expect(wip?.status).toBe('draft')
    expect(wip?.payload.kondisi).toBe('Diedit lagi')

    const pending = await getPendingDrafts()
    expect(pending).toHaveLength(1)
    expect(pending[0]!.status).toBe('failed')
    expect(pending[0]!.payload.kondisi).toBe(queued.payload.kondisi)
  })

  it('enqueueForSync memindahkan draft WIP existing ke antrean sync (id dipakai ulang, WIP lama terhapus)', async () => {
    const { saveDraft, enqueueForSync, getDraftForAssignment, getPendingDrafts } = useOfflineQueue()

    const wip = await saveDraft(makePayload({ kondisi: 'Sedang diisi' }), new Blob(['x']), 'Pasien Uji')

    const queued = await enqueueForSync(makePayload({ kondisi: 'Siap kirim' }), new Blob(['y']), 'Pasien Uji')

    expect(queued.id).toBe(wip.id)
    expect(queued.status).toBe('pending_sync')
    // WIP lama SUPERSEDED -- tidak boleh nyangkut jadi 2 record terpisah (1 di DRAFT_STORE, 1
    // lagi di QUEUE_STORE) untuk assignment yang sama.
    expect(await getDraftForAssignment(10)).toBeNull()
    expect(await getPendingDrafts()).toHaveLength(1)
  })

  it('enqueueForSync dipanggil dua kali (retry submit offline) memperbarui entri QUEUE_STORE yang sama, bukan duplikat', async () => {
    const { enqueueForSync, getPendingDrafts } = useOfflineQueue()

    const first = await enqueueForSync(makePayload({ kondisi: 'Percobaan 1' }), new Blob(['x']), 'Pasien Uji')
    const second = await enqueueForSync(makePayload({ kondisi: 'Percobaan 2' }), new Blob(['y']), 'Pasien Uji')

    expect(second.id).toBe(first.id)
    const pending = await getPendingDrafts()
    expect(pending).toHaveLength(1)
    expect(pending[0]!.payload.kondisi).toBe('Percobaan 2')
  })

  it('getDraftForAssignment mengembalikan null kalau tidak ada draft untuk assignment itu', async () => {
    const { getDraftForAssignment } = useOfflineQueue()

    expect(await getDraftForAssignment(999)).toBeNull()
  })

  it('getDraftForAssignment (DRAFT_STORE only) TIDAK menemukan entri yang sudah masuk antrean sync', async () => {
    const { enqueueForSync, getDraftForAssignment } = useOfflineQueue()

    await enqueueForSync(makePayload(), new Blob(['x']), 'Pasien Uji')

    expect(await getDraftForAssignment(10)).toBeNull()
  })

  it('deleteDraft menghapus draft WIP dari penyimpanan', async () => {
    const { saveDraft, deleteDraft, getAllDrafts } = useOfflineQueue()
    const draft = await saveDraft(makePayload(), null, 'Pasien Uji')

    await deleteDraft(draft.id)

    expect(await getAllDrafts()).toHaveLength(0)
  })

  it('deleteDraft juga menghapus entri dari antrean sync (pemanggil tidak perlu tahu draft ada di store mana)', async () => {
    const { enqueueForSync, deleteDraft, getPendingDrafts } = useOfflineQueue()
    const queued = await enqueueForSync(makePayload(), new Blob(['x']), 'Pasien Uji')

    await deleteDraft(queued.id)

    expect(await getPendingDrafts()).toHaveLength(0)
  })

  it('getPendingDrafts mengembalikan entri antrean sync terurut createdAt terbaru dulu', async () => {
    const { enqueueForSync, getPendingDrafts } = useOfflineQueue()

    await enqueueForSync(makePayload({ assignment_id: 1 }), new Blob(['a']), 'Pasien A')
    await new Promise((r) => setTimeout(r, 5))
    await enqueueForSync(makePayload({ assignment_id: 2 }), new Blob(['b']), 'Pasien B')

    const pending = await getPendingDrafts()
    expect(pending).toHaveLength(2)
    expect(pending[0]!.patientNama).toBe('Pasien B')
  })

  it('migrasi skema v1 (1 store gabungan) -> v2 (2 store terpisah) memindahkan record lama dengan benar', async () => {
    // Simulasikan device NYATA yang sudah lama pakai app ini sebelum revisi 2-store -- buka DB
    // langsung di versi 1 (skema lama: SATU object store 'visit_report_drafts', dibedakan lewat
    // field `status`), isi manual 3 record, tutup. Baru setelah itu panggil useOfflineQueue()
    // (yang minta versi 2) supaya onupgradeneeded migrasi nyata jalan, sama seperti yang akan
    // terjadi di HP kader begitu app di-deploy dengan versi baru.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('produli-offline', 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('visit_report_drafts', { keyPath: 'id' })
      }
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('visit_report_drafts', 'readwrite')
        const store = tx.objectStore('visit_report_drafts')
        store.put({ id: 'wip-1', patientNama: 'WIP Lama', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', status: 'draft', lastError: null, payload: makePayload({ assignment_id: 1 }), photo: null })
        store.put({ id: 'pending-1', patientNama: 'Pending Lama', createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', status: 'pending_sync', lastError: null, payload: makePayload({ assignment_id: 2 }), photo: new Blob(['x']) })
        store.put({ id: 'failed-1', patientNama: 'Failed Lama', createdAt: '2026-01-03T00:00:00.000Z', updatedAt: '2026-01-03T00:00:00.000Z', status: 'failed', lastError: 'Server down', payload: makePayload({ assignment_id: 3 }), photo: new Blob(['y']) })
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })

    const { getAllDrafts, getPendingDrafts } = useOfflineQueue()

    const wip = await getAllDrafts()
    expect(wip).toHaveLength(1)
    expect(wip[0]!.id).toBe('wip-1')
    expect(wip[0]!.status).toBe('draft')

    const pending = await getPendingDrafts()
    expect(pending.map((d) => d.id).sort()).toEqual(['failed-1', 'pending-1'])
    expect(pending.find((d) => d.id === 'failed-1')?.lastError).toBe('Server down')
  })

  it('draftToFormData membangun field sesuai kontrak SubmitVisitReportRequest', async () => {
    const { enqueueForSync } = useOfflineQueue()
    const draft = await enqueueForSync(
      makePayload({
        tindakan: ['diberi_obat', 'dirujuk_puskesmas'],
        cara_rujukan: 'dijemput_ambulan',
        patientFieldUpdates: { golongan_darah: 'O', is_bpjs: true }
      }),
      new Blob(['foto']),
      'Pasien Uji'
    )

    const fd = draftToFormData(draft)

    expect(fd.get('assignment_id')).toBe('10')
    expect(fd.get('is_offline')).toBe('1')
    expect(fd.get('client_submission_id')).toBe(draft.id)
    expect(fd.getAll('tindakan[]')).toEqual(['diberi_obat', 'dirujuk_puskesmas'])
    expect(fd.get('cara_rujukan')).toBe('dijemput_ambulan')
    expect(fd.get('golongan_darah')).toBe('O')
    // Boolean true harus dikonversi ke string '1' -- FormData tidak bisa menyimpan boolean asli.
    expect(fd.get('is_bpjs')).toBe('1')
  })
})
