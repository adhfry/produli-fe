# Brief UI/UX — Antigravity (Gemini) Membangun Dulu, Claude Menyambungkan Kemudian

> **Alur kerja (revisi):** Gemini membangun **struktur & tampilan** 1 halaman (murni visual, data dummy/placeholder) → setelah itu Claude Code menyambungkan ke data/logic asli **mengikuti struktur yang sudah ada**, tanpa mengubah desainnya. Satu halaman selesai penuh (Gemini→Claude) sebelum pindah ke halaman berikutnya — bukan Gemini membangun semua halaman sekaligus baru Claude menyambungkan semuanya di akhir.

## 1. Batasan Kerja Gemini

- Bangun **markup + styling + struktur komponen** halaman yang diminta. Data yang ditampilkan boleh dummy/placeholder — TAPI **bentuk struktur data (nama field, tipe) harus mengikuti `types/api.ts`** yang sudah ada di project (baca dulu file itu sebelum membangun) — supaya penyambungan Claude nanti tinggal ganti sumber data, bukan re-desain ulang bentuk komponennya.
- Reuse `layouts/private.vue` yang sudah ada (jangan bikin ulang noindex/SEO) — tambahkan shell/komponen dashboard/app DI DALAM layout itu.
- Jangan panggil `useApi`/`$fetch`/Pinia store sungguhan — itu bagian Claude. Cukup `const dummyData = {...}` lokal di komponen, dengan bentuk yang sudah disebut di atas.
- Style: tema terang, palet `docs/planning/07-design-tokens-dan-koreksi-referensi.md` (final, jangan buat warna baru), konsisten satu keluarga visual dengan landing page (`pages/index.vue`, sudah final — split layout, shadow lembut, icon dalam badge berwarna, motif dot-grid).

## 2. Batasan Kerja Claude (setelah Gemini selesai 1 halaman)

- **Jangan ubah markup/struktur/style** yang sudah dibangun Gemini — tugasnya murni menyambungkan: bikin/pakai Pinia store, panggil endpoint asli lewat `useApi`, ganti `dummyData` jadi data store, tambahkan loading skeleton (ikuti bentuk yang sudah ada di komponen) dan error state, pasang logic (role visibility, form submit, dst).
- Kalau bentuk dummy data Gemini ternyata beda dari response API asli — sesuaikan di composable/mapping layer, **jangan** ubah komponen tampilannya untuk "memaksakan" biar cocok.
- Kalau nemu Gemini salah bikin struktur yang bikin penyambungan jadi ganjil — laporkan dulu ke user, jangan diam-diam re-desain sendiri.

## 3. Non-negotiable untuk halaman `/app` (kader)

Berlaku untuk Gemini SAAT membangun, bukan cuma Claude saat menyambungkan:

- Font minimal 16-18px teks umum, 20px+ aksi utama.
- Tombol besar, full-width, target sentuh besar.
- 1 aksi utama besar per layar — jangan padatkan banyak opsi dalam satu layar.
- Bottom navigation maksimal 3-4 item, ikon + label teks selalu tampil.
- Kontras warna tinggi (WCAG AA minimal).

Halaman `/dashboard` (staf, bukan lansia) boleh lebih padat informasi, tidak terikat aturan di atas.

## 4. Urutan Halaman (1 per 1, Gemini → Claude, baru lanjut berikutnya)

1. **`/dashboard`** (shell utama: sidebar/nav, header, card ringkasan risiko+status kunjungan) — mulai dari sini
2. `/dashboard/pasien` (+ detail)
3. `/dashboard/staf`, `/dashboard/kader`, `/dashboard/kunjungan`
4. `/app` (home+tugas), `/app/kunjungan/:id` (form 7-layer), `/app/profil`

Landing page dan sub-halaman publik (`/tentang-kami`, `/kontak`) **sudah final** — tidak termasuk alur ini.
