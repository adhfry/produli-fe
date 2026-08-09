import type { ApiSuccessEnvelope, PaginatedData } from '~/types/api'

// Auto-imported (app/utils/*) — daftar kandidat/kader/assignment per puskesmas bisa lebih dari
// satu halaman (per_page dibatasi backend maks 100), jadi tarik semua halaman supaya "Pilih
// Semua yang Belum Ditugaskan" benar-benar lihat semua kandidat, bukan cuma halaman pertama.
export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<ApiSuccessEnvelope<PaginatedData<T>>>
): Promise<T[]> {
  const items: T[] = []
  let page = 1
  let lastPage = 1

  do {
    const res = await fetchPage(page)
    items.push(...res.data.items)
    lastPage = res.data.pagination.last_page
    page += 1
  } while (page <= lastPage)

  return items
}
