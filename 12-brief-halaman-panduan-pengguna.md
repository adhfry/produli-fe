# Brief: Halaman Panduan Pengguna PRODULI (per Role)

> Nama sistem: **PRODULI** (Prolanis Peduli) — dokumen ini disusun setelah perubahan nama dari KOPIPU Smart. Pakai "PRODULI" konsisten, jangan campur nama lama.

## Prinsip Desain (WAJIB)

- **Mobile-first mutlak** — mayoritas pembaca buka lewat HP, bukan browser desktop. Layout, ukuran teks, jarak sentuh semua dirancang dari sudut pandang layar kecil dulu, desktop menyesuaikan (bukan sebaliknya).
- Bahasa jelas, tidak teknis, tidak bertele-tele — pembaca bisa siapa saja (Kepala Puskesmas sampai kader di desa), bukan developer.
- Struktur rapi: heading jelas berjenjang, nomor urut untuk langkah-langkah, bukan paragraf panjang.
- Animasi/transisi **kalau ada, harus bertujuan** (bantu pemahaman — mis. highlight bagian yang lagi dijelaskan), bukan dekorasi.
- Tema terang, konsisten dengan desain landing page yang sudah ada (token warna resmi, sudah didokumentasikan terpisah).
- **Placeholder gambar**: di tiap bagian yang butuh screenshot, taruh kotak placeholder jelas berlabel nama halaman yang dimaksud (mis. `[Gambar: halaman Dashboard Puskesmas]`) — user akan isi sendiri gambar aslinya nanti, agent tidak perlu generate gambar apa pun.

## Struktur Rute

`/panduan` (indeks, pilih role) → `/panduan/admin-puskesmas`, `/panduan/pj-prolanis`, `/panduan/tenaga-kesehatan`, `/panduan/kader`.

---

## 1. Panduan Admin Puskesmas

**Cara mendapat akun:**
1. Didaftarkan oleh Administrator Kabupaten (Dinas Kesehatan/Labkesda) — bukan mendaftar sendiri.
2. Email aktivasi terkirim ke alamat yang didaftarkan.
3. Klik link di email → sistem buatkan password acak sekali tampil → langsung bisa login, atau langsung diarahkan ganti password sendiri.
4. `[Gambar: email aktivasi]` `[Gambar: halaman aktivasi]`

**Login:** email+password, atau tautkan Google nanti dari Pengaturan untuk login lebih cepat. `[Gambar: halaman login]`

**Yang bisa dilihat & dilakukan:**
- **Dashboard wilayah kerja** — peta sebaran pasien di area puskesmasnya, breakdown risiko per kecamatan/desa. `[Gambar: dashboard dengan peta]`
- **Top 5 kecamatan risiko tertinggi** — ranking area yang paling butuh perhatian. `[Gambar: kartu top 5 kecamatan]`
- **Kelola staf** — daftarkan PJ Prolanis baru untuk puskesmasnya. `[Gambar: halaman Manajemen Staf]`
- **Kelola tenaga lapangan** — daftarkan Kader (PMO) dan Tenaga Kesehatan. `[Gambar: halaman Manajemen Kader]`
- **Laporan tingkat kepatuhan** — persentase kunjungan terjadwal yang benar-benar selesai. `[Gambar: kartu tingkat kepatuhan]`
- Peran ini **memonitor**, tidak punya wewenang menyetujui/menolak laporan kunjungan — itu levelnya PJ Prolanis dan Admin Kabupaten.

## 2. Panduan PJ Prolanis

**Cara mendapat akun:** sama seperti Admin Puskesmas (didaftarkan Admin Kabupaten ATAU Admin Puskesmasnya sendiri) — email aktivasi, set password, login. `[Gambar: email aktivasi]` `[Gambar: halaman login]`

