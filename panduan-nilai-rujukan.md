Betul. Saya sekarang akan susun ini **sebagai standar analisis untuk AI agent**, bukan sebagai tampilan hasil pemeriksaan. Saya juga akan mengunci aturan supaya agent tidak bingung antara **nilai rujukan**, **kategori risiko**, dan **batas diagnosis**.

Saya sudah cek ulang sumber primer/rujukan laboratorium. Ada satu temuan penting: **rentang Urea yang Anda miliki memang sangat mirip dengan nilai rujukan Roche untuk Urea serum**, bukan BUN. Roche memberikan Urea dewasa 18–60 tahun **12,6–42,6 mg/dL** dan 60–90 tahun **17,4–49,2 mg/dL**; sedangkan BUN memiliki angka yang jauh lebih rendah. Roche juga secara eksplisit membedakan Urea dan Urea Nitrogen/BUN. ([Roche Elabdoc][1])

---

# STANDAR NILAI RUJUKAN UNTUK ANALISIS KIMIA KLINIK

## 1. Prinsip dasar yang harus digunakan AI

Untuk setiap hasil pemeriksaan, AI harus menentukan:

1. **Nama pemeriksaan**
2. **Satuan**
3. **Jenis spesimen**, jika tersedia
4. **Umur pasien**
5. **Jenis kelamin pasien**, jika pemeriksaan dipengaruhi gender
6. **Nilai hasil**
7. **Reference interval / kategori interpretasi**
8. **Status hasil**

   * Normal
   * Rendah
   * Tinggi
   * Borderline
   * Sangat tinggi
9. Jangan menyimpulkan penyakit hanya berdasarkan satu hasil laboratorium.

Untuk pemeriksaan lipid, istilah seperti *desirable*, *borderline high*, *high*, dan *very high* merupakan **kategori interpretatif**, bukan sekadar batas biologis `min–max`. ([Mayo Clinic Laboratories][2])

---

# 2. MASTER NILAI RUJUKAN

## A. CHOLESTEROL TOTAL

### Umur <2 tahun

**Nilai rujukan tidak ditetapkan** dalam standar lipid yang digunakan di sini.

### Umur 2–17 tahun

|             Hasil | Interpretasi    |
| ----------------: | --------------- |
|    **<170 mg/dL** | Acceptable      |
| **170–199 mg/dL** | Borderline high |
|    **≥200 mg/dL** | High            |

### Umur ≥18 tahun

|             Hasil | Interpretasi    |
| ----------------: | --------------- |
|    **<200 mg/dL** | Desirable       |
| **200–239 mg/dL** | Borderline high |
|    **≥240 mg/dL** | High            |

Tidak dibedakan berdasarkan gender. ([Mayo Clinic Laboratories][3])

### Contoh

**Pasien 45 tahun:**

> Cholesterol = 210 mg/dL

→ **Borderline high**

**Pasien 15 tahun:**

> Cholesterol = 180 mg/dL

→ **Borderline high**

Karena anak menggunakan batas <170, bukan <200.

---

# 3. TRIGLISERIDA

Ini **wajib menggunakan umur**.

### <2 tahun

Reference interval standar yang digunakan di sini **tidak ditetapkan**.

### 2–9 tahun

|           Hasil | Interpretasi    |
| --------------: | --------------- |
|   **<75 mg/dL** | Acceptable      |
| **75–99 mg/dL** | Borderline high |
|  **≥100 mg/dL** | High            |

### 10–17 tahun

|            Hasil | Interpretasi    |
| ---------------: | --------------- |
|    **<90 mg/dL** | Acceptable      |
| **90–129 mg/dL** | Borderline high |
|   **≥130 mg/dL** | High            |

### ≥18 tahun

|             Hasil | Interpretasi    |
| ----------------: | --------------- |
|    **<150 mg/dL** | Normal          |
| **150–199 mg/dL** | Borderline high |
| **200–499 mg/dL** | High            |
|    **≥500 mg/dL** | Very high       |

([Mayo Clinic Laboratories][4])

