# Brief: Restyle Dashboard KOPIPU Smart

## Konteks

Lampirkan 2 gambar ini ke Gemini bareng brief ini:

- **reference.jpeg** → desain target (source: "KOPIPU Smart", sidebar teal gelap, versi lengkap)
- **current.png** → hasil generate sekarang (localhost:3033/dashboard) yang perlu di-restyle

Task ini **restyling visual murni** (warna, spacing, tipografi, layout kartu) mengikuti `reference.png`. Bukan redesign ulang struktur data atau fitur yang sudah dibangun.

Saya sengaja tidak menebak-nebak kode hex warna di brief ini — minta Gemini sampling warna/spacing langsung dari `reference.png` (dia bisa lihat gambarnya), supaya hasilnya presisi, bukan kira-kira. anda dapat melihat setup tailwindcss saya anda bisa melihat setup css dengan tailwind nya seperti apa, jika ada warna yang kurang dan salah anda bisa perbaiki agar sesuai dengan tone (jangan melangkah terlalu jauh dari tema css yang saya buat)

## ⚠️ JANGAN DIUBAH — fitur yang sudah dibangun

Di card peta, tiga hal ini **fungsinya harus tetap ada**, cuma boleh disesuaikan tampilannya (border/spacing/warna) biar menyatu dengan desain baru:

- Poligon batas wilayah (kecamatan + desa/kelurahan) — data geografis, jangan diganti/dihapus
- Search input typeahead ("Cari desa/kecamatan...")
- Filter mode toggle (tampilan per-kecamatan vs per-desa)
- Tombol fullscreen
- Menu di sidebar
- fungsi fitur notif di header. dan profile

---

## 1. Header Global (Navbar Atas)

**Hapus** search input "Cari data pasien..." yang sekarang ada di sisi kiri header.

**Ganti** dengan widget info berisi 3 bagian (sapaan, jam, lokasi), posisi menggantikan search bar tadi:

```vue
<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { LucideMapPin } from "#components";

const now = ref(new Date());
let timer;
onMounted(() => {
  timer = setInterval(() => (now.value = new Date()), 1000);
});
onUnmounted(() => clearInterval(timer));

const greeting = computed(() => {
  const h = now.value.getHours();
  if (h >= 5 && h < 11) return "Selamat Pagi";
  if (h >= 11 && h < 15) return "Selamat Siang";
  if (h >= 15 && h < 18) return "Selamat Sore";
  return "Selamat Malam";
});

const timeString = computed(
  () =>
    now.value.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB",
);

// default: wilayah kerja dari profil user (lihat catatan di bawah)
const userLocation = computed(() => authStore.user?.wilayah_kerja ?? "—");
</script>

<template>
  <div class="flex items-center gap-2 text-sm">
    <span class="font-semibold text-accent"
      >{{ greeting }}, dr. {{ authStore.user?.nama_depan }}</span
    >
    <span class="text-slate-300">•</span>
    <span class="text-slate-500">{{ timeString }}</span>
    <span class="text-slate-300">•</span>
    <span class="flex items-center gap-1 text-slate-500">
      <LucideMapPin class="w-3.5 h-3.5 text-slate-400" />
      {{ userLocation }}
    </span>
  </div>
</template>
```

**Catatan soal "lokasi aktif":** ada 2 cara implementasi yang beda jauh:

1. **Wilayah kerja dari profil user** (dipakai di snippet atas) — simpel, tidak perlu izin browser, cocok buat dashboard tenaga kesehatan (misal "Puskesmas Kalianget, Kab. Sumenep")
2. **Geolocation browser** (GPS + reverse geocode ke nama kota/kecamatan) — perlu izin lokasi dari user, lebih kompleks, dan lokasi device belum tentu sama dengan wilayah kerja resminya

Defaultnya saya pakai opsi 1 di snippet ini. Kalau maksudnya opsi 2, kasih tahu Gemini eksplisit karena butuh flow permission tambahan.

---

## 2. 6 Card Statistik (Baris Atas)

Layout per card di reference beda urutan elemen dari current:

| Elemen      | Reference                                                        | Current (sekarang)                   |
| ----------- | ---------------------------------------------------------------- | ------------------------------------ |
| Icon        | Lingkaran warna, pojok kiri atas                                 | Sama                                 |
| Trend badge | Tidak ada badge — teks polos di baris paling bawah, dengan panah | Pill/badge warna di pojok kanan atas |
| Label       | Di samping icon, baris sama                                      | Uppercase kecil, di bawah icon       |
| Value       | Besar bold, baris kedua                                          | Besar bold, baris ketiga             |

