# CLAUDE.md — PRODULI Frontend (letakkan file ini di root repo Nuxt PRODULI)

## Konteks Proyek

Frontend PWA mobile-first untuk PRODULI. Pengguna utama halaman
kader adalah **lansia** — semua keputusan UI harus mengutamakan
kemudahan, bukan estetika kompleks. Stack: Nuxt 4, Vue 3, TypeScript,
PWA (Workbox), Pinia, TailwindCSS v4, Nuxt UI, Chart.js, MapLibre GL.

## Backend API

Repo backend Laravel ada di sebelah (`../produli-backend` atau
sesuai path lokal Anda). Kontrak endpoint yang sudah live ada di
`docs/planning/05-kontrak-api-produli-backend.md` (diambil dari
`route:list` nyata) — tapi untuk bentuk persis request/response tiap
endpoint, **baca langsung Controller/Request/Resource class di repo
backend**, jangan menebak dari dokumen ini saja (dokumen ditulis
sebelum backend selesai, jadi §2 dstnya generik — dokumen 05 yang
jadi peta endpoint, tapi kode backend tetap sumber kebenaran field
persisnya).
Base URL: `runtimeConfig.public.apiBase`, dari env `NUXT_PUBLIC_API_BASE`
(dev: `http://localhost:8033/api/v1`). Setiap request wajib
`credentials: 'include'` — tanpa ini refresh-token cookie tidak
pernah terkirim, auth tidak akan jalan.

## Prinsip Wajib (lihat `03-uiux-frontend-produli-nuxt.md`)

- Halaman kader: font besar (16–18px+), tombol besar full-width,
  1 aksi utama per layar, navigasi linear, bottom nav max 3–4 item
  dengan ikon + label teks (bukan icon-only).
- Dashboard Dinkes/Puskesmas/PJ boleh lebih data-dense — bukan target
  lansia.
- SEO **hanya** aktif di layout publik (`layouts/public.vue`) —
  landing/about. Semua halaman privat (`layouts/private.vue`) wajib
  `noindex, nofollow` otomatis, jangan diatur manual per halaman.
- State management: Pinia per domain (`useAuthStore`,
  `useAssignmentStore`, `usePatientStore`, `useSyncStore`), akses API
  selalu lewat composable, tidak langsung dari komponen.
- Loading state: skeleton per tipe card (bukan spinner polos), pola
  stale-while-revalidate untuk data privat.
- Offline-first: IndexedDB (`useOfflineQueue`) untuk draft laporan
  kunjungan, Background Sync API untuk auto-upload saat online.

## Batasan Keras

- Token otentikasi TIDAK boleh disimpan di localStorage.
- Login Google TIDAK diimplementasikan langsung di Nuxt (client secret
  hanya di backend) — Nuxt hanya redirect ke endpoint Laravel.
- Upload foto kunjungan selalu lewat endpoint Laravel, tidak pernah
  direct-to-S3 dari browser.