### Contoh

> Trigliserida = 158 mg/dL, umur 45 tahun

→ **Borderline high**

Jadi nilai `158` pada data Anda **tidak normal**, meskipun laboratorium lama menuliskan `<140`.

---

# 4. HDL

HDL **menggunakan gender + umur**.

### Umur <2 tahun

Reference interval tidak ditetapkan dalam standar ini.

### Umur 2–17 tahun

|             HDL | Interpretasi   |
| --------------: | -------------- |
|   **<40 mg/dL** | Low            |
| **40–45 mg/dL** | Borderline low |
|   **>45 mg/dL** | Acceptable     |

Tidak dibedakan gender pada kelompok anak. ([Mayo Clinic Laboratories][5])

### Umur ≥18 tahun

#### Laki-laki

> **HDL ≥40 mg/dL = acceptable**

#### Perempuan

> **HDL ≥50 mg/dL = acceptable**

Tidak ada upper limit yang digunakan sebagai batas abnormal pada klasifikasi ini. ([Mayo Clinic Laboratories][5])

### Contoh

**Laki-laki 50 tahun**

> HDL = 64 mg/dL

→ **Acceptable**

**Perempuan 50 tahun**

> HDL = 64 mg/dL

→ **Acceptable**

**Laki-laki 35 tahun**

> HDL = 35 mg/dL

→ **Low**

**Perempuan 35 tahun**

> HDL = 45 mg/dL

→ **Low**, karena batas perempuan dewasa adalah ≥50 mg/dL.

Jadi:

> ❌ `HDL 0–1000 mg/dL`

harus dihapus sebagai nilai rujukan.

---

# 5. LDL

LDL menggunakan **umur**, bukan gender.

### Umur <2 tahun

Reference interval tidak ditetapkan.

### Umur 2–17 tahun

|               LDL | Interpretasi    |
| ----------------: | --------------- |
|    **<110 mg/dL** | Acceptable      |
| **110–129 mg/dL** | Borderline high |
|    **≥130 mg/dL** | High            |

### Umur ≥18 tahun

|               LDL | Interpretasi    |
| ----------------: | --------------- |
|    **<100 mg/dL** | Desirable       |
| **100–129 mg/dL** | Above desirable |
| **130–159 mg/dL** | Borderline high |
| **160–189 mg/dL** | High            |
|    **≥190 mg/dL** | Very high       |

([Mayo Clinic Laboratories][6])

### Contoh

> LDL = 114 mg/dL
> Umur = 50 tahun

→ **Above desirable**

Bukan `normal` jika model menggunakan klasifikasi lipid ini.

Sedangkan:

> LDL = 75 mg/dL

→ **Desirable**

---

# 6. CREATININE

Ini adalah pemeriksaan yang **jelas membutuhkan umur + gender**.

Reference interval berikut berasal dari Mayo Clinic Laboratories. ([Mayo Clinic Laboratories][7])

### 0–11 bulan

**Laki-laki dan perempuan:**

> **0,17–0,42 mg/dL**

### 1–5 tahun

> **0,19–0,49 mg/dL**

Gender sama.

### 6–10 tahun

> **0,26–0,61 mg/dL**

Gender sama.

### 11–14 tahun

> **0,35–0,86 mg/dL**

Untuk laki-laki.

### 11–15 tahun

> **0,35–0,86 mg/dL**

Untuk perempuan.

### Laki-laki ≥15 tahun

> **0,74–1,35 mg/dL**

### Perempuan ≥16 tahun

> **0,59–1,04 mg/dL**

([Mayo Clinic Laboratories][7])

### Contoh

**Laki-laki 40 tahun**

> Creatinine = 0,6 mg/dL

→ **Low**

**Perempuan 40 tahun**

> Creatinine = 0,6 mg/dL

→ **Normal**

Ini contoh penting mengapa AI **tidak boleh** mengatakan `0,6 normal` tanpa mengetahui gender.

---

# 7. UREA — STANDARD YANG SUDAH DIPERJELAS

