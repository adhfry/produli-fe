# Perancangan Tile Server Offline — PRODULI

Versi: 1.0 · Status: Rancangan (belum dibangun)

## 1. Latar Belakang & Tujuan

`/app/kunjungan/[id]` butuh peta yang bisa diakses **offline** saat kader kunjungan ke desa tanpa sinyal (docs/planning/10 §5). Sumber tile yang dipakai sekarang (tile mentah Google, basemap gratis CARTO) tidak aman untuk di-cache massal — kebijakan pemakaian layanan gratis itu umumnya melarang bulk-download/offline-caching, beda dari sekadar ditampilkan langsung saat online.

**Solusi:** server tile sendiri, dari data OpenStreetMap (lisensi ODbL — eksplisit mengizinkan self-hosting & offline use), diproses jadi vector tile, di-serve dari VPS sendiri. Konsisten dengan pola infrastruktur proyek ini (MinIO self-hosted, bukan S3 pihak ketiga).

**Bedakan dari yang sudah ada:** ini BASEMAP (jalan, nama tempat, bangunan) — beda dari poligon batas desa/kecamatan (data resmi Anda sendiri, "sudah rapi") yang dipakai untuk mewarnai sebaran risiko. Basemap ini jadi latar di BAWAH poligon itu, dua lapisan berbeda yang digabung di MapLibre GL sisi klien.

## 2. Topologi & Arsitektur

```
[ INTERNET ]
     │ (HTTPS)
     ▼
tiles.labkesdasumenep.cloud
     │
[ Nginx Reverse Proxy ] ── rate limit, SSL (Let's Encrypt)
     │
[ localhost:8080 ]
     │
[ tileserver-gl ] ── serve vector tile (ZXY) + style + preview bawaan
     │
[ Data: sumenep.mbtiles ] ── hasil build dari OSM extract
```

**Pipeline pembuatan data** (terpisah dari server yang jalan terus-menerus — dijalankan sekali di awal, lalu berkala untuk update):

```
OSM extract (Jawa Timur, dari Geofabrik)
     │
[ Planetiler ] ── clip ke bounding box Sumenep + buffer, render jadi vector tile
     ▼
sumenep.mbtiles (1 file, dipindah ke server)
```

## 3. Komponen

| Komponen | Peran | Kenapa dipilih |
|---|---|---|
| **Planetiler** | Generator vector tile dari data OSM mentah | Modern, jauh lebih cepat & hemat resource dari tool generasi lama (osm2vectortiles/tippecanoe pipeline manual) — proyek aktif dipelihara |
| **tileserver-gl** | Serve `.mbtiles` sebagai vector tile (ZXY/TileJSON) + preview bawaan | Standar de-facto untuk self-hosted vector tile, integrasi native dengan MapLibre GL (yang sudah dipakai proyek ini) |
| **OpenMapTiles style** (mis. "osm-bright") | Style JSON — aturan warna/render di atas skema vector tile | Skema output Planetiler kompatibel langsung — tidak perlu bikin style dari nol |
| **Nginx** | Reverse proxy + SSL | Pola sama seperti MinIO |
| **systemd** | Jalankan `tileserver-gl` sebagai service persisten | Sama seperti pola Horizon (Supervisor) yang sudah direncanakan — auto-restart, jalan di background |

## 4. Cakupan Data — HANYA Sumenep, bukan Indonesia/global

Extract dari Geofabrik level provinsi (Jawa Timur) sebagai sumber, tapi Planetiler **clip ke bounding box Kabupaten Sumenep** (+ buffer beberapa km) saat render — supaya `sumenep.mbtiles` tetap kecil (estimasi puluhan-ratusan MB, bukan gigabyte). Ini konsisten dengan prinsip yang sudah dipakai berkali-kali di proyek ini (data-minimization) — tidak perlu simpan/serve peta seluruh Indonesia untuk aplikasi yang cuma dipakai di 1 kabupaten.

