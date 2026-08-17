Ya. Untuk parameter yang sudah ada di PRODULI, saya sarankan **jangan sekadar mengganti angka `<120`, `<140`, dan `<180`**. Kita perlu membedakan **nilai normal**, **prediabetes**, **diabetes**, dan **target terapi**, karena ketiganya bukan hal yang sama.

Saya cek ulang terhadap **ADA Standards of Care 2026** dan WHO. Untuk glukosa, standar diagnostik saat ini adalah **GDP ≥126 mg/dL**, **2-jam glucose ≥200 mg/dL pada 75-g OGTT**, atau **glukosa random ≥200 mg/dL bila disertai gejala klasik/krisis hiperglikemia**. ([Diabetes Journals][1])

## 1. Gula Darah Puasa / GDP

Untuk **orang dewasa non-hamil**, gunakan:

|               GDP | Interpretasi                              |
| ----------------: | ----------------------------------------- |
|    **<100 mg/dL** | 🟢 Normal                                 |
| **100–125 mg/dL** | 🟡 Impaired Fasting Glucose / Prediabetes |
|    **≥126 mg/dL** | 🔴 Diabetes\*                             |

\*Jika tidak terdapat hiperglikemia yang jelas, hasil diagnostik harus dikonfirmasi dengan pengujian ulang atau tes diagnostik lain. ADA 2026 menggunakan **≥126 mg/dL** sebagai cut-off diabetes dan **100–125 mg/dL** sebagai prediabetes. ([Diabetes Journals][1])

### Jadi nilai Labkesda:

> `<120 mg/dL`

**Sebaiknya jangan digunakan sebagai klasifikasi kesehatan universal.**

Untuk analisis AI:

```text
GDP <100       = NORMAL
GDP 100–125    = PREDIABETES / IFG
GDP ≥126       = DIABETES RANGE
```

### Contoh

| GDP | Status            |
| --: | ----------------- |
|  85 | 🟢 Normal         |
|  99 | 🟢 Normal         |
| 105 | 🟡 Prediabetes    |
| 119 | 🟡 Prediabetes    |
| 125 | 🟡 Prediabetes    |
| 126 | 🔴 Diabetes range |
| 180 | 🔴 Diabetes range |

**Catatan:** GDP harus berarti **tidak ada asupan kalori selama minimal 8 jam**. ([Diabetes Journals][1])

---

# 2. Gula Darah 2JPP

Di sini ada hal yang sangat penting untuk AI Anda.

**Gula Darah 2JPP ≠ OGTT 2 jam.**

### 2JPP

Artinya:

> Glukosa diperiksa **2 jam setelah mulai makan**.

Sedangkan kriteria diagnostik ADA:

> **2-hour plasma glucose setelah konsumsi 75 g glukosa pada OGTT**

Jadi jangan membuat AI menganggap:

> 2JPP 200 = otomatis diagnosis diabetes.

Untuk pemeriksaan **2JPP rutin setelah makan**, gunakan interpretasi postprandial.

Pada individu non-diabetes, kadar glukosa postprandial umumnya tidak melebihi sekitar **140 mg/dL**. ([Diabetes Journals][2])

Untuk analisis praktis:

|              2JPP | Interpretasi                     |
| ----------------: | -------------------------------- |
|    **<140 mg/dL** | 🟢 Normal / desirable            |
| **140–199 mg/dL** | 🟡 Elevated postprandial glucose |
|    **≥200 mg/dL** | 🔴 High / diabetes-range value   |

**Tetapi:** kategori **prediabetes 140–199 mg/dL** secara resmi berlaku untuk **2-h plasma glucose pada 75-g OGTT**, bukan otomatis untuk 2JPP setelah makanan biasa. ADA secara eksplisit mendefinisikan prediabetes 140–199 mg/dL pada **75-g OGTT**. ([Diabetes Journals][1])

Jadi untuk AI agent, saya justru menyarankan label:

```text
2JPP <140       = NORMAL
2JPP 140–199    = ELEVATED
2JPP ≥200       = HIGH
```

bukan:

```text
2JPP 140–199 = PREDIABETES
```

kecuali pemeriksaannya memang **75-g OGTT**.

---

