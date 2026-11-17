<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type { PatientFormState } from '~/utils/patient-form'
import type { AddPasienBaruPayload, ApiSuccessEnvelope, KtpScanResult, PatientSearchItem, PengantarSampel, PengirimanSampel, PengirimanSampelPasien } from '~/types/api'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const route = useRoute()
const batchId = computed(() => Number(route.params.id))

useHead({
  title: 'Susun Antrian Pengiriman Sampel'
})

const batch = ref<PengirimanSampel | null>(null)
const isLoading = ref(false)
const loadError = ref('')
const orderedPasien = ref<PengirimanSampelPasien[]>([])

const isDraft = computed(() => batch.value?.status === 'draft')
const isTerkunci = computed(() => batch.value?.status === 'terkunci')

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draf',
  terkunci: 'Terkunci',
  ditugaskan: 'Ditugaskan',
  otw: 'OTW ke Labkesda',
  tiba_labkesda: 'Tiba di Labkesda',
  dikonfirmasi_labkesda: 'Dikonfirmasi Labkesda',
  dibatalkan: 'Dibatalkan'
}

// diam = penyegaran latar (setelah menambah pasien, realtime, cek berkala): daftar tetap terlihat.
async function loadBatch(diam = false) {
  if (!diam) isLoading.value = true
  loadError.value = ''
  try {
    const api = useApi()
    const res = await api(`/pengiriman-sampel/${batchId.value}`) as ApiSuccessEnvelope<PengirimanSampel>
    batch.value = res.data
    orderedPasien.value = [...(res.data.pasien ?? [])].sort((a, b) => a.urutan - b.urutan)
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Gagal memuat antrian.'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => loadBatch())

// --- Kunci / Edit / Batalkan ---
const isTransitioning = ref(false)
const transitionError = ref('')

async function lockBatch() {
  isTransitioning.value = true
  transitionError.value = ''
  try {
    const api = useApi()
    await api(`/pengiriman-sampel/${batchId.value}/lock`, { method: 'POST' })
    await loadBatch()
    useToast().add({ title: 'Daftar antrian berhasil dikunci', color: 'success' })
  } catch (e) {
    transitionError.value = e instanceof ApiError ? e.message : 'Gagal mengunci antrian.'
  } finally {
    isTransitioning.value = false
  }
}

async function unlockBatch() {
  isTransitioning.value = true
  transitionError.value = ''
  try {
    const api = useApi()
    await api(`/pengiriman-sampel/${batchId.value}/unlock`, { method: 'POST' })
    await loadBatch()
  } catch (e) {
    transitionError.value = e instanceof ApiError ? e.message : 'Gagal membuka kunci antrian.'
  } finally {
    isTransitioning.value = false
  }
}

const showCancelConfirm = ref(false)

async function confirmCancelBatch() {
  isTransitioning.value = true
  transitionError.value = ''
  try {
    const api = useApi()
    await api(`/pengiriman-sampel/${batchId.value}/cancel`, { method: 'POST' })
    showCancelConfirm.value = false
    await loadBatch()
    useToast().add({ title: 'Antrian dibatalkan', color: 'success' })
  } catch (e) {
    transitionError.value = e instanceof ApiError ? e.message : 'Gagal membatalkan antrian.'
  } finally {
    isTransitioning.value = false
  }
}

// --- Tugaskan Pengantar (Fase C) ---
const showAssignModal = ref(false)
const courierOptions = ref<PengantarSampel[]>([])
const isLoadingCouriers = ref(false)
const selectedCourierId = ref<number | null>(null)
const isAssigning = ref(false)
const assignError = ref('')

async function openAssignModal() {
  showAssignModal.value = true
  selectedCourierId.value = null
  assignError.value = ''
  isLoadingCouriers.value = true
  try {
    const api = useApi()
    courierOptions.value = await fetchAllPages((page) => api('/pengantar-sampel', { query: { status_aktif: true, per_page: 100, page } }))
  } catch (e) {
    assignError.value = e instanceof ApiError ? e.message : 'Gagal memuat daftar pengantar sampel.'
  } finally {
    isLoadingCouriers.value = false
  }
}

async function assignCourier() {
  if (!selectedCourierId.value) return
  isAssigning.value = true
  assignError.value = ''
  try {
    const api = useApi()
    await api(`/pengiriman-sampel/${batchId.value}/assign-courier`, {
      method: 'POST',
      body: { pengantar_sampel_id: selectedCourierId.value }
    })
    showAssignModal.value = false
    await loadBatch()
    useToast().add({ title: 'Pengantar sampel berhasil ditugaskan', color: 'success' })
  } catch (e) {
    assignError.value = e instanceof ApiError ? e.message : 'Gagal menugaskan pengantar sampel.'
  } finally {
    isAssigning.value = false
  }
}

// --- Cetak PDF ---
const isPrinting = ref(false)

async function printBatch() {
  isPrinting.value = true
  try {
    const api = useApi()
    const blob = await api(`/pengiriman-sampel/${batchId.value}/export-pdf`) as Blob
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `antrian-sampel-${batchId.value}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (e) {
    useToast().add({ title: 'Gagal mencetak daftar antrian', color: 'error' })
  } finally {
    isPrinting.value = false
  }
}

// --- Tambah pasien ke antrian: cari sambil mengetik, atau daftarkan pasien baru ---
// Revisi 2026-11-17: satu dialog, dua mode. Mode "cari": ketik nama/NIK/no. BPJS, muncul maks 10
// kartu kandidat (GET /pengiriman-sampel/patient-search). Bila tidak ketemu, dialog menawarkan
// "Daftarkan pasien baru" dan pindah ke mode "daftar" (isian lengkap + scan KTP) yang bisa kembali
// ke mode cari kapan saja. Pasien baru langsung didaftarkan ke Labkesda (RegisterPasienBaruToSilakesJob);
// hasil verifikasinya muncul di baris antrian tanpa memuat ulang halaman.
type ModeTambah = 'cari' | 'daftar'

const showTambahModal = ref(false)
const modeTambah = ref<ModeTambah>('cari')
const kataKunci = ref('')
const hasilCari = ref<PatientSearchItem[]>([])
const kataKunciTerakhir = ref('')
const isMencari = ref(false)
const cariError = ref('')
const menambahkanId = ref<number | null>(null)
const tambahError = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)

const pencarianTerlaluPendek = computed(() => {
  const q = kataKunci.value.trim()
  const angka = q.replace(/[\s.-]/g, '')
  return /^\d+$/.test(angka) ? angka.length < 4 : q.length < 2
})
const tidakDitemukan = computed(() =>
  !isMencari.value && !cariError.value && !pencarianTerlaluPendek.value
  && kataKunciTerakhir.value === kataKunci.value.trim() && hasilCari.value.length === 0
)

let nomorPencarian = 0
async function cariPasien() {
  const q = kataKunci.value.trim()
  cariError.value = ''
  if (pencarianTerlaluPendek.value) {
    hasilCari.value = []
    kataKunciTerakhir.value = q
    return
  }
  const nomor = ++nomorPencarian
  isMencari.value = true
  try {
    const res = await useApi()('/pengiriman-sampel/patient-search', { query: { q, batch_id: batchId.value } }) as ApiSuccessEnvelope<{ items: PatientSearchItem[] }>
    // Ketikan berikutnya sudah mengirim pencarian baru: hasil lama dibuang supaya kartu tidak "lompat".
    if (nomor !== nomorPencarian) return
    hasilCari.value = res.data.items
    kataKunciTerakhir.value = q
  } catch (e) {
    if (nomor !== nomorPencarian) return
    cariError.value = e instanceof ApiError ? e.message : 'Pencarian gagal. Periksa koneksi lalu coba lagi.'
  } finally {
    if (nomor === nomorPencarian) isMencari.value = false
  }
}
const cariPasienTertunda = useDebounceFn(cariPasien, 300)
watch(kataKunci, () => {
  if (showTambahModal.value && modeTambah.value === 'cari') cariPasienTertunda()
})

async function openTambahModal() {
  modeTambah.value = 'cari'
  kataKunci.value = ''
  hasilCari.value = []
  kataKunciTerakhir.value = ''
  cariError.value = ''
  tambahError.value = ''
  showTambahModal.value = true
  await nextTick()
  searchInputRef.value?.focus()
}

function closeTambahModal() {
  if (isSavingNewPatient.value || menambahkanId.value !== null) return
  showTambahModal.value = false
}

// Escape menutup dialog hanya di mode cari: di mode daftar isian panjang bisa hilang karena
// satu tombol tak sengaja, jadi keluar dari sana lewat tombol yang jelas.
onKeyStroke('Escape', () => {
  if (showTambahModal.value && modeTambah.value === 'cari') closeTambahModal()
})

async function tambahkanKandidat(p: PatientSearchItem) {
  if (p.sudah_di_antrian) return
  menambahkanId.value = p.external_patient_id
  tambahError.value = ''
  try {
    await useApi()(`/pengiriman-sampel/${batchId.value}/pasien`, { method: 'POST', body: { external_patient_id: p.external_patient_id } })
    p.sudah_di_antrian = true
    await loadBatch(true)
    useToast().add({ title: `${p.nama} masuk antrian nomor ${orderedPasien.value.length}`, color: 'success' })
    // Langsung siap untuk pasien berikutnya (urutan tambah = urutan antrian).
    kataKunci.value = ''
    hasilCari.value = []
    kataKunciTerakhir.value = ''
    await nextTick()
    searchInputRef.value?.focus()
  } catch (e) {
    tambahError.value = e instanceof ApiError ? e.message : 'Gagal menambahkan pasien.'
  } finally {
    menambahkanId.value = null
  }
}

// --- Mode daftar: pasien baru (isian lengkap + scan KTP, aturan sama dengan backend
// AddPatientToPengirimanSampelRequest) ---
const isSavingNewPatient = ref(false)
const newPatientError = ref('')
const newPatientFieldErrors = ref<Record<string, string[]>>({})
const newPatientForm = ref<PatientFormState>(emptyPatientForm())
const newPatientKtpScanId = ref<number | null>(null)
const newPatientSudahTerdaftar = ref(false)
const newPatientFieldsRef = ref<{ setWilayahDariTeks: (kec: string | null | undefined, desa: string | null | undefined) => Promise<void> } | null>(null)

// FKTP terdaftar pasien baru = puskesmas pengirim batch ini (permintaan user 2026-11-17).
// Backend (PengirimanSampelService::addPatient) memaksa nilai yang sama.
const fktpPengirimBatch = computed(() => batch.value?.puskesmas?.nama?.trim() || null)

// Kata kunci yang tidak ketemu dibawa ke form: 16 digit = NIK, 13 digit = no. BPJS, teks = nama.
function formPasienBaruDari(q: string): PatientFormState {
  const f = emptyPatientForm()
  if (fktpPengirimBatch.value) f.fktp_pilihan = fktpPengirimBatch.value
  const angka = q.replace(/[\s.-]/g, '')
  if (/^\d{16}$/.test(angka)) f.nik = angka
  else if (/^\d{13}$/.test(angka)) {
    f.no_bpjs = angka
    f.is_bpjs = true
  } else if (!/^\d+$/.test(angka)) f.name = q.trim()
  return f
}

function keModeDaftar() {
  newPatientForm.value = formPasienBaruDari(kataKunci.value)
  newPatientKtpScanId.value = null
  newPatientSudahTerdaftar.value = false
  newPatientError.value = ''
  newPatientFieldErrors.value = {}
  modeTambah.value = 'daftar'
}

async function keModeCari() {
  if (isSavingNewPatient.value) return
  modeTambah.value = 'cari'
  await nextTick()
  searchInputRef.value?.focus()
}

async function onNewPatientKtpScanned(result: KtpScanResult) {
  newPatientKtpScanId.value = result.id
  newPatientSudahTerdaftar.value = result.existing_patient_id !== null
  if (!result.fields) return
  applyKtpFields(newPatientForm.value, result.fields)
  if (result.fields.kecamatan || result.fields.kel_desa) {
    await newPatientFieldsRef.value?.setWilayahDariTeks(result.fields.kecamatan, result.fields.kel_desa)
  }
}

function onNewPatientKtpRemoved() {
  newPatientKtpScanId.value = null
  newPatientSudahTerdaftar.value = false
}

// Pasien di KTP ternyata sudah terdaftar: kembali ke mode cari dengan NIK-nya.
async function cariPasienDariKtp() {
  const nik = newPatientForm.value.nik
  await keModeCari()
  kataKunci.value = nik
}

// Cek di browser dulu supaya petugas langsung tahu isian mana yang kurang, tanpa bolak-balik
// ke server. Server tetap memvalidasi ulang dengan aturan yang sama.
function periksaPasienBaru(): Record<string, string[]> {
  const f = newPatientForm.value
  const galat: Record<string, string[]> = {}
  const wajib: Array<[keyof PatientFormState, string]> = [
    ['nik', 'NIK wajib diisi.'], ['name', 'Nama wajib diisi.'], ['tempat_lahir', 'Tempat lahir wajib diisi.'],
    ['tgl_lahir', 'Tanggal lahir wajib diisi.'], ['gender', 'Pilih jenis kelamin.'], ['phone', 'Nomor HP wajib diisi.'],
    ['alamat', 'Alamat wajib diisi.']
  ]
  for (const [key, pesan] of wajib) {
    if (String(f[key] ?? '').trim() === '') galat[key] = [pesan]
  }
  if (!galat.nik) {
    const nik = parseNik(f.nik)
    if (!nik.valid) galat.nik = [nik.alasan ?? 'NIK tidak valid.']
  }
  if (!galat.phone && phoneError(f.phone)) galat.phone = [phoneError(f.phone)!]
  if (bpjsError(f.no_bpjs)) galat.no_bpjs = [bpjsError(f.no_bpjs)!]
  if (f.name.trim() !== '' && f.name.trim().length < 3) galat.name = ['Nama minimal 3 huruf.']
  return galat
}

async function saveNewPatient() {
  newPatientError.value = ''
  const f = newPatientForm.value
  const galatLokal = periksaPasienBaru()
  newPatientFieldErrors.value = galatLokal
  if (Object.keys(galatLokal).length > 0) {
    newPatientError.value = 'Ada isian yang perlu dilengkapi, lihat pesan merah di form.'
    return
  }
  if (newPatientSudahTerdaftar.value) {
    newPatientError.value = 'NIK ini sudah terdaftar. Kembali ke cari pasien, lalu tambahkan pasien tersebut.'
    return
  }
  if (Object.keys(nikMismatches(f.nik, f.tgl_lahir, f.gender)).length > 0 && !f.konfirmasi_beda_nik) {
    newPatientError.value = 'Tanggal lahir atau jenis kelamin tidak sama dengan NIK. Periksa KTP, lalu centang konfirmasi bila memang begitu.'
    return
  }

  const kosongJadiNull = (v: string) => (v.trim() === '' ? null : v.trim())
  const payload: AddPasienBaruPayload = {
    name: f.name.trim(),
    nik: f.nik,
    gender: f.gender as 'L' | 'P',
    tempat_lahir: f.tempat_lahir.trim(),
    tgl_lahir: f.tgl_lahir,
    phone: normalizePhone(f.phone),
    alamat: f.alamat.trim(),
    rt_rw: kosongJadiNull(f.rt_rw),
    kel_desa: kosongJadiNull(f.kel_desa),
    kecamatan: kosongJadiNull(f.kecamatan),
    no_bpjs: kosongJadiNull(f.no_bpjs),
    jenis_prolanis: (kosongJadiNull(f.jenis_prolanis) as AddPasienBaruPayload['jenis_prolanis']) ?? null,
    email: kosongJadiNull(f.email),
    agama: kosongJadiNull(f.agama),
    status_perkawinan: kosongJadiNull(f.status_perkawinan),
    pekerjaan: kosongJadiNull(f.pekerjaan),
    golongan_darah: kosongJadiNull(f.golongan_darah),
    fktp: kosongJadiNull(buildFktpValue(f.fktp_pilihan, f.fktp_tambahan)),
    ktp_scan_id: newPatientKtpScanId.value,
    konfirmasi_beda_nik: f.konfirmasi_beda_nik
  }

  isSavingNewPatient.value = true
  try {
    await useApi()(`/pengiriman-sampel/${batchId.value}/pasien`, { method: 'POST', body: payload })
    await loadBatch(true)
    useToast().add({
      title: `${payload.name} masuk antrian dan sedang didaftarkan ke Labkesda`,
      description: 'Hasil verifikasi Labkesda muncul di baris antrian dan di notifikasi Anda.',
      color: 'success'
    })
    kataKunci.value = ''
    hasilCari.value = []
    kataKunciTerakhir.value = ''
    isSavingNewPatient.value = false
    await keModeCari()
  } catch (e) {
    if (e instanceof ApiError) {
      newPatientFieldErrors.value = e.errors ?? {}
      newPatientError.value = e.errors ? 'Ada isian yang perlu diperbaiki, lihat pesan merah di form.' : e.message
    } else {
      newPatientError.value = 'Gagal menambahkan pasien baru. Periksa koneksi lalu coba lagi.'
    }
  } finally {
    isSavingNewPatient.value = false
  }
}

// --- Status pendaftaran pasien baru di baris antrian ---
const REGISTRASI_TAMPIL: Record<string, { label: string, kelas: string }> = {
  mengirim: { label: 'Mendaftarkan ke Labkesda', kelas: 'bg-slate-100 text-slate-700' },
  menunggu_verifikasi: { label: 'Menunggu verifikasi Labkesda', kelas: 'bg-warning-50 text-warning-800' },
  terdaftar: { label: 'Terdaftar', kelas: 'bg-success-50 text-success-800' },
  ditolak: { label: 'Ditolak Labkesda', kelas: 'bg-danger-50 text-danger-700' },
  gagal_kirim: { label: 'Belum terkirim', kelas: 'bg-slate-100 text-slate-700' }
}
function registrasiTampil(p: PengirimanSampelPasien) {
  const meta = p.registrasi_status ? REGISTRASI_TAMPIL[p.registrasi_status] : null
  if (!meta) return null
  return {
    ...meta,
    label: p.registrasi_status === 'terdaftar' && p.registrasi_no_reg ? `${meta.label}, no. reg ${p.registrasi_no_reg}` : meta.label
  }
}

// Hasil verifikasi datang lewat realtime (SilakesEventService -> 'pengiriman_sampel.berubah').
// Selama masih ada pendaftaran yang belum diputuskan, halaman juga mengecek tiap 30 detik sebagai
// jaring pengaman bila koneksi realtime terputus.
const adaPendaftaranBerjalan = computed(() =>
  orderedPasien.value.some((p) => p.registrasi_status === 'mengirim' || p.registrasi_status === 'menunggu_verifikasi')
)
let unsubscribeRealtime: (() => void) | null = null
let pollPendaftaran: ReturnType<typeof setInterval> | null = null
onMounted(async () => {
  const { subscribe, dashboardTopic } = useRealtime()
  const topic = dashboardTopic()
  if (topic) {
    unsubscribeRealtime = await subscribe(topic, 'pengiriman_sampel.berubah', (payload) => {
      if ((payload as { pengiriman_sampel_id?: number })?.pengiriman_sampel_id === batchId.value) loadBatch(true)
    })
  }
  pollPendaftaran = setInterval(() => {
    if (adaPendaftaranBerjalan.value && !isLoading.value) loadBatch(true)
  }, 30_000)
})
onUnmounted(() => {
  unsubscribeRealtime?.()
  if (pollPendaftaran) clearInterval(pollPendaftaran)
})

// --- Hapus pasien dari antrian ---
const removingId = ref<number | null>(null)

async function removePatientRow(pasien: PengirimanSampelPasien) {
  removingId.value = pasien.id
  try {
    const api = useApi()
    await api(`/pengiriman-sampel/${batchId.value}/pasien/${pasien.id}`, { method: 'DELETE' })
    await loadBatch()
  } catch (e) {
    useToast().add({ title: e instanceof ApiError ? e.message : 'Gagal menghapus pasien dari antrian', color: 'error' })
  } finally {
    removingId.value = null
  }
}

// --- Drag-reorder ("meja A-B-C") ---
const isPersistingOrder = ref(false)

async function persistOrder() {
  isPersistingOrder.value = true
  try {
    const api = useApi()
    await api(`/pengiriman-sampel/${batchId.value}/reorder`, {
      method: 'POST',
      body: { pasien_ids: orderedPasien.value.map((p) => p.id) }
    })
    // Re-numbering lokal supaya tabel langsung tampil 1..N tanpa nunggu round-trip lagi.
    orderedPasien.value.forEach((p, index) => { p.urutan = index + 1 })
  } catch (e) {
    useToast().add({ title: e instanceof ApiError ? e.message : 'Gagal menyimpan urutan antrian', color: 'error' })
    await loadBatch()
  } finally {
    isPersistingOrder.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <div class="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wider">
        <NuxtLink to="/dashboard" class="hover:text-primary transition-colors">Dashboard</NuxtLink>
        <LucideChevronRight class="w-3 h-3" />
        <NuxtLink to="/dashboard/pengiriman-sampel" class="hover:text-primary transition-colors">Pengiriman Sampel ke Labkesda</NuxtLink>
        <LucideChevronRight class="w-3 h-3" />
        <span class="text-slate-600">Antrian #{{ batchId }}</span>
      </div>
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-extrabold text-accent">Susun Antrian Pengiriman Sampel</h1>
          <p class="text-sm text-slate-500 mt-1">{{ batch?.puskesmas?.nama }}</p>
          <p v-if="loadError" class="text-xs font-semibold text-danger mt-1">{{ loadError }}</p>
          <p v-if="transitionError" class="text-xs font-semibold text-danger mt-1">{{ transitionError }}</p>
        </div>
        <span v-if="batch" class="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border bg-primary/10 text-primary border-primary/20">
          {{ STATUS_LABELS[batch.status] }}
        </span>
      </div>
    </div>

    <div v-if="isLoading && !batch" class="bg-white rounded-2xl border border-slate-100 shadow-card py-16 text-center text-slate-400">
      <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
      Memuat antrian...
    </div>

    <template v-else-if="batch">
      <!-- Aksi -->
      <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex flex-wrap items-center gap-3">
        <template v-if="isDraft">
          <button
            type="button"
            class="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
            @click="openTambahModal"
          >
            <LucideUserPlus class="h-4 w-4" aria-hidden="true" /> Tambah Pasien
          </button>
          <button
            @click="lockBatch"
            :disabled="isTransitioning || (batch.pasien?.length ?? 0) === 0"
            class="flex items-center gap-2 bg-accent text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-colors shadow-sm ml-auto"
          >
            <LucideLoader2 v-if="isTransitioning" class="w-4 h-4 animate-spin" />
            <LucideLock v-else class="w-4 h-4" /> Kunci Daftar Antrian
          </button>
        </template>
        <template v-else-if="isTerkunci">
          <button @click="unlockBatch" :disabled="isTransitioning" class="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors">
            <LucideLoader2 v-if="isTransitioning" class="w-4 h-4 animate-spin" />
            <LucideLockOpen v-else class="w-4 h-4" /> Edit Daftar
          </button>
          <button @click="openAssignModal" class="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-600 transition-colors shadow-sm ml-auto">
            <LucideTruck class="w-4 h-4" /> Tugaskan Pengantar
          </button>
        </template>
        <div v-else-if="['ditugaskan', 'otw', 'tiba_labkesda', 'dikonfirmasi_labkesda'].includes(batch.status)" class="flex items-center gap-2 text-sm text-slate-600">
          <LucideTruck class="w-4 h-4 text-primary" />
          Pengantar: <span class="font-bold text-slate-800">{{ batch.pengantar_sampel?.nama || '-' }}</span>
        </div>
        <button @click="printBatch" :disabled="isPrinting" class="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors">
          <LucideLoader2 v-if="isPrinting" class="w-4 h-4 animate-spin" />
          <LucidePrinter v-else class="w-4 h-4" /> Cetak Daftar Antrian
        </button>
        <button
          v-if="isDraft || isTerkunci || batch.status === 'ditugaskan'"
          @click="showCancelConfirm = true"
          class="flex items-center gap-2 text-danger px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-danger/5 transition-colors"
        >
          <LucideX class="w-4 h-4" /> Batalkan
        </button>
      </div>

      <!-- Daftar antrian (draggable) -->
      <div class="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div class="p-5 border-b border-slate-100 bg-slate-50/50">
          <h2 class="font-bold text-accent">Urutan Antrian</h2>
          <p v-if="isDraft" class="text-xs text-slate-500 mt-1">
            Seret <LucideGripVertical class="w-3 h-3 inline -mt-0.5" /> untuk mengubah urutan, sesuaikan dengan urutan fisik sampel.
          </p>
        </div>

        <p v-if="(batch.pasien?.length ?? 0) === 0" class="py-12 text-center text-slate-400">
          Belum ada pasien di antrian ini.
        </p>

        <VueDraggable
          v-else
          v-model="orderedPasien"
          :animation="150"
          handle=".drag-handle"
          :disabled="!isDraft || isPersistingOrder"
          class="divide-y divide-slate-100"
          @end="persistOrder"
        >
          <div v-for="pasien in orderedPasien" :key="pasien.id" class="flex items-center gap-3 px-5 py-3.5 group">
            <LucideGripVertical
              v-if="isDraft"
              class="drag-handle w-4 h-4 text-slate-300 cursor-grab active:cursor-grabbing shrink-0"
            />
            <span class="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
              {{ pasien.urutan }}
            </span>
            <div class="flex-1 min-w-0">
              <span class="font-bold text-slate-800 block">{{ pasien.nama_snapshot }}</span>
              <span
                v-if="pasien.registrasi_catatan && (pasien.registrasi_status === 'ditolak' || pasien.registrasi_status === 'gagal_kirim')"
                class="block text-xs"
                :class="pasien.registrasi_status === 'ditolak' ? 'text-danger-700' : 'text-slate-600'"
              >{{ pasien.registrasi_catatan }}</span>
            </div>
            <span v-if="pasien.jenis_prolanis_snapshot" class="text-[10px] font-bold uppercase text-primary bg-primary/10 px-2 py-1 rounded-md">
              {{ pasien.jenis_prolanis_snapshot }}
            </span>
            <span
              v-if="registrasiTampil(pasien)"
              class="rounded-md px-2 py-1 text-[11px] font-semibold"
              :class="registrasiTampil(pasien)!.kelas"
              :title="pasien.registrasi_catatan ?? undefined"
            >
              {{ registrasiTampil(pasien)!.label }}
            </span>
            <span v-else-if="pasien.is_pasien_baru" class="text-[10px] font-bold uppercase text-warning bg-warning/10 px-2 py-1 rounded-md">
              Pasien Baru
            </span>
            <button
              v-if="isDraft"
              @click="removePatientRow(pasien)"
              :disabled="removingId === pasien.id"
              title="Hapus dari antrian"
              class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:bg-danger/5 hover:text-danger transition-colors disabled:opacity-50"
            >
              <LucideLoader2 v-if="removingId === pasien.id" class="w-3.5 h-3.5 animate-spin" />
              <LucideTrash2 v-else class="w-3.5 h-3.5" />
            </button>
          </div>
        </VueDraggable>
      </div>
    </template>

    <!-- Modal: Tambah pasien ke antrian (revisi 2026-11-17): mode cari (ketik, maks 10 kartu) dan
         mode daftar pasien baru (isian lengkap + scan KTP), bisa bolak-balik. -->
    <div
      v-if="showTambahModal"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      @click.self="modeTambah === 'cari' && closeTambahModal()"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-tambah-pasien"
        class="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
      >
        <div class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div class="min-w-0">
            <h3 id="judul-tambah-pasien" class="flex items-center gap-2 text-lg font-bold text-accent">
              <template v-if="modeTambah === 'cari'">
                <LucideSearch class="h-5 w-5 text-primary" aria-hidden="true" /> Tambah pasien ke antrian
              </template>
              <template v-else>
                <LucideUserRoundPlus class="h-5 w-5 text-primary" aria-hidden="true" /> Daftarkan pasien baru
              </template>
            </h3>
            <p class="mt-0.5 text-sm text-slate-600">
              {{ modeTambah === 'cari'
                ? `Antrian berisi ${orderedPasien.length} pasien. Pasien yang ditambahkan masuk di urutan berikutnya.`
                : 'Pasien langsung didaftarkan ke Labkesda. Isian bertanda * wajib.' }}
            </p>
          </div>
          <button
            type="button"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
            aria-label="Tutup"
            :disabled="isSavingNewPatient || menambahkanId !== null"
            @click="closeTambahModal"
          >
            <LucideX class="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <!-- Mode cari -->
        <div v-if="modeTambah === 'cari'" class="space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <div>
            <label for="cari-pasien-antrian" class="mb-1.5 block text-sm font-semibold text-slate-700">Cari nama, NIK, atau no. BPJS</label>
            <div class="relative">
              <LucideSearch class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="cari-pasien-antrian"
                ref="searchInputRef"
                v-model="kataKunci"
                type="search"
                autocomplete="off"
                placeholder="Contoh: Siti Aminah, 3529..., 0001..."
                class="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-describedby="cari-pasien-status"
              />
              <LucideLoader2 v-if="isMencari" class="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" aria-hidden="true" />
            </div>
            <p id="cari-pasien-status" class="mt-1.5 text-xs text-slate-600" aria-live="polite">
              <template v-if="kataKunci.trim() === ''">Ketik minimal 2 huruf nama, atau 4 angka NIK/no. BPJS.</template>
              <template v-else-if="pencarianTerlaluPendek">Lanjutkan mengetik...</template>
              <template v-else-if="!isMencari && hasilCari.length > 0">{{ hasilCari.length }} pasien cocok{{ hasilCari.length === 10 ? ' (10 teratas, ketik lebih lengkap untuk mempersempit)' : '' }}.</template>
            </p>
          </div>

          <p v-if="cariError || tambahError" role="alert" class="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-sm font-semibold text-danger-700">
            {{ cariError || tambahError }}
          </p>

          <ul v-if="hasilCari.length > 0" class="space-y-2">
            <li v-for="p in hasilCari" :key="p.external_patient_id">
              <div
                class="flex items-center gap-3 rounded-2xl border p-3.5"
                :class="p.sudah_di_antrian ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white'"
              >
                <div class="min-w-0 flex-1">
                  <p class="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold text-slate-900">
                    {{ p.nama }}
                    <span v-if="p.jenis_prolanis" class="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase text-primary">{{ p.jenis_prolanis }}</span>
                    <span v-else-if="!p.is_prolanis" class="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">Belum Prolanis</span>
                  </p>
                  <p class="mt-0.5 text-xs text-slate-700 tabular-nums">
                    NIK {{ p.nik || '-' }}<template v-if="p.no_bpjs"> · BPJS {{ p.no_bpjs }}</template><template v-if="p.no_reg"> · No. reg {{ p.no_reg }}</template>
                  </p>
                  <p class="text-xs text-slate-600">
                    {{ [p.kel_desa_raw, p.kecamatan_raw].filter(Boolean).join(', ') || 'Alamat belum tercatat' }}<template v-if="p.tanggal_lab_terakhir"> · Lab terakhir {{ new Date(p.tanggal_lab_terakhir).toLocaleDateString('id-ID') }}</template>
                  </p>
                </div>
                <span v-if="p.sudah_di_antrian" class="flex min-h-11 shrink-0 items-center gap-1.5 px-2 text-sm font-semibold text-success-800">
                  <LucideCheck class="h-4 w-4" aria-hidden="true" /> Di antrian
                </span>
                <button
                  v-else
                  type="button"
                  class="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-white hover:bg-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:opacity-50"
                  :disabled="menambahkanId !== null"
                  :aria-label="`Tambahkan ${p.nama} ke antrian`"
                  @click="tambahkanKandidat(p)"
                >
                  <LucideLoader2 v-if="menambahkanId === p.external_patient_id" class="h-4 w-4 animate-spin" aria-hidden="true" />
                  <LucidePlus v-else class="h-4 w-4" aria-hidden="true" />
                  Tambahkan
                </button>
              </div>
            </li>
          </ul>

          <div v-if="tidakDitemukan" class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
            <p class="font-semibold text-slate-800">Tidak ada pasien "{{ kataKunciTerakhir }}" di puskesmas ini.</p>
            <p class="mt-1 text-sm text-slate-600">Periksa ejaan atau cari dengan NIK. Bila memang belum terdaftar, daftarkan sekarang.</p>
            <button
              type="button"
              class="mx-auto mt-4 flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-bold text-white hover:bg-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
              @click="keModeDaftar"
            >
              <LucideUserRoundPlus class="h-4 w-4" aria-hidden="true" /> Daftarkan pasien baru
            </button>
          </div>
        </div>

        <!-- Mode daftar pasien baru -->
        <div v-else class="space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <p v-if="newPatientError" role="alert" class="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-sm font-semibold text-danger-700">{{ newPatientError }}</p>

          <PatientKtpScanPanel @scanned="onNewPatientKtpScanned" @removed="onNewPatientKtpRemoved">
            <template #setelah-hasil>
              <div v-if="newPatientSudahTerdaftar" class="mt-2 text-xs font-semibold text-danger-700">
                NIK di KTP ini sudah terdaftar sebagai pasien.
                <button type="button" class="ml-1 underline underline-offset-2 hover:text-danger-800" @click="cariPasienDariKtp">Cari pasien ini</button>
              </div>
            </template>
          </PatientKtpScanPanel>

          <PatientDataFields
            ref="newPatientFieldsRef"
            v-model:form="newPatientForm"
            mode="baru"
            id-prefix="pasien-baru"
            :errors="newPatientFieldErrors"
            :fktp-pengirim="fktpPengirimBatch"
            fktp-pengirim-keterangan="Otomatis: puskesmas pengirim sampel ini."
          />
        </div>

        <div class="flex shrink-0 flex-wrap items-center gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
          <template v-if="modeTambah === 'cari'">
            <button
              v-if="!tidakDitemukan"
              type="button"
              class="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              @click="keModeDaftar"
            >
              <LucideUserRoundPlus class="h-4 w-4" aria-hidden="true" /> Pasien belum terdaftar? Daftarkan
            </button>
            <button
              type="button"
              class="ml-auto min-h-11 rounded-xl bg-accent px-6 font-bold text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 disabled:opacity-50"
              :disabled="menambahkanId !== null"
              @click="closeTambahModal"
            >
              Selesai
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              class="flex min-h-11 items-center gap-2 rounded-xl px-4 font-semibold text-slate-700 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
              :disabled="isSavingNewPatient"
              @click="keModeCari"
            >
              <LucideArrowLeft class="h-4 w-4" aria-hidden="true" /> Kembali ke cari pasien
            </button>
            <button
              type="button"
              class="ml-auto flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-bold text-white hover:bg-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:opacity-50"
              :disabled="isSavingNewPatient"
              @click="saveNewPatient"
            >
              <LucideLoader2 v-if="isSavingNewPatient" class="h-4 w-4 animate-spin" aria-hidden="true" />
              Daftarkan &amp; masukkan antrian
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Modal: Tugaskan Pengantar -->
    <div v-if="showAssignModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div class="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
        <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h3 class="font-bold text-accent text-lg flex items-center gap-2">
            <LucideTruck class="w-5 h-5 text-primary" /> Tugaskan Pengantar Sampel
          </h3>
          <button @click="showAssignModal = false" class="text-slate-400 hover:text-slate-600 p-1"><LucideX class="w-5 h-5" /></button>
        </div>

        <div class="p-6 space-y-4">
          <p v-if="assignError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{{ assignError }}</p>

          <div v-if="isLoadingCouriers" class="py-6 text-center text-slate-400">
            <LucideLoader2 class="w-5 h-5 mx-auto animate-spin" />
          </div>
          <template v-else>
            <select v-model.number="selectedCourierId" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option :value="null">Pilih pengantar sampel...</option>
              <option v-for="c in courierOptions" :key="c.id" :value="c.id">{{ c.user?.name }}</option>
            </select>
            <p v-if="courierOptions.length === 0" class="text-xs text-slate-500">
              Belum ada pengantar sampel aktif. Daftarkan dulu di
              <NuxtLink to="/dashboard/pengantar-sampel" class="text-primary font-semibold hover:underline">Manajemen Pengantar Sampel</NuxtLink>.
            </p>
          </template>
        </div>

        <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button @click="showAssignModal = false" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
          <button
            @click="assignCourier"
            :disabled="isAssigning || !selectedCourierId"
            class="py-2.5 px-6 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <LucideLoader2 v-if="isAssigning" class="w-4 h-4 animate-spin" />
            Tugaskan
          </button>
        </div>
      </div>
    </div>

    <!-- Konfirmasi Batalkan -->
    <div v-if="showCancelConfirm" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div class="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
        <div class="p-6">
          <div class="w-14 h-14 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mb-4">
            <LucideAlertTriangle class="w-7 h-7" />
          </div>
          <h3 class="font-bold text-accent text-lg mb-1">Batalkan Antrian?</h3>
          <p class="text-sm text-slate-500 leading-relaxed">Antrian ini akan ditandai dibatalkan dan tidak bisa dikirim. Tindakan ini tidak bisa dibatalkan.</p>
        </div>
        <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button @click="showCancelConfirm = false" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
          <button
            @click="confirmCancelBatch"
            :disabled="isTransitioning"
            class="py-2.5 px-6 rounded-xl font-bold text-white bg-danger hover:bg-danger/90 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <LucideLoader2 v-if="isTransitioning" class="w-4 h-4 animate-spin" />
            Ya, Batalkan
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
