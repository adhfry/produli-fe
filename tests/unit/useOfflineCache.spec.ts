// docs/planning/15 (temuan audit: nol test coverage frontend) -- composable ini SEMPAT punya bug
// nyata sesi lalu: mengoper Proxy reaktif Vue (mis. assignments.value dari Pinia) langsung ke
// IndexedDB melempar "DataCloneError: ... could not be cloned", ketahuan lewat debugging manual
// di browser sungguhan. Test ini jadi jaring pengaman supaya bug yang sama tidak lolos lagi diam-diam.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { useOfflineCache } from '../../app/composables/useOfflineCache'

describe('useOfflineCache', () => {
  beforeEach(async () => {
    // Reset database bersih tiap test -- fake-indexeddb menyimpan state di globalThis.indexedDB,
    // tidak otomatis ke-reset antar test.
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('produli-offline-cache')
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
      req.onblocked = () => resolve()
    })
  })

  it('menyimpan dan membaca kembali nilai yang sama', async () => {
    const { setCached, getCached } = useOfflineCache()
    await setCached('visit_assignments', [{ id: 1, status: 'pending' }])

    const result = await getCached<{ id: number, status: string }[]>('visit_assignments')

    expect(result).not.toBeNull()
    expect(result?.value).toEqual([{ id: 1, status: 'pending' }])
    expect(result?.updatedAt).toBeTypeOf('string')
  })

  it('mengembalikan null untuk key yang belum pernah disimpan', async () => {
    const { getCached } = useOfflineCache()

    const result = await getCached('tidak-pernah-ada')

    expect(result).toBeNull()
  })

  it('menimpa nilai lama saat key yang sama disimpan ulang', async () => {
    const { setCached, getCached } = useOfflineCache()
    await setCached('visit_assignments', [{ id: 1 }])
    await setCached('visit_assignments', [{ id: 1 }, { id: 2 }])

    const result = await getCached<{ id: number }[]>('visit_assignments')

    expect(result?.value).toHaveLength(2)
  })

  it('regresi DataCloneError -- objek berbentuk Proxy (mis. ref Pinia) tetap tersimpan aman', async () => {
    const { setCached, getCached } = useOfflineCache()
    // Proxy polos meniru sifat reaktif Vue (structured-clone algorithm browser menolak Proxy
    // mentah) -- setCached() WAJIB membulatkannya ke objek polos dulu (JSON round-trip) sebelum
    // sampai ke IndexedDB, bukan melempar exception.
    const reactiveLike = new Proxy({ id: 42, nama: 'Pasien Uji' }, {})

    await expect(setCached('proxy-test', reactiveLike)).resolves.not.toThrow()

    const result = await getCached<{ id: number, nama: string }>('proxy-test')
    expect(result?.value).toEqual({ id: 42, nama: 'Pasien Uji' })
  })
})
