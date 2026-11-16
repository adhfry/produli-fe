// Membaca tanggal lahir & jenis kelamin dari NIK, aturan SAMA dengan SiLAKES
// (FE_SiLAKES/src/utils/nik.ts) dan backend PRODULI (App\Support\NikParser), supaya peringatan
// di form sama persis dengan yang divalidasi server.
//
// NIK 16 digit = [6 kode wilayah][DDMMYY][4 urut]; DD + 40 untuk perempuan.
// Nomor register pasien SiLAKES diawali 1/2, NIK pengganti "NIK tidak diketahui" diawali 0:
// keduanya bukan NIK asli.

export interface ParsedNik {
  valid: boolean
  tglLahir?: string // YYYY-MM-DD
  gender?: 'L' | 'P'
  alasan?: string
}

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

export function parseNik(value: string | null | undefined, today: Date = new Date()): ParsedNik {
  const digits = onlyDigits(value)

  if (digits.length !== 16) return { valid: false, alasan: 'NIK harus 16 digit angka.' }
  if (digits[0] === '1' || digits[0] === '2') return { valid: false, alasan: 'Ini nomor registrasi pasien, bukan NIK KTP.' }
  if (digits[0] === '0') return { valid: false, alasan: 'NIK tidak boleh diawali 0. Periksa kembali KTP pasien.' }

  let day = Number.parseInt(digits.slice(6, 8), 10)
  const month = Number.parseInt(digits.slice(8, 10), 10)
  const yy = Number.parseInt(digits.slice(10, 12), 10)

  let gender: 'L' | 'P' = 'L'
  if (day > 40) {
    gender = 'P'
    day -= 40
  }

  const year = (yy <= today.getFullYear() % 100 ? 2000 : 1900) + yy
  const date = new Date(Date.UTC(year, month - 1, day))
  if (month < 1 || month > 12 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { valid: false, alasan: 'Tanggal lahir di dalam NIK tidak masuk akal. Periksa kembali KTP pasien.' }
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  return { valid: true, tglLahir: `${year}-${pad(month)}-${pad(day)}`, gender }
}

// Ketidakcocokan NIK dengan tanggal lahir / jenis kelamin. Tahun dibandingkan 2 digit terakhir
// saja (abad tidak tertulis di NIK), sama seperti SiLAKES.
export function nikMismatches(
  nik: string | null | undefined,
  tglLahir: string | null | undefined,
  gender: string | null | undefined
): Partial<Record<'tgl_lahir' | 'gender', string>> {
  const parsed = parseNik(nik)
  if (!parsed.valid || !parsed.tglLahir) return {}

  const hasil: Partial<Record<'tgl_lahir' | 'gender', string>> = {}
  const [y, m, d] = parsed.tglLahir.split('-')

  if (tglLahir && /^\d{4}-\d{2}-\d{2}$/.test(tglLahir)) {
    const [ty, tm, td] = tglLahir.split('-')
    if (td !== d || tm !== m || ty!.slice(2) !== y!.slice(2)) {
      hasil.tgl_lahir = `Tanggal lahir tidak sama dengan NIK (NIK menunjukkan ${d}-${m}-..${y!.slice(2)}).`
    }
  }

  if (gender && gender !== parsed.gender) {
    hasil.gender = `Jenis kelamin tidak sama dengan NIK (NIK menunjukkan ${parsed.gender === 'L' ? 'laki-laki' : 'perempuan'}).`
  }

  return hasil
}
