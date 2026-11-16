// Pilihan & aturan isian data pasien, disamakan dengan SiLAKES (registrasi pasien) dan backend
// PRODULI (App\Support\PatientFormRules), dipakai form "Ajukan Update Data Pasien" dan form pasien
// baru di pengiriman sampel.

export const STATUS_PERKAWINAN_OPTIONS = [
  { value: 'BELUM KAWIN', label: 'Belum Kawin' },
  { value: 'KAWIN', label: 'Kawin' },
  { value: 'CERAI HIDUP', label: 'Cerai Hidup' },
  { value: 'CERAI MATI', label: 'Cerai Mati' }
] as const

export const AGAMA_OPTIONS = [
  { value: 'ISLAM', label: 'Islam' },
  { value: 'KRISTEN', label: 'Kristen' },
  { value: 'KATOLIK', label: 'Katolik' },
  { value: 'HINDU', label: 'Hindu' },
  { value: 'BUDHA', label: 'Budha' },
  { value: 'KONGHUCU', label: 'Konghucu' }
] as const

export const GOLONGAN_DARAH_OPTIONS = ['A', 'B', 'AB', 'O'] as const

export const JENIS_PROLANIS_OPTIONS = [
  { value: 'DM', label: 'Diabetes Melitus (DM)' },
  { value: 'HT', label: 'Hipertensi (HT)' },
  { value: 'DM_HT', label: 'DM & Hipertensi' }
] as const

export const JENIS_PEROKOK_OPTIONS = [
  { value: 'AKTIF', label: 'Aktif merokok' },
  { value: 'PASIF', label: 'Pasif / tidak merokok' }
] as const

// Nomor HP Indonesia: 08..., 628..., +628..., panjang total 10-15 (batas kolom SiLAKES 15).
const PHONE_REGEX = /^(\+62|62|0)8\d{7,11}$/

export function normalizePhone(value: string | null | undefined): string {
  return (value ?? '').replace(/[\s\-().]/g, '')
}

export function phoneError(value: string | null | undefined): string | null {
  const phone = normalizePhone(value)
  if (phone === '') return null
  return PHONE_REGEX.test(phone) ? null : 'Nomor HP harus nomor Indonesia yang diawali 08, contoh 081234567890.'
}

export function bpjsError(value: string | null | undefined): string | null {
  const bpjs = (value ?? '').trim()
  if (bpjs === '') return null
  return /^\d{13}$/.test(bpjs) ? null : 'Nomor BPJS harus 13 digit angka.'
}

// Status perkawinan hasil OCR KTP ("CERAI HIDUP", "BELUM KAWIN", ...) ke nilai baku.
export function normalizeStatusPerkawinan(raw: string | null | undefined): string {
  const text = (raw ?? '').toUpperCase().trim()
  if (text.includes('HIDUP')) return 'CERAI HIDUP'
  if (text.includes('MATI')) return 'CERAI MATI'
  if (text.includes('BELUM')) return 'BELUM KAWIN'
  if (text.includes('KAWIN')) return 'KAWIN'
  return ''
}

// Agama hasil OCR ke nilai baku (KTP lama kadang menulis "BUDDHA"/"KHONGHUCU").
export function normalizeAgama(raw: string | null | undefined): string {
  const text = (raw ?? '').toUpperCase().trim()
  if (text.startsWith('BUD')) return 'BUDHA'
  if (text.includes('HUCU')) return 'KONGHUCU'
  return AGAMA_OPTIONS.some((a) => a.value === text) ? text : ''
}

// FKTP: daftar & format nilai SAMA dengan SiLAKES (FE_SiLAKES/src/data/fktpOptions.ts), supaya
// kolom patients.fktp di SiLAKES berisi nilai yang dikenali form SiLAKES juga.
export const FKTP_PUSKESMAS = [
  'Puskesmas Ambunten',
  'Puskesmas Arjasa',
  'Puskesmas Batang-Batang',
  'Puskesmas Batuan',
  'Puskesmas Batuputih',
  'Puskesmas Bluto',
  'Puskesmas Dasuk',
  'Puskesmas Dungkek',
  'Puskesmas Ganding',
  'Puskesmas Gapura',
  'Puskesmas Gayam',
  'Puskesmas Giliginting',
  'Puskesmas Guluk-Guluk',
  'Puskesmas Kalianget',
  'Puskesmas Kangayan',
  'Puskesmas Legung',
  'Puskesmas Lenteng',
  'Puskesmas Manding',
  'Puskesmas Masalembu',
  'Puskesmas Moncek Tengah',
  'Puskesmas Nonggunong',
  'Puskesmas Pagerungan Besar',
  'Puskesmas Pamolokan',
  'Puskesmas Pandian',
  'Puskesmas Pasongsongan',
  'Puskesmas Pragaan',
  "Puskesmas Ra'as",
  'Puskesmas Rubaru',
  'Puskesmas Sapeken',
  'Puskesmas Saronggi',
  'Puskesmas Talango'
] as const

export const FKTP_TIDAK_ADA = 'TIDAK ADA'
export const FKTP_DOKTER_PRIBADI = '__dokter_pribadi__'
export const FKTP_LAINNYA = '__lainnya__'

export const FKTP_OPTIONS = [
  ...FKTP_PUSKESMAS.map((nama) => ({ value: nama as string, label: nama as string })),
  { value: FKTP_TIDAK_ADA, label: 'Tidak ada' },
  { value: FKTP_DOKTER_PRIBADI, label: 'Dokter pribadi' },
  { value: FKTP_LAINNYA, label: 'Lainnya' }
]

