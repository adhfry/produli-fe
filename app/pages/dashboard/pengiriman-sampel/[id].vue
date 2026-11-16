<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type { PatientFormState } from '~/utils/patient-form'
import type { AddPasienBaruPayload, ApiSuccessEnvelope, KtpScanResult, PatientCandidate, PengantarSampel, PengirimanSampel, PengirimanSampelPasien } from '~/types/api'

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

async function loadBatch() {
  isLoading.value = true
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

onMounted(loadBatch)

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

// --- Pilih pasien yang sudah ada (checkbox + cari) ---
// Pola sama persis modal "Buat Penugasan" di dashboard/kunjungan/index.vue.
const showPickerModal = ref(false)
const candidatePatients = ref<PatientCandidate[]>([])
const isLoadingCandidates = ref(false)
const candidateSearchQuery = ref('')
const selectedCandidateIds = ref<number[]>([])
const isAddingCandidates = ref(false)
const addCandidatesError = ref('')

const alreadyQueuedExternalIds = computed(
  () => new Set((batch.value?.pasien ?? []).map((p) => p.external_patient_id).filter((id) => id != null))
)

const filteredCandidates = computed(() => {
  const q = candidateSearchQuery.value.toLowerCase()
  return candidatePatients.value.filter((p) => {
    if (alreadyQueuedExternalIds.value.has(p.external_patient_id)) return false
    return q ? p.nama.toLowerCase().includes(q) : true
  })
})

async function openPickerModal() {
  showPickerModal.value = true
  selectedCandidateIds.value = []
  addCandidatesError.value = ''
  if (candidatePatients.value.length === 0) {
    isLoadingCandidates.value = true
    try {
      const api = useApi()
      candidatePatients.value = await fetchAllPages((page) => api('/pengiriman-sampel/patient-candidates', { query: { per_page: 100, page } }))
    } catch (e) {
      addCandidatesError.value = e instanceof ApiError ? e.message : 'Gagal memuat daftar pasien.'
    } finally {
      isLoadingCandidates.value = false
    }
  }
}

function toggleCandidateSelection(externalPatientId: number) {
  const idx = selectedCandidateIds.value.indexOf(externalPatientId)
  if (idx === -1) selectedCandidateIds.value.push(externalPatientId)
  else selectedCandidateIds.value.splice(idx, 1)
}

async function addSelectedCandidates() {
  if (selectedCandidateIds.value.length === 0) return
  isAddingCandidates.value = true
  addCandidatesError.value = ''
  try {
    const api = useApi()
    // Berurutan (bukan Promise.all) -- urutan tambah SENGAJA jadi urutan antrian ("cari nama
    // dari urutan pertama di daftar hadir, otomatis jadi urutan nomor 1, dst"), Promise.all
    // tidak menjamin urutan penyelesaian request sama dengan urutan array.
    for (const externalId of selectedCandidateIds.value) {
      await api(`/pengiriman-sampel/${batchId.value}/pasien`, { method: 'POST', body: { external_patient_id: externalId } })
    }
    showPickerModal.value = false
    await loadBatch()
    useToast().add({ title: `${selectedCandidateIds.value.length} pasien ditambahkan ke antrian`, color: 'success' })
  } catch (e) {
    addCandidatesError.value = e instanceof ApiError ? e.message : 'Gagal menambahkan pasien.'
  } finally {
    isAddingCandidates.value = false
  }
}

// --- Tambah pasien baru (belum ada di SiLAKES sama sekali) ---
// Revisi 2026-11-16: isian lengkap seperti registrasi SiLAKES + scan KTP + verifikasi NIK
// (komponen PatientDataFields, aturan sama dengan backend AddPatientToPengirimanSampelRequest).
const showNewPatientModal = ref(false)
const isSavingNewPatient = ref(false)
const newPatientError = ref('')
const newPatientFieldErrors = ref<Record<string, string[]>>({})
const newPatientForm = ref<PatientFormState>(emptyPatientForm())
const newPatientKtpScanId = ref<number | null>(null)
const newPatientSudahTerdaftar = ref(false)
const newPatientFieldsRef = ref<{ setWilayahDariTeks: (kec: string | null | undefined, desa: string | null | undefined) => Promise<void> } | null>(null)

function formPasienBaruAwal(): PatientFormState {
  const f = emptyPatientForm()
  // FKTP pasien yang dikirim puskesmas biasanya puskesmas itu sendiri -- tetap bisa diganti.
  const namaPuskesmas = batch.value?.puskesmas?.nama ?? ''
  if ((FKTP_PUSKESMAS as readonly string[]).includes(namaPuskesmas)) f.fktp_pilihan = namaPuskesmas
  return f
}

function openNewPatientModal() {
  newPatientForm.value = formPasienBaruAwal()
  newPatientKtpScanId.value = null
  newPatientSudahTerdaftar.value = false
  newPatientError.value = ''
  newPatientFieldErrors.value = {}
  showNewPatientModal.value = true
}

function closeNewPatientModal() {
  if (!isSavingNewPatient.value) showNewPatientModal.value = false
}
onKeyStroke('Escape', () => {
  if (showNewPatientModal.value) closeNewPatientModal()
})

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
    newPatientError.value = 'NIK ini sudah terdaftar. Tutup form ini, lalu tambahkan lewat daftar pasien terdaftar.'
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
    const api = useApi()
    await api(`/pengiriman-sampel/${batchId.value}/pasien`, { method: 'POST', body: payload })
    showNewPatientModal.value = false
    await loadBatch()
    useToast().add({ title: 'Pasien baru ditambahkan ke antrian', color: 'success' })
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
          <button @click="openPickerModal" class="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-600 transition-colors shadow-sm">
            <LucideUserPlus class="w-4 h-4" /> Pilih Pasien
          </button>
          <button @click="openNewPatientModal" class="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">
            <LucideUserRoundPlus class="w-4 h-4" /> Tambah Pasien Baru
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
            </div>
            <span v-if="pasien.jenis_prolanis_snapshot" class="text-[10px] font-bold uppercase text-primary bg-primary/10 px-2 py-1 rounded-md">
              {{ pasien.jenis_prolanis_snapshot }}
            </span>
            <span v-if="pasien.is_pasien_baru" class="text-[10px] font-bold uppercase text-warning bg-warning/10 px-2 py-1 rounded-md">
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

    <!-- Modal: Pilih Pasien -->
    <div v-if="showPickerModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div class="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
        <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
          <h3 class="font-bold text-accent text-lg flex items-center gap-2">
            <LucideUserPlus class="w-5 h-5 text-primary" /> Pilih Pasien Prolanis
          </h3>
          <button @click="showPickerModal = false" class="text-slate-400 hover:text-slate-600 p-1"><LucideX class="w-5 h-5" /></button>
        </div>

        <div class="p-6 space-y-4 overflow-y-auto">
          <p v-if="addCandidatesError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{{ addCandidatesError }}</p>

          <input
            v-model="candidateSearchQuery"
            type="text"
            placeholder="Cari nama pasien..."
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />

          <div class="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-72 overflow-y-auto">
            <p v-if="isLoadingCandidates" class="py-8 text-center text-slate-400">
              <LucideLoader2 class="w-5 h-5 mx-auto animate-spin" />
            </p>
            <label
              v-for="p in filteredCandidates"
              :key="p.id"
              class="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50"
            >
              <input
                type="checkbox"
                :checked="selectedCandidateIds.includes(p.external_patient_id)"
                @change="toggleCandidateSelection(p.external_patient_id)"
                class="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
              />
              <div class="flex-1 min-w-0">
                <span class="text-sm font-semibold text-slate-800 block">{{ p.nama }}</span>
                <span class="text-[11px] text-slate-500">{{ p.kel_desa_raw }}, {{ p.kecamatan_raw }}</span>
                <span v-if="p.tanggal_lab_terakhir" class="text-[11px] text-slate-400 italic block">
                  Lab terakhir: {{ new Date(p.tanggal_lab_terakhir).toLocaleDateString('id-ID') }}
                </span>
              </div>
              <span v-if="p.jenis_prolanis" class="text-[10px] font-bold uppercase text-primary bg-primary/10 px-2 py-1 rounded-md">{{ p.jenis_prolanis }}</span>
            </label>
            <p v-if="!isLoadingCandidates && filteredCandidates.length === 0" class="py-8 text-center text-slate-400 text-sm">Tidak ada kandidat pasien.</p>
          </div>
        </div>

        <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <span class="text-xs text-slate-500 font-semibold">{{ selectedCandidateIds.length }} dipilih</span>
          <div class="flex items-center gap-3">
            <button @click="showPickerModal = false" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
            <button
              @click="addSelectedCandidates"
              :disabled="isAddingCandidates || selectedCandidateIds.length === 0"
              class="py-2.5 px-6 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
            >
              <LucideLoader2 v-if="isAddingCandidates" class="w-4 h-4 animate-spin" />
              Tambahkan ke Antrian
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: Tambah Pasien Baru -- isian lengkap + scan KTP (revisi 2026-11-16). -->
    <div
      v-if="showNewPatientModal"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      @click.self="closeNewPatientModal"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-pasien-baru"
        class="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
      >
        <div class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <h3 id="judul-pasien-baru" class="flex items-center gap-2 text-lg font-bold text-accent">
            <LucideUserRoundPlus class="h-5 w-5 text-primary" aria-hidden="true" /> Tambah pasien baru
          </h3>
          <button
            type="button"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Tutup"
            @click="closeNewPatientModal"
          >
            <LucideX class="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div class="space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <p class="text-sm text-slate-600">
            Untuk pasien yang belum terdaftar di Labkesda. Data diusulkan ke Labkesda dan resmi tersimpan setelah diverifikasi petugas saat sampel tiba. Isian bertanda * wajib.
          </p>
          <p v-if="newPatientError" role="alert" class="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-sm font-semibold text-danger-700">{{ newPatientError }}</p>

          <PatientKtpScanPanel @scanned="onNewPatientKtpScanned" @removed="onNewPatientKtpRemoved">
            <template #setelah-hasil>
              <p v-if="newPatientSudahTerdaftar" class="mt-2 text-xs font-semibold text-danger-700">
                NIK di KTP ini sudah terdaftar sebagai pasien. Tutup form ini, lalu tambahkan lewat daftar pasien terdaftar supaya riwayat lab pasien tidak terpecah.
              </p>
            </template>
          </PatientKtpScanPanel>

          <PatientDataFields
            ref="newPatientFieldsRef"
            v-model:form="newPatientForm"
            mode="baru"
            id-prefix="pasien-baru"
            :errors="newPatientFieldErrors"
          />
        </div>

        <div class="flex shrink-0 gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:justify-end sm:px-6">
          <button
            type="button"
            class="min-h-11 flex-1 rounded-xl px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:flex-none"
            :disabled="isSavingNewPatient"
            @click="closeNewPatientModal"
          >
            Batal
          </button>
          <button
            type="button"
            class="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-bold text-white hover:bg-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:opacity-50 sm:flex-none"
            :disabled="isSavingNewPatient"
            @click="saveNewPatient"
          >
            <LucideLoader2 v-if="isSavingNewPatient" class="h-4 w-4 animate-spin" aria-hidden="true" />
            Tambahkan ke antrian
          </button>
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
