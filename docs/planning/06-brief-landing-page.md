# Brief Landing Page & Halaman Publik — PRODULI

> Semua konten teks di dokumen ini diambil verbatim dari draft resmi proyek (bukan dikarang baru) — jangan diparafrase jauh dari aslinya, cukup disusun ulang ke komponen visual.

## 1. Tujuan

Landing page ini representasi publik pertama PRODULI — audiensnya bukan cuma kader/staf (yang nanti login), tapi juga pihak luar: pejabat Dinkes lain, puskesmas yang belum tahu program ini, media, atau siapa pun yang mencari tahu soal program ini di Google. Beda total dari halaman kader (senior-friendly, super sederhana) — di sini boleh lebih kaya visual, animasi, dan kedalaman konten, karena tujuannya meyakinkan dan menginformasikan, bukan dipakai berulang oleh lansia di lapangan.

## 2. Rute Halaman (untuk SEO — tiap halaman punya title/description sendiri)

| Rute            | Isi                                                                                                 | Kenapa terpisah (SEO)                                  |
| --------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `/`             | Hero, Mengapa PRODULI, Nilai Inovasi (ringkas), Tentang Inovasi (ringkas), CTA, Footer         | Landing utama, kata kunci umum                         |
| `/tentang-kami` | Latar belakang lengkap, Visi & Misi, Nilai Inovasi (lengkap), Tentang Inovasi (lengkap + penggagas) | Kata kunci "tentang", kedalaman konten bagus untuk SEO |
| `/kontak`       | Cara melapor kendala, email, konteks institusi                                                      | Kata kunci "kontak"/"hubungi"                          |

**Rekomendasi tambahan** (bukan wajib, tapi konsisten dengan seluruh kerja UU PDP yang sudah dibangun di backend): `/privasi` — kebijakan privasi singkat (data apa yang dikumpulkan dari pasien/kader, untuk apa, siapa yang bisa akses). Ini bukan cuma formalitas — situs pemerintah yang menyebut soal data kesehatan sebaiknya punya ini untuk kepercayaan publik. Putuskan sendiri kalau mau termasuk sekarang atau menyusul.

Semua rute publik pakai `layouts/public.vue` (SEO aktif, sudah dibangun Prompt 2) — jangan sampai ada yang salah pakai `layouts/private.vue`.

## 3. Konten — Landing (`/`)

### Hero

- Headline: **"Mewujudkan Pelayanan Kesehatan yang Proaktif"**
- Subtitle: _"PRODULI merupakan platform digital yang mendukung pelaksanaan inovasi KOPIPU (Konseling Masalah Kesehatan Keluarga dari Pintu ke Pintu), sebuah pendekatan pelayanan kesehatan berbasis data laboratorium melalui kunjungan rumah secara aktif untuk meningkatkan kualitas kesehatan masyarakat."_
- Tombol: **[ Masuk Sistem ]** (ke `/auth/login`) — **[ Pelajari Inovasi ]** (scroll ke Tentang Inovasi, atau ke `/tentang-kami`)
- Tampilkan logo (`produli-logo-remove-bg.png` atau versi icon-only) besar/menonjol di hero — ini titik pertama orang lihat brand-nya.

### Mengapa PRODULI (6 card)

✓ Berbasis Data Laboratorium
✓ Dashboard Analitik
✓ Mobile First
✓ GPS Validation
✓ Dokumentasi Digital
✓ Monitoring Real-time

(Tiap card: ikon + judul + 1 kalimat pendek penjelasan yang **jujur dan spesifik** ke fitur yang benar-benar dibangun — mis. "GPS Validation" bisa dijelaskan singkat mengacu ke validasi 7-layer kunjungan yang sudah dibangun, bukan klaim generik.)

### Nilai Inovasi (cocok untuk animasi scroll — before/after)

> Selama ini: **Laboratorium → hasil keluar → selesai.**
> Sekarang: **Laboratorium → Analisis Risiko → Dashboard → Kader Bergerak → Edukasi → Monitoring → Evaluasi.**

