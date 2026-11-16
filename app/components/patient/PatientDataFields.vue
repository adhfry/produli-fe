<script setup lang="ts">
import type { PatientFormState } from '~/utils/patient-form'

// Isian data pasien lengkap seperti registrasi SiLAKES, dipakai bersama:
// - mode 'usulan': "Ajukan Update Data Pasien" (semua opsional, yang dikirim hanya yang berubah)
// - mode 'baru'  : pasien baru di pengiriman sampel (identitas inti wajib)
// Verifikasi NIK sama dengan SiLAKES: tanggal lahir & jenis kelamin dibaca dari NIK, isian yang
// tidak cocok ditandai dan butuh konfirmasi eksplisit sebelum dikirim.
const form = defineModel<PatientFormState>('form', { required: true })

const props = defineProps<{
  mode: 'usulan' | 'baru'
  errors?: Record<string, string[]>
  idPrefix: string
}>()

const wajib = computed(() => props.mode === 'baru')
const galat = (field: string) => props.errors?.[field]?.[0] ?? null
const id = (field: string) => `${props.idPrefix}-${field}`

// --- Wilayah kanonik (kecamatan & desa Sumenep) -------------------------------------------
const { kecamatanList, isLoadingKecamatan, isLoadingDesa, loadKecamatanList, loadDesaList } = useWilayahResolver()
const desaList = ref<{ nama: string }[]>([])
const kecamatanId = ref<number | null>(null)
const catatanWilayah = ref('')

const kecamatanItems = computed(() => kecamatanList.value.map((k) => ({ label: k.nama, value: k.id })))
const desaItems = computed(() => desaList.value.map((d) => ({ label: d.nama, value: d.nama })))

async function pilihKecamatan(idKecamatan: number | null, pertahankanDesa = false) {
  kecamatanId.value = idKecamatan
  form.value.kecamatan = kecamatanList.value.find((k) => k.id === idKecamatan)?.nama ?? ''
  if (!pertahankanDesa) form.value.kel_desa = ''
  desaList.value = idKecamatan !== null ? await loadDesaList(idKecamatan) : []
}

// Dipanggil induk saat form dibuka (nilai lama) atau setelah scan KTP (teks OCR).
async function setWilayahDariTeks(kecamatanRaw: string | null | undefined, desaRaw: string | null | undefined) {
  await loadKecamatanList()
  catatanWilayah.value = ''
  const kec = cocokkanNamaWilayah(kecamatanRaw, kecamatanList.value)
  if (!kec) {
    if (kecamatanRaw) catatanWilayah.value = `Kecamatan "${kecamatanRaw}" tidak ada di daftar wilayah Sumenep. Pilih manual bila pasien berdomisili di Sumenep.`
    return
  }
  await pilihKecamatan(kec.id, true)
  const desa = cocokkanNamaWilayah(desaRaw, desaList.value)
  form.value.kel_desa = desa?.nama ?? ''
  if (desaRaw && !desa) catatanWilayah.value = `Kel/desa "${desaRaw}" tidak ditemukan di Kecamatan ${kec.nama}. Pilih manual.`
}
defineExpose({ setWilayahDariTeks })
onMounted(loadKecamatanList)

// --- NIK -----------------------------------------------------------------------------------
const nikDigits = computed(() => onlyDigits(form.value.nik))
const nikInfo = computed(() => (nikDigits.value.length === 0 ? null : parseNik(nikDigits.value)))
const nikTeks = computed(() => {
  const info = nikInfo.value
  if (!info) return null
  if (nikDigits.value.length < 16) return { jenis: 'info', pesan: `${nikDigits.value.length} dari 16 digit` }
  if (!info.valid) return { jenis: 'galat', pesan: info.alasan ?? 'NIK tidak valid.' }
  const [y, m, d] = info.tglLahir!.split('-')
  return { jenis: 'ok', pesan: `Menurut NIK: lahir ${d}-${m}-${y}, ${info.gender === 'L' ? 'laki-laki' : 'perempuan'}.` }
})