**Rentang zoom**: fokus di zoom 9–16 (level kabupaten sampai jalan/gang) — ini yang benar-benar dipakai kader navigasi. Zoom sangat rendah (world/negara) tidak krusial untuk use-case ini, bisa dikecualikan atau dibuat sangat ringan.

## 5. Domain & Jaringan

| Fungsi | Domain | Keterangan |
|---|---|---|
| Tile server | `tiles.labkesdasumenep.cloud` | Nginx → `localhost:8080`, HTTPS Let's Encrypt |

Tidak perlu subdomain admin terpisah (beda dari MinIO) — `tileserver-gl` sudah sertakan halaman preview bawaan di path yang sama, cukup 1 domain.

## 6. Prosedur Setup (garis besar)

1. **Unduh data sumber**: extract Jawa Timur dari Geofabrik (`.osm.pbf`).
2. **Install Planetiler**, jalankan dengan bounding box Sumenep (koordinat dari data poligon yang sudah Anda miliki) → hasilkan `sumenep.mbtiles`.
3. **Install Node.js + tileserver-gl** di VPS, taruh `sumenep.mbtiles` + style JSON di direktori data-nya.
4. **systemd service** untuk `tileserver-gl` (auto-start, auto-restart) — pola config mirip Horizon yang sudah direncanakan.
5. **Nginx reverse proxy** `tiles.labkesdasumenep.cloud` → `localhost:8080`, SSL via certbot, tambahkan rate-limit dasar (`limit_req`) — tile server tidak butuh autentikasi (bukan data sensitif), tapi tetap dibatasi supaya tidak disalahgunakan sebagai bandwidth gratis pihak luar.
6. **Konfigurasi Nuxt**: `NUXT_PUBLIC_TILE_SERVER_URL=https://tiles.labkesdasumenep.cloud` — MapLibre GL style URL diarahkan ke sini, ganti dari CARTO/Google.

## 7. Update Data Berkala

OSM berubah (jalan baru, dll) — bukan sekali generate lalu selesai selamanya. **Rekomendasi**: jadwalkan ulang proses Planetiler tiap 3–6 bulan (cron/systemd timer, dijalankan manual dulu untuk beberapa iterasi awal sebelum diotomasi penuh) — unduh extract terbaru, render ulang, ganti file `.mbtiles` (tileserver-gl butuh restart singkat setelah file diganti).

## 8. Estimasi Resource

- **Disk**: extract Jawa Timur mentah ~1-2GB (sementara, bisa dihapus setelah build), `sumenep.mbtiles` hasil akhir jauh lebih kecil (estimasi puluhan-ratusan MB — angka pasti baru diketahui setelah build pertama).
- **RAM saat build**: Planetiler butuh beberapa GB RAM sementara saat proses (bukan saat serving) — kalau VPS produksi resource-nya pas-pasan, build bisa dilakukan di mesin lokal/terpisah, hasil `.mbtiles`-nya saja yang dipindah ke VPS.
- **RAM/CPU saat serving**: `tileserver-gl` ringan untuk trafik regional skala kabupaten — jauh di bawah kebutuhan Laravel/MySQL yang sudah jalan di VPS yang sama.

**Perlu dicek dulu sebelum eksekusi**: spesifikasi VPS produksi saat ini (RAM/disk tersisa) — supaya jelas apakah tile server aman ditumpuk di VPS yang sama dengan MinIO+Laravel+MySQL+Redis, atau perlu VPS terpisah.

## 9. Yang TIDAK berubah dari desain sebelumnya

Client-side (docs/planning/10 §5) tetap sama: Service Worker (Workbox) cache tile per-request, tombol "Unduh Peta Wilayah Kerja" fetch tile untuk bounding box tugas hari ini. Server ini cuma mengganti SUMBER tile-nya dari CARTO/Google ke domain sendiri — tidak ada perubahan arsitektur di sisi frontend.