Ini bagian yang paling penting dari pertanyaan Anda.

## Urea ≠ BUN

Roche mendefinisikan pemeriksaan:

* **Urea**
* **Urea Nitrogen / BUN**

sebagai dua pelaporan yang berbeda.

Konversinya:

> **Urea mg/dL × 0,467 = BUN mg/dL**

atau:

> **Urea mg/dL ≈ BUN × 2,14**

Roche secara langsung memberikan nilai rujukan Urea dalam mg/dL. ([Roche Elabdoc][1])

### Urea serum — standar yang dipakai

## 0–14 hari

Untuk data pediatrik CALIPER:

> **3–22 mg/dL**

## 15 hari–<1 tahun

> **4–16 mg/dL**

## 1–<10 tahun

> **9–22 mg/dL**

## 10–<19 tahun

> **7–18 mg/dL**

Data CALIPER menunjukkan interval pediatrik Urea tersebut dan digunakan sebagai reference interval pediatrik berbasis populasi sehat. ([ResearchGate][8])

---

## Dewasa 18–60 tahun

Roche:

> **12,6–42,6 mg/dL**

([Roche Elabdoc][1])

Ini sangat dekat dengan nilai laboratorium Anda:

> `12,9–42,9 mg/dL`

Artinya angka yang Anda miliki memang **sangat konsisten dengan reference interval Urea Roche**, bukan BUN.

---

## Umur 60–90 tahun

Roche:

> **17,4–49,2 mg/dL**

Laboratorium Anda:

> `17,2–49,3 mg/dL`

Sekali lagi, sangat dekat dengan Roche. ([Roche Elabdoc][1])

---

## Umur ≥90 tahun

Di sinilah harus hati-hati.

Reference interval Roche tersebut berhenti pada **90 tahun**. Jadi tidak boleh mengarang reference interval baru seolah-olah ada standar universal untuk >90 tahun.

Untuk **aturan operasional AI yang konsisten**, gunakan:

> **≥90 tahun → 17,4–49,2 mg/dL**

dengan status internal:

> `extended_from_60_90`

Artinya model boleh melakukan klasifikasi, tetapi tidak boleh menyebut interval tersebut sebagai "reference interval internasional khusus usia ≥90 tahun".

Ini lebih aman daripada mengarang angka baru.

### Master Urea yang saya sarankan

| Umur             |                 Urea |
| ---------------- | -------------------: |
| 0–14 hari        |       **3–22 mg/dL** |
| 15 hari–<1 tahun |       **4–16 mg/dL** |
| 1–<10 tahun      |       **9–22 mg/dL** |
| 10–<18 tahun     |       **7–18 mg/dL** |
| 18–59 tahun      |  **12,6–42,6 mg/dL** |
| 60–89 tahun      |  **17,4–49,2 mg/dL** |
| ≥90 tahun        | **17,4–49,2 mg/dL*** |

`*` = perpanjangan operasional interval 60–90 tahun karena tidak tersedia interval universal tervalidasi khusus ≥90 tahun dari sumber yang dipakai.

**Gender tidak digunakan untuk Urea pada standar ini.**

---

# 8. MICROALBUMIN

Di sini kita harus membedakan **Microalbumin concentration** dengan **Albumin/Creatinine Ratio (ACR)**.

Data Anda:

> Microalbumin = **25,8 mg/L**

dan laboratorium memberikan:

> `<30 mg/L`

Untuk analisis terhadap **hasil yang memang dilaporkan sebagai konsentrasi mg/L**, gunakan:

> **<30 mg/L = within laboratory reference threshold**

Tetapi **jangan mengubah 25,8 mg/L menjadi 25,8 mg/g**.

Karena:

> mg/L ≠ mg/g

Untuk penilaian albuminuria yang direkomendasikan secara internasional, gunakan **urine ACR**.

KDIGO menggunakan:

|       Urine ACR | Kategori |
| --------------: | -------- |
|    **<30 mg/g** | A1       |
| **30–299 mg/g** | A2       |
|   **≥300 mg/g** | A3       |