watch(() => form.value.nik, (nilai) => {
  const digits = onlyDigits(nilai).slice(0, 16)
  if (digits !== nilai) form.value.nik = digits
  // Sama seperti SiLAKES: isi otomatis tanggal lahir & jenis kelamin bila masih kosong.
  const info = parseNik(digits)
  if (info.valid) {
    if (!form.value.tgl_lahir && info.tglLahir) form.value.tgl_lahir = info.tglLahir
    if (!form.value.gender && info.gender) form.value.gender = info.gender
  }
})

const beda = computed(() => nikMismatches(form.value.nik, form.value.tgl_lahir, form.value.gender))
const adaBeda = computed(() => Object.keys(beda.value).length > 0)
watch(adaBeda, (ada) => {
  if (!ada) form.value.konfirmasi_beda_nik = false
})

// --- Validasi langsung (sebelum dikirim) --------------------------------------------------
const phoneTeks = computed(() => phoneError(form.value.phone))
const bpjsTeks = computed(() => bpjsError(form.value.no_bpjs))
const fktpPerluNama = computed(() => form.value.fktp_pilihan === FKTP_DOKTER_PRIBADI || form.value.fktp_pilihan === FKTP_LAINNYA)
watch(() => form.value.fktp_pilihan, (baru, lama) => {
  if (lama !== undefined && baru !== lama) form.value.fktp_tambahan = ''
})

// Diikat ke variabel lokal: auto-import Nuxt berlaku di <script setup>, tidak dijamin di template.
const opsiStatusPerkawinan = STATUS_PERKAWINAN_OPTIONS
const opsiAgama = AGAMA_OPTIONS
const opsiGolonganDarah = GOLONGAN_DARAH_OPTIONS
const opsiJenisProlanis = JENIS_PROLANIS_OPTIONS
const opsiJenisPerokok = JENIS_PEROKOK_OPTIONS
const opsiFktp = FKTP_OPTIONS
const fktpDokterPribadi = FKTP_DOKTER_PRIBADI

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-700'
</script>