# 3. Gula Darah Sewaktu / Acak

Ini yang paling sering salah dibuat sebagai reference interval.

Labkesda Anda:

> `<180 mg/dL`

Saya **tidak menyarankan angka `<180` disebut sebagai nilai normal universal**.

Untuk **random plasma glucose**, ADA tidak memberikan kategori "normal/prediabetes" seperti GDP.

Yang memiliki makna diagnostik adalah:

> **≥200 mg/dL + gejala klasik hiperglikemia atau hyperglycemic crisis → diabetes diagnostic criterion.**

Gejala klasik mencakup antara lain poliuria, polidipsia, dan penurunan berat badan yang tidak dapat dijelaskan. ([Diabetes Journals][1])

Maka untuk AI:

|                   GDS/Gula Darah Acak | Interpretasi                                              |
| ------------------------------------: | --------------------------------------------------------- |
|                        **<140 mg/dL** | 🟢 Tidak menunjukkan hiperglikemia                        |
|                     **140–199 mg/dL** | 🟡 Elevated/random hyperglycemia                          |
| **≥200 mg/dL + gejala klasik/krisis** | 🔴 Diabetes diagnostic range                              |
|           **≥200 mg/dL tanpa gejala** | 🔴 High; **belum cukup sendiri untuk diagnosis diabetes** |

WHO juga menggunakan **random plasma glucose ≥200 mg/dL hanya bila terdapat gejala** sebagai kriteria diagnosis. ([Iris][3])

Jadi:

> **GDS 185 mg/dL**

→ **Elevated**, tetapi **tidak boleh langsung disebut diabetes**.

Sedangkan:

> **GDS 230 mg/dL + poliuria/polidipsia**

→ memenuhi **kriteria diagnostik diabetes**.

---

# 4. Asam Urat / Uric Acid

Nah, untuk **Uric Acid**, nilai Labkesda Anda:

> L: 3,5–7,2
> P: 2,6–6,0 mg/dL

sudah menunjukkan konsep yang benar yaitu **gender-dependent**, tetapi kalau Anda ingin analisis AI yang lebih rinci sampai anak-anak, kita bisa menggunakan interval berdasarkan **umur + gender**.

Mayo Clinic memberikan interval berikut. ([Mayo Clinic Laboratories][4])

## Laki-laki

| Umur       |                      Uric Acid |
| ---------- | -----------------------------: |
| <1 tahun   | **Reference belum ditetapkan** |
| 1–10 tahun |              **2,4–5,4 mg/dL** |
| 11 tahun   |                    **2,7–5,9** |
| 12 tahun   |                    **3,1–6,4** |
| 13 tahun   |                    **3,4–6,9** |
| 14 tahun   |                    **3,7–7,4** |
| 15 tahun   |                    **4,0–7,8** |
| ≥16 tahun  |                    **3,7–8,0** |

## Perempuan

| Umur       |                      Uric Acid |
| ---------- | -----------------------------: |
| <1 tahun   | **Reference belum ditetapkan** |
| 1 tahun    |              **2,1–4,9 mg/dL** |
| 2 tahun    |                    **2,1–5,0** |
| 3 tahun    |                    **2,2–5,1** |
| 4 tahun    |                    **2,3–5,2** |
| 5 tahun    |                    **2,3–5,3** |
| 6 tahun    |                    **2,3–5,4** |
| 7–8 tahun  |                    **2,3–5,5** |
| 9–10 tahun |                    **2,3–5,7** |
| 11 tahun   |                    **2,3–5,8** |
| 12 tahun   |                    **2,3–5,9** |
| ≥13 tahun  |                    **2,7–6,1** |

([Mayo Clinic Laboratories][4])

### Jadi saya sarankan:

Untuk **dewasa**, gunakan interval ini:

| Gender    | Umur      |           Rujukan |
| --------- | --------- | ----------------: |
| Laki-laki | ≥16 tahun | **3,7–8,0 mg/dL** |
| Perempuan | ≥13 tahun | **2,7–6,1 mg/dL** |

Ini berbeda dari nilai Labkesda Anda:

> L 3,5–7,2
> P 2,6–6,0

