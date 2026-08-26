<script setup lang="ts">
import type { ApiSuccessEnvelope, AssignmentStatus, VisitAssignment, Puskesmas, VisitMonitoringResponse, PaginatedData } from '~/types/api'
import flatpickr from 'flatpickr'
import 'flatpickr/dist/flatpickr.css'
import { Indonesian } from 'flatpickr/dist/l10n/id.js'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
useHead({
  title: 'Data Kunjungan Prolanis'
})

// GET /visit-assignments -- sudah ter-scope backend (VisitAssignmentService::scopedQuery):
// super_admin semua, admin_puskesmas/pj_prolanis cuma puskesmasnya sendiri.
//
// Revisi paginasi SERVER-SIDE (sebelumnya fetchAllPages menarik SEMUA baris lewat per_page=100
// berulang lalu filter/paginate di JS -- blok "Pagination" di UI cuma dekorasi, tidak fungsional
// sama sekali, dan tabel "Semua"/"Selesai" bisa berat kalau datanya banyak). Sama pola dengan
// dashboard/pasien/index.vue: search/status/puskesmas_id dikirim sebagai query param, hasil
// pagination.total/current_page/last_page dari backend dipakai langsung.
const visitsList = ref<VisitAssignment[]>([])
const totalCount = ref(0)
const currentPage = ref(1)
const lastPage = ref(1)
const PER_PAGE = 20
// isInitialLoading (skeleton penuh, cuma true di load PERTAMA) vs isRefetching (silent --
// halaman refresh data di latar belakang tanpa mengosongkan tabel yang sedang tampil, dipakai
// setelah aksi berhasil seperti bulk-assign/batalkan supaya tidak terasa "reload dari nol").
const isInitialLoading = ref(true)
const isRefetching = ref(false)
const visitsError = ref('')

async function loadVisits(page = currentPage.value) {
  if (visitsList.value.length === 0) isInitialLoading.value = true
  else isRefetching.value = true
  visitsError.value = ''
  try {
    const api = useApi()
    const res = await api('/visit-assignments', {
      query: {
        per_page: PER_PAGE,
        page,
        ...(searchQuery.value.trim() ? { search: searchQuery.value.trim() } : {}),
        ...(filterStatus.value ? { status: filterStatus.value } : {}),
        ...(isSuperAdmin.value && filterPuskesmasId.value ? { puskesmas_id: filterPuskesmasId.value } : {})
      }
    }) as ApiSuccessEnvelope<PaginatedData<VisitAssignment>>
    visitsList.value = res.data.items
    totalCount.value = res.data.pagination.total
    currentPage.value = res.data.pagination.current_page
    lastPage.value = res.data.pagination.last_page
  } catch (e) {
    visitsError.value = e instanceof ApiError ? e.message : 'Gagal memuat data kunjungan.'
  } finally {
    isInitialLoading.value = false
    isRefetching.value = false
  }
}

function goToPage(page: number) {
  if (page < 1 || page > lastPage.value || page === currentPage.value || isInitialLoading.value || isRefetching.value) return
  loadVisits(page)
}
// Monitoring (revisi Bu Kadis) -- summary status + breakdown per desa, endpoint TERPISAH
// (bukan diturunkan dari visitsList di atas) karena backend menghitungnya di database (COUNT
// per status, JOIN ke desa) -- lebih akurat & murah daripada agregasi ulang di JS dari 100 baris
// per_page yang sudah dimuat, dan tetap benar walau visitsList nanti dipaginate beneran.
const monitoring = ref<VisitMonitoringResponse | null>(null)
const isLoadingMonitoring = ref(false)
const monitoringError = ref('')
const showMonitoringDesaTable = ref(false)

async function loadMonitoring() {
  isLoadingMonitoring.value = true
  monitoringError.value = ''
  try {
    const api = useApi()
    const res = await api('/visit-assignments/monitoring') as ApiSuccessEnvelope<VisitMonitoringResponse>
    monitoring.value = res.data
  } catch (e) {
    monitoringError.value = e instanceof ApiError ? e.message : 'Gagal memuat data monitoring.'
  } finally {
    isLoadingMonitoring.value = false
  }
}

// Realtime (permintaan user, lewat produli-wss) -- backend membroadcast "visit_report.submitted"
// ke topic puskesmas:{id}/role:super_admin tiap ada laporan kunjungan masuk (lihat
// RealtimeBroadcastService::broadcastDashboardSignal() sisi backend), halaman ini sebelumnya
// cuma load sekali saat mount tanpa cara tahu ada laporan baru tanpa refresh manual. Poll 2 menit
// dipertahankan sebagai jaring pengaman (socket gagal connect/putus lama), sama pola dgn
// dashboard/rujukan/index.vue.
let pollTimer: ReturnType<typeof setInterval> | null = null
let unsubscribeRealtime: (() => void) | null = null

function refreshOnSignal() {
  loadVisits()
  loadMonitoring()
}

onMounted(async () => {
  loadVisits()
  loadPuskesmasFullList()
  loadMonitoring()

  pollTimer = setInterval(refreshOnSignal, 120_000)

  const { subscribe, dashboardTopic } = useRealtime()
  const topic = dashboardTopic()
  if (topic) {
    unsubscribeRealtime = await subscribe(topic, 'visit_report.submitted', refreshOnSignal)
  }
})
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  unsubscribeRealtime?.()
})

const searchQuery = ref('')
const filterStatus = ref('')
// Puskesmas ID (BUKAN nama lagi) -- dikirim sebagai query param puskesmas_id ke backend
// (VisitAssignmentController::index()), yang cuma benar-benar menghormatinya untuk super_admin
// (DataScope::isFullAccess) -- sama persis pola PatientController. admin_puskesmas/pj_prolanis
// sudah terkunci ke puskesmasnya sendiri lewat scopedQuery(), dropdown ini disembunyikan untuk
// mereka (lihat template) supaya tidak menampilkan filter yang toh tidak berpengaruh apa pun.
const filterPuskesmasId = ref<number | null>(null)

// Opsi filter puskesmas -- KHUSUS super_admin (lihat catatan filterPuskesmasId di atas). Fetch
// daftar LENGKAP (GET /puskesmas, semua role staf boleh baca) supaya tetap mencakup seluruh 31
// puskesmas se-kabupaten, bukan cuma yang kebetulan muncul di halaman yang sedang dimuat.
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
const puskesmasOptions = computed(() => [...puskesmasFullList.value].sort((a, b) => a.nama.localeCompare(b.nama)))

// Deep-link dari card "Lihat Detail"/"Kunjungan Selesai" di /dashboard (docs/planning/02 §17) —
// ?status=completed dkk pre-select filter di atas. Validasi ketat, jangan langsung pakai nilai
// query URL apa adanya (bisa diubah manual/dibagikan).
const VALID_STATUS_FILTERS = ['pending', 'in_progress', 'completed', 'cancelled', 'terlambat', 'diulang']
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

// Filter search/status/puskesmas SEKARANG server-side (lihat loadVisits()) -- visitsList sudah
// berisi HANYA baris hasil query terfilter+terpaginasi backend, tidak perlu disaring lagi di JS.
// Reset ke halaman 1 begitu filter apa pun berubah (halaman 5 hasil filter lama biasanya tidak
// nyambung sama sekali dengan hasil filter baru).
watch(filterStatus, () => loadVisits(1))
watch(filterPuskesmasId, () => loadVisits(1))
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => loadVisits(1), 350)
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

