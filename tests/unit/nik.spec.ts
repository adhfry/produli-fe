import { describe, expect, it } from 'vitest'
import { nikMismatches, parseNik } from '../../app/utils/nik'
import { normalizeAgama, normalizeStatusPerkawinan, phoneError } from '../../app/utils/patient-form'

const today = new Date('2026-11-16T00:00:00Z')

describe('parseNik (aturan sama dengan SiLAKES)', () => {
  it('membaca tanggal lahir dan jenis kelamin laki-laki', () => {
    expect(parseNik('3529010101800001', today)).toEqual({ valid: true, tglLahir: '1980-01-01', gender: 'L' })
  })

  it('perempuan: tanggal ditambah 40', () => {
    expect(parseNik('3529014501650002', today)).toEqual({ valid: true, tglLahir: '1965-01-05', gender: 'P' })
  })

  it('tahun 2 digit <= tahun berjalan dianggap 2000-an', () => {
    expect(parseNik('3529010101200001', today).tglLahir).toBe('2020-01-01')
  })

  it('menolak NIK pengganti 0000, nomor registrasi, panjang salah, dan tanggal mustahil', () => {
    expect(parseNik('0000000000000123', today).valid).toBe(false)
    expect(parseNik('1010126000000123', today).valid).toBe(false)
    expect(parseNik('35290101', today).valid).toBe(false)
    expect(parseNik('3529013102800001', today).valid).toBe(false) // 31 Februari
  })
})

describe('nikMismatches', () => {
  it('kosong bila cocok', () => {
    expect(nikMismatches('3529014501650002', '1965-01-05', 'P')).toEqual({})
  })

  it('menandai tanggal lahir dan jenis kelamin yang berbeda', () => {
    const hasil = nikMismatches('3529014501650002', '1970-05-05', 'L')
    expect(hasil.tgl_lahir).toContain('05-01-..65')
    expect(hasil.gender).toContain('perempuan')
  })

  it('tidak membandingkan bila NIK tidak valid', () => {
    expect(nikMismatches('0000000000000123', '1970-05-05', 'L')).toEqual({})
  })
})

describe('aturan isian lain', () => {
  it('nomor HP Indonesia', () => {
    expect(phoneError('0812-3456-7890')).toBeNull()
    expect(phoneError('+6281234567890')).toBeNull()
    expect(phoneError('12345')).not.toBeNull()
    expect(phoneError('')).toBeNull()
  })

  it('normalisasi hasil OCR', () => {
    expect(normalizeStatusPerkawinan('CERAI HIDUP')).toBe('CERAI HIDUP')
    expect(normalizeStatusPerkawinan('BELUM KAWIN')).toBe('BELUM KAWIN')
    expect(normalizeAgama('BUDDHA')).toBe('BUDHA')
    expect(normalizeAgama('islam')).toBe('ISLAM')
    expect(normalizeAgama('LAINNYA')).toBe('')
  })
})

describe('isi form dari hasil scan KTP', () => {
  it('hanya menimpa isian yang terbaca, menormalkan agama & status', async () => {
    const { applyKtpFields, emptyPatientForm } = await import('../../app/utils/patient-form')
    const form = emptyPatientForm()
    form.phone = '081234567890'
    applyKtpFields(form, {
      nik: '3529014501650002', name: 'SITI AMINAH', tgl_lahir: '1965-01-05', gender: 'P',
      agama: 'BUDDHA', status_perkawinan: 'CERAI MATI', golongan_darah: 'X', alamat: null
    })
    expect(form.nik).toBe('3529014501650002')
    expect(form.agama).toBe('BUDHA')
    expect(form.status_perkawinan).toBe('CERAI MATI')
    expect(form.golongan_darah).toBe('')
    expect(form.phone).toBe('081234567890')
    expect(form.alamat).toBe('')
  })

  it('mencocokkan nama wilayah OCR ke daftar kanonik', async () => {
    const { cocokkanNamaWilayah } = await import('../../app/utils/patient-form')
    const daftar = [{ nama: 'Kota Sumenep' }, { nama: 'Batang-Batang' }]
    expect(cocokkanNamaWilayah('KEC. KOTA SUMENEP', daftar)?.nama).toBe('Kota Sumenep')
    expect(cocokkanNamaWilayah('BATANG BATANG', daftar)?.nama).toBe('Batang-Batang')
    expect(cocokkanNamaWilayah('PAMEKASAN', daftar)).toBeNull()
  })
})