Laboratorium menjadi pusat pengambilan keputusan — transformasi ini menjadikan data lab jauh lebih bernilai. Cocok divisualisasikan sebagai alur horizontal/vertikal dengan tiap tahap muncul berurutan saat di-scroll (pakai `motion-v`, animasi bertujuan — bukan dekorasi kosong, sesuai prinsip docs/planning/03).

### Tentang Inovasi (versi ringkas, versi lengkap di `/tentang-kami`)

> _"KOPIPU merupakan inovasi pelayanan kesehatan yang digagas oleh Kepala Dinas Kesehatan P2KB Kabupaten Sumenep, drg. Ellya Fardasah, sebagai upaya memperkuat pelayanan kesehatan preventif melalui kunjungan rumah berbasis data laboratorium dan pendekatan keluarga."_

### Footer (Kredit Elegan — tampil di semua halaman publik)

> _"Sistem dikembangkan oleh Pengolah Data dan Informasi UPTD Laboratorium Kesehatan Daerah Kabupaten Sumenep."_

Sertakan juga di footer: logo (versi kecil), link ke `/tentang-kami` dan `/kontak`, dan copyright tahun berjalan.

## 4. Konten — `/tentang-kami`

### Latar Belakang

> Penyakit kronis seperti Diabetes Mellitus, Hipertensi, Dislipidemia, dan Gangguan Ginjal merupakan penyebab terbesar komplikasi kesehatan masyarakat. Laboratorium Kesehatan Daerah Kabupaten Sumenep telah memiliki data pemeriksaan laboratorium pasien melalui SiLAKES, namun selama ini hasil pemeriksaan tersebut belum dimanfaatkan secara maksimal sebagai dasar pelayanan kesehatan aktif di lapangan. Sebagian besar pelayanan kesehatan masih bersifat menunggu pasien datang (Passive Healthcare).

### Visi

> Mewujudkan pelayanan kesehatan preventif yang cepat, tepat sasaran, berbasis data laboratorium, dan terintegrasi secara digital untuk meningkatkan kualitas hidup masyarakat Kabupaten Sumenep.

### Misi

- Digitalisasi kunjungan rumah.
- Integrasi hasil laboratorium.
- Monitoring real-time.
- Decision Support bagi Dinas Kesehatan.
- Peningkatan kualitas pelayanan Prolanis.

### Tujuan Sistem

- Mengidentifikasi pasien risiko tinggi secara otomatis.
- Mengintegrasikan data Laboratorium SiLAKES.
- Mengelola penugasan kader.
- Memastikan kunjungan benar-benar dilakukan.
- Mendokumentasikan hasil kunjungan.
- Menjadi dashboard monitoring Dinas Kesehatan.

### Tentang Inovasi (versi lengkap — sama kutipan seperti di landing, boleh ditambah 1-2 paragraf konteks program KOPIPU secara umum kalau ada, tapi jangan karang detail yang tidak ada sumbernya)

### Fitur Utama (untuk kedalaman konten SEO — daftar naratif, bukan cuma bullet generik)

Sinkronisasi data pasien dari SiLAKES, dashboard terpisah untuk Dinas Kesehatan/Puskesmas/PJ Prolanis/Kader, kunjungan door-to-door dengan validasi GPS, kamera wajib dari aplikasi (bukan galeri), analitik pasien berdasarkan kategori risiko (Berat/Sedang/Ringan), dan monitoring seluruh kunjungan secara real-time.

## 5. Konten — `/kontak`

- Email pelaporan kendala: **labkesmassumenep@gmail.com** — tulis jelas ini untuk melaporkan kendala teknis sistem, bukan layanan kesehatan langsung (hindari orang salah kirim keluhan medis ke sini).
- Konteks institusi: UPTD Laboratorium Kesehatan Daerah Kabupaten Sumenep, di bawah Dinas Kesehatan, Pengendalian Penduduk dan Keluarga Berencana (DKP2KB) Kabupaten Sumenep.
- Form kontak sederhana opsional (nama, email, pesan) — kalau dibuat, kirim ke email di atas lewat backend (bukan expose SMTP credential ke frontend), atau cukup `mailto:` link kalau tidak mau bangun endpoint baru untuk ini sekarang.

