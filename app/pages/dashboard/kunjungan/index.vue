<script setup lang="ts">
import type { ApiSuccessEnvelope, AssignmentStatus, VisitAssignment, Puskesmas } from '~/types/api'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
useHead({
  title: 'Data Kunjungan Prolanis'
})

// GET /visit-assignments -- sudah ter-scope backend (VisitAssignmentService::scopedQuery):
// super_admin semua, admin_puskesmas/pj_prolanis cuma puskesmasnya sendiri.
const visitsList = ref<VisitAssignment[]>([])
const isLoadingVisits = ref(false)
const visitsError = ref('')

async function loadVisits() {
  isLoadingVisits.value = true
  visitsError.value = ''
  try {
    const api = useApi()
    visitsList.value = await fetchAllPages<VisitAssignment>((page) => api('/visit-assignments', { query: { per_page: 100, page } }))
  } catch (e) {
    visitsError.value = e instanceof ApiError ? e.message : 'Gagal memuat data kunjungan.'
  } finally {
    isLoadingVisits.value = false
  }
}
onMounted(() => {
  loadVisits()
  loadPuskesmasFullList()
})

const searchQuery = ref('')
const filterStatus = ref('')
const filterPuskesmas = ref('')

// Opsi filter puskesmas -- admin_puskesmas/pj_prolanis cuma akan punya 1 opsi (puskesmasnya
// sendiri, scoped backend, aman diturunkan dari data yang sudah dimuat). super_admin SEBELUMNYA
// juga diturunkan dari data yang sudah dimuat -- bug: kalau assignment yang ada kebetulan cuma
// dari 1 puskesmas (data dev/awal), opsi filter jadi cuma 1 walau se-kabupaten py 31 puskesmas.
// Sekarang fetch daftar LENGKAP (GET /puskesmas, semua role staf boleh baca) khusus super_admin.
const puskesmasFullList = ref<Puskesmas[]>([])
async function loadPuskesmasFullList() {
  if (!isSuperAdmin.value) return
  try {
    puskesmasFullList.value = await fetchAllPages<Puskesmas>((page) =>
      useApi()('/puskesmas', { query: { per_page: 100, page } })
    )
  } catch (e) {
    console.error('Gagal memuat daftar puskesmas', e)
  }
}
const puskesmasOptions = computed(() => {
  if (isSuperAdmin.value && puskesmasFullList.value.length > 0) {
    return [...puskesmasFullList.value].map((p) => p.nama).sort()
  }
  const names = new Set(visitsList.value.map((v) => v.puskesmas?.nama).filter((n): n is string => !!n))
  return [...names].sort()
})

// Deep-link dari card "Lihat Detail"/"Kunjungan Selesai" di /dashboard (docs/planning/02 §17) —
// ?status=completed dkk pre-select filter di atas. Validasi ketat, jangan langsung pakai nilai
// query URL apa adanya (bisa diubah manual/dibagikan).
const VALID_STATUS_FILTERS = ['pending', 'in_progress', 'completed', 'cancelled', 'terlambat']
const route = useRoute()
if (typeof route.query.status === 'string' && VALID_STATUS_FILTERS.includes(route.query.status)) {
  filterStatus.value = route.query.status
}

// "Terlambat" bukan status tersimpan (backend cuma pending/in_progress/completed/cancelled) --
// dihitung di sini dari assignment pending + scheduled_date sudah lewat (docs/planning/09
// keputusan #3). "Diulang" JUGA bukan status tersimpan -- dideteksi dari assignment.status
// kembali 'pending' TAPI sudah punya report.validation_status='invalid' (VisitReportReviewService
// membuka lagi assignment saat super_admin menolak laporan, docs/planning/02 §11), beda makna
// dari 'pending' biasa (belum pernah dikerjakan sama sekali).
function isRepeat(visit) {
  return visit.status === 'pending' && visit.report?.validation_status === 'invalid'
}
function isOverdue(visit) {
  if (visit.status !== 'pending' || isRepeat(visit)) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(visit.scheduled_date) < today
}

const STATUS_LABELS = {
  pending: 'Terjadwal',
  in_progress: 'Sedang Berlangsung',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  terlambat: 'Terlambat',
  diulang: 'Diulang (Laporan Ditolak)'
}

function displayStatus(visit) {
  if (isRepeat(visit)) return 'diulang'
  return isOverdue(visit) ? 'terlambat' : visit.status
}

function getStatusLabel(visit) {
  return STATUS_LABELS[displayStatus(visit)] ?? visit.status
}

const filteredVisits = computed(() => {
  return visitsList.value.filter(v => {
    const q = searchQuery.value.toLowerCase()
    const matchSearch = !q || (v.patient?.nama ?? '').toLowerCase().includes(q) || (v.kader?.name ?? '').toLowerCase().includes(q)
    const matchStatus = filterStatus.value
      ? (filterStatus.value === 'terlambat' ? isOverdue(v) : filterStatus.value === 'diulang' ? isRepeat(v) : v.status === filterStatus.value)
      : true
    const matchPuskesmas = filterPuskesmas.value ? v.puskesmas?.nama === filterPuskesmas.value : true
    return matchSearch && matchStatus && matchPuskesmas
  })
})

const getStatusColor = (visit) => {
  const s = displayStatus(visit)
  if (s === 'completed') return 'bg-success/10 text-success border border-success/20'
  if (s === 'pending') return 'bg-info/10 text-info border border-info/20'
  if (s === 'in_progress') return 'bg-primary/10 text-primary border border-primary/20'
  if (s === 'terlambat') return 'bg-danger/10 text-danger border border-danger/20'
  if (s === 'diulang') return 'bg-warning/10 text-warning border border-warning/20'
  if (s === 'cancelled') return 'bg-slate-100 text-slate-600 border border-slate-200'
  return 'bg-slate-100 text-slate-600'
}