([KDIGO][9])

Untuk pemeriksaan albumin urine random, Mayo juga memberikan batas berdasarkan rasio albumin/kreatinin:

| Gender    |              ACR normal |
| --------- | ----------------------: |
| Laki-laki | **<17 mg/g creatinine** |
| Perempuan | **<25 mg/g creatinine** |

([Mayo Clinic Labs][10])

### Aturan AI

Jika input:

> `Microalbumin = 25.8 mg/L`

→ nilai tersebut **tidak boleh diklasifikasikan sebagai A1/A2/A3**.

Jika input:

> `Albumin/Creatinine Ratio = 25.8 mg/g`

→ **A1 (<30 mg/g)**.

Ini penting sekali.

---

# 9. MASTER FINAL

Berikut format yang menurut saya paling cocok untuk diberikan kepada AI agent:

| Pemeriksaan           | Umur                                        | Gender    | Nilai rujukan / kategori                                                                  |
| --------------------- | ------------------------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| **Cholesterol Total** | <2 th                                       | Semua     | Tidak ditetapkan                                                                          |
|                       | 2–17 th                                     | Semua     | <170 acceptable; 170–199 borderline high; ≥200 high                                       |
|                       | ≥18 th                                      | Semua     | <200 desirable; 200–239 borderline high; ≥240 high                                        |
| **Trigliserida**      | <2 th                                       | Semua     | Tidak ditetapkan                                                                          |
|                       | 2–9 th                                      | Semua     | <75 acceptable; 75–99 borderline; ≥100 high                                               |
|                       | 10–17 th                                    | Semua     | <90 acceptable; 90–129 borderline; ≥130 high                                              |
|                       | ≥18 th                                      | Semua     | <150 normal; 150–199 borderline; 200–499 high; ≥500 very high                             |
| **HDL**               | <2 th                                       | Semua     | Tidak ditetapkan                                                                          |
|                       | 2–17 th                                     | Semua     | <40 low; 40–45 borderline low; >45 acceptable                                             |
|                       | ≥18 th                                      | Laki-laki | ≥40 acceptable                                                                            |
|                       | ≥18 th                                      | Perempuan | ≥50 acceptable                                                                            |
| **LDL**               | <2 th                                       | Semua     | Tidak ditetapkan                                                                          |
|                       | 2–17 th                                     | Semua     | <110 acceptable; 110–129 borderline; ≥130 high                                            |
|                       | ≥18 th                                      | Semua     | <100 desirable; 100–129 above desirable; 130–159 borderline; 160–189 high; ≥190 very high |
| **Creatinine**        | 0–11 bln                                    | Semua     | 0,17–0,42                                                                                 |
|                       | 1–5 th                                      | Semua     | 0,19–0,49                                                                                 |
|                       | 6–10 th                                     | Semua     | 0,26–0,61                                                                                 |
|                       | 11–14 th                                    | Laki-laki | 0,35–0,86                                                                                 |
|                       | 11–15 th                                    | Perempuan | 0,35–0,86                                                                                 |
|                       | ≥15 th                                      | Laki-laki | 0,74–1,35                                                                                 |
|                       | ≥16 th                                      | Perempuan | 0,59–1,04                                                                                 |
| **Urea**              | 0–14 hari                                   | Semua     | 3–22                                                                                      |
|                       | 15 hari–<1 th                               | Semua     | 4–16                                                                                      |
|                       | 1–<10 th                                    | Semua     | 9–22                                                                                      |
|                       | 10–<18 th                                   | Semua     | 7–18                                                                                      |
|                       | 18–59 th                                    | Semua     | 12,6–42,6                                                                                 |
|                       | 60–89 th                                    | Semua     | 17,4–49,2                                                                                 |
|                       | ≥90 th                                      | Semua     | 17,4–49,2*                                                                                |
| **Microalbumin**      | Semua                                       | Semua     | <30 mg/L untuk konsentrasi urine yang dilaporkan dalam mg/L                               |
| **Urine ACR**         | Semua usia yang menggunakan klasifikasi ACR | Semua     | <30 mg/g A1; 30–299 A2; ≥300 A3                                                           |