Karena **interval laboratorium lokal dan interval Mayo tidak harus identik**. Untuk AI yang Anda ingin jadikan standar analisis, saya akan menggunakan **satu sumber referensi secara konsisten**, bukan mencampur batas Labkesda dengan Mayo.

---

# 5. Tapi "Hyperuricemia" berbeda dengan "Reference Interval"

Ini sangat penting.

Mayo menyebut hyperuricemia paling umum didefinisikan sebagai:

- **Laki-laki >8,0 mg/dL**
- **Perempuan >6,1 mg/dL**

([Mayo Clinic Laboratories][4])

Artinya AI harus membedakan:

```text
Reference interval
        ≠
Hyperuricemia threshold
        ≠
Treatment target
```

Misalnya:

### Laki-laki

> Uric Acid = 7,5 mg/dL

Masih berada dalam reference interval Mayo:

> 3,7–8,0

Tetapi sudah cukup tinggi untuk mendapat perhatian klinis tergantung konteks.

### Laki-laki

> Uric Acid = 8,5 mg/dL

→ **Above reference interval / hyperuricemia range**

---

# 6. MASTER YANG SAYA SARANKAN UNTUK AI

Ini yang menurut saya paling bersih:

| Pemeriksaan            | Kondisi                    | Umur             | Gender | Interpretasi                                                                                        |
| ---------------------- | -------------------------- | ---------------- | ------ | --------------------------------------------------------------------------------------------------- |
| **Gula Darah Puasa**   | Puasa ≥8 jam               | Dewasa non-hamil | Semua  | <100 Normal; 100–125 Prediabetes/IFG; ≥126 Diabetes range                                           |
| **Gula Darah Sewaktu** | Kapan saja                 | Dewasa           | Semua  | <140 tidak menunjukkan hyperglycemia; 140–199 Elevated; ≥200 + gejala/krisis = diagnostic criterion |
| **Gula Darah 2JPP**    | 2 jam setelah makan        | Dewasa           | Semua  | <140 Normal/desirable; 140–199 Elevated; ≥200 High                                                  |
| **2-h OGTT**           | 2 jam setelah 75 g glukosa | Dewasa non-hamil | Semua  | <140 Normal; 140–199 IGT/Prediabetes; ≥200 Diabetes                                                 |
| **Uric Acid**          | Serum                      | 1–10 th          | L      | 2,4–5,4                                                                                             |
|                        |                            | 11 th            | L      | 2,7–5,9                                                                                             |
|                        |                            | 12 th            | L      | 3,1–6,4                                                                                             |
|                        |                            | 13 th            | L      | 3,4–6,9                                                                                             |
|                        |                            | 14 th            | L      | 3,7–7,4                                                                                             |
|                        |                            | 15 th            | L      | 4,0–7,8                                                                                             |
|                        |                            | ≥16 th           | L      | **3,7–8,0**                                                                                         |
|                        |                            | 1 th             | P      | 2,1–4,9                                                                                             |
|                        |                            | 2 th             | P      | 2,1–5,0                                                                                             |
|                        |                            | 3 th             | P      | 2,2–5,1                                                                                             |
|                        |                            | 4 th             | P      | 2,3–5,2                                                                                             |
|                        |                            | 5 th             | P      | 2,3–5,3                                                                                             |
|                        |                            | 6 th             | P      | 2,3–5,4                                                                                             |
|                        |                            | 7–8 th           | P      | 2,3–5,5                                                                                             |
|                        |                            | 9–10 th          | P      | 2,3–5,7                                                                                             |
|                        |                            | 11 th            | P      | 2,3–5,8                                                                                             |
|                        |                            | 12 th            | P      | 2,3–5,9                                                                                             |
|                        |                            | ≥13 th           | P      | **2,7–6,1**                                                                                         |

---

# 7. Contoh supaya AI tidak salah

### Kasus 1

**GDP 115 mg/dL**

→ **Prediabetes / IFG**

Bukan normal.

---

### Kasus 2

**GDP 130 mg/dL**

→ **Diabetes range**

Tetapi bila tidak ada hiperglikemia yang jelas, **perlu konfirmasi** sebelum menyatakan diagnosis definitif. ([Diabetes Journals][1])

---

### Kasus 3