const getRiskColor = (risk) => {
  if (risk === 'berat') return 'text-danger bg-danger/10'
  if (risk === 'sedang') return 'text-warning bg-warning/10'
  if (risk === 'ringan') return 'text-success bg-success/10'
  return 'text-slate-600 bg-slate-100'
}

const showAddModal = ref(false)

// --- Buat Penugasan (bulk) — docs/planning/02 §12, POST /api/v1/visit-assignments/bulk ---
const candidatePatients = ref([])
const assignedPatientIds = ref(new Set())
const isLoadingCandidates = ref(false)
const candidatesError = ref('')

const kaderList = ref([])
const isLoadingKader = ref(false)
const kaderError = ref('')

const kecamatanFilter = ref('')
const desaFilter = ref('')
const selectedPatientIds = ref([])
const selectedKaderId = ref(null)
// Kunjungan berombongan (docs/planning/02 §16) -- kader TAMBAHAN yang ikut mendampingi
// selectedKaderId (primer) di SELURUH batch ini, opsional. Beda dari kader_id: kalau satu
// pendamping gagal validasi (nonaktif/beda puskesmas), backend tolak SELURUH batch, bukan
// partial-success seperti patient_ids.
const selectedCompanionIds = ref([])
const scheduledDate = ref('')
const priority = ref('berat')

const showConfirmModal = ref(false)
const isSubmittingBulk = ref(false)
const bulkError = ref('')
const bulkResult = ref(null)

async function loadCandidates() {
  isLoadingCandidates.value = true
  candidatesError.value = ''
  try {
    const api = useApi()
    // Kandidat kunjungan: risiko Berat DAN Sedang (permintaan Bu Kadis -- sebelumnya cuma Berat,
    // lihat docs/planning/02 §12). GET /patients cuma terima 1 risk_level per request, jadi
    // fetch 2x paralel lalu digabung, bukan ubah backend jadi array (endpoint ini dipakai
    // dashboard/pasien juga, tidak ingin ubah kontraknya).
    const [beratPatients, sedangPatients, assignments] = await Promise.all([
      fetchAllPages((page) => api('/patients', { query: { risk_level: 'berat', per_page: 100, page } })),
      fetchAllPages((page) => api('/patients', { query: { risk_level: 'sedang', per_page: 100, page } })),
      fetchAllPages((page) => api('/visit-assignments', { query: { per_page: 100, page } }))
    ])
    candidatePatients.value = [...beratPatients, ...sedangPatients]
    assignedPatientIds.value = new Set(
      assignments
        .filter((a) => a.status === 'pending' || a.status === 'in_progress')
        .map((a) => a.patient?.id)
        .filter((id) => id != null)
    )
  } catch (e) {
    candidatesError.value = e instanceof ApiError ? e.message : 'Gagal memuat daftar pasien kandidat.'
  } finally {
    isLoadingCandidates.value = false
  }
}

async function loadKaderList() {
  isLoadingKader.value = true
  kaderError.value = ''
  try {
    const api = useApi()
    kaderList.value = await fetchAllPages((page) => api('/kader', { query: { status_aktif: true, per_page: 100, page } }))
  } catch (e) {
    kaderError.value = e instanceof ApiError ? e.message : 'Gagal memuat daftar kader.'
  } finally {
    isLoadingKader.value = false
  }
}

// super_admin sudah tidak bisa buka modal ini sama sekali (tombolnya disembunyikan, lihat
// v-if="!isSuperAdmin" di atas) -- siapa pun yang sampai sini pasti admin_puskesmas/pj_prolanis,
// jadi kecamatan filter SELALU dikunci ke kecamatan puskesmas mereka sendiri (docs/planning §7
// lanjutan). Kandidat pasien (GET /patients) & kader (GET /kader) SUDAH scope backend ke
// puskesmas sendiri -- ini murni memastikan mereka juga tidak bisa "cari" kecamatan lain yang
// toh tidak akan pernah ada datanya utk mereka.
async function lockAssignKecamatan() {
  if (!authStore.user?.puskesmas_id) return
  try {
    const res = await useApi()(`/puskesmas/${authStore.user.puskesmas_id}`) as ApiSuccessEnvelope<{ kecamatan: { nama: string } | null }>
    if (res.data.kecamatan) {
      kecamatanFilter.value = res.data.kecamatan.nama
    }
  } catch (e) {
    console.error('Gagal memuat kecamatan puskesmas sendiri', e)
  }
}

function openAssignModal() {
  showAddModal.value = true
  loadCandidates()
  loadKaderList()
  lockAssignKecamatan()
}

function closeAssignFlow() {
  showAddModal.value = false
  showConfirmModal.value = false
  selectedPatientIds.value = []
  selectedKaderId.value = null
  selectedCompanionIds.value = []
  scheduledDate.value = ''
  priority.value = 'berat'
  kecamatanFilter.value = ''
  desaFilter.value = ''
  candidateSearchQuery.value = ''
  bulkResult.value = null
  bulkError.value = ''
}

// Kader primer tidak boleh jadi pendampingnya sendiri (BulkCreateVisitAssignmentRequest) --
// filter dari opsi & buang dari seleksi kalau kebetulan sudah tercentang saat kader tujuan diganti.
const companionOptions = computed(() => kaderList.value.filter((k) => k.id !== selectedKaderId.value))
watch(selectedKaderId, (newVal) => {
  selectedCompanionIds.value = selectedCompanionIds.value.filter((id) => id !== newVal)
})

function toggleCompanionSelection(kaderId) {
  const idx = selectedCompanionIds.value.indexOf(kaderId)
  if (idx === -1) selectedCompanionIds.value.push(kaderId)
  else selectedCompanionIds.value.splice(idx, 1)
}

