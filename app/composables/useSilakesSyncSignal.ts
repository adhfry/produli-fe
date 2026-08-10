// Sinyal reaktif dibagi antar komponen (Nuxt useState, SSR-safe/scoped per sesi klien) --
// dipakai supaya halaman yang sedang aktif (dashboard, dashboard/pasien,
// dashboard/pasien/[id]) otomatis reload datanya sendiri begitu sinkronisasi SiLAKES
// berhasil, tanpa perlu refresh manual. Sebelumnya sync berhasil cuma memperbarui label
// "Terakhir sinkronisasi" di sidebar -- data di halaman aktif tetap versi lama sampai
// user reload manual.
//
// Counter (bukan boolean/timestamp) -- watch() di halaman mendeteksi PERUBAHAN nilai,
// counter yang selalu naik menjamin itu selalu terdeteksi sebagai perubahan baru, beda
// dari timestamp yang secara teori bisa sama persis kalau dua trigger terjadi di detik
// yang sama.
export function useSilakesSyncSignal() {
  return useState<number>('silakes-sync-signal', () => 0)
}

// Waktu sinkron terakhir dibagi antar komponen -- sidebar (label "Terakhir sinkronisasi")
// BUKAN satu-satunya tempat yang bisa memicu sync (halaman detail pasien juga punya tombol
// sendiri di banner riwayat pengajuan), jadi state-nya harus dibagi supaya sidebar tetap
// akurat walau sync dipicu dari halaman lain.
export function useSilakesLastSyncedAt() {
  return useState<string | null>('silakes-last-synced-at', () => null)
}

// Dipanggil oleh KODE YANG MEMICU sinkronisasi (tombol sidebar, tombol "Sinkronisasi
// Sekarang" di riwayat pengajuan) setelah POST /silakes/sync sukses -- BUKAN oleh halaman
// yang cuma mendengarkan.
export function signalSilakesSyncCompleted(lastSyncedAt?: string) {
  if (lastSyncedAt) {
    useSilakesLastSyncedAt().value = lastSyncedAt
  }
  useSilakesSyncSignal().value++
}
