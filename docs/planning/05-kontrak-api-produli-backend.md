# Kontrak API Backend PRODULI (Aktual — dari `route:list` nyata)

> Diambil langsung dari `php artisan route:list` di repo backend, bukan direkonstruksi dari ingatan — kalau ada perbedaan dengan yang ditemukan Claude Code saat baca kode backend langsung, **ikuti kode backend**, dokumen ini cuma peta, bukan sumber kebenaran mutlak. Untuk bentuk persis request/response tiap endpoint (field apa saja, validasi apa), baca Controller/Request/Resource class terkait di repo backend — dokumen ini sengaja tidak menebak detail itu.

## Detail terverifikasi dari kode backend langsung (bukan cuma route:list)

- List response: `data.items` + `data.pagination` — **bukan** `meta`/`links` standar Laravel.
- Refresh token: cookie bernama `kopipu_refresh_token` + header `X-Device-Id` wajib disertakan.
- Middleware `password.changed` aktif di hampir semua route privat (kecuali `logout`, `me`, `change-password`) — kalau dapat 403 dengan `data.code=MUST_CHANGE_PASSWORD`, redirect ke halaman ganti password.
- `GET /dashboard/summary`: key risk-level & status kunjungan selalu lengkap di-fill 0 (tidak pernah hilang dari response meski datanya kosong) — aman diasumsikan ada tanpa optional-chaining berlebihan.
- `GET /notifications`: `unread_count` selalu dihitung ulang tiap request (bukan cache).

## Base URL

```
Dev:  NUXT_PUBLIC_API_BASE=http://localhost:8033/api/v1
Prod: NUXT_PUBLIC_API_BASE=https://api.kopipu-smart.labkesdasumenep.id/api/v1
```

Set di `nuxt.config.ts` → `runtimeConfig.public.apiBase`, baca dari env var di atas.

**Wajib di composable `useApi`:** setiap request `credentials: 'include'` (refresh token dikirim via httpOnly cookie, tanpa ini auth tidak akan pernah jalan — lihat Dokumen 2 §6). Semua response mengikuti amplop standar `{status, message, data}` (Dokumen 2 §4).

## Auth (`/api/v1/auth/*`)

| Method | Path                         | Auth          | Catatan                                                                                             |
| ------ | ---------------------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| POST   | `/auth/login`                | publik        |                                                                                                     |
| POST   | `/auth/refresh`              | publik\*      | \*butuh refresh cookie terpasang                                                                    |
| POST   | `/auth/logout`               | Bearer        |                                                                                                     |
| GET    | `/auth/me`                   | Bearer        |                                                                                                     |
| POST   | `/auth/google/exchange`      | publik        | tukar `code` (dari redirect) jadi token                                                             |
| GET    | `/auth/google/link/redirect` | Bearer        | balikin JSON `{redirect_url}`, BUKAN redirect langsung — Nuxt yang `window.location = redirect_url` |
| DELETE | `/auth/google/unlink`        | Bearer        | 422 kalau user tidak punya password                                                                 |
| POST   | `/auth/activate`             | publik        | pakai token dari email aktivasi                                                                     |
| POST   | `/auth/activate/resend`      | Bearer, admin |                                                                                                     |
| POST   | `/auth/change-password`      | Bearer        |                                                                                                     |
| POST   | `/auth/forgot-password`      | publik        |                                                                                                     |
| POST   | `/auth/reset-password`       | publik        | pakai token dari email reset                                                                        |

**Endpoint di luar `/api/v1`, BUKAN JSON — jangan di-`$fetch`, navigasi browser langsung (`window.location`):**

- `GET /auth/google/redirect` — mulai OAuth login.
- `GET /auth/google/callback` — Google redirect balik ke sini, lalu redirect lagi ke Nuxt bawa `?code=`.
- `GET /auth/google/link/callback` — sama, untuk alur tautkan akun.

**Diabaikan (bawaan Laravel/Sanctum, tidak relevan untuk pola Bearer token yang dipakai proyek ini):** `/sanctum/csrf-cookie`, `/_ignition/*`, `GET /`, `GET /up`.

## Resource Endpoints