## 6. Desain & Animasi (REVISI — hasil pertama gagal, spek berikut wajib diikuti persis)

**Hasil pertama gagal karena:** tema gelap (padahal untuk audiens umum, harus terang), layout satu kolom serba-tengah (generik, terkesan template), icon "Mengapa PRODULI" patah/tidak render, teks headline ada artefak visual (shadow/outline yang tidak rapi). Berikut spesifikasi yang lebih tegas supaya tidak terulang.

### Tema: TERANG, bukan gelap

**Warna resmi ada di `07-design-tokens-dan-koreksi-referensi.md`** (palet dari user: primary teal `#00A59A`, secondary hijau `#65B32E`, accent navy `#003B5C`, surface minty `#F4FBF9`, plus danger/warning/info/success/neutral) — dokumen itu final, jangan buat warna baru di luar itu.
Latar dasar putih/`#F8FAFC`, teks gelap. **Jangan** pakai tema gelap sama sekali di halaman publik — ini bukan preferensi, ini keputusan final. (Kalau nanti mau nambah toggle dark mode sebagai fitur opsional di masa depan, itu keputusan terpisah nanti — bukan sekarang, dan bukan default.)

### Layout: asimetris kanan-kiri, BUKAN satu kolom serba-tengah

Prinsip: tiap section besar (hero, "Mengapa", "Nilai Inovasi", "Tentang Inovasi") pakai split 2 kolom (sekitar 55/45 atau 50/50), sisi bergantian tiap section (zigzag) — bukan semua konten ditumpuk vertikal di tengah seperti hasil pertama.

**Hero** (teks kiri, visual kanan):

```
┌─────────────────────────────────────────────┐
│  [logo kecil]                    Tentang Kontak  [Masuk Sistem] │
├─────────────────────────────────────────────┤
│                          │                          │
│  Mewujudkan Pelayanan    │    [ilustrasi/visual      │
│  Kesehatan yang Proaktif.│     besar — lihat §6.3]   │
│                          │                          │
│  [subtitle 2-3 baris]    │    (dot-grid pattern      │
│                          │     halus di background)  │
│  [Masuk Sistem] [Pelajari│                          │
│   Inovasi]               │                          │
└─────────────────────────────────────────────┘
```

**"Mengapa PRODULI"** — bukan grid kartu seragam kaku, coba bento-style (1-2 card besar + beberapa kecil, variasi ukuran) ATAU icon+teks berjajar horizontal dengan 1 card "unggulan" lebih besar. Tiap icon di dalam badge/lingkaran berwarna (bukan icon polos mengambang), pastikan render nyata (lihat §6.4 — ini bug yang harus diperbaiki dulu).

**"Nilai Inovasi"** (before/after) — visual kiri (flow diagram lama: "Laboratorium → hasil keluar → selesai"), visual kanan (flow diagram baru dengan lebih banyak tahap) ATAU satu flow horizontal penuh lebar dengan panah, animasi tiap tahap muncul saat di-scroll.

**"Tentang Inovasi"** — kutipan besar di satu sisi, elemen visual/dekoratif (bukan foto orang — pakai ilustrasi abstrak/icon) di sisi lain.

Section berikutnya (`/tentang-kami`, dsb.) ikuti pola sama: alternating split, bukan tumpukan tengah.

### Kekayaan visual (supaya terasa "mewah", bukan halaman kosong berisi teks)

