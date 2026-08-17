// docs/planning/15 (temuan audit: nol test coverage frontend) -- fokus ke bagian IndexedDB murni
// (saveDraft/getDraftForAssignment/promoteDraftToPendingSync/draftToFormData), BUKAN
// syncOneDraft/syncAllDrafts yang butuh useApi()+ApiError (auto-import Nuxt, perlu konteks
// @nuxt/test-utils terpisah -- di luar cakupan scaffold ringan ini).
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

  it('saveDraft TIDAK menurunkan status pending_sync/failed kembali ke draft (auto-save tidak boleh menutupi kegagalan)', async () => {
    const { saveDraft, promoteDraftToPendingSync, markDraftFailed, getDraftForAssignment } = useOfflineQueue()

    const draft = await saveDraft(makePayload(), new Blob(['x']), 'Pasien Uji')
    await promoteDraftToPendingSync(draft.id)
    await markDraftFailed(draft.id, 'Gagal terkirim — periksa koneksi.')

    // Auto-save berkala jalan lagi di halaman yang sama (skenario nyata: kader kembali ke
    // halaman kunjungan yang draft-nya sempat gagal kirim, lalu mengetik ulang sesuatu).
    await saveDraft(makePayload({ kondisi: 'Diedit lagi' }), new Blob(['y']), 'Pasien Uji', 'draft')

    const result = await getDraftForAssignment(10)
    expect(result?.status).toBe('failed')
    expect(result?.payload.kondisi).toBe('Diedit lagi')
  })

  it('promoteDraftToPendingSync memindahkan status draft ke pending_sync', async () => {
    const { saveDraft, promoteDraftToPendingSync, getDraftForAssignment } = useOfflineQueue()
    const draft = await saveDraft(makePayload(), new Blob(['x']), 'Pasien Uji')

    await promoteDraftToPendingSync(draft.id)

    expect((await getDraftForAssignment(10))?.status).toBe('pending_sync')
  })

  it('getDraftForAssignment mengembalikan null kalau tidak ada draft untuk assignment itu', async () => {
    const { getDraftForAssignment } = useOfflineQueue()

    expect(await getDraftForAssignment(999)).toBeNull()
  })

  it('deleteDraft menghapus draft dari penyimpanan', async () => {
    const { saveDraft, deleteDraft, getAllDrafts } = useOfflineQueue()
    const draft = await saveDraft(makePayload(), null, 'Pasien Uji')

    await deleteDraft(draft.id)

    expect(await getAllDrafts()).toHaveLength(0)
  })

  it('draftToFormData membangun field sesuai kontrak SubmitVisitReportRequest', async () => {
    const { saveDraft } = useOfflineQueue()
    const draft = await saveDraft(
      makePayload({
        tindakan: ['diberi_obat', 'dirujuk_puskesmas'],
        cara_rujukan: 'dijemput_ambulan',
        patientFieldUpdates: { golongan_darah: 'O', is_bpjs: true }
      }),
      new Blob(['foto']),
      'Pasien Uji',
      'pending_sync'
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