// Petugas bertugas -- kader ATAU tenaga_kesehatan (saling eksklusif, revisi Bu Kadis PMO).
// Dipakai tabel/detail supaya baris kunjungan milik nakes tidak tampil "-" begitu saja.
function petugasName(visit) {
  return visit.kader?.name ?? visit.tenaga_kesehatan?.name ?? '-'
}
function petugasLabel(visit) {
  return visit.tenaga_kesehatan ? 'Tenaga Kesehatan' : 'Kader'
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
// patient_id -> { at: ISO string, by: nama petugas } -- kunjungan TERAKHIR pasien itu, dihitung
// dari assignments yang sudah di-fetch di loadCandidates(). Map (bukan object) supaya key
// numerik tidak perlu di-string-kan.
const patientLastVisit = ref(new Map())
function lastVisitLabel(patientId) {
  const v = patientLastVisit.value.get(patientId)
  if (!v) return null
  const d = new Date(v.at)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `Terakhir dikunjungi ${dd} ${mm} ${d.getFullYear()} ${hh}:${min} oleh ${v.by}`
}
const isLoadingCandidates = ref(false)
const candidatesError = ref('')

const kaderList = ref([])
const isLoadingKader = ref(false)
const kaderError = ref('')

// Tenaga kesehatan (revisi Bu Kadis PMO) -- alternatif "Kader" sebagai jenis petugas yang
// ditugaskan. POST /care-assignments TIDAK punya endpoint bulk seperti kader (cuma terima 1
// patient_id per panggilan) -- assignTenagaKesehatanBatch() di bawah loop per pasien di
// FRONTEND, mengumpulkan hasil ke bentuk {created, failed} yang SAMA seperti response bulk
// kader, supaya modal konfirmasi & penanganan partial-success bisa dipakai bersama tanpa
// duplikasi template.
const petugasType = ref('kader') // 'kader' | 'tenaga_kesehatan'
const tenagaKesehatanList = ref([])
const isLoadingTenagaKesehatan = ref(false)
const tenagaKesehatanError = ref('')
const selectedTenagaKesehatanId = ref(null)
// Kunjungan hari-1 bersama (CareAssignmentService::assignTenagaKesehatan) -- BEDA dari
// selectedCompanionIds kader di bawah: cuma SATU kader pendamping (bukan daftar), backend
// menandainya companion di kunjungan pertama nakes + langsung aktifkan rencana mingguan kader.
const selectedNakesKaderCompanionId = ref(null)

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
const scheduledDateInputRef = ref(null)
const priority = ref('berat')

// Flatpickr (mirror pola dashboard/index.vue initDateRangePicker) -- dateFormat 'Y-m-d' PERSIS
// yang diterima Laravel ('date' validation rule), altInput tampilkan format manusiawi terpisah
// supaya v-model (scheduledDate) tidak pernah bergantung ke parsing string flatpickr baliknya.
// Modal ini v-if (unmount total saat ditutup) -- setiap kali dibuka DOM input-nya baru, jadi
// re-init aman tanpa perlu destroy instance lama.
function initScheduledDatePicker() {
  if (!scheduledDateInputRef.value) return
  flatpickr(scheduledDateInputRef.value, {
    locale: Indonesian,
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'j F Y',
    minDate: 'today',
    onChange: (selectedDates) => {
      const d = selectedDates[0]
      scheduledDate.value = d
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        : ''
    }
  })
}

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

    // "Terakhir dikunjungi" (temuan lapangan, revisi Bu Kadis) -- admin_puskesmas/pj_prolanis
    // perlu tahu riwayat kunjungan SEBELUM memilih pasien buat ditugaskan lagi, supaya tidak
    // menugaskan ulang pasien yang baru saja dikunjungi tanpa sadar. Dihitung dari `assignments`
    // yang SUDAH di-fetch penuh di atas (bukan fetch tambahan) -- ambil laporan TERBARU per
    // pasien (report.created_at = waktu submit sesungguhnya, BUKAN scheduled_date yang cuma
    // tanggal tanpa jam).
    const lastVisitMap = new Map()
    for (const a of assignments) {
      if (!a.report?.created_at || !a.patient?.id) continue
      const existing = lastVisitMap.get(a.patient.id)
      if (!existing || new Date(a.report.created_at) > new Date(existing.at)) {
        lastVisitMap.set(a.patient.id, { at: a.report.created_at, by: petugasName(a) })
      }
    }
    patientLastVisit.value = lastVisitMap
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

async function loadTenagaKesehatanList() {
  isLoadingTenagaKesehatan.value = true
  tenagaKesehatanError.value = ''
  try {
    const api = useApi()
    tenagaKesehatanList.value = await fetchAllPages((page) => api('/tenaga-kesehatan', { query: { status_aktif: true, per_page: 100, page } }))
  } catch (e) {
    tenagaKesehatanError.value = e instanceof ApiError ? e.message : 'Gagal memuat daftar tenaga kesehatan.'
  } finally {
    isLoadingTenagaKesehatan.value = false
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

async function openAssignModal() {
  showAddModal.value = true
  loadCandidates()
  loadKaderList()
  loadTenagaKesehatanList()
  lockAssignKecamatan()
  await nextTick()
  initScheduledDatePicker()
}

function closeAssignFlow() {
  showAddModal.value = false
  showConfirmModal.value = false
  petugasType.value = 'kader'
  selectedPatientIds.value = []
  selectedKaderId.value = null
  selectedCompanionIds.value = []
  selectedTenagaKesehatanId.value = null
  selectedNakesKaderCompanionId.value = null
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

const canProceedToConfirm = computed(() => {
  if (selectedPatientIds.value.length === 0 || !scheduledDate.value) return false
  if (petugasType.value === 'tenaga_kesehatan') return !!selectedTenagaKesehatanId.value
  return !!selectedKaderId.value && !!priority.value
})

function openConfirmModal() {
  if (!canProceedToConfirm.value) return
  showConfirmModal.value = true
}

function failedReason(patientId) {
  return bulkResult.value?.failed.find((f) => f.patient_id === patientId)?.reason
}

// POST /care-assignments cuma terima 1 patient_id per panggilan (tidak seperti
// /visit-assignments/bulk) -- loop sekuensial per pasien terpilih, kumpulkan hasil ke bentuk
// {created, failed} yang SAMA seperti response bulk kader supaya modal konfirmasi & penanganan
// partial-success di bawah tetap satu jalur untuk kedua jenis petugas.
async function assignTenagaKesehatanBatch() {
  const api = useApi()
  const created = []
  const failed = []
  for (const patientId of selectedPatientIds.value) {
    try {
      const res = await api('/care-assignments', {
        method: 'POST',
        body: {
          patient_id: patientId,
          tenaga_kesehatan_id: selectedTenagaKesehatanId.value,
          scheduled_date: scheduledDate.value,
          kader_id: selectedNakesKaderCompanionId.value
        }
      })
      created.push(res.data)
    } catch (e) {
      failed.push({ patient_id: patientId, reason: e instanceof ApiError ? e.message : 'Gagal menugaskan.' })
    }
  }
  return { created, failed }
}

async function submitBulkAssignment() {
  isSubmittingBulk.value = true
  bulkError.value = ''
  try {
    let resultData
    if (petugasType.value === 'tenaga_kesehatan') {
      resultData = await assignTenagaKesehatanBatch()
    } else {
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
      resultData = res.data
    }
    bulkResult.value = resultData
    for (const created of resultData.created) {
      if (created.patient?.id) assignedPatientIds.value.add(created.patient.id)
    }
    // Semua sukses tanpa kegagalan -> tutup alur langsung + toast + silent refresh (penugasan
    // baru harus langsung terlihat di tabel tanpa reload manual). Ada yang gagal -> biarkan modal
    // konfirmasi terbuka menampilkan hasil partial success supaya PJ tahu mana yang perlu ditinjau.
    if (resultData.failed.length === 0) {
      closeAssignFlow()
      useToast().add({
        title: resultData.created.length > 1 ? `${resultData.created.length} penugasan kunjungan berhasil dibuat` : 'Penugasan kunjungan berhasil dibuat',
        color: 'success'
      })
      await loadVisits(1)
      await loadMonitoring()
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

// Deep-link dari notifikasi bel / tombol "Lihat Kunjungan" di FCM (laporan kunjungan baru) --
// ?assignment_id= buka langsung modal detail assignment terkait, tanpa perlu klik manual di
// tabel. Sama pola validasinya dgn ?status= di atas (whitelist/format ketat, bukan pakai nilai
// URL apa adanya). visitsList baru terisi setelah loadVisits() (async) selesai, jadi pakai
// watch (bukan cek langsung) supaya tetap kebuka meski query hadir sebelum data siap.
if (typeof route.query.assignment_id === 'string' && /^\d+$/.test(route.query.assignment_id)) {
  const targetAssignmentId = Number(route.query.assignment_id)
  const stopAssignmentDeepLink = watch(visitsList, (list) => {
    const found = list.find((v) => v.id === targetAssignmentId)
    if (found) {
      viewVisit(found)
      stopAssignmentDeepLink()
    }
  }, { immediate: true })
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
//
// REVISI (laporan user: "tombol konfirmasi pj prolanis dimana?") -- sebelumnya SATU-SATUNYA cara
// menerima laporan adalah buka modal detail dulu (klik ikon mata), scroll ke bawah, baru ketemu
// tombolnya -- tidak ada penanda apa pun di tabel sendiri kalau suatu baris menunggu tindakan PJ,
// beda dengan super_admin yang sudah dapat tombol validasi cepat langsung di baris (lihat
// quickValidate() di atas). acceptReport() sekarang terima parameter `visit` eksplisit (dipanggil
// baik dari tombol cepat di baris tabel MAUPUN dari dalam modal, bukan cuma dari selectedVisit)
// supaya bisa dipakai di tabel, dan menyamakan `visit` dgn `selectedVisit` kalau sedang dibuka.
const acceptingVisitId = ref(null)
const acceptError = ref('')
const acceptReport = async (visit) => {
  if (!visit?.report) return
  acceptingVisitId.value = visit.id
  acceptError.value = ''
  try {
    const api = useApi()
    const res = await api(`/visit-reports/${visit.report.id}/accept`, { method: 'PATCH' })
    visit.report = res.data
    if (selectedVisit.value?.id === visit.id) selectedVisit.value.report = res.data
    const idx = visitsList.value.findIndex((v) => v.id === visit.id)
    if (idx !== -1) visitsList.value[idx].report = res.data
    useToast().add({ title: 'Laporan kunjungan diterima', color: 'success' })
  } catch (e) {
    acceptError.value = e instanceof ApiError ? e.message : 'Gagal menerima laporan.'
    useToast().add({ title: acceptError.value, color: 'error' })
  } finally {
    acceptingVisitId.value = null
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
    useToast().add({
      title: validationForm.value.is_valid ? 'Laporan ditandai valid' : 'Laporan ditandai tidak valid',
      color: validationForm.value.is_valid ? 'success' : 'warning'
    })
  } catch (e) {
    validationError.value = e instanceof ApiError ? e.message : 'Gagal menyimpan validasi.'
  } finally {
    isValidating.value = false
  }
}

// --- "..." dropdown per baris (menggantikan tombol centang/x begitu laporan SUDAH divalidasi,
// temuan lapangan: centang/x yang tetap tampil setelah divalidasi membingungkan -- terlihat
// seperti belum diputuskan). Satu ref untuk baris mana yang dropdown-nya terbuka (bukan per-
// baris ref terpisah), ditutup otomatis saat klik di luar. ---
// Dropdown per-baris di dalam v-for -- SATU ref target tunggal (pola onClickOutside biasa)
// tidak cocok karena elemennya berpindah-pindah baris. Pakai listener klik global + cek
// closest() ke class marker (.visit-actions-dropdown) -- jauh lebih sederhana & tetap benar
// untuk berapa pun baris tabel-nya.
const openActionsForVisitId = ref<number | null>(null)
useEventListener(document, 'click', (e) => {
  if (openActionsForVisitId.value === null) return
  if (!(e.target as HTMLElement)?.closest?.('.visit-actions-dropdown')) {
    openActionsForVisitId.value = null
  }
})

const isRevertingValidation = ref(false)
async function revertValidation(visit) {
  if (!visit.report) return
  isRevertingValidation.value = true
  openActionsForVisitId.value = null
  try {
    const api = useApi()
    const res = await api(`/validasi-laporan/${visit.report.id}/batalkan`, { method: 'PATCH' })
    visit.report = res.data
    if (visit.report.validation_status === 'pending') {
      // revertValidation() backend bisa mengembalikan assignment ke 'completed' kalau
      // sebelumnya invalid (lihat VisitReportReviewService::revertValidation()) -- refresh
      // silent supaya baris ini langsung mencerminkan status assignment terbaru dari server,
      // bukan menebak transisinya di frontend.
      await loadVisits(currentPage.value)
    }
    useToast().add({ title: 'Validasi dibatalkan, laporan kembali menunggu validasi', color: 'warning' })
  } catch (e) {
    useToast().add({ title: e instanceof ApiError ? e.message : 'Gagal membatalkan validasi.', color: 'error' })
  } finally {
    isRevertingValidation.value = false
  }
}

// --- Validasi massal (temuan lapangan, UX super_admin) -- pilih beberapa laporan PENDING
// sekaligus lewat checkbox, satu keputusan untuk semuanya. Cuma laporan validation_status=
// 'pending' yang bisa dipilih (yang sudah diputuskan pakai "..." > Batalkan Validasi dulu kalau
// mau diubah, bukan ikut tercentang di sini). ---
const selectedReportIds = ref<number[]>([])
function isSelectableForBulk(visit) {
  return isSuperAdmin.value && visit.report && visit.report.validation_status === 'pending'
}
function isReportSelected(visit) {
  return !!visit.report && selectedReportIds.value.includes(visit.report.id)
}
function toggleSelectReport(visit) {
  if (!visit.report) return
  const id = visit.report.id
  const idx = selectedReportIds.value.indexOf(id)
  if (idx === -1) selectedReportIds.value.push(id)
  else selectedReportIds.value.splice(idx, 1)
}
const selectablePendingOnPage = computed(() => visitsList.value.filter((v) => isSelectableForBulk(v)))
const allPendingOnPageSelected = computed(() =>
  selectablePendingOnPage.value.length > 0 &&
  selectablePendingOnPage.value.every((v) => selectedReportIds.value.includes(v.report.id))
)
function toggleSelectAllPendingOnPage() {
  if (allPendingOnPageSelected.value) {
    const idsOnPage = selectablePendingOnPage.value.map((v) => v.report.id)
    selectedReportIds.value = selectedReportIds.value.filter((id) => !idsOnPage.includes(id))
  } else {
    const idsOnPage = selectablePendingOnPage.value.map((v) => v.report.id)
    selectedReportIds.value = [...new Set([...selectedReportIds.value, ...idsOnPage])]
  }
}
// Baris terpilih (utk daftar nama + preview di modal konfirmasi) -- dicari dari visitsList
// halaman yang sedang tampil, cukup karena seleksi memang cuma dibuat dari baris yang terlihat.
const selectedVisitsPreview = computed(() =>
  visitsList.value.filter((v) => v.report && selectedReportIds.value.includes(v.report.id))
)

const showBulkValidateModal = ref(false)
const bulkValidateForm = ref({ is_valid: true, note: '' })
const isBulkValidating = ref(false)
const bulkValidateError = ref('')
function openBulkValidateModal() {
  if (selectedReportIds.value.length === 0) return
  bulkValidateForm.value = { is_valid: true, note: '' }
  bulkValidateError.value = ''
  showBulkValidateModal.value = true
}
async function submitBulkValidate() {
  if (selectedReportIds.value.length === 0) return
  isBulkValidating.value = true
  bulkValidateError.value = ''
  try {
    const api = useApi()
    await api('/validasi-laporan-bulk', {
      method: 'PATCH',
      body: {
        report_ids: selectedReportIds.value,
        is_valid: bulkValidateForm.value.is_valid,
        note: bulkValidateForm.value.note || null
      }
    })
    showBulkValidateModal.value = false
    useToast().add({
      title: `${selectedReportIds.value.length} laporan berhasil divalidasi`,
      color: bulkValidateForm.value.is_valid ? 'success' : 'warning'
    })
    selectedReportIds.value = []
    await loadVisits(currentPage.value)
  } catch (e) {
    bulkValidateError.value = e instanceof ApiError ? e.message : 'Gagal menyimpan validasi massal.'
  } finally {
    isBulkValidating.value = false
  }
}

// --- Batalkan Penugasan (keputusan Kepala Dinas) -- PATCH /visit-assignments/{id}/cancel,
// VisitAssignmentPolicy::cancel(): admin_puskesmas/pj_prolanis sepuskesmas boleh LANGSUNG, TANPA
// approval super_admin. Replikasi dari dashboard/kunjungan/[id].vue (halaman detail) supaya aksi
// yang sama tersedia langsung dari tabel index, bukan cuma setelah masuk ke detail dulu. ---
const canCancelAssignment = computed(() => isPjProlanis.value || (authStore.roles ?? []).includes('admin_puskesmas'))
function canCancelVisitNow(visit) {
  return canCancelAssignment.value && ['pending', 'in_progress'].includes(visit.status)
}

const visitToCancel = ref(null)
const showCancelConfirm = ref(false)
const cancelReason = ref('')
const isCancelling = ref(false)
const cancelError = ref('')

function requestCancel(visit) {
  visitToCancel.value = visit
  cancelReason.value = ''
  cancelError.value = ''
  showCancelConfirm.value = true
}

async function confirmCancel() {
  if (!visitToCancel.value) return
  isCancelling.value = true
  cancelError.value = ''
  try {
    const api = useApi()
    await api(`/visit-assignments/${visitToCancel.value.id}/cancel`, {
      method: 'PATCH',
      body: cancelReason.value.trim() ? { reason: cancelReason.value.trim() } : {}
    })
    showCancelConfirm.value = false
    useToast().add({ title: 'Penugasan dibatalkan', color: 'success' })
    // Silent refresh -- baris yang baru dibatalkan cukup hilang/berubah status di halaman yang
    // sedang dilihat, tidak perlu skeleton penuh seolah halaman dimuat ulang dari awal.
    await loadVisits(currentPage.value)
  } catch (e) {
    cancelError.value = e instanceof ApiError ? e.message : 'Gagal membatalkan penugasan.'
  } finally {
    isCancelling.value = false
  }
}

// --- Hapus Kunjungan (permintaan user, takut ada kunjungan yang BENAR-BENAR salah) -- DELETE
// /visit-assignments/{id}, VisitAssignmentPolicy::delete(): super_admin SAJA (beda dari
// Batalkan di atas yang admin_puskesmas/pj_prolanis juga boleh) -- ini soft-delete permanen
// dari tampilan (baris + laporan terkait hilang dari SEMUA daftar/riwayat), bukan cuma ubah
// status, jadi digerbang lebih ketat. Alasan WAJIB diisi (beda dari Batalkan yang opsional).
const canDeleteAssignment = computed(() => isSuperAdmin.value)
const visitToDelete = ref(null)
const showDeleteConfirm = ref(false)
const deleteReason = ref('')
const isDeleting = ref(false)
const deleteError = ref('')

function requestDelete(visit) {
  visitToDelete.value = visit
  deleteReason.value = ''
  deleteError.value = ''
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (!visitToDelete.value || !deleteReason.value.trim()) return
  isDeleting.value = true
  deleteError.value = ''
  try {
    const api = useApi()
    await api(`/visit-assignments/${visitToDelete.value.id}`, {
      method: 'DELETE',
      body: { reason: deleteReason.value.trim() }
    })
    showDeleteConfirm.value = false
    useToast().add({ title: 'Kunjungan berhasil dihapus', color: 'success' })
    await loadVisits(currentPage.value)
  } catch (e) {
    const firstFieldError = e instanceof ApiError && e.errors ? Object.values(e.errors)[0]?.[0] : null
    deleteError.value = firstFieldError ?? (e instanceof ApiError ? e.message : 'Gagal menghapus kunjungan.')
  } finally {
    isDeleting.value = false
  }
}

// --- Tugaskan Ulang Kunjungan Ini (temuan lapangan, revisi Bu Kadis) -- KHUSUS admin_puskesmas/
// pj_prolanis (VisitAssignmentPolicy::create() menolak super_admin untuk jalur kader; super_admin
// TIDAK diberi tombol ini sama sekali, bukan cuma disembunyikan setengah). Petugas (kader ATAU
// tenaga_kesehatan) & prioritas dipakai APA ADANYA dari kunjungan lama -- cuma tanggal baru yang
// perlu diisi ulang, supaya admin tidak perlu memilih petugas dari daftar lagi.
//
// SENGAJA cuma untuk status 'cancelled' -- BUKAN untuk 'diulang'/invalid: assignment yang
// ditolak validasi SUDAH otomatis dibuka lagi ke status 'pending' oleh backend
// (VisitReportReviewService::validateReport()), kader/nakes-nya sudah melihatnya lagi di
// daftar tugas sendiri. VisitAssignmentService::assign()/CareAssignmentService tidak punya
// guard anti-duplikat sama sekali -- membuat penugasan BARU untuk kasus yang sudah otomatis
// terbuka lagi akan menghasilkan 2 tugas untuk pasien yang sama, membingungkan kader di lapangan.
function canReassignVisit(visit) {
  return canCancelAssignment.value && displayStatus(visit) === 'cancelled'
}

const visitToReassign = ref(null)
const showReassignModal = ref(false)
const reassignDate = ref('')
const reassignDateInputRef = ref(null)
const isReassigning = ref(false)
const reassignError = ref('')

// Flatpickr (permintaan user: konsisten di SELURUH input tanggal, config bersama lewat
// useFlatpickr.ts) -- sebelumnya <input type="date"> native, tidak konsisten dgn picker lain di
// halaman ini & lintas browser/OS tampilannya berbeda-beda.
function initReassignDatePicker() {
  initDatePicker(reassignDateInputRef.value, reassignDate, { minDate: 'today' })
}

async function requestReassign(visit) {
  visitToReassign.value = visit
  reassignDate.value = ''
  reassignError.value = ''
  showReassignModal.value = true
  openActionsForVisitId.value = null
  await nextTick()
  initReassignDatePicker()
}

async function confirmReassign() {
  const visit = visitToReassign.value
  if (!visit || !reassignDate.value) return
  isReassigning.value = true
  reassignError.value = ''
  try {
    const api = useApi()
    if (visit.kader) {
      await api('/visit-assignments', {
        method: 'POST',
        body: {
          patient_id: visit.patient.id,
          kader_id: visit.kader.id,
          scheduled_date: reassignDate.value,
          priority: visit.priority
        }
      })
    } else if (visit.tenaga_kesehatan) {
      await api('/care-assignments', {
        method: 'POST',
        body: {
          patient_id: visit.patient.id,
          tenaga_kesehatan_id: visit.tenaga_kesehatan.id,
          scheduled_date: reassignDate.value,
          kader_id: null
        }
      })
    } else {
      reassignError.value = 'Kunjungan ini tidak punya petugas kader/tenaga kesehatan yang jelas, tidak bisa ditugaskan ulang otomatis.'
      return
    }
    showReassignModal.value = false
    useToast().add({ title: 'Kunjungan berhasil ditugaskan ulang', color: 'success' })
    await loadVisits(currentPage.value)
  } catch (e) {
    // REVISI (laporan user: "tugaskan kembali gagal") -- sebelumnya cuma e.message (pesan
    // generik Laravel "The given data was invalid.") ditampilkan, alasan SPESIFIK gagalnya
    // (mis. "Wilayah pasien belum resolved", "Kader bukan dari puskesmas yang sama", "Pasien
    // ini sudah punya assignment aktif" -- lihat VisitAssignmentService::ensureWilayahResolvable/
    // ensureKaderAvailable) ada di e.errors tapi tidak pernah ditampilkan, jadi user tidak tahu
    // alasan sebenarnya & menebak-nebak (format tanggal, dst). Pola sama dgn app/kunjungan/[id].vue.
    const firstFieldError = e instanceof ApiError && e.errors ? Object.values(e.errors)[0]?.[0] : null
    reassignError.value = firstFieldError ?? (e instanceof ApiError ? e.message : 'Gagal menugaskan ulang kunjungan.')
  } finally {
    isReassigning.value = false
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

    <!-- Monitoring (revisi Bu Kadis) -- ringkasan status + siapa mengunjungi desa mana, endpoint
         TERPISAH dari visitsList (GET /visit-assignments/monitoring, dihitung backend). -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
      <div class="flex items-center gap-2 mb-4">
        <LucideGauge class="w-4 h-4 text-primary" />
        <h2 class="font-bold text-accent text-sm">Monitoring Kunjungan</h2>
      </div>

      <p v-if="monitoringError" class="text-xs font-semibold text-danger mb-3">{{ monitoringError }}</p>

      <div v-if="isLoadingMonitoring && !monitoring" class="py-8 text-center text-slate-400 text-sm">
        <LucideLoader2 class="w-5 h-5 mx-auto mb-2 animate-spin" />
        Memuat monitoring...
      </div>

      <template v-else-if="monitoring">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Belum Dikunjungi</p>
            <p class="text-2xl font-extrabold text-accent">{{ monitoring.summary.pending }}</p>
          </div>
          <div class="rounded-xl border border-info/20 bg-info/5 p-4">
            <p class="text-[10px] font-bold uppercase tracking-widest text-info mb-1">Sedang Proses</p>
            <p class="text-2xl font-extrabold text-info">{{ monitoring.summary.in_progress }}</p>
          </div>
          <div class="rounded-xl border border-success/20 bg-success/5 p-4">
            <p class="text-[10px] font-bold uppercase tracking-widest text-success mb-1">Selesai</p>
            <p class="text-2xl font-extrabold text-success">{{ monitoring.summary.completed }}</p>
          </div>
          <div class="rounded-xl border p-4" :class="monitoring.summary.overdue > 0 ? 'border-danger/20 bg-danger/5' : 'border-slate-100 bg-slate-50'">
            <p class="text-[10px] font-bold uppercase tracking-widest mb-1" :class="monitoring.summary.overdue > 0 ? 'text-danger' : 'text-slate-400'">Tenggat Lewat</p>
            <p class="text-2xl font-extrabold" :class="monitoring.summary.overdue > 0 ? 'text-danger' : 'text-accent'">{{ monitoring.summary.overdue }}</p>
          </div>
        </div>

        <!-- Per desa -- "siapa mengunjungi desa mana" -- collapsed default (bisa cukup panjang
             di puskesmas dgn banyak desa), toggle sama pola dgn section lain di halaman ini. -->
        <div v-if="monitoring.per_desa.length" class="mt-4 pt-4 border-t border-slate-100">
          <button type="button" @click="showMonitoringDesaTable = !showMonitoringDesaTable" class="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
            <LucideChevronDown class="w-3.5 h-3.5 transition-transform" :class="{ 'rotate-180': showMonitoringDesaTable }" />
            {{ showMonitoringDesaTable ? 'Sembunyikan' : 'Lihat' }} Rincian per Desa ({{ monitoring.per_desa.length }} desa)
          </button>

          <div v-if="showMonitoringDesaTable" class="overflow-x-auto mt-3">
            <table class="w-full text-left border-collapse min-w-[560px]">
              <thead>
                <tr class="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th class="py-2.5 px-3 font-semibold">Desa</th>
                  <th class="py-2.5 px-3 font-semibold text-center">Total</th>
                  <th class="py-2.5 px-3 font-semibold text-center">Belum</th>
                  <th class="py-2.5 px-3 font-semibold text-center">Proses</th>
                  <th class="py-2.5 px-3 font-semibold text-center">Selesai</th>
                  <th class="py-2.5 px-3 font-semibold">Petugas</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="row in monitoring.per_desa" :key="row.desa_id" class="text-sm">
                  <td class="py-2.5 px-3 font-semibold text-slate-700">{{ row.desa_nama }}</td>
                  <td class="py-2.5 px-3 text-center font-bold text-accent">{{ row.total }}</td>
                  <td class="py-2.5 px-3 text-center text-slate-600">{{ row.pending }}</td>
                  <td class="py-2.5 px-3 text-center text-info">{{ row.in_progress }}</td>
                  <td class="py-2.5 px-3 text-center text-success">{{ row.completed }}</td>
                  <td class="py-2.5 px-3 text-slate-500 text-xs">{{ row.petugas.join(', ') || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p v-else class="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400 italic">
          Belum ada kunjungan.
        </p>
      </template>
    </div>

    <!-- Bar aksi validasi massal -- KHUSUS super_admin, muncul begitu ada laporan pending yang
         dicentang (temuan lapangan, UX validasi banyak laporan sekaligus tanpa buka satu-satu). -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div v-if="isSuperAdmin && selectedReportIds.length > 0" class="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
        <span class="text-sm font-bold text-primary flex items-center gap-2">
          <LucideSquareCheck class="w-4 h-4" />
          {{ selectedReportIds.length }} laporan dipilih
        </span>
        <div class="flex items-center gap-2">
          <button @click="selectedReportIds = []" class="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">
            Batal Pilih
          </button>
          <button @click="openBulkValidateModal" class="px-4 py-2 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary-600 transition-colors shadow-sm flex items-center gap-2">
            <LucideCheckCheck class="w-4 h-4" />
            Validasi Terpilih
          </button>
        </div>
      </div>
    </Transition>

    <!-- Filters & Table Card -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-card flex flex-col overflow-hidden">

      <!-- Toolbar -->
      <div class="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50">
        <div class="relative w-full md:w-80">
          <LucideSearch class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Cari nama pasien, kader, atau tenaga kesehatan..."
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
            <option value="cancelled">Dibatalkan</option>
          </select>
          <!-- Cuma berpengaruh untuk super_admin (backend abaikan puskesmas_id utk role lain,
               DataScope::isFullAccess) -- disembunyikan utk admin_puskesmas/pj_prolanis supaya
               tidak menampilkan filter yang toh tidak mengubah apa pun (mereka sudah terkunci
               ke puskesmasnya sendiri). -->
          <select v-if="isSuperAdmin" v-model="filterPuskesmasId" class="flex-1 md:w-48 py-2.5 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
            <option :value="null">Semua Puskesmas</option>
            <option v-for="p in puskesmasOptions" :key="p.id" :value="p.id">{{ p.nama }}</option>
          </select>
        </div>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[950px]">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <!-- Checkbox validasi massal -- KHUSUS super_admin (temuan lapangan, UX validasi
                   banyak laporan sekaligus). "Pilih semua" cuma memilih baris PENDING di halaman
                   yang sedang tampil (server-side pagination -- tidak ada cara pilih "semua data"
                   tanpa menariknya semua ke client, sengaja tidak dilakukan). -->
              <th v-if="isSuperAdmin" class="py-4 px-3 font-semibold w-10">
                <input
                  type="checkbox"
                  :checked="allPendingOnPageSelected"
                  :disabled="selectablePendingOnPage.length === 0"
                  @change="toggleSelectAllPendingOnPage"
                  class="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30 disabled:opacity-30"
                  title="Pilih semua laporan menunggu validasi di halaman ini"
                />
              </th>
              <th class="py-4 px-5 font-semibold">Pasien Prolanis</th>
              <th class="py-4 px-5 font-semibold">Petugas</th>
              <th class="py-4 px-5 font-semibold">Tenggat Waktu</th>
              <th class="py-4 px-5 font-semibold text-center">Status</th>
              <th class="py-4 px-5 font-semibold">Hasil Tensi</th>
              <th class="py-4 px-5 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <!-- isInitialLoading = skeleton penuh (load PERTAMA saja). isRefetching (silent,
                 setelah aksi berhasil/ganti halaman-filter) SENGAJA tidak mengosongkan tabel --
                 baris lama tetap tampil sampai data baru datang, tidak terasa "reload dari nol". -->
            <tr v-if="isInitialLoading">
              <td :colspan="isSuperAdmin ? 7 : 6" class="py-12 text-center text-slate-400">
                <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
                Memuat data kunjungan...
              </td>
            </tr>
            <tr v-else-if="visitsError">
              <td :colspan="isSuperAdmin ? 7 : 6" class="py-8 text-center text-sm font-semibold text-danger">{{ visitsError }}</td>
            </tr>
            <tr v-for="visit in visitsList" v-else :key="visit.id" class="hover:bg-slate-50/80 transition-colors group">
               <td v-if="isSuperAdmin" class="py-4 px-3">
                  <input
                    v-if="isSelectableForBulk(visit)"
                    type="checkbox"
                    :checked="isReportSelected(visit)"
                    @change="toggleSelectReport(visit)"
                    class="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                  />
               </td>
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
                  <p class="text-sm font-bold text-slate-700 flex items-center gap-1.5"><LucideUser class="w-3.5 h-3.5 text-slate-400"/> {{ petugasName(visit) }}</p>
                  <p class="text-[11px] text-slate-500 font-medium mt-1">{{ petugasLabel(visit) }} &bull; {{ visit.puskesmas?.nama ?? '-' }}</p>
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
                  <!-- Status validasi super_admin -- TERPISAH dari status assignment di atas
                       (temuan lapangan: sebelumnya tidak tampil sama sekali di tabel, harus
                       buka detail dulu buat tahu sudah/belum divalidasi). -->
                  <span
                    v-if="visit.report"
                    class="block max-w-min mx-auto mt-1.5 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider whitespace-nowrap"
                    :class="{
                      'bg-warning/10 text-warning-700 border border-warning/20': visit.report.validation_status === 'pending',
                      'bg-success/10 text-success border border-success/20': visit.report.validation_status === 'valid',
                      'bg-danger/10 text-danger border border-danger/20': visit.report.validation_status === 'invalid'
                    }"
                  >
                     {{ visit.report.validation_status === 'pending' ? 'Menunggu Validasi Admin' : visit.report.validation_status === 'valid' ? 'Divalidasi Admin' : 'Ditolak Admin' }}
                  </span>
                  <!-- Status penerimaan PJ Prolanis -- sebelumnya CUMA tampil di dalam modal detail
                       (temuan lapangan: PJ Prolanis tidak tahu baris mana yang perlu ditindaklanjuti
                       tanpa buka satu-satu). Tampil untuk SEMUA role (bukan cuma PJ) supaya
                       admin_puskesmas/super_admin juga bisa pantau laporan mana yang belum diterima. -->
                  <span
                    v-if="visit.report"
                    class="block max-w-min mx-auto mt-1.5 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider whitespace-nowrap"
                    :class="visit.report.pj_reviewed_at ? 'bg-success/10 text-success border border-success/20' : 'bg-warning/10 text-warning-700 border border-warning/20'"
                  >
                     {{ visit.report.pj_reviewed_at ? 'Diterima PJ' : 'Menunggu Diterima PJ' }}
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
                       cuma muncul kalau sudah ada laporan utk divalidasi & MASIH pending. Buka
                       modal dengan keputusan sudah terpilih, bukan langsung submit tanpa
                       konfirmasi. Begitu SUDAH divalidasi (valid/invalid), tombol centang/x
                       diganti "..." (temuan lapangan: centang/x yang tetap ada setelah
                       divalidasi terlihat seperti belum ada keputusan). -->
                  <template v-if="isSuperAdmin && visit.report">
                     <template v-if="visit.report.validation_status === 'pending'">
                        <button @click="quickValidate(visit, true)" title="Tandai Valid" class="inline-flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:text-success hover:border-success transition-colors p-2 rounded-xl shadow-sm mr-2">
                           <LucideCheck class="w-4 h-4" />
                        </button>
                        <button @click="quickValidate(visit, false)" title="Tandai Tidak Valid" class="inline-flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:text-danger hover:border-danger transition-colors p-2 rounded-xl shadow-sm mr-2">
                           <LucideX class="w-4 h-4" />
                        </button>
                     </template>
                     <div v-else class="visit-actions-dropdown relative inline-block mr-2">
                        <button @click="openActionsForVisitId = openActionsForVisitId === visit.id ? null : visit.id" title="Aksi Validasi" class="inline-flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:text-primary hover:border-primary transition-colors p-2 rounded-xl shadow-sm">
                           <LucideEllipsis class="w-4 h-4" />
                        </button>
                        <Transition
                          enter-active-class="transition duration-150 ease-out"
                          enter-from-class="transform scale-95 opacity-0"
                          enter-to-class="transform scale-100 opacity-100"
                          leave-active-class="transition duration-100 ease-in"
                          leave-from-class="transform scale-100 opacity-100"
                          leave-to-class="transform scale-95 opacity-0"
                        >
                           <div v-if="openActionsForVisitId === visit.id" class="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-slate-100 z-20 overflow-hidden text-left">
                              <button
                                :disabled="isRevertingValidation"
                                @click="revertValidation(visit)"
                                class="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-warning-700 hover:bg-warning/10 transition-colors disabled:opacity-50"
                              >
                                 <LucideRotateCcw class="w-4 h-4" />
                                 Batalkan Validasi
                              </button>
                           </div>
                        </Transition>
                     </div>
                  </template>
                  <!-- Aksi cepat terima laporan -- KHUSUS pj_prolanis, muncul cuma kalau ada laporan &
                       belum diterima (padanan tombol validasi cepat super_admin di atas, supaya
                       PJ Prolanis tidak perlu buka modal dulu buat tahu/menjalankan aksinya). -->
                  <button
                    v-if="isPjProlanis && visit.report && !visit.report.pj_reviewed_at"
                    @click="acceptReport(visit)"
                    :disabled="acceptingVisitId === visit.id"
                    title="Terima Laporan"
                    class="inline-flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:text-info hover:border-info transition-colors p-2 rounded-xl shadow-sm mr-2 disabled:opacity-50"
                  >
                     <LucideLoader2 v-if="acceptingVisitId === visit.id" class="w-4 h-4 animate-spin" />
                     <LucideCheckCircle v-else class="w-4 h-4" />
                  </button>
                  <button @click="viewVisit(visit)" title="Lihat Detail" class="inline-flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:text-primary hover:border-primary transition-colors p-2 rounded-xl shadow-sm mr-2">
                     <LucideEye class="w-4 h-4" />
                  </button>
                  <!-- Batalkan Penugasan (keputusan Kepala Dinas) -- admin_puskesmas/pj_prolanis
                       sepuskesmas, cuma muncul kalau assignment masih bisa dibatalkan (pending/
                       in_progress). Sama endpoint & modal dgn dashboard/kunjungan/[id].vue. -->
                  <button v-if="canCancelVisitNow(visit)" @click="requestCancel(visit)" title="Batalkan Penugasan" class="inline-flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:text-danger hover:border-danger transition-colors p-2 rounded-xl shadow-sm mr-2">
                     <LucideCircleX class="w-4 h-4" />
                  </button>
                  <!-- Hapus Kunjungan (permintaan user) -- KHUSUS super_admin, status apa pun
                       (beda dari Batalkan yang cuma pending/in_progress) -- lihat komentar
                       requestDelete() di script kenapa lebih ketat dari Batalkan. -->
                  <button v-if="canDeleteAssignment" @click="requestDelete(visit)" title="Hapus Kunjungan" class="inline-flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:text-danger hover:border-danger transition-colors p-2 rounded-xl shadow-sm">
                     <LucideTrash2 class="w-4 h-4" />
                  </button>
                  <!-- Tugaskan Ulang -- KHUSUS admin_puskesmas/pj_prolanis, cuma untuk kunjungan
                       yang DIBATALKAN (lihat catatan canReassignVisit() di script kenapa 'diulang'
                       sengaja tidak diikutkan). -->
                  <button v-if="canReassignVisit(visit)" @click="requestReassign(visit)" title="Tugaskan Ulang Kunjungan Ini" class="inline-flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:text-primary hover:border-primary transition-colors p-2 rounded-xl shadow-sm ml-2">
                     <LucideRefreshCw class="w-4 h-4" />
                  </button>
               </td>
            </tr>
            <tr v-if="!isInitialLoading && !visitsError && visitsList.length === 0">
               <td :colspan="isSuperAdmin ? 7 : 6" class="py-12 text-center">
                 <div class="flex flex-col items-center justify-center text-slate-400">
                    <LucideCalendarX class="w-10 h-10 mb-3 text-slate-300" />
                    <p class="font-medium">Tidak ada data penugasan kunjungan.</p>
                 </div>
               </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginasi SERVER-SIDE -- totalCount/currentPage/lastPage dari pagination hasil query
           TERFILTER backend (bukan window klien), sama pola dgn dashboard/pasien/index.vue. -->
      <div class="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
        <span class="text-sm text-slate-500">
          Menampilkan <b class="text-slate-700">{{ visitsList.length }}</b> dari total <b class="text-slate-700">{{ totalCount }}</b> kunjungan
          <template v-if="lastPage > 1"> (halaman {{ currentPage }} dari {{ lastPage }})</template>
        </span>
        <div v-if="lastPage > 1" class="flex items-center gap-1.5">
          <button
            type="button"
            :disabled="currentPage <= 1 || isInitialLoading || isRefetching"
            @click="goToPage(currentPage - 1)"
            class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-white hover:text-primary disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-600 transition-colors"
          >
            <LucideChevronLeft class="w-4 h-4" />
          </button>
          <span class="text-xs font-semibold text-slate-600 px-2">{{ currentPage }} / {{ lastPage }}</span>
          <button
            type="button"
            :disabled="currentPage >= lastPage || isInitialLoading || isRefetching"
            @click="goToPage(currentPage + 1)"
            class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-white hover:text-primary disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-600 transition-colors"
          >
            <LucideChevronRight class="w-4 h-4" />
          </button>
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
                         <!-- Terakhir dikunjungi (temuan lapangan) -- supaya admin_puskesmas/
                              pj_prolanis tidak menugaskan ulang pasien yang baru saja
                              dikunjungi tanpa sadar. Kosong (tidak tampil) kalau belum pernah
                              ada laporan kunjungan sama sekali untuk pasien ini. -->
                         <span v-if="lastVisitLabel(p.id)" class="text-[11px] text-slate-400 italic block truncate">{{ lastVisitLabel(p.id) }}</span>
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

             <!-- Jenis Petugas (revisi Bu Kadis PMO) -- kader (pendampingan minum obat) ATAU
                  tenaga_kesehatan (pemeriksaan lanjutan), gerbang backend beda: kader lewat
                  POST /visit-assignments/bulk, nakes lewat POST /care-assignments (per pasien,
                  di-loop di assignTenagaKesehatanBatch()). -->
             <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Jenis Petugas</label>
                <div class="grid grid-cols-2 gap-3">
                   <button
                      type="button"
                      @click="petugasType = 'kader'"
                      class="py-2.5 px-4 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2"
                      :class="petugasType === 'kader' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-500 hover:border-slate-300'"
                   >
                      <LucideUser class="w-4 h-4" /> Kader
                   </button>
                   <button
                      type="button"
                      @click="petugasType = 'tenaga_kesehatan'"
                      class="py-2.5 px-4 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2"
                      :class="petugasType === 'tenaga_kesehatan' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-500 hover:border-slate-300'"
                   >
                      <LucideStethoscope class="w-4 h-4" /> Tenaga Kesehatan
                   </button>
                </div>
             </div>

             <!-- Kader Tujuan + Prioritas (jenis petugas: kader) -->
             <div v-if="petugasType === 'kader'" class="grid grid-cols-2 gap-4">
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

             <!-- Tenaga Kesehatan Tujuan (jenis petugas: tenaga_kesehatan) -- tanpa prioritas,
                  itu otomatis dari klasifikasi risiko pasien di backend (CareAssignmentService::
                  createVisit()), bukan input manual seperti jalur kader. -->
             <div v-else>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Tenaga Kesehatan Tujuan</label>
                <select v-model="selectedTenagaKesehatanId" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" :disabled="isLoadingTenagaKesehatan">
                   <option :value="null" disabled>{{ isLoadingTenagaKesehatan ? 'Memuat...' : 'Pilih tenaga kesehatan' }}</option>
                   <option v-for="tk in tenagaKesehatanList" :key="tk.id" :value="tk.id">{{ tk.user?.name ?? `Tenaga Kesehatan #${tk.id}` }}</option>
                </select>
                <p v-if="tenagaKesehatanError" class="text-xs text-danger mt-1">{{ tenagaKesehatanError }}</p>
                <p class="text-[11px] text-slate-400 mt-1.5">Prioritas kunjungan otomatis mengikuti klasifikasi risiko tiap pasien.</p>
             </div>

             <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Tanggal Kunjungan (berlaku untuk semua pasien terpilih)</label>
                <input ref="scheduledDateInputRef" type="text" placeholder="Pilih tanggal..." readonly class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white cursor-pointer" />
             </div>

             <!-- Kader Pendamping (opsional) -- kunjungan berombongan (docs/planning/02 §16) kalau
                  jenis petugas kader (multi-kader, badge di seluruh pasien batch ini), ATAU
                  kunjungan hari-1 bersama (revisi Bu Kadis PMO) kalau jenis petugas tenaga_kesehatan
                  (SATU kader companion saja per desain CareAssignmentService::assignTenagaKesehatan). -->
             <div v-if="petugasType === 'kader'">
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
             <div v-else>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Kader Pendamping (Opsional)</label>
                <p class="text-[11px] text-slate-400 mb-2">Kunjungan hari pertama biasanya kader ikut mendampingi -- pilih kadernya di sini supaya rencana kunjungan mingguan kader ini langsung aktif juga (berlaku ke semua pasien di batch ini).</p>
                <select v-model="selectedNakesKaderCompanionId" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" :disabled="isLoadingKader">
                   <option :value="null">{{ isLoadingKader ? 'Memuat...' : 'Tanpa kader (nakes sendirian)' }}</option>
                   <option v-for="k in kaderList" :key="k.id" :value="k.id">{{ k.user?.name ?? `Kader #${k.id}` }}</option>
                </select>
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
                <template v-if="petugasType === 'kader'">
                   <p><span class="text-slate-500">Kader:</span> <b class="text-slate-800">{{ kaderList.find(k => k.id === selectedKaderId)?.user?.name }}</b></p>
                   <p v-if="selectedCompanionIds.length"><span class="text-slate-500">Pendamping:</span> <b class="text-slate-800">{{ kaderList.filter(k => selectedCompanionIds.includes(k.id)).map(k => k.user?.name).join(', ') }}</b></p>
                   <p><span class="text-slate-500">Prioritas:</span> <b class="text-slate-800 capitalize">{{ priority }}</b></p>
                </template>
                <template v-else>
                   <p><span class="text-slate-500">Tenaga Kesehatan:</span> <b class="text-slate-800">{{ tenagaKesehatanList.find(tk => tk.id === selectedTenagaKesehatanId)?.user?.name }}</b></p>
                   <p v-if="selectedNakesKaderCompanionId"><span class="text-slate-500">Kader Pendamping:</span> <b class="text-slate-800">{{ kaderList.find(k => k.id === selectedNakesKaderCompanionId)?.user?.name }}</b></p>
                </template>
                <p><span class="text-slate-500">Tanggal:</span> <b class="text-slate-800">{{ scheduledDate }}</b></p>
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

             <!-- Detail lengkap (revisi Bu Kadis) -- halaman TERPISAH, bukan diperluas di modal
                  ini: bukti foto, data pasien lengkap, data kader/nakes, SEMUA input form
                  kunjungan. Modal ini tetap fokus alur kerja (terima/validasi laporan) di bawah. -->
             <NuxtLink
                :to="`/dashboard/kunjungan/${selectedVisit.id}`"
                class="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm text-primary bg-primary/10 hover:bg-primary/20 transition-colors border border-primary/20"
             >
                <LucideExternalLink class="w-4 h-4" />
                Lihat Detail Lengkap &amp; Bukti Foto
             </NuxtLink>

             <div class="grid grid-cols-2 gap-4">
                <div>
                   <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Pasien</p>
                   <p class="text-sm font-bold text-slate-800">{{ selectedVisit.patient?.nama ?? '-' }}</p>
                </div>
                <div>
                   <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{{ petugasLabel(selectedVisit) }} Bertugas</p>
                   <p class="text-sm font-bold text-slate-800">{{ petugasName(selectedVisit) }}</p>
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
                         <button @click="acceptReport(selectedVisit)" :disabled="acceptingVisitId === selectedVisit.id" class="w-full py-3 px-4 rounded-xl font-bold text-white bg-info hover:bg-info/90 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 active:scale-[0.98]">
                            <LucideCheckCircle class="w-5 h-5" v-if="acceptingVisitId !== selectedVisit.id"/>
                            <LucideLoader2 v-else class="w-5 h-5 animate-spin" />
                            {{ acceptingVisitId === selectedVisit.id ? 'Memproses...' : 'Terima Laporan' }}
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

    <!-- Modal Validasi Massal -- KHUSUS super_admin (temuan lapangan, UX validasi banyak laporan
         sekaligus). Daftar nama + preview kecil per pasien terpilih supaya super_admin yakin
         betul siapa saja yang akan ikut divalidasi sebelum konfirmasi. -->
    <div v-if="showBulkValidateModal" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
       <div class="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
             <h3 class="font-bold text-accent text-lg flex items-center gap-2">
               <LucideCheckCheck class="w-5 h-5 text-primary" />
               Validasi {{ selectedReportIds.length }} Laporan Sekaligus
             </h3>
             <button @click="showBulkValidateModal = false" class="text-slate-400 hover:text-slate-600 p-1">
                <LucideX class="w-5 h-5" />
             </button>
          </div>

          <div class="p-6 space-y-5 overflow-y-auto">
             <p v-if="bulkValidateError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{{ bulkValidateError }}</p>

             <div>
                <label class="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Laporan yang akan divalidasi</label>
                <div class="border border-slate-100 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
                   <div v-for="visit in selectedVisitsPreview" :key="visit.id" class="flex items-center gap-3 p-3">
                      <img v-if="visit.report?.photo_url" :src="visit.report.photo_url" class="w-10 h-10 rounded-lg object-cover shrink-0 border border-slate-100" />
                      <div v-else class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-300">
                         <LucideImageOff class="w-4 h-4" />
                      </div>
                      <div class="min-w-0">
                         <p class="text-sm font-bold text-slate-800 truncate">{{ visit.patient?.nama ?? 'Pasien tidak diketahui' }}</p>
                         <p class="text-[11px] text-slate-500">{{ petugasLabel(visit) }} {{ petugasName(visit) }} &bull; {{ visit.scheduled_date }}</p>
                      </div>
                   </div>
                </div>
             </div>

             <div>
                <label class="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Keputusan Validasi (berlaku untuk semua)</label>
                <div class="flex gap-4">
                  <label class="flex-1 cursor-pointer">
                    <input type="radio" v-model="bulkValidateForm.is_valid" :value="true" class="peer sr-only" />
                    <div class="w-full py-3 px-4 rounded-xl border-2 border-slate-200 text-center text-sm font-bold text-slate-500 peer-checked:border-success peer-checked:bg-success/10 peer-checked:text-success transition-all flex items-center justify-center gap-2 shadow-sm">
                      <LucideCheckCircle class="w-5 h-5" />
                      Valid
                    </div>
                  </label>
                  <label class="flex-1 cursor-pointer">
                    <input type="radio" v-model="bulkValidateForm.is_valid" :value="false" class="peer sr-only" />
                    <div class="w-full py-3 px-4 rounded-xl border-2 border-slate-200 text-center text-sm font-bold text-slate-500 peer-checked:border-danger peer-checked:bg-danger/10 peer-checked:text-danger transition-all flex items-center justify-center gap-2 shadow-sm">
                      <LucideXCircle class="w-5 h-5" />
                      Tidak Valid
                    </div>
                  </label>
                </div>
             </div>

             <div>
                <label class="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Catatan (Opsional, berlaku untuk semua)</label>
                <textarea v-model="bulkValidateForm.note" rows="3" placeholder="Tambahkan alasan mengapa tidak valid, atau catatan lainnya..." class="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none bg-slate-50 hover:bg-white transition-colors"></textarea>
             </div>
          </div>

          <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
             <button @click="showBulkValidateModal = false" class="py-2.5 px-5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
             <button @click="submitBulkValidate" class="py-2.5 px-6 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 active:scale-[0.98]" :disabled="isBulkValidating">
                <LucideLoader2 v-if="isBulkValidating" class="w-5 h-5 animate-spin" />
                <LucideSave v-else class="w-5 h-5" />
                {{ isBulkValidating ? 'Menyimpan...' : `Validasi ${selectedReportIds.length} Laporan` }}
             </button>
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
             <p class="text-sm text-slate-600">Tentukan apakah laporan kunjungan dari {{ petugasLabel(selectedVisit).toLowerCase() }} <span class="font-bold text-slate-800">{{ petugasName(selectedVisit) }}</span> ini valid atau tidak.</p>
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

    <!-- Konfirmasi Batalkan Penugasan -- satu-satunya safety net (backend sengaja tidak butuh
         approval super_admin, keputusan Kepala Dinas). Sama markup dgn dashboard/kunjungan/
         [id].vue supaya konsisten, cuma sumber datanya visitToCancel (baris tabel), bukan
         assignment (halaman detail). Kader/nakes bersangkutan otomatis dinotif backend. -->
    <div
      v-if="showCancelConfirm && visitToCancel"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
    >
      <div class="bg-white rounded-3xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        <div class="p-6 overflow-y-auto">
          <div class="w-14 h-14 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mb-4">
            <LucideCircleX class="w-7 h-7" />
          </div>
          <h3 class="font-bold text-accent text-lg mb-1">Batalkan Penugasan Ini?</h3>
          <p class="text-sm text-slate-500 leading-relaxed mb-4">
            <span class="font-bold text-slate-700">{{ petugasName(visitToCancel) }}</span> ({{ petugasLabel(visitToCancel) }})
            akan diberi tahu bahwa penugasan kunjungan ke
            <span class="font-bold text-slate-700">{{ visitToCancel.patient?.nama }}</span>
            tanggal {{ visitToCancel.scheduled_date }} dibatalkan. Tindakan ini tidak bisa
            dibatalkan (undo) -- kalau salah batal, buat penugasan baru dari awal.
          </p>
          <label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Alasan (opsional, disertakan di notifikasi)</label>
          <textarea
            v-model="cancelReason"
            rows="3"
            maxlength="500"
            placeholder="Mis. salah pilih kader, typo data pasien..."
            class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-danger focus:ring-1 focus:ring-danger/30 outline-none resize-none"
          />
          <p v-if="cancelError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2 mt-4">
            {{ cancelError }}
          </p>
        </div>
        <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
          <button
            @click="showCancelConfirm = false"
            class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Batal
          </button>
          <button
            @click="confirmCancel"
            :disabled="isCancelling"
            class="py-2.5 px-6 rounded-xl font-bold text-white bg-danger hover:bg-danger/90 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <LucideLoader2 v-if="isCancelling" class="w-4 h-4 animate-spin" />
            Ya, Batalkan Penugasan
          </button>
        </div>
      </div>
    </div>

    <!-- Konfirmasi Hapus Kunjungan (permintaan user) -- KHUSUS super_admin, alasan WAJIB diisi
         (beda dari Batalkan yang opsional) -- lihat komentar requestDelete() di script. -->
    <div
      v-if="showDeleteConfirm && visitToDelete"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
    >
      <div class="bg-white rounded-3xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        <div class="p-6 overflow-y-auto">
          <div class="w-14 h-14 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mb-4">
            <LucideTrash2 class="w-7 h-7" />
          </div>
          <h3 class="font-bold text-accent text-lg mb-1">Hapus Kunjungan Ini?</h3>
          <p class="text-sm text-slate-500 leading-relaxed mb-4">
            Kunjungan ke <span class="font-bold text-slate-700">{{ visitToDelete.patient?.nama }}</span>
            tanggal {{ visitToDelete.scheduled_date }} (petugas {{ petugasName(visitToDelete) }}) beserta
            laporannya akan hilang dari SELURUH daftar &amp; riwayat -- gunakan ini HANYA untuk
            kunjungan yang benar-benar salah (mis. salah pasien, data uji coba). Untuk pembatalan
            biasa, pakai "Batalkan Penugasan", bukan ini.
          </p>
          <label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Alasan (wajib diisi)</label>
          <textarea
            v-model="deleteReason"
            rows="3"
            maxlength="500"
            placeholder="Mis. salah pasien, ini data uji coba yang tidak sengaja tersubmit..."
            class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-danger focus:ring-1 focus:ring-danger/30 outline-none resize-none"
          />
          <p v-if="deleteError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2 mt-4">
            {{ deleteError }}
          </p>
        </div>
        <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
          <button
            @click="showDeleteConfirm = false"
            class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Batal
          </button>
          <button
            @click="confirmDelete"
            :disabled="isDeleting || !deleteReason.trim()"
            class="py-2.5 px-6 rounded-xl font-bold text-white bg-danger hover:bg-danger/90 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <LucideLoader2 v-if="isDeleting" class="w-4 h-4 animate-spin" />
            Ya, Hapus Kunjungan
          </button>
        </div>
      </div>
    </div>

    <!-- Tugaskan Ulang Kunjungan -- KHUSUS admin_puskesmas/pj_prolanis, untuk kunjungan yang
         SUDAH DIBATALKAN (lihat catatan canReassignVisit() di script). Petugas & prioritas
         dipakai apa adanya dari kunjungan lama, cuma tanggal baru yang diminta. -->
    <div
      v-if="showReassignModal && visitToReassign"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
    >
      <div class="bg-white rounded-3xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        <div class="p-6 overflow-y-auto">
          <div class="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <LucideRefreshCw class="w-7 h-7" />
          </div>
          <h3 class="font-bold text-accent text-lg mb-1">Tugaskan Ulang Kunjungan?</h3>
          <p class="text-sm text-slate-500 leading-relaxed mb-4">
            Penugasan baru untuk <span class="font-bold text-slate-700">{{ visitToReassign.patient?.nama }}</span>
            akan dibuat dengan petugas yang sama,
            <span class="font-bold text-slate-700">{{ petugasName(visitToReassign) }}</span> ({{ petugasLabel(visitToReassign) }}),
            di tanggal baru yang Anda pilih di bawah.
          </p>
          <label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Tanggal Kunjungan Baru</label>
          <input
            ref="reassignDateInputRef"
            type="text"
            placeholder="Pilih tanggal..."
            readonly
            class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none bg-white cursor-pointer"
          />
          <p v-if="reassignError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2 mt-4">
            {{ reassignError }}
          </p>
        </div>
        <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
          <button
            @click="showReassignModal = false"
            class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Batal
          </button>
          <button
            @click="confirmReassign"
            :disabled="isReassigning || !reassignDate"
            class="py-2.5 px-6 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <LucideLoader2 v-if="isReassigning" class="w-4 h-4 animate-spin" />
            Ya, Tugaskan Ulang
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