**Yang membedakan dari Admin Puskesmas — pengawasan langsung:**
- **Kelola Kader & Tenaga Kesehatan** — daftarkan tenaga lapangan di wilayah kerjanya. `[Gambar: halaman Manajemen Kader]`
- **Tugaskan kunjungan** — pilih pasien (kategori Berat), pilih Tenaga Kesehatan (dan Kader pendamping untuk kunjungan pertama), atur jadwal. `[Gambar: halaman Penugasan Kunjungan]`
- **Menerima laporan kunjungan** — begitu Tenaga Kesehatan/Kader submit laporan, PJ yang pertama meninjau dan menerimanya sebagai bukti kunjungan benar terjadi. `[Gambar: tombol Terima Laporan]`
- **Memantau progres** — siapa sudah kunjungan, siapa belum, laporan mana yang perlu ditindaklanjuti. `[Gambar: dashboard kunjungan]`

## 3. Panduan Tenaga Kesehatan

**Cara mendapat akun:** didaftarkan oleh PJ Prolanis ATAU Admin Puskesmas — email aktivasi ke alamat yang didaftarkan, klik link, dapat password, login. `[Gambar: email aktivasi]` `[Gambar: halaman login]`

**Berbeda dari peran lain — murni aplikasi lapangan, tanpa dashboard:**
- **Tidak ada akses dashboard/monitoring** — begitu login, langsung ke halaman kerja lapangan (bukan dashboard kantor). `[Gambar: halaman Beranda aplikasi lapangan]`
- **Daftar tugas kunjungan** — hanya pasien yang ditugaskan PJ yang muncul, tidak bisa pilih pasien sendiri. `[Gambar: halaman Daftar Tugas]`
- **Jadwal**: umumnya 1 bulan sekali per pasien, tapi bisa ditugaskan mendadak kalau kondisi mendesak.
- **Wajib berada di lokasi** — sistem verifikasi lokasi GPS (harus sesuai alamat pasien) dan wilayah kerja puskesmasnya sendiri, tidak bisa asal isi laporan dari jauh. `[Gambar: layar validasi lokasi]`
- **Catat kondisi pasien** — hasil pemeriksaan saat kunjungan (gula darah, tensi, keluhan pasien, tindakan yang diberikan), foto dokumentasi langsung dari kamera aplikasi (bukan galeri). `[Gambar: form pemeriksaan]` `[Gambar: kamera aplikasi]`
- **Kirim laporan** — sekali kirim, PJ Prolanis yang meninjau selanjutnya.

## 4. Panduan Kader (PMO — Pendamping Minum Obat)

**Cara mendapat akun:** sama seperti Tenaga Kesehatan (didaftarkan PJ/Admin Puskesmas) — email aktivasi, password, login. `[Gambar: email aktivasi]` `[Gambar: halaman login]`

**Tugas paling ringan & paling sering — kontrol kepatuhan minum obat:**
- **Kunjungan pertama bareng Tenaga Kesehatan** — Kader mendampingi di kunjungan awal, ikut kenal lokasi dan pasiennya. `[Gambar: badge "Mendampingi" di daftar tugas]`
- **Kunjungan selanjutnya, mandiri tiap minggu** — titik lokasi rumah pasien sudah tersimpan dari kunjungan pertama, Kader tinggal datang sesuai jadwal mingguan. `[Gambar: halaman Daftar Tugas Kader]`
- **Cek kepatuhan minum obat** — konfirmasi pasien minum obat sesuai anjuran, catat kalau ada kendala. `[Gambar: form PMO mingguan]`
- **Lapor ke PRODULI** — tiap kunjungan mingguan tercatat, jadi riwayat kepatuhan pasien terlihat dari waktu ke waktu.

---

## Catatan untuk Agent

Sebagian alur di panduan **Tenaga Kesehatan** dan **Kader (PMO)** menjelaskan desain yang dituju — kalau ada bagian yang belum bisa dikonfirmasi dari kode backend saat ini (mis. alur PMO mingguan yang lebih ringan), tulis dengan bahasa yang tetap akurat untuk arah desainnya tanpa mengklaim detail teknis yang belum pasti (mis. jangan sebutkan nama field/endpoint spesifik untuk bagian yang masih rencana).
