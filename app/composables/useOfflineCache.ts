// Cache BACA generik (docs/planning/12) -- beda dari useOfflineQueue.ts (yang khusus antrean
// KIRIM draft laporan kunjungan). IndexedDB terpisah supaya tidak mencampur tanggung jawab:
// composable ini murni "simpan hasil GET terakhir yang sukses, sajikan lagi kalau GET berikutnya
// gagal karena jaringan mati" -- dipakai stores/assignment.ts (daftar tugas) & halaman riwayat
// kunjungan pasien di app/pages/app/kunjungan/[id].vue.

const DB_NAME = 'produli-offline-cache'
const DB_VERSION = 1
const STORE_NAME = 'cached_reads'

interface CacheEntry<T> {
  key: string
  value: T
  updatedAt: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
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

export function useOfflineCache() {
  async function setCached<T>(key: string, value: T): Promise<void> {
    // Pemanggil biasanya mengoper ref Pinia (mis. assignments.value) -- itu Proxy reaktif Vue,
    // BUKAN objek polos. IndexedDB structured-clone MENOLAK Proxy ("DataCloneError: ... could not
    // be cloned") -- dikonfirmasi lewat pengujian nyata di browser. Bulat-bulat lewat JSON supaya
    // benar-benar objek polos sebelum disimpan (data ini memang selalu berasal dari respons JSON
    // API, aman di-round-trip begini).
    const plainValue = JSON.parse(JSON.stringify(value)) as T
    const entry: CacheEntry<T> = { key, value: plainValue, updatedAt: new Date().toISOString() }
    await withStore('readwrite', (store) => store.put(entry))
  }

  async function getCached<T>(key: string): Promise<{ value: T, updatedAt: string } | null> {
    const entry = await withStore<CacheEntry<T> | undefined>('readonly', (store) => store.get(key))
    if (!entry) return null
    return { value: entry.value, updatedAt: entry.updatedAt }
  }

  return { setCached, getCached }
}