Ubah ke pola reference: `[icon] Label` sebaris di atas → `Value` besar → `↗/↘ X% dari minggu lalu` di baris paling bawah tanpa background pill.

Warna trend dinamis sesuai konteks: hijau kalau perubahan itu kabar baik (termasuk kalau angka "Belum Dikunjungi" **turun** → tetap hijau meski trend-nya minus), merah/oranye kalau kabar buruk.

---

## 3. Card Peta — "Peta Sebaran Pasien Risiko"

Header card di reference juga ada dropdown periode ("Minggu Ini") di kanan — opsional, tambahkan kalau mau parity penuh, tapi bukan prioritas.

Yang perlu diubah:

**Basemap** — reference pakai basemap yang jauh lebih soft/muted dari OSM raster biasa. Opsi termudah: ganti tile source ke CARTO Positron (gratis, tanpa API key):

```js
tiles: ["https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"];
```

**Warna polygon & legend — perlu keputusan, jangan langsung dieksekusi Gemini tanpa ini dikonfirmasi:**
Reference pakai choropleth berbasis **jumlah pasien** (5 bucket: 0-50, 51-150, 151-300, 301-500, >500, gradasi teal→kuning→oranye→merah). Yang sekarang jalan pakai kategori **risiko** (3 bucket: Aman/Atensi/Tinggi). Ini bukan cuma beda warna — beda metrik & logic data sepenuhnya.

Rekomendasi saya: **pertahankan skema 3-kategori risiko** yang sudah ada (karena itu yang relevan buat konteks Prolanis/pemantauan risiko pasien kamu), tapi restyle warnanya biar senada sama basemap baru. Kalau kamu memang mau ganti ke skema jumlah pasien, itu perlu data agregat count per wilayah dulu — kasih tahu saya, saya bisa bantu siapin strukturnya.

**Posisi kontrol zoom**: pindah dari kanan-bawah ke kiri-atas (minor, opsional).

---

## 4. Chart "Distribusi Risiko" (Donut)

- Tambahkan persentase di legend: `● Risiko Berat   2.145 (14,0%)` — sekarang cuma tampil jumlahnya tanpa persentase
- Tambahkan link "Lihat Selengkapnya →" di bawah legend, warna teal

## 5. Chart "Progres Kunjungan" (Ring)

- Ganti baris ringkasan di bawah ring: dari 1 baris gabungan ("Target Bulanan: 1.820/3.100 Kunjungan") jadi format list 2 baris terpisah — "Target Minggu Ini" dan "Sisa Target", masing-masing dengan angka sendiri rata kanan
- Tambahkan link "Lihat Detail →"

---

## 6. Card "Aktivitas Kunjungan Hari Ini"

Ini yang paling beda strukturnya. Reference pakai format **tabel** dengan header kolom eksplisit:

```
Nama Kader | Kunjungan | Selesai | Progres | Terakhir Update
```

Current pakai format list/card (avatar + nama+role di kiri, fraction "12/15" + progress bar tipis di kanan, tanpa header kolom). Ubah ke format tabel seperti reference, avatar tetap pertahankan di kolom nama.

## 7. Card "5 Kecamatan dengan Risiko Tertinggi"

Sudah cukup dekat secara struktur. Tinggal:

- Rapikan gradasi warna bar sesuai ranking (merah → oranye → kuning → teal dari tertinggi ke terendah)
- Data masih dummy (Sukamaju, Harapan, dst) — saya sudah siapkan data kecamatan asli Sumenep dari kerjaan sebelumnya (file `sumenep_search_index.json` dkk), bilang aja kalau mau saya bantu integrasikan ke sini

## 8. Card "Notifikasi"

- Ganti indicator dari outline-dot berwarna jadi **icon di dalam lingkaran berwarna** (shield=risiko/merah, folder=penugasan/oranye, refresh=sync/biru, check=selesai/hijau) — sesuai jenis notifikasi
- Cek ulang label link kanan atas ("Tandai Dibaca" vs "Lihat Semua") — sesuaikan sama kebutuhan fungsional kamu, jangan asal ngikutin reference kalau fungsinya beda

---

## Ringkasan urutan kerja yang disarankan

1. Header (hapus search, pasang widget sapaan)
2. 6 card statistik
3. 2 chart (donut + ring)
4. 3 card bawah
5. Card peta (basemap dulu, baru diskusikan soal skema warna choropleth)

Beri tahu Gemini untuk **screenshot hasilnya tiap section selesai**, biar bisa langsung dicocokkan ke reference.png sebelum lanjut ke section berikutnya — daripada restyle semua sekaligus lalu ternyata meleset jauh.