Sumber lipid: Mayo/NCEP/National Lipid Association dan pediatric guidelines. ([Mayo Clinic Laboratories][2])
Sumber kreatinin: Mayo Clinic Laboratories. ([Mayo Clinic Laboratories][7])
Sumber Urea dewasa: Roche Urea/BUN method sheet. ([Roche Elabdoc][1])
Sumber pediatrik Urea: CALIPER pediatric reference intervals. ([ResearchGate][8])
Sumber albuminuria: KDIGO dan Mayo Clinic Laboratories. ([KDIGO][9])

---

# 10. Contoh analisis menggunakan data Anda

Data:

| Pemeriksaan  |     Hasil |  Umur | Gender |
| ------------ | --------: | ----: | ------ |
| Cholesterol  | 210 mg/dL | 55 th | L      |
| Trigliserida | 158 mg/dL | 55 th | L      |
| Urea         |  59 mg/dL | 55 th | L      |
| Creatinine   | 2,7 mg/dL | 55 th | L      |
| HDL          |  64 mg/dL | 55 th | L      |
| LDL          | 114 mg/dL | 55 th | L      |
| Microalbumin | 25,8 mg/L | 55 th | L      |

### Hasil analisis

| Pemeriksaan  |     Hasil | Rujukan yang digunakan | Status                                         |
| ------------ | --------: | ---------------------: | ---------------------------------------------- |
| Cholesterol  |       210 |                   <200 | 🟠 **Borderline high**                         |
| Trigliserida |       158 |                   <150 | 🟠 **Borderline high**                         |
| Urea         |        59 |              12,6–42,6 | 🔴 **High**                                    |
| Creatinine   |       2,7 |              0,74–1,35 | 🔴 **High**                                    |
| HDL          |        64 |                    ≥40 | 🟢 **Acceptable**                              |
| LDL          |       114 |         <100 desirable | 🟡 **Above desirable**                         |
| Microalbumin | 25,8 mg/L |               <30 mg/L | 🟢 **Within reported concentration threshold** |

Untuk Urea:

> **59 mg/dL > 42,6 mg/dL**

sehingga **tinggi** untuk usia 55 tahun.

Untuk Creatinine:

> **2,7 mg/dL > 1,35 mg/dL**

sehingga **tinggi** untuk laki-laki dewasa.

Kombinasi **Urea tinggi + Creatinine tinggi** kemudian dapat menjadi sinyal yang perlu dianalisis lebih lanjut oleh model, tetapi model **tidak boleh langsung menyatakan "gagal ginjal" hanya dari dua angka tersebut**. Konteks klinis, eGFR, riwayat, hidrasi, obat, dan pemeriksaan lain tetap diperlukan.

---

# 11. Contoh kondisi gender

### Kasus A — laki-laki

> Umur: 40 tahun
> Creatinine: 0,60 mg/dL
> HDL: 45 mg/dL

Analisis:

* Creatinine: **LOW** karena laki-laki dewasa 0,74–1,35
* HDL: **ACCEPTABLE** karena laki-laki ≥40

---

### Kasus B — perempuan

> Umur: 40 tahun
> Creatinine: 0,60 mg/dL
> HDL: 45 mg/dL

Analisis:

* Creatinine: **NORMAL** karena perempuan 0,59–1,04
* HDL: **LOW** karena perempuan membutuhkan ≥50

**Nilai sama, tetapi interpretasi berbeda karena gender.**

---

# 12. Contoh kondisi umur

### Anak 8 tahun

> Cholesterol = 180
> Trigliserida = 80
> LDL = 115
> HDL = 42

Interpretasi:

* Cholesterol 180 → **Borderline high**
* Trigliserida 80 → **Borderline high**
* LDL 115 → **Borderline high**
* HDL 42 → **Borderline low**

Kalau AI salah memakai batas dewasa, hasilnya bisa keliru.

---

### Dewasa 45 tahun

