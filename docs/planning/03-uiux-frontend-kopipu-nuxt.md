# Dokumen Perencanaan 3/3 — UI/UX & Frontend Nuxt KOPIPU Smart

## 1. Prinsip Desain (Senior-Friendly)

Target utama antarmuka lapangan: **kader lansia**. Prinsip:

- Font besar (16–18px teks umum, 20px+ untuk aksi utama), kontras tinggi (minimal WCAG AA, usahakan AAA untuk teks aksi).
- Tombol besar, full-width, 1 aksi utama per layar.
- Navigasi linear / step-by-step; bottom navigation maksimal 3–4 item, **ikon + label teks selalu tampil** (jangan icon-only).
- Hindari gesture kompleks (swipe, long-press); gunakan tap sederhana.
- Feedback jelas & besar tiap aksi (toast, loading state, success state — bukan sekadar ikon kecil).
- Bahasa Indonesia sehari-hari, hindari istilah teknis ("assignment" → "Tugas", "sync" → "Sedang menyimpan...").

## 2. Struktur Halaman per Peran

| Area                              | Sifat                 | Karakteristik                                                    |
| --------------------------------- | --------------------- | ---------------------------------------------------------------- |
| Landing / About / Tentang Inovasi | Publik, **SEO aktif** | Sesuai draft: Hero, Kenapa KOPIPU Smart, Tentang Inovasi, Footer |
| Dashboard Dinkes / Puskesmas / PJ | Privat, **no-SEO**    | Data-dense wajar (tabel, chart, peta) — bukan target lansia      |
| Aplikasi Kader (PWA)              | Privat, **no-SEO**    | Sangat sederhana, card-based, 1 aksi besar per layar             |

## 3. State Management (Pinia)

- Store per domain: `useAuthStore`, `useAssignmentStore`, `usePatientStore`, `useSyncStore` (state antrian offline).
- Composable layer (`useApi`, `useAssignments`) sebagai abstraksi di atas store — **komponen tidak fetch API langsung**, selalu lewat composable (testability + separation of concern).
- `pinia-plugin-persistedstate` untuk data non-sensitif saja (mis. preferensi tampilan). **Token otentikasi tidak boleh di-persist ke localStorage** — simpan di memory + refresh via httpOnly cookie/secure storage.

## 4. Data Fetching, Cache & Loading State

- Halaman publik: `useAsyncData`/`useFetch` bawaan Nuxt (SSR-friendly, caching otomatis, baik untuk SEO).
- Halaman privat (dashboard/kader): `$fetch` + composable dengan cache key manual, pola **stale-while-revalidate** — tampilkan data cache dulu sambil fetch data terbaru di background. Penting untuk kader di area sinyal lemah.
- **Skeleton loading** (bukan spinner polos): komponen skeleton per tipe card (`PatientCardSkeleton`, `DashboardStatSkeleton`, `AssignmentListSkeleton`) dengan animasi shimmer halus — tampil saat first load, sesuai prinsip "hindari animasi tanpa tujuan" (jangan berlebihan).
- Offline-first (Layer 7 di draft): Workbox (sudah di stack) untuk asset caching; IndexedDB via composable `useOfflineQueue` untuk simpan draft laporan kunjungan sebelum tersambung; Background Sync API browser untuk auto-upload saat online kembali.

## 5. SEO Strategy

**Halaman publik** (landing, about, tentang inovasi):

- Render mode SSR/universal (bukan SPA murni) agar crawler bisa index.
- `useSeoMeta()`/`useHead()` per halaman: title, meta description, OG image.
- `@nuxtjs/sitemap` untuk sitemap.xml otomatis.
- `robots.txt` mengizinkan crawl halaman publik.

**Halaman privat** (login, dashboard, app kader):

- `robots.txt` disallow path `/dashboard`, `/admin`, `/app`, dll.
- Middleware/layout otomatis inject `<meta name="robots" content="noindex, nofollow">` untuk semua route privat.
- **Pemisahan layout**: `layouts/public.vue` (SEO aktif) vs `layouts/private.vue` (noindex default) — supaya tidak ada human-error lupa menonaktifkan SEO di halaman privat.

## 6. Komponen & Design System

- Basis: Nuxt UI + TailwindCSS v4, token warna sebagai CSS variable (bukan hex hardcode di tiap komponen). **Palet resmi lengkap ada di `07-design-tokens-dan-koreksi-referensi.md`** (primary/secondary/accent/surface/danger/warning/neutral/info/success, 11-shade tiap warna) — dokumen itu yang jadi rujukan warna final, bukan draft awal ini.
- Tipografi: Inter/Geist.
- **Penulisan nama brand: selalu "KOPIPU Smart"** (KOPIPU kapital semua, Smart kapital di S saja) — jangan "Kopipu Smart", "KOPIPU SMART", atau variasi lain. Konsisten di semua teks UI, judul halaman, meta tag, manifest PWA, dan komunikasi (email, dsb).
- **Aset logo** (4 file, sudah disediakan, taruh di `public/logo/`): `kopipu-smart-logo.png`/`-remove-bg.png` (icon+wordmark, buat header/navbar), `kopipu-smart-logo-plus-desc.png`/`-remove-bg.png` (icon+wordmark+tagline+badge, buat landing/footer/OG image). Icon PWA (192/512/maskable) di-crop terpisah dari wordmark — logo penuh tidak dipakai langsung sebagai app icon (tidak terbaca di ukuran kecil).
- Komponen reusable inti:
  - `<AppCard>` — mobile-first, target sentuh besar
  - `<StatusBadge level="berat|sedang|ringan">` — warna konsisten di seluruh app
  - `<PrimaryButton size="lg">` — default besar untuk alur kader
  - `<GpsCameraCapture>` — wajib kamera live, geolocation terintegrasi, preview watermark client-side sebelum kirim (validasi ulang tetap di server, lihat Dokumen 2 §5)

## 7. Catatan & Trade-off

- SSR untuk halaman publik butuh Node server berjalan (Nitro) — bukan static export; pastikan hosting mendukung.
- PWA + SSR bisa jalan bersamaan di Nuxt lewat `routeRules` per halaman (route-based rendering), bukan full SPA — perlu direncanakan sejak awal struktur folder `pages/`.

---

_Ini adalah dokumen terakhir dari 3 dokumen planning KOPIPU Smart. Lihat juga: 01-integrasi-silakes-kopipu.md, 02-arsitektur-backend-kopipu-smart.md_