// Kecamatan select di sini SELALU disabled/display-only (dikunci lockAssignKecamatan ke
// kecamatan puskesmas sendiri, lihat template) -- BUKAN filter fungsional. candidatePatients
// sudah 100% puskesmas sendiri lewat scoping backend (GET /patients), jadi seluruh kandidat di
// sini otomatis berada di kecamatan yang SAMA; tidak ada gunanya dicocokkan lagi.
//
// Bug nyata sebelumnya: desaOptions & filteredCandidates ikut menyaring pakai
// `p.kecamatan_raw === kecamatanFilter.value` -- p.kecamatan_raw teks mentah SiLAKES apa
// adanya (kapitalisasi/ejaan macam-macam, mis. "KOTA" bukan "Kota Sumenep"), dibandingkan ke
// nama kecamatan BAKU dari lockAssignKecamatan(). Cocok cuma kalau kebetulan identik persis --
// untuk Puskesmas Pandian nyaris semua pasien gagal cocok, bikin daftar pasien & pilihan desa
// tampil kosong total meski kandidatnya ada (sama persis kelas bug yang sudah diperbaiki di
// dashboard/pasien/index.vue, lihat komentar lockKecamatanToOwnPuskesmas di sana). Dihapus di
// sini, bukan diperbaiki jadi cocok ID kanonik -- toh sudah redundan (lihat paragraf atas).
const kecamatanOptions = computed(() => {
  const set = new Set(candidatePatients.value.map((p) => p.kecamatan_raw).filter(Boolean))
  if (kecamatanFilter.value) set.add(kecamatanFilter.value)
  return [...set].sort()
})
const desaOptions = computed(() => {
  const set = new Set(candidatePatients.value.map((p) => p.kel_desa_raw).filter(Boolean))
  return [...set].sort()
})

const candidateSearchQuery = ref('')

const filteredCandidates = computed(() => {
  const q = candidateSearchQuery.value.trim().toLowerCase()
  return candidatePatients.value.filter((p) => {
    const matchDesa = desaFilter.value ? p.kel_desa_raw === desaFilter.value : true
    const matchSearch = q ? p.nama.toLowerCase().includes(q) || (p.no_reg ?? '').toLowerCase().includes(q) : true
    return matchDesa && matchSearch
  })
})

function isPatientAssigned(patientId) {
  return assignedPatientIds.value.has(patientId)
}

function togglePatientSelection(patientId) {
  if (isPatientAssigned(patientId)) return
  const idx = selectedPatientIds.value.indexOf(patientId)
  if (idx === -1) selectedPatientIds.value.push(patientId)
  else selectedPatientIds.value.splice(idx, 1)
}

function selectAllUnassigned() {
  selectedPatientIds.value = filteredCandidates.value
    .filter((p) => !isPatientAssigned(p.id))
    .map((p) => p.id)
}

const selectedPatients = computed(() =>
  candidatePatients.value.filter((p) => selectedPatientIds.value.includes(p.id))
)

const canProceedToConfirm = computed(() =>
  selectedPatientIds.value.length > 0 && !!selectedKaderId.value && !!scheduledDate.value && !!priority.value
)

function openConfirmModal() {
  if (!canProceedToConfirm.value) return
  showConfirmModal.value = true
}

function failedReason(patientId) {
  return bulkResult.value?.failed.find((f) => f.patient_id === patientId)?.reason
}

async function submitBulkAssignment() {
  isSubmittingBulk.value = true
  bulkError.value = ''
  try {
    const api = useApi()
    const res = await api('/visit-assignments/bulk', {
      method: 'POST',
      body: {
        kader_id: selectedKaderId.value,
        companion_kader_ids: selectedCompanionIds.value,
        patient_ids: selectedPatientIds.value,
        scheduled_date: scheduledDate.value,
        priority: priority.value
      }
    })
    bulkResult.value = res.data
    for (const created of res.data.created) {
      if (created.patient?.id) assignedPatientIds.value.add(created.patient.id)
    }
    // Semua sukses tanpa kegagalan -> tutup alur langsung. Ada yang gagal -> biarkan modal
    // konfirmasi terbuka menampilkan hasil partial success supaya PJ tahu mana yang perlu ditinjau.
    if (res.data.failed.length === 0) {
      closeAssignFlow()
    }
  } catch (e) {
    bulkError.value = e instanceof ApiError ? e.message : 'Gagal membuat penugasan.'
  } finally {
    isSubmittingBulk.value = false
  }
}

const showViewModal = ref(false)
const selectedVisit = ref(null)

const viewVisit = (visit) => {
  selectedVisit.value = visit
  showViewModal.value = true
}

// Role gating asli -- pola sama dgn dashboard/index.vue (authStore.roles, BUKAN toggle mock).
const authStore = useAuthStore()
const isSuperAdmin = computed(() => (authStore.roles ?? []).includes('super_admin'))
const isPjProlanis = computed(() => (authStore.roles ?? []).includes('pj_prolanis'))

// PATCH /visit-reports/{id}/accept (VisitReportPolicy::accept) -- pj_prolanis, HANYA laporan
// dari kader yang disupervisinya sendiri. Scope daftar di sini cuma per-puskesmas (bukan
// per-supervisi), jadi tombol tetap ditampilkan untuk semua pj_prolanis; 403 kalau bukan
// kadernya ditangani sebagai error biasa, bukan disembunyikan di frontend (policy tetap sumber
// kebenaran, bukan ditebak di sini).
const isAccepting = ref(false)
const acceptError = ref('')
const acceptReport = async () => {
  if (!selectedVisit.value?.report) return
  isAccepting.value = true
  acceptError.value = ''
  try {
    const api = useApi()
    const res = await api(`/visit-reports/${selectedVisit.value.report.id}/accept`, { method: 'PATCH' })
    selectedVisit.value.report = res.data
    const idx = visitsList.value.findIndex((v) => v.id === selectedVisit.value.id)
    if (idx !== -1) visitsList.value[idx].report = res.data
  } catch (e) {
    acceptError.value = e instanceof ApiError ? e.message : 'Gagal menerima laporan.'
  } finally {
    isAccepting.value = false
  }
}