> Cholesterol = 180
> Trigliserida = 80
> LDL = 115
> HDL = 42

Interpretasi:

* Cholesterol 180 → **Desirable**
* Trigliserida 80 → **Normal**
* LDL 115 → **Above desirable**
* HDL:

  * laki-laki → **Acceptable**
  * perempuan → **Low**

Ini menunjukkan mengapa **umur dan gender harus menjadi bagian dari konteks analisis**.

---

## 13. Format aturan yang sebaiknya dipahami AI

Urutan reasoning-nya:

```text
INPUT
│
├── Pemeriksaan
├── Hasil
├── Satuan
├── Umur
└── Gender
        │
        ▼
IDENTIFIKASI PEMERIKSAAN
        │
        ▼
APAKAH MEMBUTUHKAN UMUR?
        │
        ├── YA → pilih kelompok umur
        └── TIDAK
        │
        ▼
APAKAH MEMBUTUHKAN GENDER?
        │
        ├── YA → pilih gender
        └── TIDAK
        │
        ▼
PILIH REFERENCE INTERVAL
        │
        ▼
BANDINGKAN HASIL
        │
        ├── LOW
        ├── NORMAL / ACCEPTABLE
        ├── BORDERLINE
        ├── HIGH
        └── VERY HIGH
        │
        ▼
ANALISIS KLINIS TERINTEGRASI
```

**Poin paling penting:** AI harus terlebih dahulu menentukan **reference interval yang benar untuk pasien tersebut**, baru menilai hasilnya. Jangan membandingkan semua pasien dengan satu angka seperti `Urea 12,9–42,9` atau `Creatinine 0,8–1,3`.

Dan khusus **Urea**, saya akan menggunakan **Urea mg/dL**, bukan BUN, untuk dataset Anda. Rentang dewasa yang Anda berikan memang sangat dekat dengan rentang Urea Roche: **12,6–42,6 mg/dL untuk 18–60 tahun** dan **17,4–49,2 mg/dL untuk 60–90 tahun**. ([Roche Elabdoc][1])

[1]: https://elabdoc-prod.roche.com/LifeScience/Document/36a21972-f3c5-e511-739a-00215a9b3428 "method-sheet-cobas"
[2]: https://www.mayocliniclabs.com/test-catalog/overview/616696?utm_source=chatgpt.com "LPSC1 - Overview: Lipid Panel, Serum"
[3]: https://www.mayocliniclabs.com/test-catalog/Overview/8320?utm_source=chatgpt.com "CHOL - Overview: Cholesterol, Total, Serum"
[4]: https://www.mayocliniclabs.com/test-catalog/overview/606879?utm_source=chatgpt.com "TRIGC - Overview: Triglycerides, CDC, Serum"
[5]: https://www.mayocliniclabs.com/test-catalog/overview/8429?utm_source=chatgpt.com "HDCH - Overview: Cholesterol, High-Density Lipoprotein (HDL), Serum"
[6]: https://www.mayocliniclabs.com/test-catalog/overview/617023?utm_source=chatgpt.com "CLDL1 - Overview: Cholesterol, Low-Density Lipoprotein (LDL), Calculated, Serum"
[7]: https://www.mayocliniclabs.com/test-catalog/Overview/48216?utm_source=chatgpt.com "CRTS1 - Overview: Creatinine with Estimated Glomerular Filtration Rate (eGFR), Serum"
[8]: https://www.researchgate.net/publication/320334440_The_Canadian_laboratory_initiative_on_pediatric_reference_intervals_A_CALIPER_white_paper?utm_source=chatgpt.com "(PDF) The Canadian laboratory initiative on pediatric reference intervals: A CALIPER white paper"
[9]: https://kdigo.org/wp-content/uploads/2024/03/KDIGO-2024-CKD-Guideline.pdf?utm_source=chatgpt.com "KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease"
[10]: https://prd1.mayocliniclabs.com/test-catalog/overview/606730?utm_source=chatgpt.com "RALB1 - Overview: Albumin, Random, Urine"