<template>
  <div class="space-y-6">
    <!-- Identitas: urutan sama dengan KTP supaya petugas tinggal membaca dari atas ke bawah -->
    <fieldset class="space-y-3">
      <legend class="mb-2 text-sm font-bold text-accent">Identitas sesuai KTP</legend>

      <div>
        <label :for="id('nik')" :class="labelClass">NIK<span v-if="wajib" class="text-danger-600"> *</span></label>
        <input
          :id="id('nik')"
          v-model="form.nik"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          maxlength="16"
          placeholder="16 digit angka"
          :aria-invalid="!!galat('nik') || nikTeks?.jenis === 'galat'"
          :aria-describedby="id('nik-info')"
          :class="[inputClass, 'tracking-wider']"
        />
        <p :id="id('nik-info')" class="mt-1 text-xs" :class="{
          'text-danger-700 font-semibold': galat('nik') || nikTeks?.jenis === 'galat',
          'text-secondary-700': !galat('nik') && nikTeks?.jenis === 'ok',
          'text-slate-500': !galat('nik') && (!nikTeks || nikTeks.jenis === 'info')
        }">
          {{ galat('nik') ?? nikTeks?.pesan ?? (mode === 'usulan' ? 'Kosongkan bila NIK tidak berubah.' : 'Ketik NIK, tanggal lahir dan jenis kelamin terisi otomatis.') }}
        </p>
      </div>

      <div>
        <label :for="id('name')" :class="labelClass">Nama lengkap<span v-if="wajib" class="text-danger-600"> *</span></label>
        <input :id="id('name')" v-model="form.name" type="text" autocomplete="off" :class="inputClass" :aria-invalid="!!galat('name')" />
        <p v-if="galat('name')" class="mt-1 text-xs font-semibold text-danger-700">{{ galat('name') }}</p>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label :for="id('tempat_lahir')" :class="labelClass">Tempat lahir<span v-if="wajib" class="text-danger-600"> *</span></label>
          <input :id="id('tempat_lahir')" v-model="form.tempat_lahir" type="text" autocomplete="off" :class="inputClass" />
          <p v-if="galat('tempat_lahir')" class="mt-1 text-xs font-semibold text-danger-700">{{ galat('tempat_lahir') }}</p>
        </div>
        <div>
          <label :for="id('tgl_lahir')" :class="labelClass">Tanggal lahir<span v-if="wajib" class="text-danger-600"> *</span></label>
          <input :id="id('tgl_lahir')" v-model="form.tgl_lahir" type="date" min="1900-01-01" :class="inputClass" :aria-invalid="!!galat('tgl_lahir') || !!beda.tgl_lahir" />
          <p v-if="galat('tgl_lahir') || beda.tgl_lahir" class="mt-1 text-xs font-semibold" :class="galat('tgl_lahir') ? 'text-danger-700' : 'text-warning-800'">
            {{ galat('tgl_lahir') ?? beda.tgl_lahir }}
          </p>
        </div>
      </div>

      <div>
        <span :id="id('gender-label')" :class="labelClass">Jenis kelamin<span v-if="wajib" class="text-danger-600"> *</span></span>
        <div role="radiogroup" :aria-labelledby="id('gender-label')" class="grid grid-cols-2 gap-2">
          <label
            v-for="opsi in [{ v: 'L', t: 'Laki-laki' }, { v: 'P', t: 'Perempuan' }]"
            :key="opsi.v"
            class="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold focus-within:ring-2 focus-within:ring-primary/30"
            :class="form.gender === opsi.v ? 'border-primary bg-primary-50 text-primary-800' : 'border-slate-300 bg-white text-slate-700'"
          >
            <input v-model="form.gender" type="radio" :name="id('gender')" :value="opsi.v" class="h-4 w-4 accent-primary" />
            {{ opsi.t }}
          </label>
        </div>
        <p v-if="galat('gender') || beda.gender" class="mt-1 text-xs font-semibold" :class="galat('gender') ? 'text-danger-700' : 'text-warning-800'">
          {{ galat('gender') ?? beda.gender }}
        </p>
      </div>

      <label v-if="adaBeda" class="flex items-start gap-2 rounded-xl border border-warning-300 bg-warning-50 p-3 text-sm text-warning-900">
        <input v-model="form.konfirmasi_beda_nik" type="checkbox" class="mt-0.5 h-4 w-4 accent-primary" />
        <span>Data di atas sudah saya cocokkan dengan KTP asli pasien dan memang berbeda dari kode NIK.</span>
      </label>
    </fieldset>

    <fieldset class="space-y-3">
      <legend class="mb-2 text-sm font-bold text-accent">Alamat</legend>
      <div>
        <label :for="id('alamat')" :class="labelClass">Alamat lengkap<span v-if="wajib" class="text-danger-600"> *</span></label>
        <textarea :id="id('alamat')" v-model="form.alamat" rows="2" placeholder="Jalan, dusun, nomor rumah" :class="[inputClass, 'resize-none']" />
        <p v-if="galat('alamat')" class="mt-1 text-xs font-semibold text-danger-700">{{ galat('alamat') }}</p>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label :for="id('rt_rw')" :class="labelClass">RT/RW</label>
          <input :id="id('rt_rw')" v-model="form.rt_rw" type="text" placeholder="002/003" :class="inputClass" />
        </div>
        <div>
          <label :for="id('kecamatan')" :class="labelClass">Kecamatan</label>
          <USelectMenu
            :id="id('kecamatan')"
            :model-value="kecamatanId ?? undefined"
            :items="kecamatanItems"
            value-key="value"
            :loading="isLoadingKecamatan"
            placeholder="Pilih kecamatan"
            class="w-full"
            @update:model-value="(v: number | null | undefined) => pilihKecamatan(v ?? null)"
          />
        </div>
        <div>
          <label :for="id('kel_desa')" :class="labelClass">Kel/desa</label>
          <USelectMenu
            :id="id('kel_desa')"
            v-model="form.kel_desa"
            :items="desaItems"
            value-key="value"
            :disabled="!kecamatanId"
            :loading="isLoadingDesa"
            :placeholder="kecamatanId ? 'Pilih kel/desa' : 'Pilih kecamatan dulu'"
            class="w-full"
          />
        </div>
      </div>
      <p v-if="catatanWilayah" class="text-xs font-semibold text-warning-800">{{ catatanWilayah }}</p>
    </fieldset>

    <fieldset class="space-y-3">
      <legend class="mb-2 text-sm font-bold text-accent">Kontak</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label :for="id('phone')" :class="labelClass">Nomor HP<span v-if="wajib" class="text-danger-600"> *</span></label>
          <input :id="id('phone')" v-model="form.phone" type="tel" inputmode="tel" placeholder="08xxxxxxxxxx" :class="inputClass" :aria-invalid="!!(galat('phone') || phoneTeks)" />
          <p v-if="galat('phone') || phoneTeks" class="mt-1 text-xs font-semibold text-danger-700">{{ galat('phone') ?? phoneTeks }}</p>
        </div>
        <div>
          <label :for="id('email')" :class="labelClass">Email</label>
          <input :id="id('email')" v-model="form.email" type="email" autocomplete="off" placeholder="nama@email.com" :class="inputClass" />
          <p v-if="galat('email')" class="mt-1 text-xs font-semibold text-danger-700">{{ galat('email') }}</p>
        </div>
      </div>
    </fieldset>

    <fieldset class="space-y-3">
      <legend class="mb-2 text-sm font-bold text-accent">Data lain</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label :for="id('pekerjaan')" :class="labelClass">Pekerjaan</label>
          <input :id="id('pekerjaan')" v-model="form.pekerjaan" type="text" placeholder="Sesuai KTP" :class="inputClass" />
        </div>
        <div>
          <label :for="id('status_perkawinan')" :class="labelClass">Status perkawinan</label>
          <select :id="id('status_perkawinan')" v-model="form.status_perkawinan" :class="inputClass">
            <option value="">Pilih</option>
            <option v-for="o in opsiStatusPerkawinan" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <div>
          <label :for="id('agama')" :class="labelClass">Agama</label>
          <select :id="id('agama')" v-model="form.agama" :class="inputClass">
            <option value="">Pilih</option>
            <option v-for="o in opsiAgama" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <div>
          <label :for="id('golongan_darah')" :class="labelClass">Golongan darah</label>
          <select :id="id('golongan_darah')" v-model="form.golongan_darah" :class="inputClass">
            <option value="">Pilih</option>
            <option v-for="g in opsiGolonganDarah" :key="g" :value="g">{{ g }}</option>
          </select>
        </div>
        <div>
          <label :for="id('jenis_prolanis')" :class="labelClass">Jenis Prolanis</label>
          <select :id="id('jenis_prolanis')" v-model="form.jenis_prolanis" :class="inputClass">
            <option value="">Pilih</option>
            <option v-for="o in opsiJenisProlanis" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <div v-if="mode === 'usulan'">
          <label :for="id('jenis_perokok')" :class="labelClass">Status merokok</label>
          <select :id="id('jenis_perokok')" v-model="form.jenis_perokok" :class="inputClass">
            <option value="">Pilih</option>
            <option v-for="o in opsiJenisPerokok" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <div>
          <label :for="id('fktp')" :class="labelClass">FKTP terdaftar</label>
          <select :id="id('fktp')" v-model="form.fktp_pilihan" :class="inputClass">
            <option value="">Pilih</option>
            <option v-for="o in opsiFktp" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <div v-if="fktpPerluNama">
          <label :for="id('fktp_tambahan')" :class="labelClass">{{ form.fktp_pilihan === fktpDokterPribadi ? 'Nama dokter' : 'Nama FKTP' }}</label>
          <input :id="id('fktp_tambahan')" v-model="form.fktp_tambahan" type="text" :class="inputClass" />
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label v-if="mode === 'usulan'" class="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700">
          <input v-model="form.is_bpjs" type="checkbox" class="h-4 w-4 accent-primary" />
          Peserta BPJS
        </label>
        <div v-if="mode === 'baru' || form.is_bpjs">
          <label :for="id('no_bpjs')" :class="labelClass">Nomor BPJS</label>
          <input :id="id('no_bpjs')" v-model="form.no_bpjs" type="text" inputmode="numeric" maxlength="13" placeholder="13 digit" :class="inputClass" />
          <p v-if="galat('no_bpjs') || bpjsTeks" class="mt-1 text-xs font-semibold text-danger-700">{{ galat('no_bpjs') ?? bpjsTeks }}</p>
        </div>
      </div>
    </fieldset>
  </div>
</template>
