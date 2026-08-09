# Audit & Lengkapi Halaman yang Sudah Ada

> Living document — diupdate tiap ada temuan/keputusan baru. Kabar baik: `/dashboard/kunjungan` sudah mengimplementasikan alur §11 (Terima Laporan/Validasi Laporan) dengan rapi dan benar. Google-link dan credit line di `/app/profil` juga sudah pas.

## Halaman yang SUDAH FINAL — jangan diubah strukturnya, backend menyesuaikan ke ini

- **`/app/kunjungan/[id]`** — seluruh halaman final, termasuk field vital sign (tensi/GDP/asam urat/kolesterol) dan form update data pasien yang luas (agama, golongan darah, BPJS, dst). Backend WAJIB diperluas untuk mendukung ini (sudah masuk ke docs/planning/02 dan 01 §9 — lihat perubahan di bawah).
- **`/dashboard` (halaman utama/index.vue)** — final, termasuk komponen GIS. **Catatan: saya belum sempat membaca file ini** (belum diupload) — sebelum backend Claude menyesuaikan, perlu dilihat dulu strukturnya (lihat "Langkah selanjutnya" di bawah).
- **`/app/index.vue` — bagian HEADER saja** (greeting, jam, lokasi, animasi shrink saat scroll) — final. Bagian LAIN di halaman ini (quick actions, tips kesehatan, kegiatan mendatang) masih terbuka untuk diaudit/disederhanakan — terutama karena ada concern kepadatan informasi vs prinsip senior-friendly (lihat temuan lama soal ukuran teks).

## Halaman yang MASIH PERLU AUDIT/BOLEH DIROMBAK

`/dashboard/pasien` (+detail), `/dashboard/kader`, `/dashboard/staf`, `/app/tugas`, `/app/index.vue` (selain header) — audit besar-besaran struktur & bentuk boleh dilakukan di sini kalau memang belum sesuai keinginan Anda.

## Keputusan yang sudah dikonfirmasi (sebelumnya jadi pertanyaan terbuka)

1. **Vital sign/lab saat kunjungan — DIKONFIRMASI, opsional.** Sudah ditambahkan ke `visit_reports` (docs/planning/02): `systolic`, `diastolic`, `gdp`, `g2pp`, `uric_acid`, `cholesterol` — semua nullable, bukan bagian wajib 7-layer validation.
2. **Form update data pasien luas — DIKONFIRMASI**, ini realisasi "sembari menyelam minum air". Endpoint `pembaruan-lapangan` (docs/planning/01 §9) sudah diperluas: tambah `golongan_darah`, `agama`, `is_bpjs`, `no_bpjs`, `jenis_prolanis`, `jenis_perokok` (selain field kontak/alamat yang sudah ada). Tetap masuk `pending_review`, tidak ada auto-apply — aturan itu tidak berubah.
3. **Istilah tidak konsisten dengan backend** — masih perlu diperbaiki: `'tinggi'/'sedang'/'rendah'` → `'Berat'/'Sedang'/'Ringan'`; status `'terjadwal'/'terlambat'` bukan enum backend (backend: `pending`/`in_progress`/`completed`/`cancelled`) — "terlambat" harus dihitung di frontend (pending + tanggal lewat), jangan diharapkan dari API.
4. **Laporan "Tidak Valid" — MASIH TERBUKA, belum ada keputusan.** Assignment jadi apa, kader perlu kunjungan ulang atau tidak — ini belum dijawab, masih menghalangi `/app/tugas` dianggap selesai.

## Middleware keamanan — DITUNDA (keputusan user)

**Jangan pasang dulu.** Sengaja ditunda supaya bisa preview UI tanpa login selama masih iterasi. Akan dipasang di 1 langkah terakhir nanti, bersamaan waktu semua halaman disambungkan ke data asli sekaligus — bukan dikerjakan sekarang.

## Temuan kecil (perbaikan cepat, tidak perlu keputusan besar)

- Ukuran teks di `/app` banyak di bawah 16px (`text-xs`, bahkan `text-[10px]`/`[8px]`) — prinsip senior-friendly (bukan soal selera).
- `/dashboard/kader`: tombol Hapus dan Edit kader belum ada endpoint backend-nya (cuma `POST` buat + `PATCH` self-service). Tandai BUTUH BACKEND kalau mau dipertahankan.
- `/app/profil` referensi `/logo/logo-no-text.png` — nama file tidak cocok 4 aset logo yang ada. Cek keberadaannya, atau generate dari `pwa-512x512.png` yang sudah dibuat.
- Quick action "Riwayat Medis"/"Pasien Binaan"/"Kontak Pusk." di `/app` belum ada aksi — putuskan diisi atau dihapus.

## Definisi resmi: `/dashboard/kader` vs `/dashboard/staf`

- **`/dashboard/kader`** = kelola KADER (field worker). Sudah lengkap (list, tambah, edit, hapus, performa bulanan).
- **`/dashboard/staf`** = kelola STAF kantor (admin_puskesmas & pj_prolanis, `POST /api/v1/staff`). Judul di kode "Manajemen Staf & Kader" → ganti jadi **"Manajemen Staf"** saja.

## Checklist per halaman (yang belum final)

### `/dashboard/pasien` + `/dashboard/pasien/[id]`

- [ ] List `GET /api/v1/patients` — filter `wilayah_status`/`risk_level`, pagination; detail `GET /api/v1/patients/{id}`
- [ ] `nik_hash` TIDAK PERNAH ditampilkan
- [ ] Badge risiko pakai istilah resmi Berat/Sedang/Ringan + warna docs/planning/07

### `/dashboard/kader`

- [ ] List `GET /api/v1/kader` ter-scope; tambah via `POST /api/v1/kader` (no_hp wajib)
- [ ] Registrasi baru → email aktivasi otomatis (backend sudah handle, tampilkan pesan sukses saja)
- [ ] Role-visibility belum terlihat di kode — PJ/admin_puskesmas/super_admin beda kewenangan, saat ini semua role kelihatan bisa hapus/edit

### `/dashboard/staf`

- [ ] `POST /api/v1/staff` — super_admin: admin_puskesmas ATAU pj_prolanis, puskesmas mana pun. admin_puskesmas: HANYA pj_prolanis, otomatis ke puskesmasnya sendiri (field puskesmas tidak perlu dipilih manual)
- [ ] Registrasi → email aktivasi otomatis

### `/dashboard/kunjungan`

- [ ] Sudah bagus (alur §11 lengkap) — tinggal perbaiki istilah risiko/status, tambah kolom vital sign di detail laporan

### `/app/tugas`

- [ ] List `GET /api/v1/visit-assignments` scope kader — **terhalang keputusan #4 di atas**, jangan diasumsikan dulu

### `/app/kunjungan/[id]` — FINAL, backend menyesuaikan (lihat atas)

### `/app/profil`

- [ ] `PATCH /api/v1/kader/profile` — no_hp TIDAK bisa diubah dari sini

---

## Gap yang sengaja belum masuk prompt (butuh backend dulu)

Master Puskesmas, Master Desa, Audit Log, Pengaturan `risk_thresholds` — belum ada endpoint sama sekali, backlog terpisah.