const showValidationModal = ref(false)
const validationForm = ref({
  is_valid: true,
  note: ''
})
const isValidating = ref(false)
const validationError = ref('')

const openValidationModal = () => {
  validationForm.value = { is_valid: true, note: '' }
  validationError.value = ''
  showValidationModal.value = true
}

// Aksi cepat centang/x di baris tabel (khusus super_admin, docs/planning/02 §11) -- langsung
// buka modal validasi dengan keputusan SUDAH terpilih, super_admin tinggal konfirmasi/tambah
// catatan lalu simpan, tidak perlu buka detail dulu lalu cari tombol "Validasi Laporan" lagi.
const quickValidate = (visit, isValid) => {
  selectedVisit.value = visit
  validationForm.value = { is_valid: isValid, note: '' }
  validationError.value = ''
  showValidationModal.value = true
}

// PATCH /validasi-laporan/{id} (VisitReportPolicy::validateReport -- super_admin saja). Keputusan
// 'invalid' otomatis membuka lagi assignment.status jadi 'pending' di backend (docs/planning/02
// §11) -- refresh baris tabel dari response supaya status "Diulang" langsung terlihat tanpa reload.
const submitValidation = async () => {
  if (!selectedVisit.value?.report) return
  isValidating.value = true
  validationError.value = ''
  try {
    const api = useApi()
    const res = await api(`/validasi-laporan/${selectedVisit.value.report.id}`, {
      method: 'PATCH',
      body: { is_valid: validationForm.value.is_valid, note: validationForm.value.note || null }
    })
    selectedVisit.value.report = res.data
    if (!validationForm.value.is_valid) {
      selectedVisit.value.status = 'pending'
    }
    const idx = visitsList.value.findIndex((v) => v.id === selectedVisit.value.id)
    if (idx !== -1) {
      visitsList.value[idx].report = res.data
      if (!validationForm.value.is_valid) visitsList.value[idx].status = 'pending'
    }
    showValidationModal.value = false
  } catch (e) {
    validationError.value = e instanceof ApiError ? e.message : 'Gagal menyimpan validasi.'
  } finally {
    isValidating.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Breadcrumb & Header -->
    <div>
      <div class="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wider">
        <NuxtLink to="/dashboard" class="hover:text-primary transition-colors">Dashboard</NuxtLink>
        <LucideChevronRight class="w-3 h-3" />
        <span class="text-slate-600">Data Kunjungan</span>
      </div>
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-extrabold text-accent">Data Kunjungan Prolanis</h1>
          <p class="text-sm text-slate-500 mt-1">Pantau jadwal penugasan dan hasil laporan kunjungan Kader Prolanis lapangan.</p>
        </div>
        <div class="flex items-center gap-3">
          <!-- super_admin TIDAK bisa membuat penugasan (VisitAssignmentPolicy::createBulk) --
               keputusan operasional puskesmas, bukan tindakan administrator kabupaten. -->
          <button v-if="!isSuperAdmin" @click="openAssignModal" class="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-600 transition-colors shadow-sm">
            <LucideCalendarPlus class="w-4 h-4" />
            <span class="hidden sm:inline">Buat Penugasan Baru</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Filters & Table Card -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-card flex flex-col overflow-hidden">
      
      <!-- Toolbar -->
      <div class="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50">
        <div class="relative w-full md:w-80">
          <LucideSearch class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Cari pasien atau kader..." 
            class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
          />
        </div>
        
        <div class="flex items-center gap-3 w-full md:w-auto">
          <select v-model="filterStatus" class="flex-1 md:w-48 py-2.5 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
            <option value="">Semua Status</option>
            <option value="pending">Terjadwal</option>
            <option value="in_progress">Sedang Berlangsung</option>
            <option value="completed">Selesai</option>
            <option value="terlambat">Terlambat</option>
            <option value="diulang">Diulang (Laporan Ditolak)</option>
          </select>
          <select v-model="filterPuskesmas" class="flex-1 md:w-48 py-2.5 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
            <option value="">Semua Puskesmas</option>
            <option v-for="nama in puskesmasOptions" :key="nama" :value="nama">{{ nama }}</option>
          </select>
        </div>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[950px]">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <th class="py-4 px-5 font-semibold">Pasien Prolanis</th>
              <th class="py-4 px-5 font-semibold">Petugas (Kader)</th>
              <th class="py-4 px-5 font-semibold">Tenggat Waktu</th>
              <th class="py-4 px-5 font-semibold text-center">Status</th>
              <th class="py-4 px-5 font-semibold">Hasil Tensi</th>
              <th class="py-4 px-5 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="isLoadingVisits">
              <td colspan="6" class="py-12 text-center text-slate-400">
                <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
                Memuat data kunjungan...
              </td>
            </tr>
            <tr v-else-if="visitsError">
              <td colspan="6" class="py-8 text-center text-sm font-semibold text-danger">{{ visitsError }}</td>
            </tr>
            <tr v-for="visit in filteredVisits" v-else :key="visit.id" class="hover:bg-slate-50/80 transition-colors group">
               <td class="py-4 px-5">
                  <div class="flex items-center gap-3">
                     <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-sm shrink-0 border" :class="getRiskColor(visit.priority) + ' border-current/20'">
                        {{ (visit.patient?.nama ?? '?').split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() }}
                     </div>
                     <div>
                        <span class="font-bold text-slate-800 block">{{ visit.patient?.nama ?? 'Pasien tidak diketahui' }}</span>
                        <span class="text-[10px] uppercase tracking-wider font-bold" :class="getRiskColor(visit.priority).split(' ')[0]">
                           Risiko {{ visit.priority }}
                        </span>
                     </div>
                  </div>
               </td>
               <td class="py-4 px-5">
                  <p class="text-sm font-bold text-slate-700 flex items-center gap-1.5"><LucideUser class="w-3.5 h-3.5 text-slate-400"/> {{ visit.kader?.name ?? '-' }}</p>
                  <p class="text-[11px] text-slate-500 font-medium mt-1">{{ visit.puskesmas?.nama ?? '-' }}</p>
               </td>
               <td class="py-4 px-5">
                  <span class="text-sm font-semibold text-slate-700 flex items-center gap-2">
                     <LucideCalendar class="w-4 h-4 text-slate-400" />
                     {{ visit.scheduled_date }}
                  </span>
               </td>
               <td class="py-4 px-5 text-center">
                  <span class="px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider" :class="getStatusColor(visit)">
                     {{ getStatusLabel(visit) }}
                  </span>
               </td>
               <td class="py-4 px-5">
                  <div v-if="visit.report?.systolic" class="flex gap-2">
                     <div class="bg-white border border-slate-200 rounded-md px-2 py-1 text-center shadow-sm">
                        <span class="block text-[9px] text-slate-400 font-bold uppercase leading-none mb-0.5">Sistolik</span>
                        <span class="text-sm font-black text-danger leading-none">{{ visit.report.systolic }}</span>
                     </div>
                     <div class="bg-white border border-slate-200 rounded-md px-2 py-1 text-center shadow-sm">
                        <span class="block text-[9px] text-slate-400 font-bold uppercase leading-none mb-0.5">Diastolik</span>
                        <span class="text-sm font-black text-warning leading-none">{{ visit.report.diastolic }}</span>
                     </div>
                  </div>
                  <span v-else class="text-xs font-semibold text-slate-400 italic">Belum ada hasil</span>
               </td>
               <td class="py-4 px-5 text-right whitespace-nowrap">
                  <!-- Aksi cepat validasi -- KHUSUS super_admin (VisitReportPolicy::validateReport),
                       cuma muncul kalau sudah ada laporan utk divalidasi. Buka modal dengan
                       keputusan sudah terpilih, bukan langsung submit tanpa konfirmasi. -->
                  <template v-if="isSuperAdmin && visit.report">
                     <button @click="quickValidate(visit, true)" title="Tandai Valid" class="inline-flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:text-success hover:border-success transition-colors p-2 rounded-xl shadow-sm mr-2">
                        <LucideCheck class="w-4 h-4" />
                     </button>
                     <button @click="quickValidate(visit, false)" title="Tandai Tidak Valid" class="inline-flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:text-danger hover:border-danger transition-colors p-2 rounded-xl shadow-sm mr-2">
                        <LucideX class="w-4 h-4" />
                     </button>
                  </template>
                  <button @click="viewVisit(visit)" class="inline-flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:text-primary hover:border-primary transition-colors p-2 rounded-xl shadow-sm mr-2">
                     <LucideEye class="w-4 h-4" />
                  </button>
               </td>
            </tr>
            <tr v-if="!isLoadingVisits && !visitsError && filteredVisits.length === 0">
               <td colspan="6" class="py-12 text-center">
                 <div class="flex flex-col items-center justify-center text-slate-400">
                    <LucideCalendarX class="w-10 h-10 mb-3 text-slate-300" />
                    <p class="font-medium">Tidak ada data penugasan kunjungan.</p>
                 </div>
               </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Pagination (Mock) -->
      <div class="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
        <span class="text-sm text-slate-500">Menampilkan <b class="text-slate-700">{{ filteredVisits.length }}</b> dari <b class="text-slate-700">{{ visitsList.length }}</b> kunjungan</span>
        <div class="flex items-center gap-1.5">
          <button class="p-2 rounded-xl border border-slate-200 text-slate-400 bg-white cursor-not-allowed"><LucideChevronLeft class="w-4 h-4" /></button>
          <button class="w-8 h-8 flex items-center justify-center rounded-xl bg-primary text-white text-sm font-bold shadow-sm">1</button>
          <button class="p-2 rounded-xl border border-slate-200 text-slate-600 bg-white hover:bg-slate-100 transition-colors"><LucideChevronRight class="w-4 h-4" /></button>
        </div>
      </div>
    </div>
    
    <!-- Add Modal — bulk assign (docs/planning/02 §12, diperluas ke risiko Sedang atas
         permintaan Bu Kadis): filter wilayah/cari nama, multi-select pasien risiko Berat/Sedang
         yang belum ditugaskan, kader+tanggal+prioritas berlaku 1 batch. -->
    <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
       <div class="bg-white rounded-3xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
          <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
             <h3 class="font-bold text-accent text-lg flex items-center gap-2">
               <LucideCalendarPlus class="w-5 h-5 text-primary" />
               Buat Penugasan Baru
             </h3>
             <button @click="closeAssignFlow" class="text-slate-400 hover:text-slate-600 p-1">
                <LucideX class="w-5 h-5" />
             </button>
          </div>

          <div class="p-6 space-y-5 overflow-y-auto">
             <p class="text-xs text-slate-500 -mt-2">Kandidat: pasien risiko <b class="text-danger">Berat</b> dan <b class="text-warning">Sedang</b> di wilayah Puskesmas Anda.</p>

             <!-- Filter wilayah -- kecamatan SELALU terkunci ke wilayah kerja puskesmas sendiri
                  (lockAssignKecamatan, dipanggil saat modal dibuka), tidak bisa dipilih manual;
                  cuma label informatif, lihat komentar kecamatanOptions di script. -->
             <div class="grid grid-cols-2 gap-3">
                <select v-model="kecamatanFilter" disabled class="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-100 text-slate-500 cursor-not-allowed">
                   <option value="">Memuat kecamatan...</option>
                   <option v-for="kec in kecamatanOptions" :key="kec" :value="kec">{{ kec }}</option>
                </select>
                <select v-model="desaFilter" class="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                   <option value="">Semua Desa/Kelurahan</option>
                   <option v-for="desa in desaOptions" :key="desa" :value="desa">{{ desa }}</option>
                </select>
             </div>

             <!-- Cari pasien -- filter client-side (kandidat sudah dimuat semua di awal, lihat
                  loadCandidates), tidak perlu request baru tiap ketik. -->
             <div class="relative">
                <LucideSearch class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                   v-model="candidateSearchQuery"
                   type="text"
                   placeholder="Cari nama atau no. registrasi pasien..."
                   class="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                />
             </div>

             <!-- Daftar kandidat -->
             <div>
                <div class="flex items-center justify-between mb-2">
                   <label class="block text-xs font-bold text-slate-700 uppercase tracking-wide">Pilih Pasien</label>
                   <button
                      @click="selectAllUnassigned"
                      :disabled="isLoadingCandidates || filteredCandidates.length === 0"
                      type="button"
                      class="text-xs font-bold text-primary hover:underline disabled:opacity-40 disabled:no-underline"
                   >
                      Pilih Semua yang Belum Ditugaskan
                   </button>
                </div>

                <div v-if="isLoadingCandidates" class="py-8 flex items-center justify-center text-slate-400 gap-2 border border-slate-100 rounded-xl">
                   <LucideLoader2 class="w-4 h-4 animate-spin" /> Memuat daftar pasien...
                </div>
                <p v-else-if="candidatesError" class="text-sm text-danger py-3">{{ candidatesError }}</p>
                <div v-else class="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-64 overflow-y-auto">
                   <label
                      v-for="p in filteredCandidates"
                      :key="p.id"
                      class="flex items-center gap-3 px-4 py-2.5"
                      :class="isPatientAssigned(p.id) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'"
                   >
                      <input
                         type="checkbox"
                         :checked="selectedPatientIds.includes(p.id)"
                         :disabled="isPatientAssigned(p.id)"
                         @change="togglePatientSelection(p.id)"
                         class="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                      />
                      <div class="flex-1 min-w-0">
                         <AppTooltip :text="p.nama">
                            <span class="text-sm font-semibold text-slate-800 block truncate">{{ p.nama }}</span>
                         </AppTooltip>
                         <span class="text-[11px] text-slate-500">{{ p.kel_desa_raw || '—' }}, {{ p.kecamatan_raw || '—' }}</span>
                      </div>
                      <span
                         class="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md shrink-0"
                         :class="p.risk_level === 'berat' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'"
                      >
                         {{ p.risk_level === 'berat' ? 'Berat' : 'Sedang' }}
                      </span>
                      <span v-if="isPatientAssigned(p.id)" class="text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-500 px-2 py-1 rounded-md shrink-0">
                         Sudah Ditugaskan
                      </span>
                   </label>
                   <p v-if="filteredCandidates.length === 0" class="text-sm text-slate-400 text-center py-6">Tidak ada kandidat pada filter ini.</p>
                </div>
             </div>

             <!-- Kader + tanggal + prioritas (berlaku 1 batch) -->
             <div class="grid grid-cols-2 gap-4">
                <div>
                   <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Kader Tujuan</label>
                   <select v-model="selectedKaderId" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" :disabled="isLoadingKader">
                      <option :value="null" disabled>{{ isLoadingKader ? 'Memuat...' : 'Pilih kader' }}</option>
                      <option v-for="k in kaderList" :key="k.id" :value="k.id">{{ k.user?.name ?? `Kader #${k.id}` }}</option>
                   </select>
                   <p v-if="kaderError" class="text-xs text-danger mt-1">{{ kaderError }}</p>
                </div>
                <div>
                   <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Prioritas Kunjungan</label>
                   <select v-model="priority" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                      <option value="ringan">Ringan</option>
                      <option value="sedang">Sedang</option>
                      <option value="berat">Berat</option>
                   </select>
                </div>
             </div>
             <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Tanggal Kunjungan (berlaku untuk semua pasien terpilih)</label>
                <input type="date" v-model="scheduledDate" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
             </div>

             <!-- Kader Pendamping (opsional) — kunjungan berombongan, docs/planning/02 §16 -->
             <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Kader Pendamping (Opsional)</label>
                <p class="text-[11px] text-slate-400 mb-2">Ikut mendampingi kader tujuan di seluruh pasien yang dipilih di batch ini.</p>
                <div class="border border-slate-200 rounded-xl max-h-40 overflow-y-auto divide-y divide-slate-100">
                   <label v-for="k in companionOptions" :key="k.id" class="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                      <input
                         type="checkbox"
                         :checked="selectedCompanionIds.includes(k.id)"
                         @change="toggleCompanionSelection(k.id)"
                         class="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                      />
                      <span class="text-sm font-medium text-slate-700">{{ k.user?.name ?? `Kader #${k.id}` }}</span>
                   </label>
                   <p v-if="companionOptions.length === 0" class="text-sm text-slate-400 text-center py-4">{{ isLoadingKader ? 'Memuat...' : 'Tidak ada kader lain yang tersedia.' }}</p>
                </div>
             </div>
          </div>

          <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
             <span class="text-sm text-slate-500"><b class="text-slate-800">{{ selectedPatientIds.length }}</b> pasien dipilih</span>
             <div class="flex items-center gap-3">
                <button @click="closeAssignFlow" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
                <button
                   @click="openConfirmModal"
                   :disabled="!canProceedToConfirm"
                   class="py-2.5 px-6 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                   Lanjutkan
                </button>
             </div>
          </div>
       </div>
    </div>

    <!-- Confirm Modal — daftar nama pasien terpilih sebelum submit + hasil partial success -->
    <div v-if="showConfirmModal" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
       <div class="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
          <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
             <h3 class="font-bold text-accent text-lg flex items-center gap-2">
               <LucideShieldCheck class="w-5 h-5 text-primary" />
               Konfirmasi Penugasan
             </h3>
             <button @click="showConfirmModal = false" class="text-slate-400 hover:text-slate-600 p-1">
                <LucideX class="w-5 h-5" />
             </button>
          </div>

          <div class="p-6 space-y-4 overflow-y-auto">
             <div class="bg-slate-50 rounded-xl border border-slate-100 p-4 text-sm space-y-1.5">
                <p><span class="text-slate-500">Kader:</span> <b class="text-slate-800">{{ kaderList.find(k => k.id === selectedKaderId)?.user?.name }}</b></p>
                <p v-if="selectedCompanionIds.length"><span class="text-slate-500">Pendamping:</span> <b class="text-slate-800">{{ kaderList.filter(k => selectedCompanionIds.includes(k.id)).map(k => k.user?.name).join(', ') }}</b></p>
                <p><span class="text-slate-500">Tanggal:</span> <b class="text-slate-800">{{ scheduledDate }}</b></p>
                <p><span class="text-slate-500">Prioritas:</span> <b class="text-slate-800 capitalize">{{ priority }}</b></p>
             </div>

             <div>
                <p class="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">{{ selectedPatients.length }} Pasien Terpilih</p>
                <ul class="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                   <li v-for="p in selectedPatients" :key="p.id" class="px-4 py-2.5 text-sm flex items-center justify-between gap-2">
                      <span class="font-semibold text-slate-800">{{ p.nama }}</span>
                      <span v-if="failedReason(p.id)" class="text-[10px] font-bold text-danger bg-danger/10 px-2 py-1 rounded-md text-right">{{ failedReason(p.id) }}</span>
                      <LucideCheckCircle v-else-if="bulkResult" class="w-4 h-4 text-success shrink-0" />
                   </li>
                </ul>
             </div>

             <p v-if="bulkResult" class="text-sm font-semibold" :class="bulkResult.failed.length === 0 ? 'text-success' : 'text-warning'">
                {{ bulkResult.created.length }} berhasil dibuat, {{ bulkResult.failed.length }} gagal.
             </p>
             <p v-if="bulkError" class="text-sm text-danger">{{ bulkError }}</p>
          </div>

          <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
             <template v-if="!bulkResult">
                <button @click="showConfirmModal = false" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Kembali</button>
                <button @click="submitBulkAssignment" :disabled="isSubmittingBulk" class="py-2.5 px-6 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70">
                   <LucideLoader2 v-if="isSubmittingBulk" class="w-4 h-4 animate-spin" />
                   {{ isSubmittingBulk ? 'Memproses...' : 'Tugaskan Sekarang' }}
                </button>
             </template>
             <button v-else @click="closeAssignFlow" class="py-2.5 px-6 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-700 transition-colors w-full">Tutup</button>
          </div>
       </div>
    </div>

    <!-- View Detail Modal -->
    <div v-if="showViewModal && selectedVisit" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
       <div class="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
          <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
             <h3 class="font-bold text-accent text-lg flex items-center gap-2">
               <LucideFileText class="w-5 h-5 text-primary" />
               Detail Laporan Kunjungan
             </h3>
             <button @click="showViewModal = false" class="text-slate-400 hover:text-slate-600 p-1">
                <LucideX class="w-5 h-5" />
             </button>
          </div>

          <div class="p-6 space-y-5 overflow-y-auto">
             <div class="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                   <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Status Kunjungan</p>
                   <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider" :class="getStatusColor(selectedVisit)">
                      {{ getStatusLabel(selectedVisit) }}
                   </span>
                </div>
                <div class="text-right">
                   <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Tenggat</p>
                   <p class="text-sm font-bold text-slate-800">{{ selectedVisit.scheduled_date }}</p>
                </div>
             </div>

             <div class="grid grid-cols-2 gap-4">
                <div>
                   <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Pasien</p>
                   <p class="text-sm font-bold text-slate-800">{{ selectedVisit.patient?.nama ?? '-' }}</p>
                </div>
                <div>
                   <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Kader Bertugas</p>
                   <p class="text-sm font-bold text-slate-800">{{ selectedVisit.kader?.name ?? '-' }}</p>
                </div>
             </div>

             <p v-if="isRepeat(selectedVisit)" class="text-xs font-semibold text-warning-700 bg-warning/10 border border-warning/20 rounded-xl px-3 py-2 flex items-start gap-2">
                <LucideAlertTriangle class="w-4 h-4 shrink-0 mt-0.5" />
                Laporan sebelumnya ditolak Super Admin, kader perlu mengulang kunjungan ini. Lihat catatan validasi di bawah.
             </p>

             <template v-if="selectedVisit.report">
                <div>
                   <h4 class="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide border-b border-slate-100 pb-2">Hasil Pemeriksaan</h4>
                   <p class="text-sm text-slate-700 font-semibold mb-3">Kondisi: {{ selectedVisit.report.kondisi }}</p>
                   <div v-if="selectedVisit.report.systolic || selectedVisit.report.diastolic" class="flex gap-4 mb-2">
                      <div class="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col items-center justify-center min-w-[100px] shadow-sm">
                         <span class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Sistolik</span>
                         <span class="text-2xl font-black text-danger leading-none">{{ selectedVisit.report.systolic ?? '-' }}</span>
                      </div>
                      <div class="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col items-center justify-center min-w-[100px] shadow-sm">
                         <span class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Diastolik</span>
                         <span class="text-2xl font-black text-warning leading-none">{{ selectedVisit.report.diastolic ?? '-' }}</span>
                      </div>
                   </div>
                </div>

                <div v-if="selectedVisit.report.keluhan">
                   <h4 class="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Keluhan Pasien</h4>
                   <p class="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed font-medium">"{{ selectedVisit.report.keluhan }}"</p>
                </div>

                <div>
                   <h4 class="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Catatan Kader</h4>
                   <p v-if="selectedVisit.report.catatan" class="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed font-medium">"{{ selectedVisit.report.catatan }}"</p>
                   <p v-else class="text-sm text-slate-400 italic">Tidak ada catatan.</p>
                </div>

                <!-- SECTION VALIDASI LAPORAN -- 2 tahap independen (docs/planning/02 §11):
                     penerimaan PJ (pj_reviewed_at) TIDAK bergantung/menunggu validasi final
                     super_admin (validation_status), begitu juga sebaliknya. -->
                <div class="pt-4 mt-2 border-t border-slate-100 space-y-4">
                   <div>
                      <h4 class="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Diterima PJ Prolanis</h4>
                      <span v-if="selectedVisit.report.pj_reviewed_at" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-success/10 text-success border border-success/20">
                         <LucideCheckCircle class="w-3.5 h-3.5" /> Diterima oleh {{ selectedVisit.report.pj_reviewed_by?.name ?? 'PJ Prolanis' }}
                      </span>
                      <span v-else class="px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-warning/10 text-warning border border-warning/20">Menunggu Diterima PJ</span>

                      <div v-if="isPjProlanis && !selectedVisit.report.pj_reviewed_at" class="mt-3">
                         <button @click="acceptReport" :disabled="isAccepting" class="w-full py-3 px-4 rounded-xl font-bold text-white bg-info hover:bg-info/90 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 active:scale-[0.98]">
                            <LucideCheckCircle class="w-5 h-5" v-if="!isAccepting"/>
                            <LucideLoader2 v-else class="w-5 h-5 animate-spin" />
                            {{ isAccepting ? 'Memproses...' : 'Terima Laporan' }}
                         </button>
                         <p v-if="acceptError" class="text-xs font-semibold text-danger mt-2">{{ acceptError }}</p>
                      </div>
                   </div>

                   <div>
                      <h4 class="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Validasi Final Super Admin</h4>
                      <span v-if="selectedVisit.report.validation_status === 'valid'" class="px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-success/10 text-success border border-success/20">Valid</span>
                      <span v-else-if="selectedVisit.report.validation_status === 'invalid'" class="px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-danger/10 text-danger border border-danger/20">Tidak Valid</span>
                      <span v-else class="px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-warning/10 text-warning border border-warning/20">Menunggu Validasi</span>
                      <p v-if="selectedVisit.report.validation_note" class="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 mt-2 leading-relaxed">
                         <span class="font-bold text-slate-700">Catatan:</span> "{{ selectedVisit.report.validation_note }}"
                      </p>

                      <div v-if="isSuperAdmin" class="mt-3">
                         <button @click="openValidationModal" class="w-full py-3 px-4 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]">
                            <LucideShieldCheck class="w-5 h-5" />
                            {{ selectedVisit.report.validation_status === 'pending' ? 'Validasi Laporan' : 'Ubah Keputusan Validasi' }}
                         </button>
                      </div>
                   </div>
                </div>
             </template>
             <p v-else class="text-sm text-slate-400 italic text-center py-4">Belum ada laporan kunjungan untuk kunjungan ini.</p>
          </div>
          
          <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end shrink-0">
             <button @click="showViewModal = false" class="py-2.5 px-6 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-700 transition-colors shadow-sm w-full">Tutup Detail</button>
          </div>
       </div>
    </div>

    <!-- Validation Modal untuk Super Admin -->
    <div v-if="showValidationModal && selectedVisit" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
       <div class="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
          <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
             <h3 class="font-bold text-accent text-lg flex items-center gap-2">
               <LucideShieldCheck class="w-5 h-5 text-primary" />
               Validasi Laporan
             </h3>
             <button @click="showValidationModal = false" class="text-slate-400 hover:text-slate-600 p-1">
                <LucideX class="w-5 h-5" />
             </button>
          </div>

          <div class="p-6 space-y-5 overflow-y-auto">
             <p class="text-sm text-slate-600">Tentukan apakah laporan kunjungan dari kader <span class="font-bold text-slate-800">{{ selectedVisit.kader?.name ?? '-' }}</span> ini valid atau tidak.</p>
             <p v-if="validationError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{{ validationError }}</p>

             <div>
                <label class="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Keputusan Validasi</label>
                <div class="flex gap-4">
                  <label class="flex-1 cursor-pointer">
                    <input type="radio" v-model="validationForm.is_valid" :value="true" class="peer sr-only" />
                    <div class="w-full py-3 px-4 rounded-xl border-2 border-slate-200 text-center text-sm font-bold text-slate-500 peer-checked:border-success peer-checked:bg-success/10 peer-checked:text-success transition-all flex items-center justify-center gap-2 shadow-sm">
                      <LucideCheckCircle class="w-5 h-5" />
                      Valid
                    </div>
                  </label>
                  <label class="flex-1 cursor-pointer">
                    <input type="radio" v-model="validationForm.is_valid" :value="false" class="peer sr-only" />
                    <div class="w-full py-3 px-4 rounded-xl border-2 border-slate-200 text-center text-sm font-bold text-slate-500 peer-checked:border-danger peer-checked:bg-danger/10 peer-checked:text-danger transition-all flex items-center justify-center gap-2 shadow-sm">
                      <LucideXCircle class="w-5 h-5" />
                      Tidak Valid
                    </div>
                  </label>
                </div>
             </div>
             
             <div>
                <label class="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Catatan (Opsional)</label>
                <textarea v-model="validationForm.note" rows="3" placeholder="Tambahkan alasan mengapa tidak valid, atau catatan lainnya..." class="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none bg-slate-50 hover:bg-white transition-colors"></textarea>
             </div>
          </div>
          
          <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
             <button @click="showValidationModal = false" class="py-2.5 px-5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
             <button @click="submitValidation" class="py-2.5 px-6 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 active:scale-[0.98]" :disabled="isValidating">
                <LucideLoader2 v-if="isValidating" class="w-5 h-5 animate-spin" />
                <LucideSave v-else class="w-5 h-5" />
                {{ isValidating ? 'Menyimpan...' : 'Simpan Keputusan' }}
             </button>
          </div>
       </div>
    </div>

  </div>
</template>