- **Motif dot-grid dari logo** (pola kotak-kotak kecil memudar di sisi kanan icon) dipakai berulang sebagai elemen dekoratif halus di background section — bukan cuma sekali di logo, jadi identitas visual berulang di seluruh halaman.
- **Aksen gradien lembut** pakai warna brand (hijau→biru, mengikuti gradien di outline rumah pada logo) — sebagai blob/shape dekoratif blur di belakang section tertentu (hero, CTA akhir), bukan solid flat semua.
- **Icon nyata** per poin "Mengapa" (database untuk data lab, chart untuk dashboard, phone untuk mobile, map-pin untuk GPS, camera untuk dokumentasi, activity/pulse untuk monitoring real-time) — pakai icon set yang sudah tersedia di Nuxt UI (Iconify), JANGAN biarkan ada icon yang tidak ter-resolve/patah.
- Card: shadow lembut (bukan flat tanpa shadow), radius besar (`rounded-2xl`/`3xl`), sedikit hover-lift saat disentuh mouse.

### Tipografi & tombol

- Headline besar, bold, TANPA efek shadow/outline yang berantakan (itu bug di hasil pertama — cek CSS-nya, kemungkinan ada `text-shadow`/animasi library yang meninggalkan artefak).
- Tombol: primary (isi warna brand solid, shadow halus) vs secondary (outline/ghost) — beda jelas secara visual, ukuran nyaman (padding cukup, jangan kecil mepet seperti hasil pertama).

### Animasi

`motion-v` — fade-in-up saat section masuk viewport, hover halus di card, animasi bertahap untuk alur Nilai Inovasi. Bertujuan, bukan dekorasi kosong (docs/planning/03 §4).

### Responsive

Mobile-first tapi desktop dirancang sengaja — split 2 kolom di desktop, susun jadi 1 kolom (visual di atas atau bawah teks, konsisten) di mobile. Bukan cuma mobile layout di-stretch lebar.

### Logo

Navbar: icon+wordmark kecil (`produli-logo-remove-bg.png`, di-resize proporsional). Hero: boleh lebih besar/jadi bagian komposisi visual kanan. Footer: kecil, atau versi tagline (`produli-logo-plus-desc-remove-bg.png`).

## 7. SEO Teknis (checklist)

- `useSeoMeta()` per halaman — title unik pola `"{Judul Halaman} — PRODULI"`, description spesifik per halaman (jangan generik sama di semua halaman).
- **Structured data (JSON-LD)** — tambahkan schema.org type yang sesuai (`GovernmentOrganization` atau `Organization`) di landing: nama, url, logo, description. Ini belum pernah dibahas sebelumnya di dokumen manapun, tapi worth ditambahkan — praktik SEO enterprise yang nyata, bukan cuma meta tag dasar.
- Heading hierarchy semantik yang benar — H1 cuma satu per halaman (headline hero), H2 per section, jangan pakai div/span yang di-styling seperti heading.
- `@nuxtjs/sitemap` (sudah terpasang) — pastikan `/`, `/tentang-kami`, `/kontak` (dan `/privasi` kalau dibuat) masuk.
- OG image per halaman — default `og-image.png` sudah ada dari Prompt 2, tapi `/tentang-kami` dan `/kontak` boleh override title/description OG-nya sendiri kalau relevan.
- **Pertimbangkan `@nuxt/image`** (belum terpasang) — landing page ini gambar-berat (logo, mungkin ilustrasi), modul ini bantu performa (lazy load, format modern otomatis) yang juga jadi faktor SEO (Core Web Vitals). Tanyakan dulu ke saya kalau mau tambah dependency baru, jangan diam-diam.

## 8. Batasan

- Semua teks kutipan di dokumen ini (headline, visi, misi, kutipan penggagas, kredit) **tidak boleh diparafrase jauh dari aslinya** — ini bahasa resmi program, bukan draft yang bebas ditulis ulang gaya marketing.
- Jangan menambahkan klaim yang tidak ada sumbernya (angka statistik, testimoni, "dipercaya X puskesmas", dll) — kalau mau menonjolkan kelebihan, tonjolkan yang sudah benar-benar dibangun (7-layer validation, sinkronisasi SiLAKES, dsb), bukan klaim generik yang terdengar bagus tapi tidak bisa dipertanggungjawabkan.
