# Brief: Onboarding First-Login & Mode Offline (Aplikasi Kader)

> Target pengguna: umum, rata-rata 25+ tahun (bukan cuma asumsi lansia ekstrem) — tetap perhatikan detail kecil, tapi tidak perlu seketat prinsip senior-friendly `/app` yang lain (itu tetap berlaku untuk kader lansia spesifik, ini kalibrasi untuk populasi umum).

## 1. Onboarding First-Login

**Alur:** login pertama kali (`onboarding_completed_at IS NULL`) → diarahkan paksa ke `/onboarding` (mirip pola `must_change_password`, tidak bisa diskip/back ke halaman lain) → 3 langkah:

1. **Syarat & Ketentuan** — tampilkan teks ToS (statis, taruh di komponen/file terpisah supaya gampang diupdate tanpa redeploy besar), checkbox "Saya setuju", tombol lanjut disabled sampai dicentang.
2. **Konfirmasi Penempatan** — tampilkan (read-only, BUKAN form input): nama, puskesmas, dan (khusus kader) nama PJ Prolanis yang menaunginya. Bukan untuk diubah — kalau salah, kasih catatan kecil "Kalau data ini salah, hubungi PJ/admin puskesmas Anda" (bukan tombol edit).
3. **Lengkapi Profil** (khusus kader — staf skip langsung ke selesai) — form no_wa/alamat/gender/tgl_lahir (field yang sama seperti `/app/profil`, boleh reuse komponennya), boleh dilewati ("Lengkapi nanti" — ini opsional per desain awal `KaderService`, jangan dipaksa wajib sekarang).

Submit ke `POST /api/v1/auth/onboarding/complete` → redirect ke home sesuai role.

## 2. Mode Offline — Indikator Visual

Badge status jaringan **selalu terlihat** (di header, bukan cuma di halaman kunjungan) — bukan cuma titik kecil, harus jelas beda online vs offline:
- **Online**: badge hijau kecil, tidak mengganggu.
- **Offline**: banner lebih menonjol (warna `warning`/oranye, bukan `danger`/merah — offline itu kondisi wajar di lapangan, bukan error), teks singkat "Mode Offline — data akan tersimpan lokal".

Deteksi: `navigator.onLine` sebagai sinyal awal, TAPI itu tidak selalu akurat (bisa true walau internet sebenarnya mati) — tambahkan ping ringan berkala ke endpoint backend (mis. `GET /up` yang sudah ada, request kecil) untuk konfirmasi konektivitas nyata, bukan cuma status interface jaringan.

## 3. Draft Offline & Halaman "Kunjungan Belum Terkirim"

Saat submit laporan kunjungan TANPA koneksi: simpan payload lengkap (foto sebagai blob, GPS, form, semua field pemeriksaan) ke IndexedDB sebagai draft berstatus `pending_sync` — submit dari sisi kader terasa "berhasil" seketika (tidak menunggu server), sesuai prinsip 1-aksi-besar yang sudah ditetapkan.

**Halaman baru: `/app/draft`** (atau nama serupa — "Kunjungan Belum Terkirim") — daftar draft `pending_sync`, tiap item tampilkan: nama pasien, waktu disimpan, status (menunggu sync / gagal terakhir kali dicoba + alasan). Kader bisa lihat isi draft (preview foto, data terisi) tapi TIDAK bisa edit dari sini (kalau mau ubah, hapus draft dan ulangi dari `/app/kunjungan/[id]`).

## 4. Tombol Sinkronisasi — Smart Upload Bertahap

Tombol "Sinkronkan Sekarang" (di halaman draft, dan/atau badge notifikasi jumlah draft pending di beranda) — proses:
- Upload draft **satu per satu** (bukan paralel semua sekaligus) — koneksi lapangan biasanya lemah, upload serentak berisiko semua gagal bareng.
- Progress real-time: "Mengunggah 2 dari 5..." + progress bar.
- Tiap draft pakai endpoint yang SUDAH ADA (`POST /api/v1/visit-reports`) — tidak perlu endpoint baru.
- Gagal di satu draft TIDAK menghentikan proses — lanjut ke draft berikutnya, laporkan mana yang gagal + alasannya di akhir (pola partial-success, sama seperti bulk-assign).
- Draft yang berhasil terkirim otomatis terhapus dari IndexedDB. Yang gagal tetap ada di `/app/draft`, kader bisa coba sinkron ulang.
- Sinkronisasi otomatis juga jalan diam-diam saat koneksi pulih terdeteksi (bukan cuma manual) — tapi tombol manual tetap ada supaya kader bisa mastikan sendiri, bukan cuma percaya proses background.

## 5. Peta Offline — Solusi

**Rekomendasi: cache tile peta lewat Service Worker (Workbox, sudah ada di stack `@vite-pwa/nuxt`), bukan bangun infrastruktur tile server sendiri atau layanan berbayar pihak ketiga.**

Cara kerja: request tile MapLibre GL ke sumber tile yang sudah dipakai (kecamatan/desa) otomatis ke-cache oleh Service Worker begitu pernah diakses saat online (`StaleWhileRevalidate` — pakai cache dulu kalau ada, refresh di background kalau online). Supaya kader tidak perlu "kebetulan sudah lewat situ" dulu baru ke-cache, tambahkan **tombol "Unduh Peta Wilayah Kerja"** di beranda (`/app`) — sekali ditekan (saat online, idealnya di puskesmas/rumah sebelum berangkat), sistem fetch semua tile untuk bounding box kecamatan/desa tempat kader ditugaskan hari ini (dari data `visit_assignments` yang sudah ada), pada rentang zoom yang dipakai aplikasi — bukan seluruh Kabupaten Sumenep (terlalu besar), cukup wilayah kerja aktual.

**Perlu diverifikasi dulu (bukan saya putuskan sepihak):** sumber tile peta yang dipakai sekarang itu apa — kalau masih pakai tile gratis publik (mis. demo server OpenStreetMap), banyak dari itu **melarang penggunaan berat/caching skala besar** di kebijakan pemakaiannya. Kalau iya, perlu pindah ke self-hosted tile (misalnya lewat MinIO yang sudah ada infrastrukturnya, generate tile statis dari data yang sama dipakai GIS dashboard) sebelum fitur unduh-offline ini aman dipakai produksi.

## 6. Yang TIDAK perlu backend baru
Sync (item 4) dan cache tile (item 5) murni kerja frontend — pakai endpoint/infrastruktur yang sudah ada. Cuma onboarding (item 1) yang butuh backend baru (§14 dokumen 02).