export function parseFktpValue(raw: string | null | undefined): { pilihan: string, namaTambahan: string } {
  if (!raw) return { pilihan: '', namaTambahan: '' }
  const dokterPrefix = 'Dokter Pribadi - '
  if (raw.startsWith(dokterPrefix)) return { pilihan: FKTP_DOKTER_PRIBADI, namaTambahan: raw.slice(dokterPrefix.length) }
  if (raw === 'Dokter Pribadi') return { pilihan: FKTP_DOKTER_PRIBADI, namaTambahan: '' }
  if (raw === FKTP_TIDAK_ADA) return { pilihan: FKTP_TIDAK_ADA, namaTambahan: '' }
  if ((FKTP_PUSKESMAS as readonly string[]).includes(raw)) return { pilihan: raw, namaTambahan: '' }
  return { pilihan: FKTP_LAINNYA, namaTambahan: raw }
}

export function buildFktpValue(pilihan: string, namaTambahan: string): string {
  const nama = namaTambahan.trim()
  if (pilihan === FKTP_DOKTER_PRIBADI) return nama ? `Dokter Pribadi - ${nama}` : 'Dokter Pribadi'
  if (pilihan === FKTP_LAINNYA) return nama
  return pilihan
}

// State form data pasien bersama ("Ajukan Update Data Pasien" & pasien baru pengiriman sampel).
// Semua string ('' = belum diisi) supaya v-model input HTML tidak perlu konversi null.
export interface PatientFormState {
  nik: string
  name: string
  tempat_lahir: string
  tgl_lahir: string
  gender: '' | 'L' | 'P'
  alamat: string
  rt_rw: string
  kecamatan: string
  kel_desa: string
  phone: string
  email: string
  pekerjaan: string
  status_perkawinan: string
  golongan_darah: string
  agama: string
  jenis_prolanis: string
  jenis_perokok: string
  is_bpjs: boolean
  no_bpjs: string
  fktp_pilihan: string
  fktp_tambahan: string
  konfirmasi_beda_nik: boolean
}

export function emptyPatientForm(): PatientFormState {
  return {
    nik: '', name: '', tempat_lahir: '', tgl_lahir: '', gender: '',
    alamat: '', rt_rw: '', kecamatan: '', kel_desa: '', phone: '', email: '',
    pekerjaan: '', status_perkawinan: '', golongan_darah: '', agama: '',
    jenis_prolanis: '', jenis_perokok: '', is_bpjs: false, no_bpjs: '',
    fktp_pilihan: '', fktp_tambahan: '', konfirmasi_beda_nik: false
  }
}

// Isi form dari hasil scan KTP. Hanya isian yang terbaca yang ditimpa; sisanya dibiarkan.
// Kecamatan/desa TIDAK diisi di sini (harus dicocokkan ke daftar kanonik oleh komponen form).
export function applyKtpFields(form: PatientFormState, f: {
  nik?: string | null, name?: string | null, tempat_lahir?: string | null, tgl_lahir?: string | null,
  gender?: 'L' | 'P' | null, alamat?: string | null, rt_rw?: string | null, agama?: string | null,
  status_perkawinan?: string | null, pekerjaan?: string | null, golongan_darah?: string | null
}): void {
  if (f.nik) form.nik = f.nik
  if (f.name) form.name = f.name
  if (f.tempat_lahir) form.tempat_lahir = f.tempat_lahir
  if (f.tgl_lahir && /^\d{4}-\d{2}-\d{2}$/.test(f.tgl_lahir)) form.tgl_lahir = f.tgl_lahir
  if (f.gender === 'L' || f.gender === 'P') form.gender = f.gender
  if (f.alamat) form.alamat = f.alamat
  if (f.rt_rw) form.rt_rw = f.rt_rw
  const agama = normalizeAgama(f.agama)
  if (agama) form.agama = agama
  const status = normalizeStatusPerkawinan(f.status_perkawinan)
  if (status) form.status_perkawinan = status
  if (f.pekerjaan) form.pekerjaan = f.pekerjaan
  if (f.golongan_darah && (GOLONGAN_DARAH_OPTIONS as readonly string[]).includes(f.golongan_darah)) form.golongan_darah = f.golongan_darah
}

// Cocokkan nama wilayah hasil OCR ("KEC. KOTA SUMENEP", "DS. PAJAGALAN") ke daftar kanonik.
export function cocokkanNamaWilayah<T extends { nama: string }>(raw: string | null | undefined, daftar: T[]): T | null {
  const bersih = (s: string) => s.toUpperCase().replace(/^(KEC(AMATAN)?|KEL(URAHAN)?|DS|DESA)\.?\s+/, '').replace(/[^A-Z0-9]/g, '')
  const target = bersih(raw ?? '')
  if (target === '') return null
  return daftar.find((item) => bersih(item.nama) === target) ?? null
}

// Label kolom untuk riwayat usulan (field_name dari SiLAKES).
export const PATIENT_FIELD_LABELS: Record<string, string> = {
  nik: 'NIK', name: 'Nama', tempat_lahir: 'Tempat lahir', tgl_lahir: 'Tanggal lahir', gender: 'Jenis kelamin',
  alamat: 'Alamat', rt_rw: 'RT/RW', kecamatan: 'Kecamatan', kel_desa: 'Kel/desa', phone: 'Nomor HP', email: 'Email',
  pekerjaan: 'Pekerjaan', status_perkawinan: 'Status perkawinan', golongan_darah: 'Golongan darah', agama: 'Agama',
  is_bpjs: 'Peserta BPJS', no_bpjs: 'Nomor BPJS', fktp: 'FKTP', jenis_prolanis: 'Jenis Prolanis',
  jenis_perokok: 'Status merokok', foto_ktp: 'Foto KTP'
}