**GDS 190 mg/dL**

→ **Elevated random glucose**

❌ Jangan langsung mengatakan diabetes.

---

### Kasus 4

**GDS 230 mg/dL + poliuria + polidipsia**

→ **Memenuhi kriteria diagnostik diabetes**

karena random plasma glucose ≥200 mg/dL disertai gejala klasik. ([Diabetes Journals][1])

---

### Kasus 5

**2JPP 150 mg/dL**

→ **Elevated postprandial glucose**

❌ Jangan otomatis menulis "prediabetes".

Karena **prediabetes 140–199 mg/dL** adalah kategori untuk **2-hour 75-g OGTT**, bukan sembarang pemeriksaan 2 jam setelah makan. ([Diabetes Journals][1])

---

### Kasus 6

**OGTT 2 jam = 150 mg/dL**

→ **Impaired Glucose Tolerance / Prediabetes**

Karena 140–199 mg/dL pada 75-g OGTT merupakan kriteria IGT. ([Diabetes Journals][1])

---

### Kasus 7

**Laki-laki 40 tahun, Uric Acid 7,5 mg/dL**

→ Reference interval: **3,7–8,0**

→ **Within reference interval**

---

### Kasus 8

**Perempuan 40 tahun, Uric Acid 7,5 mg/dL**

→ Reference interval: **2,7–6,1**

→ **High**

Nilai yang sama dapat menghasilkan interpretasi berbeda karena gender.

---

# 8. Jadi perubahan dari master Labkesda Anda

| Parameter          | Lama      | Saya sarankan                                                        |
| ------------------ | --------- | -------------------------------------------------------------------- |
| Gula Darah Sewaktu | `<180`    | Gunakan **<140 / 140–199 / ≥200 + gejala** untuk analisis            |
| Gula Darah Puasa   | `<120`    | **<100 normal / 100–125 prediabetes / ≥126 diabetes range**          |
| Gula Darah 2JPP    | `<140`    | **<140 normal / ≥140 elevated**; jangan samakan otomatis dengan OGTT |
| Uric Acid L        | 3,5–7,2   | **3,7–8,0** untuk ≥16 th                                             |
| Uric Acid P        | 2,6–6,0   | **2,7–6,1** untuk ≥13 th                                             |
| Uric Acid anak     | Belum ada | Tambahkan interval umur + gender                                     |

Dan saya sangat menyarankan **menambahkan parameter `OGTT 2 jam` secara terpisah** apabila suatu saat data tersebut masuk, karena:

> **Gula Darah 2JPP ≠ 2-hour OGTT**

Itu perbedaan yang sangat penting bagi AI agar tidak menghasilkan kesimpulan klinis yang salah. ADA 2026 secara eksplisit menggunakan **2-h plasma glucose ≥200 mg/dL setelah 75-g OGTT** sebagai kriteria diabetes dan **140–199 mg/dL** sebagai prediabetes/IGT. ([Diabetes Journals][1])

**Satu catatan:** angka `<180 mg/dL` yang ada di Labkesda sangat mungkin merupakan **batas operasional/interpretatif laboratorium**, tetapi tidak sebaiknya disebut sebagai "batas normal universal" untuk gula darah acak. Untuk model analisis, pemisahan antara **reference range** dan **diagnostic threshold** jauh lebih aman.

[1]: https://diabetesjournals.org/care/article/49/Supplement_1/S27/163926/2-Diagnosis-and-Classification-of-Diabetes?utm_source=chatgpt.com "2. Diagnosis and Classification of Diabetes: Standards of Care in Diabetes—2026 | Diabetes Care | American Diabetes Association"
[2]: https://diabetesjournals.org/care/article/24/4/775/23438/Postprandial-Blood-Glucose?utm_source=chatgpt.com "Postprandial Blood Glucose | Diabetes Care | American Diabetes Association"
[3]: https://iris.who.int/bitstream/handle/10665/331710/WHO-UCN-NCD-20.1-eng.pdf?utm_source=chatgpt.com "Diagnosis and Management"
[4]: https://www.mayocliniclabs.com/test-catalog/overview/8440?utm_source=chatgpt.com "URIC - Overview: Uric Acid, Serum"