| Method | Path                         | Auth                                                                                                          | Catatan                                                                                                                                                                  |
| ------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/dashboard/summary`         | Bearer                                                                                                        | ter-scope role (Dokumen 2 §7)                                                                                                                                            |
| GET    | `/patients`                  | Bearer                                                                                                        | ter-scope, filter `wilayah_status`/`risk_level`, paginated                                                                                                               |
| GET    | `/patients/{patient}`        | Bearer                                                                                                        |                                                                                                                                                                          |
| GET    | `/kader`                     | Bearer                                                                                                        | ter-scope; filter `puskesmas_id` untuk super_admin                                                                                                                       |
| POST   | `/kader`                     | Bearer                                                                                                        | PJ/admin_puskesmas/super_admin                                                                                                                                           |
| PATCH  | `/kader/profile`             | Bearer                                                                                                        | self-service, no_hp diabaikan kalau dikirim                                                                                                                              |
| POST   | `/staff`                     | Bearer, super_admin **atau** admin_puskesmas (dipaksa puskesmas_id sendiri, hanya bisa daftarkan pj_prolanis) | daftarkan admin_puskesmas (super_admin only) / pj_prolanis                                                                                                               |
| GET    | `/visit-assignments`         | Bearer                                                                                                        | ter-scope, filter `status`                                                                                                                                               |
| POST   | `/visit-assignments`         | Bearer                                                                                                        | PJ/admin_puskesmas/super_admin                                                                                                                                           |
| POST   | `/visit-assignments/bulk`    | Bearer                                                                                                        | PJ/admin_puskesmas/super_admin — `{kader_id, companion_kader_ids: [] (opsional), patient_ids: [], scheduled_date, priority}`, partial success (docs/planning/02 §12+§16) |
| GET    | `/announcements`             | Bearer                                                                                                        | semua role login                                                                                                                                                         |
| POST   | `/announcements`             | Bearer, super_admin                                                                                           | `{title, description, type}`                                                                                                                                             |
| GET    | `/puskesmas`                 | Bearer                                                                                                        | semua role login, tanpa scope                                                                                                                                            |
| GET    | `/puskesmas/{id}`            | Bearer                                                                                                        |                                                                                                                                                                          |
| PATCH  | `/puskesmas/{id}`            | Bearer, admin_puskesmas (sendiri)/super_admin                                                                 | `alamat`/`no_telp`/`no_wa`/`latitude`/`longitude`/`deskripsi` saja — bukan nama/kode                                                                                     |
| POST   | `/auth/profile/avatar`       | Bearer                                                                                                        | multipart, upload foto profil                                                                                                                                            |
| PATCH  | `/auth/profile`              | Bearer                                                                                                        | `email_notifications_enabled` (semua role, beda dari `/kader/profile`)                                                                                                   |
| POST   | `/visit-reports`             | Bearer                                                                                                        | multipart (foto), kader — 7-layer validation di server, plus `attendee_kader_ids[]` opsional (kader pendamping, docs/planning/02 §16)                                    |
| PATCH  | `/visit-reports/{id}/accept` | Bearer, pj_prolanis                                                                                           | terima laporan dari kader miliknya (docs/planning/02 §11)                                                                                                                |
| PATCH  | `/validasi-laporan/{id}`     | Bearer, super_admin                                                                                           | `{is_valid, note?}` — validasi final, TIDAK ADA istilah insentif/honor di response/pesan                                                                                 |
| GET    | `/notifications`             | Bearer                                                                                                        | filter `?unread=1`, ada `unread_count`                                                                                                                                   |
| PATCH  | `/notifications/{id}/read`   | Bearer                                                                                                        | 404 kalau bukan milik sendiri                                                                                                                                            |

## Yang perlu diverifikasi langsung dari kode (bukan dari dokumen ini)

Untuk tiap endpoint di atas sebelum dipakai di halaman/komponen: baca `app/Http/Controllers/Api/V1/*Controller.php`, `app/Http/Requests/*`, dan `app/Http/Resources/*` terkait di repo backend — field request/response persis, aturan validasi, dan struktur pagination tidak didokumentasikan ulang di sini supaya tidak ada risiko drift antara dokumen dan kode asli.
