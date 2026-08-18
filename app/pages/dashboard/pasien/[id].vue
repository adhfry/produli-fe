<script setup lang="ts">
import type { ApiSuccessEnvelope, Desa, Kader, Kecamatan, Patient, PatientFieldUpdates, PatientFieldUpdateHistoryItem, TenagaKesehatan, RiskClassificationHistory, RiskCriteriaSnapshotItem, VisitAssignment, PatientRiskLevel, LabResult } from '~/types/api'
import { Line } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, LineElement, CategoryScale, LinearScale, PointElement } from 'chart.js'

// Pemakaian Chart.js PERTAMA di codebase ini (revisi Bu Kadis, Fase 5, seksi "Riwayat & Tren
// Kondisi") -- dependency-nya sudah lama terpasang di package.json tapi belum pernah dipakai.
ChartJS.register(Title, Tooltip, Legend, LineElement, CategoryScale, LinearScale, PointElement)

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const route = useRoute()
const authStore = useAuthStore()
const toast = useToast()

// GET /api/v1/patients/{id} -- PatientsCachePolicy::update() ada, TAPI tidak ada route
// PATCH/PUT untuk itu di routes/api.php (cuma index+show), dan delete() SENGAJA selalu false
// ("data pasien ditarik dari SiLAKES, tidak ada hapus manual dari UI") -- makanya tombol
// Edit/Hapus di halaman ini dihapus, bukan cuma disembunyikan.
const patient = ref<Patient | null>(null)
const isLoading = ref(false)
const loadError = ref('')

async function loadPatient() {
  isLoading.value = true
  loadError.value = ''
  try {
    const api = useApi()
    const res = await api(`/patients/${route.params.id}`) as ApiSuccessEnvelope<Patient>
    patient.value = res.data
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Gagal memuat data pasien.'
  } finally {
    isLoading.value = false
  }
}

// --- Dasar Klasifikasi & Riwayat/Tren Kondisi (GET /patients/{id}/risk-history, revisi Bu
// Kadis Fase 5) -- diurutkan TERBARU DULU oleh backend, [0] = klasifikasi SAAT INI. ------------
const riskHistory = ref<RiskClassificationHistory[]>([])
const isLoadingRiskHistory = ref(false)
const riskHistoryError = ref('')

async function loadRiskHistory() {
  isLoadingRiskHistory.value = true
  riskHistoryError.value = ''
  try {
    const api = useApi()
    const res = await api(`/patients/${route.params.id}/risk-history`) as ApiSuccessEnvelope<RiskClassificationHistory[]>
    riskHistory.value = res.data
  } catch (e) {
    riskHistoryError.value = e instanceof ApiError ? e.message : 'Gagal memuat riwayat klasifikasi risiko.'
  } finally {
    isLoadingRiskHistory.value = false
  }
}

const latestRiskEntry = computed(() => riskHistory.value[0] ?? null)

// --- Hasil Pemeriksaan Terakhir (GET /patients/{id}/lab-results, revisi Bu Kadis) -- SEMUA
// parameter yang pernah diperiksa (bukan cuma yang exceeded seperti criteria_snapshot),
// lengkap dengan nilai_rujukan ASLI dari SiLAKES. -----------------------------------------------
const labResults = ref<LabResult[]>([])
const isLoadingLabResults = ref(false)
const labResultsError = ref('')

async function loadLabResults() {
  isLoadingLabResults.value = true
  labResultsError.value = ''
  try {
    const api = useApi()
    const res = await api(`/patients/${route.params.id}/lab-results`) as ApiSuccessEnvelope<LabResult[]>
    labResults.value = res.data
  } catch (e) {
    labResultsError.value = e instanceof ApiError ? e.message : 'Gagal memuat hasil pemeriksaan lab.'
  } finally {
    isLoadingLabResults.value = false
  }
}

// --- Riwayat Kunjungan (GET /patients/{id}/visit-history, revisi Bu Kadis Fase 5) -- kader
// MAUPUN tenaga_kesehatan, mengisi seksi yang sebelumnya placeholder statis. ------------------
const visitHistoryList = ref<VisitAssignment[]>([])
const isLoadingVisitHistory = ref(false)
const visitHistoryError = ref('')

async function loadVisitHistory() {
  isLoadingVisitHistory.value = true
  visitHistoryError.value = ''
  try {
    const api = useApi()
    const res = await api(`/patients/${route.params.id}/visit-history`) as ApiSuccessEnvelope<VisitAssignment[]>
    visitHistoryList.value = res.data
  } catch (e) {
    visitHistoryError.value = e instanceof ApiError ? e.message : 'Gagal memuat riwayat kunjungan.'
  } finally {
    isLoadingVisitHistory.value = false
  }
}

onMounted(() => {
  loadPatient()
  loadRiskHistory()
  loadVisitHistory()
  loadLabResults()
})

// Reload otomatis begitu sinkronisasi SiLAKES berhasil (dipicu dari sidebar ATAU tombol
// "Sinkronisasi Sekarang" di riwayat pengajuan pada halaman ini sendiri) -- biodata, wilayah,
// status risiko, riwayat klasifikasi, hasil lab, DAN riwayat pengajuan semuanya perlu dimuat
// ulang bersamaan (sync bisa mengubah lab_results_cache -> klasifikasi baru).
const silakesSyncSignal = useSilakesSyncSignal()
watch(silakesSyncSignal, () => {
  loadPatient()
  loadUpdateHistory()
  loadRiskHistory()
  loadLabResults()
})

useHead({
  title: computed(() => patient.value ? `Detail Pasien - ${patient.value.nama}` : 'Detail Pasien')
})

function calculateAge(dob) {
  if (!dob) return null
  const diffMs = Date.now() - new Date(dob).getTime()
  return Math.abs(new Date(diffMs).getUTCFullYear() - 1970)
}

const getRiskColor = (risk) => {
  if (risk === 'berat') return 'bg-danger/10 text-danger border border-danger/20'
  if (risk === 'sedang') return 'bg-warning/10 text-warning border border-warning/20'
  if (risk === 'ringan') return 'bg-success/10 text-success border border-success/20'
  if (risk === 'tidak_berisiko') return 'bg-primary/10 text-primary border border-primary/20'
  return 'bg-slate-100 text-slate-600 border border-slate-200'
}

const getRiskLabel = (risk) => {
  if (risk === 'berat') return 'Risiko Berat'
  if (risk === 'sedang') return 'Risiko Sedang'
  if (risk === 'ringan') return 'Risiko Ringan'
  if (risk === 'tidak_berisiko') return 'Tidak Berisiko'
  return 'Belum Dihitung'
}

// Smart Early Detection (revisi Bu Kadis) -- cuma relevan saat risk_level='sedang', lihat
// RiskClassificationService::evaluateEarlyDetection() di backend. Gabung semua reason jadi 1
// tooltip manusiawi (native title attribute, konsisten dengan pola tooltip lain di halaman ini).
const getEarlyDetectionTooltip = (patient) => {
  if (!patient?.early_detection_reason?.length) return ''
  return patient.early_detection_reason.map((r) => r.message).join('\n')
}

// --- Dasar Klasifikasi -- render criteria_snapshot APA ADANYA (bukan dihitung ulang), lihat
// RiskClassificationService::classify() di backend. ---------------------------------------
const OPERATOR_LABELS: Record<string, string> = { '>': 'Lebih dari', '>=': 'Minimal', '<': 'Kurang dari', '<=': 'Maksimal' }

function formatCriteriaThreshold(item: RiskCriteriaSnapshotItem): string {
  if (item.operator === 'between') return `${item.threshold_min} - ${item.threshold_max}`
  return `${OPERATOR_LABELS[item.operator] ?? item.operator} ${item.threshold_min ?? '-'}`
}

function formatCriteriaDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// --- Riwayat & Tren Kondisi -- Chart.js line chart level risiko dari waktu ke waktu, revisi
// Bu Kadis Fase 5. Level (bukan 1 parameter lab spesifik) yang di-plot -- pasien punya
// parameter berbeda-beda yang memicu klasifikasinya, level adalah satu-satunya sumbu yang
// selalu konsisten dibandingkan across seluruh riwayat. ---------------------------------------
const SEVERITY_ORDER: PatientRiskLevel[] = ['tidak_berisiko', 'ringan', 'sedang', 'berat']
const SEVERITY_POINT_COLOR: Record<string, string> = {
  tidak_berisiko: '#2563eb',
  ringan: '#16a34a',
  sedang: '#d97706',
  berat: '#dc2626'
}
const RISK_LABEL_SHORT: Record<string, string> = { tidak_berisiko: 'Tidak Berisiko', ringan: 'Ringan', sedang: 'Sedang', berat: 'Berat' }

const trendChartData = computed(() => {
  // riskHistory terurut TERBARU DULU dari backend -- dibalik jadi kronologis (lama -> baru)
  // supaya sumbu waktu chart terbaca dari kiri ke kanan seperti biasa.
  const rows = [...riskHistory.value].reverse()
  // Titik dengan early_detection_flag=true (RiskClassificationService::evaluateEarlyDetection())
  // TIDAK mengubah tinggi garis (level tetap 'sedang', sumbu Y sama) -- tanpa penanda terpisah,
  // titik "kondisi memburuk terdeteksi dini" ini tenggelam begitu saja di antara titik 'sedang'
  // biasa. Dibedakan lewat cincin merah tebal + radius lebih besar, BUKAN warna isi (yang tetap
  // ikut level seperti biasa), supaya tetap jelas beda dari titik 'berat' sungguhan.
  return {
    labels: rows.map((r) => formatCriteriaDate(r.assessment_date ?? r.computed_at)),
    datasets: [{
      label: 'Tingkat Risiko',
      data: rows.map((r) => SEVERITY_ORDER.indexOf(r.level)),
      borderColor: '#0d9488',
      backgroundColor: '#0d9488',
      pointBackgroundColor: rows.map((r) => SEVERITY_POINT_COLOR[r.level] ?? '#94a3b8'),
      pointBorderColor: rows.map((r) => r.early_detection_flag ? '#dc2626' : '#ffffff'),
      pointBorderWidth: rows.map((r) => r.early_detection_flag ? 3 : 1.5),
      pointRadius: rows.map((r) => r.early_detection_flag ? 8 : 5),
      pointHoverRadius: rows.map((r) => r.early_detection_flag ? 10 : 7),
      tension: 0.15,
      fill: false
    }]
  }
})

const trendChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { parsed: { y: number } }) => RISK_LABEL_SHORT[SEVERITY_ORDER[ctx.parsed.y]] ?? '-',
        // Baris tambahan KHUSUS titik early_detection_flag=true (lihat pointRadius/
        // pointBorderColor di trendChartData) -- dataIndex konsisten dengan urutan kronologis
        // yang sama dipakai trendChartData (riskHistory dibalik jadi lama -> baru).
        afterLabel: (ctx: { dataIndex: number }) => {
          const row = [...riskHistory.value].reverse()[ctx.dataIndex]
          if (!row?.early_detection_flag) return undefined
          const reasons = row.early_detection_reason?.map((r) => r.message).join('\n') ?? ''
          return `⚠ Terdeteksi berpotensi memburuk:\n${reasons}`
        }
      }
    }
  },
  scales: {
    y: {
      // min/max SENGAJA persis 0-3 (bukan -0.5/3.5) -- Chart.js generate tick MULAI DARI min
      // dengan step stepSize, jadi min pecahan (-0.5) menghasilkan tick -0.5/0.5/1.5/2.5/3.5
      // (bukan 0/1/2/3) -- SEVERITY_ORDER[0.5] dkk undefined, callback balikin '', ticks jadi
      // kosong sama sekali (bug nyata, ketahuan lewat verifikasi visual: gridline ada tapi
      // label sumbu Y kosong total).
      min: 0,
      max: 3,
      ticks: {
        stepSize: 1,
        callback: (value: number) => RISK_LABEL_SHORT[SEVERITY_ORDER[value]] ?? ''
      }
    }
  }
}

// --- Riwayat Kunjungan -- kader ATAU tenaga_kesehatan, mutually exclusive per assignment. ----
const VISIT_STATUS_LABELS: Record<string, string> = {
  pending: 'Terjadwal', in_progress: 'Sedang Berlangsung', completed: 'Selesai Dikunjungi', cancelled: 'Dibatalkan'
}
const VISIT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-info/10 text-info border border-info/20',
  in_progress: 'bg-primary/10 text-primary border border-primary/20',
  completed: 'bg-success/10 text-success border border-success/20',
  cancelled: 'bg-slate-100 text-slate-500 border border-slate-200'
}

function visitAssigneeName(visit: VisitAssignment): string {
  return visit.kader?.name ?? visit.tenaga_kesehatan?.name ?? '-'
}

function visitAssigneeType(visit: VisitAssignment): string {
  if (visit.kader) return 'Kader'
  if (visit.tenaga_kesehatan) return 'Tenaga Kesehatan'
  return '-'
}

// Detail laporan kunjungan (revisi Bu Kadis PMO) -- field klinis (gda/gdp/dst) cuma diisi
// nakes, field PMO (kepatuhan_obat/sisa_obat) cuma diisi kader (lihat /app/kunjungan/[id],
// form-nya sudah dipisah per pemilik assignment sejak awal) -- label SAMA PERSIS dengan yang
// dipakai di sana supaya konsisten.
const TINDAKAN_LABELS: Record<string, string> = {
  diberi_obat: 'Diberi Obat', dirujuk_puskesmas: 'Dirujuk ke Puskesmas', tidak_ada: 'Tidak Ada Tindakan'
}
const CARA_RUJUKAN_LABELS: Record<string, string> = {
  datang_sendiri: 'Datang Sendiri', dijemput_ambulan: 'Dijemput Ambulan',
  diantar_keluarga: 'Diantar Keluarga', diantar_nakes_kader: 'Diantar Nakes/Kader'
}
// tindakan bisa >1 sekaligus sejak Fase 2 (sebelumnya string tunggal) -- gabung jadi satu baris
// label dipisah koma, bukan render array mentah.
function formatTindakan(tindakan: string[] | string | null): string {
  const list = Array.isArray(tindakan) ? tindakan : tindakan ? [tindakan] : []
  return list.map((t) => TINDAKAN_LABELS[t] ?? t).join(', ')
}
const KEPATUHAN_OBAT_LABELS: Record<string, string> = {
  patuh: 'Patuh', kurang_patuh: 'Kurang Patuh', tidak_patuh: 'Tidak Patuh'
}
const SISA_OBAT_LABELS: Record<string, string> = {
  cukup: 'Cukup', menipis: 'Menipis', habis: 'Habis'
}
const VALIDATION_STATUS_LABELS: Record<string, string> = {
  pending: 'Menunggu Validasi', valid: 'Tervalidasi', invalid: 'Ditolak'
}
const VALIDATION_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-warning/10 text-warning-700 border border-warning/20',
  valid: 'bg-success/10 text-success border border-success/20',
  invalid: 'bg-danger/10 text-danger border border-danger/20'
}

// Puskesmas binaan pasien -- kalau belum ter-resolve TAPI pengirim hasil labnya jelas rujukan
// PERORANGAN (dokter/bidan, revisi Bu Kadis Fase 5), tampilkan nama perujuk itu, bukan "-"
// polos -- datanya sebenarnya ADA, cuma memang bukan puskesmas. Sama persis dengan
// pasien/index.vue (dua tempat rendering yang sama, tidak digabung ke composable bersama
// karena masing-masing cuma dipakai 1 kali di file masing-masing).
function puskesmasFieldLabel(patient: Patient): string {
  if (patient.puskesmas?.nama) return patient.puskesmas.nama
  if (patient.puskesmas_resolution_method === 'pengirim_individual' && patient.pengirim_raw) {
    return `Rujukan: ${patient.pengirim_raw}`
  }
  return '-'
}

function puskesmasFieldTitle(patient: Patient): string | undefined {
  if (patient.puskesmas?.nama) return undefined
  if (patient.puskesmas_resolution_method === 'unresolvable' && patient.pengirim_raw) {
    return `Tidak teridentifikasi otomatis. Teks pengirim asli: "${patient.pengirim_raw}"`
  }
  return undefined
}

const getWilayahLabel = (status) => {
  if (status === 'resolved') return 'Wilayah Cocok'
  if (status === 'unresolved') return 'Belum Cocok'
  if (status === 'out_of_scope') return 'Luar Cakupan'
  return 'Tidak Diketahui'
}

const getGeoLabel = (status) => {
  if (status === 'verified') return 'Terverifikasi'
  if (status === 'approximate') return 'Perkiraan (Desa)'
  return 'Belum Diketahui'
}

// --- Ajukan Update Data Pasien (PATCH /patients/{id}/propose-update) ---
// Jalur PARALEL dari usulan kader lewat POST /visit-reports (itu terikat satu laporan
// kunjungan) -- PatientsCachePolicy::update sudah scoped ke puskesmas yang sama, staf cuma bisa
// ajukan untuk pasien di wilayah kerjanya sendiri. SELALU pending_review di SiLAKES, TIDAK
// PERNAH auto-apply ke data KOPIPU sendiri (docs/planning/01 §9).
const canProposeUpdate = computed(() => {
  const roles = authStore.roles ?? []
  if (roles.includes('super_admin')) return true
  if (roles.includes('admin_puskesmas') || roles.includes('pj_prolanis')) {
    return authStore.user?.puskesmas_id === patient.value?.puskesmas?.id
  }
  return false
})

// --- Tugaskan Tenaga Kesehatan (POST /care-assignments, revisi Bu Kadis) ---
// CareAssignmentPolicy::create() MEMANG mengizinkan super_admin (gerbang otorisasi sama dengan
// canProposeUpdate), TAPI dropdown pilihan tenaga_kesehatan di bawah (GET /tenaga-kesehatan)
// scoped ke puskesmas user login (TenagaKesehatanService::scopedQuery) -- untuk super_admin
// (DataScope::isFullAccess) itu artinya SEMUA tenaga_kesehatan se-kabupaten tanpa filter
// puskesmas pasien sama sekali, bukan cuma yang relevan untuk pasien ini. Fitur ini secara
// praktis tidak pernah benar-benar berguna untuk super_admin (temuan lapangan, revisi Bu
// Kadis) -- disembunyikan total dari pandangan mereka, computed TERPISAH dari canProposeUpdate
// (fitur "Ajukan Update Data" di sebelahnya TETAP tampil untuk super_admin, itu tidak
// bermasalah sama sekali).
const canAssignTenagaKesehatan = computed(() => canProposeUpdate.value && !(authStore.roles ?? []).includes('super_admin'))
const showAssignTkModal = ref(false)
const tkOptions = ref<TenagaKesehatan[]>([])
const isLoadingTkOptions = ref(false)
const selectedTkId = ref<number | null>(null)
const assignTkDate = ref(new Date().toISOString().slice(0, 10))
const isAssigningTk = ref(false)
const assignTkError = ref('')

// Kunjungan hari-1 bersama kader (revisi Bu Kadis PMO) -- opsional: kalau dipilih, kader
// ditandai pendamping kunjungan pertama nakes ini DAN rencana mingguan kader langsung aktif
// (CareAssignmentService::assignTenagaKesehatan()). null = nakes sendirian seperti sebelumnya.
const kaderOptions = ref<Kader[]>([])
const isLoadingKaderOptions = ref(false)
const selectedKaderId = ref<number | null>(null)

async function openAssignTkModal() {
  showAssignTkModal.value = true
  assignTkError.value = ''
  selectedTkId.value = null
  selectedKaderId.value = null
  assignTkDate.value = new Date().toISOString().slice(0, 10)
  if (!tkOptions.value.length) {
    isLoadingTkOptions.value = true
    try {
      const api = useApi()
      tkOptions.value = await fetchAllPages((page) => api('/tenaga-kesehatan', { query: { per_page: 100, page, status_aktif: true } }))
    } catch (e) {
      console.error(e)
    } finally {
      isLoadingTkOptions.value = false
    }
  }
  if (!kaderOptions.value.length) {
    isLoadingKaderOptions.value = true
    try {
      const api = useApi()
      kaderOptions.value = await fetchAllPages((page) => api('/kader', { query: { per_page: 100, page, status_aktif: true } }))
    } catch (e) {
      console.error(e)
    } finally {
      isLoadingKaderOptions.value = false
    }
  }
}

async function assignTenagaKesehatan() {
  if (!patient.value || !selectedTkId.value) return
  isAssigningTk.value = true
  assignTkError.value = ''
  try {
    const api = useApi()
    await api('/care-assignments', {
      method: 'POST',
      body: {
        patient_id: patient.value.id,
        tenaga_kesehatan_id: selectedTkId.value,
        scheduled_date: assignTkDate.value,
        kader_id: selectedKaderId.value
      }
    })
    showAssignTkModal.value = false
    toast.add({ title: 'Tenaga kesehatan berhasil ditugaskan', icon: 'i-lucide-check-circle-2' })
  } catch (e) {
    assignTkError.value = e instanceof ApiError ? e.message : 'Gagal menugaskan tenaga kesehatan.'
  } finally {
    isAssigningTk.value = false
  }
}

const showUpdateModal = ref(false)
const updateForm = ref<PatientFieldUpdates>({})
const isSavingUpdate = ref(false)
const updateError = ref('')

// Typeahead Kel/Desa & Kecamatan (bukan input teks bebas lagi) -- nilai yang diajukan HARUS
// persis sama (huruf besar/kecil) dengan tabel kecamatan/desa kanonik, supaya WilayahResolver
// di backend tidak perlu fuzzy-match teks bebas untuk data yang masuk lewat jalur ini.
const kecamatanList = ref<Kecamatan[]>([])
const desaList = ref<Desa[]>([])
const selectedKecamatanId = ref<number | null>(null)
const isLoadingDesa = ref(false)

async function loadKecamatanList() {
  try {
    const api = useApi()
    const res = await api('/kecamatan') as ApiSuccessEnvelope<Kecamatan[]>
    kecamatanList.value = res.data
  } catch {
    // Non-fatal -- dropdown kecamatan cuma kosong, tidak menghalangi field lain di form.
  }
}
onMounted(loadKecamatanList)

async function loadDesaList(kecamatanId: number) {
  isLoadingDesa.value = true
  try {
    const api = useApi()
    const res = await api('/desa', { query: { kecamatan_id: kecamatanId } }) as ApiSuccessEnvelope<Desa[]>
    desaList.value = res.data
  } catch {
    desaList.value = []
  } finally {
    isLoadingDesa.value = false
  }
}

const kecamatanSelectItems = computed(() => kecamatanList.value.map((k) => ({ label: k.nama, value: k.id })))
const desaSelectItems = computed(() => desaList.value.map((d) => ({ label: d.nama, value: d.nama })))

// Dipicu HANYA saat user benar-benar mengganti kecamatan lewat dropdown (bukan pre-select
// terprogram di openUpdateModal) -- kel_desa lama dikosongkan karena sudah tidak relevan
// dengan kecamatan baru, supaya tidak keliru submit kombinasi yang tidak nyambung.
function onKecamatanChange(kecamatanId: number | null) {
  selectedKecamatanId.value = kecamatanId
  const kecamatan = kecamatanList.value.find((k) => k.id === kecamatanId)
  updateForm.value.kecamatan = kecamatan?.nama ?? ''
  updateForm.value.kel_desa = ''
  desaList.value = []
  if (kecamatanId !== null) loadDesaList(kecamatanId)
}

function openUpdateModal() {
  updateForm.value = {
    alamat: patient.value?.alamat ?? '',
    rt_rw: patient.value?.rt_rw ?? '',
    kel_desa: patient.value?.kel_desa_raw ?? '',
    kecamatan: patient.value?.kecamatan_raw ?? '',
    phone: patient.value?.phone ?? '',
    jenis_prolanis: patient.value?.jenis_prolanis ?? '',
    jenis_perokok: patient.value?.jenis_perokok ?? ''
  }
  updateError.value = ''
  // Coba pre-select kecamatan kalau nilai lama (teks bebas dari SiLAKES) kebetulan cocok
  // dengan salah satu nama kanonik -- kalau tidak cocok, biarkan kosong (user pilih ulang
  // lewat dropdown, otomatis jadi kanonik).
  const matchedKecamatan = kecamatanList.value.find(
    (k) => k.nama.toLowerCase() === (patient.value?.kecamatan_raw ?? '').trim().toLowerCase()
  )
  selectedKecamatanId.value = matchedKecamatan?.id ?? null
  if (matchedKecamatan) loadDesaList(matchedKecamatan.id)
  showUpdateModal.value = true
}

async function submitProposeUpdate() {
  const hasAnyValue = Object.values(updateForm.value).some((v) => typeof v === 'string' ? v.trim() !== '' : v !== undefined)
  if (!hasAnyValue) {
    updateError.value = 'Isi minimal satu field yang ingin diajukan perubahannya.'
    return
  }
  isSavingUpdate.value = true
  updateError.value = ''
  try {
    const api = useApi()
    const payload: PatientFieldUpdates = {}
    for (const [key, value] of Object.entries(updateForm.value)) {
      if (typeof value === 'string' && value.trim() !== '') (payload as any)[key] = value.trim()
      else if (typeof value === 'boolean') (payload as any)[key] = value
    }
    await api(`/patients/${route.params.id}/propose-update`, { method: 'PATCH', body: payload })
    showUpdateModal.value = false
    toast.add({ title: 'Usulan perubahan data pasien berhasil diajukan', color: 'success' })
    // Usulan baru muncul di riwayat dengan status pending_review -- muat ulang supaya
    // langsung terlihat, bukan menunggu reload halaman manual.
    loadUpdateHistory()
  } catch (e) {
    updateError.value = e instanceof ApiError ? e.message : 'Gagal mengajukan usulan perubahan.'
  } finally {
    isSavingUpdate.value = false
  }
}

// --- Riwayat Pengajuan Perubahan Data (GET /patients/{id}/update-history) ------------------
// Dibaca LIVE dari SiLAKES (patient_field_updates, sumber kopipu_*) -- KOPIPU tidak menyimpan
// salinan lokal status approval, SiLAKES tetap satu-satunya sumber kebenaran. Gerbang akses
// SAMA dengan canProposeUpdate (kalau boleh mengajukan, boleh lihat riwayatnya).
const updateHistory = ref<PatientFieldUpdateHistoryItem[]>([])
const isLoadingHistory = ref(false)
const historyError = ref('')

async function loadUpdateHistory() {
  if (!canProposeUpdate.value) return
  isLoadingHistory.value = true
  historyError.value = ''
  try {
    const api = useApi()
    const res = await api(`/patients/${route.params.id}/update-history`) as ApiSuccessEnvelope<PatientFieldUpdateHistoryItem[]>
    updateHistory.value = res.data
  } catch (e) {
    historyError.value = e instanceof ApiError ? e.message : 'Gagal memuat riwayat pengajuan.'
  } finally {
    isLoadingHistory.value = false
  }
}

// canProposeUpdate baru pasti terisi SETELAH patient.value ada (bergantung puskesmas pasien) --
// watch, bukan langsung onMounted, supaya tidak memuat riwayat sebelum gerbang aksesnya jelas.
watch(canProposeUpdate, (allowed) => {
  if (allowed) loadUpdateHistory()
}, { immediate: true })

const HISTORY_STATUS_LABELS: Record<string, string> = {
  pending_review: 'Menunggu Peninjauan',
  approved: 'Disetujui',
  rejected: 'Ditolak'
}
const HISTORY_STATUS_COLORS: Record<string, string> = {
  pending_review: 'bg-warning/10 text-warning border border-warning/20',
  approved: 'bg-success/10 text-success border border-success/20',
  rejected: 'bg-danger/10 text-danger border border-danger/20'
}
const HISTORY_KATEGORI_LABELS: Record<string, string> = { geo: 'Titik Lokasi', kontak: 'Kontak/Alamat', identitas: 'Identitas' }

function historyItemLabel(item: PatientFieldUpdateHistoryItem): string {
  if (item.kategori === 'geo') return 'Titik Lokasi Rumah'
  return item.field_name ?? HISTORY_KATEGORI_LABELS[item.kategori] ?? item.kategori
}

function formatHistoryDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Usulan disetujui SiLAKES SETELAH sinkronisasi lokal terakhir -- berarti data pasien di
// KOPIPU masih versi lama, belum menangkap perubahan yang baru disetujui itu (dibandingkan
// lewat reviewed_at vs patient.last_synced_at, bukan cuma "ada status approved" -- approval
// LAMA yang sudah tertangkap sync sebelumnya tidak perlu terus disarankan sync ulang).
const pendingSyncSuggestion = computed(() => {
  if (!patient.value) return false
  const lastSynced = patient.value.last_synced_at ? new Date(patient.value.last_synced_at).getTime() : 0
  return updateHistory.value.some((item) =>
    item.status === 'approved' && item.reviewed_at && new Date(item.reviewed_at).getTime() > lastSynced
  )
})

const isSuperAdminForSync = computed(() => (authStore.roles ?? []).includes('super_admin'))
const isTriggeringSync = ref(false)

async function triggerSyncFromHistory() {
  if (isTriggeringSync.value) return
  isTriggeringSync.value = true
  try {
    const api = useApi()
    const res = await api('/silakes/sync', { method: 'POST' }) as ApiSuccessEnvelope<{ last_synced_at: string }>
    toast.add({ title: 'Sinkronisasi SiLAKES berhasil', description: 'Data pasien ini sudah dimuat ulang dengan versi terbaru.', color: 'success' })
    // Tidak perlu reload manual di sini -- signalSilakesSyncCompleted() memicu watcher
    // silakesSyncSignal di bawah, yang sudah memanggil loadPatient()+loadUpdateHistory()
    // (satu jalur reload, dipakai baik trigger dari sini maupun dari sidebar).
    signalSilakesSyncCompleted(res.data.last_synced_at)
  } catch (e) {
    toast.add({
      title: 'Sinkronisasi SiLAKES gagal',
      description: e instanceof ApiError ? e.message : 'Terjadi kesalahan tidak terduga.',
      color: 'error'
    })
  } finally {
    isTriggeringSync.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
      <NuxtLink to="/dashboard" class="hover:text-primary transition-colors">Dashboard</NuxtLink>
      <LucideChevronRight class="w-3 h-3" />
      <NuxtLink to="/dashboard/pasien" class="hover:text-primary transition-colors">Data Pasien</NuxtLink>
      <LucideChevronRight class="w-3 h-3" />
      <span class="text-slate-600">Detail Pasien</span>
    </div>

    <div v-if="isLoading" class="bg-white rounded-2xl border border-slate-100 shadow-card p-12 text-center text-slate-400">
      <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
      Memuat data pasien...
    </div>

    <div v-else-if="loadError" class="bg-white rounded-2xl border border-danger/20 shadow-card p-8 text-center">
      <LucideAlertTriangle class="w-8 h-8 mx-auto mb-3 text-danger" />
      <p class="font-semibold text-danger">{{ loadError }}</p>
    </div>

    <template v-else-if="patient">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-2xl shadow-sm border border-primary/20 shrink-0">
            {{ patient.nama.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() }}
          </div>
          <div>
            <h1 class="text-2xl font-extrabold text-accent flex items-center gap-3 flex-wrap">
               {{ patient.nama }}
               <span class="px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider" :class="getRiskColor(patient.risk_level)">
                  {{ getRiskLabel(patient.risk_level) }}
               </span>
               <AppTooltip v-if="patient.early_detection_flag" :text="getEarlyDetectionTooltip(patient)">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-danger/10 text-danger border border-danger/20">
                     <LucideAlertTriangle class="w-3.5 h-3.5" />
                     Deteksi Dini
                  </span>
               </AppTooltip>
            </h1>
            <p class="text-sm text-slate-500 mt-1 font-medium">No. Registrasi: <span class="text-slate-700 font-bold">{{ patient.no_reg || '-' }}</span></p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button
            v-if="canAssignTenagaKesehatan"
            @click="openAssignTkModal"
            class="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm text-secondary bg-secondary/10 hover:bg-secondary/20 transition-colors border border-secondary/20"
          >
            <LucideStethoscope class="w-4 h-4" />
            Tugaskan Tenaga Kesehatan
          </button>
          <button
            v-if="canProposeUpdate"
            @click="openUpdateModal"
            class="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm text-primary bg-primary/10 hover:bg-primary/20 transition-colors border border-primary/20"
          >
            <LucidePencil class="w-4 h-4" />
            Ajukan Update Data
          </button>
        </div>
      </div>

      <!-- Layout Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <!-- Left Column: Biodata -->
        <div class="lg:col-span-1 space-y-6">
          <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <h3 class="font-bold text-accent text-base mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <LucideUser class="w-4 h-4 text-primary" />
              Informasi Pribadi
            </h3>

            <div class="space-y-4">
              <div>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Usia & Jenis Kelamin</p>
                <p class="text-sm font-bold text-slate-800">
                  <template v-if="calculateAge(patient.tgl_lahir)">{{ calculateAge(patient.tgl_lahir) }} Tahun / {{ patient.gender === 'L' ? 'Laki-laki' : patient.gender === 'P' ? 'Perempuan' : '-' }}</template>
                  <span v-else class="text-slate-400">Tidak diketahui</span>
                </p>
              </div>
              <div>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Telepon</p>
                <p class="text-sm font-bold text-slate-800">{{ patient.phone || '-' }}</p>
              </div>
              <div>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">NIK</p>
                <p class="text-sm font-bold" :class="patient.nik === 'Tidak Diketahui' ? 'text-slate-400 italic font-semibold' : 'text-slate-800'">{{ patient.nik }}</p>
              </div>
              <div>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Alamat Domisili</p>
                <p class="text-sm font-bold text-slate-800">{{ patient.alamat || '-' }}</p>
                <p class="text-xs text-slate-500 font-medium mt-0.5">RT/RW {{ patient.rt_rw || '-' }}, Desa {{ patient.kel_desa_raw || '-' }}, Kec. {{ patient.kecamatan_raw || '-' }}</p>
              </div>
              <div>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Puskesmas Binaan</p>
                <AppTooltip :text="puskesmasFieldTitle(patient) ?? ''">
                  <p
                    class="text-sm font-bold"
                    :class="patient.puskesmas?.nama ? 'text-slate-800' : 'text-slate-400 italic font-semibold'"
                  >
                    {{ puskesmasFieldLabel(patient) }}
                  </p>
                </AppTooltip>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <h3 class="font-bold text-accent text-base mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <LucideActivitySquare class="w-4 h-4 text-danger" />
              Informasi Prolanis
            </h3>

            <div class="flex flex-wrap gap-2 mt-2">
              <span v-if="patient.is_prolanis" class="bg-danger/10 text-danger border border-danger/20 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">
                {{ patient.jenis_prolanis === 'DM_HT' ? 'Diabetes & Hipertensi' : (patient.jenis_prolanis || 'Peserta Prolanis') }}
              </span>
              <span v-else class="bg-slate-100 text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">
                Bukan Peserta Prolanis
              </span>
              <span v-if="patient.is_perokok" class="bg-warning/10 text-warning border border-warning/20 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">
                Perokok{{ patient.jenis_perokok ? ` (${patient.jenis_perokok})` : '' }}
              </span>
            </div>
          </div>

          <!-- Hasil Pemeriksaan Terakhir (revisi Bu Kadis) -- GET /patients/{id}/lab-results,
               SEMUA parameter yang pernah diperiksa (bukan cuma yang jadi dasar klasifikasi di
               bawah), lengkap dengan nilai_rujukan ASLI dari SiLAKES. -->
          <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <h3 class="font-bold text-accent text-base mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <LucideFlaskConical class="w-4 h-4 text-primary" />
              Hasil Pemeriksaan Terakhir
            </h3>
            <div v-if="isLoadingLabResults" class="py-8 text-center text-slate-400">
              <LucideLoader2 class="w-5 h-5 mx-auto mb-2 animate-spin" />
              Memuat hasil pemeriksaan...
            </div>
            <p v-else-if="labResultsError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{{ labResultsError }}</p>
            <p v-else-if="labResults.length === 0" class="text-sm text-slate-400 text-center py-6">Belum ada hasil pemeriksaan lab tercatat untuk pasien ini.</p>
            <div v-else class="space-y-3">
              <div v-for="item in labResults" :key="item.parameter" class="flex items-start justify-between gap-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                <div>
                  <p class="text-sm font-bold text-slate-800">{{ item.parameter }}</p>
                  <p class="text-[11px] text-slate-500 mt-0.5">
                    Rujukan: {{ item.nilai_rujukan ?? '-' }}<span v-if="item.satuan"> {{ item.satuan }}</span>
                    &middot; Diperiksa {{ formatCriteriaDate(item.tanggal_periksa) }}
                  </p>
                </div>
                <div class="text-right shrink-0">
                  <p class="text-sm font-black text-slate-800">{{ item.value }}<span v-if="item.satuan" class="text-[11px] font-semibold text-slate-400 ml-1">{{ item.satuan }}</span></p>
                  <span
                    v-if="item.class_hasil"
                    class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    :class="item.class_hasil.toLowerCase().includes('normal') ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'"
                  >{{ item.class_hasil }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Dasar Klasifikasi (revisi Bu Kadis, Fase 5) -- criteria_snapshot baris TERBARU,
               APA ADANYA seperti dihitung RiskClassificationService, bukan dihitung ulang di
               frontend. Cuma tampil kalau ada minimal 1 parameter yang jadi dasar (patient
               tidak_berisiko/belum pernah diklasifikasi bisa punya array kosong). -->
          <div v-if="latestRiskEntry && latestRiskEntry.criteria_snapshot.length > 0" class="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <h3 class="font-bold text-accent text-base mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <LucideClipboardList class="w-4 h-4 text-warning" />
              Dasar Klasifikasi
            </h3>
            <p class="text-xs text-slate-400 mb-3 -mt-1">Parameter yang melebihi ambang rujukan saat klasifikasi terakhir dihitung.</p>
            <div class="space-y-3">
              <div v-for="(item, idx) in latestRiskEntry.criteria_snapshot" :key="idx" class="flex items-start justify-between gap-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                <div>
                  <p class="text-sm font-bold text-slate-800">{{ item.parameter }}</p>
                  <p class="text-[11px] text-slate-500 mt-0.5">Ambang: {{ formatCriteriaThreshold(item) }} &middot; Diperiksa {{ formatCriteriaDate(item.tanggal_periksa) }}</p>
                </div>
                <span class="text-sm font-black text-danger shrink-0">{{ item.value }}</span>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <h3 class="font-bold text-accent text-base mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <LucideMapPin class="w-4 h-4 text-info" />
              Status Wilayah & Sinkronisasi
            </h3>
            <div class="space-y-4">
              <div>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Kecocokan Wilayah</p>
                <p class="text-sm font-bold text-slate-800">{{ getWilayahLabel(patient.wilayah_status) }}</p>
              </div>
              <div>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Titik Lokasi (GPS)</p>
                <p class="text-sm font-bold text-slate-800">{{ getGeoLabel(patient.geo_status) }}</p>
              </div>
              <div>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Terakhir Disinkron</p>
                <p class="text-sm font-bold text-slate-800">{{ patient.last_synced_at ? new Date(patient.last_synced_at).toLocaleString('id-ID') : 'Belum pernah' }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Riwayat Kunjungan (revisi Bu Kadis, Fase 5) -- GET /patients/{id}/
             visit-history, kader MAUPUN tenaga_kesehatan (sebelumnya placeholder statis). -->
        <div class="lg:col-span-2">
          <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5 h-full flex flex-col">
            <div class="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
              <h3 class="font-bold text-accent text-base flex items-center gap-2">
                <LucideCalendarClock class="w-4 h-4 text-info" />
                Riwayat Kunjungan
              </h3>
            </div>

            <div v-if="isLoadingVisitHistory" class="py-16 text-center text-slate-400 flex-1">
              <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
              Memuat riwayat kunjungan...
            </div>
            <p v-else-if="visitHistoryError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{{ visitHistoryError }}</p>
            <div v-else-if="visitHistoryList.length === 0" class="text-center text-slate-400 py-16 flex flex-col items-center justify-center flex-1">
               <LucideHistory class="w-12 h-12 mb-4 text-slate-200" />
               <p class="font-medium text-slate-500">Belum ada kunjungan tercatat untuk pasien ini.</p>
            </div>
            <div v-else class="space-y-4 overflow-y-auto max-h-[520px] pr-1">
              <div v-for="visit in visitHistoryList" :key="visit.id" class="border border-slate-100 rounded-xl p-4">
                <div class="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p class="text-sm font-bold text-slate-800">{{ new Date(visit.scheduled_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) }}</p>
                    <p class="text-xs text-slate-500 mt-0.5">{{ visitAssigneeType(visit) }}: {{ visitAssigneeName(visit) }}</p>
                    <!-- Kunjungan hari-1 bersama kader+nakes (revisi Bu Kadis PMO) -- kader
                         pendamping ikut ditampilkan, bukan cuma pemilik assignment. -->
                    <p v-if="visit.companions?.length" class="text-xs text-slate-400 mt-0.5">
                      Didampingi: {{ visit.companions.map(c => c.nama ?? '-').join(', ') }}
                    </p>
                  </div>
                  <div class="flex flex-col items-end gap-1.5 shrink-0">
                    <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider" :class="VISIT_STATUS_COLORS[visit.status] ?? 'bg-slate-100 text-slate-500 border border-slate-200'">
                      {{ VISIT_STATUS_LABELS[visit.status] ?? visit.status }}
                    </span>
                    <span v-if="visit.report" class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider" :class="VALIDATION_STATUS_COLORS[visit.report.validation_status] ?? 'bg-slate-100 text-slate-500 border border-slate-200'">
                      {{ VALIDATION_STATUS_LABELS[visit.report.validation_status] ?? visit.report.validation_status }}
                    </span>
                  </div>
                </div>
                <div v-if="visit.report" class="mt-3 pt-3 border-t border-slate-50 text-xs text-slate-600 space-y-1">
                  <p><span class="font-semibold text-slate-700">Kondisi:</span> {{ visit.report.kondisi }}</p>
                  <p v-if="visit.report.keluhan"><span class="font-semibold text-slate-700">Keluhan:</span> {{ visit.report.keluhan }}</p>
                  <p v-if="visit.report.catatan"><span class="font-semibold text-slate-700">Catatan:</span> {{ visit.report.catatan }}</p>
                  <p v-if="visit.report.validation_note" class="text-warning-700"><span class="font-semibold">Catatan Validasi:</span> {{ visit.report.validation_note }}</p>

                  <!-- Pemeriksaan klinis (tenaga_kesehatan) -- tensi/GDA/GDP/dst, cuma tampil
                       kalau memang diisi (semua opsional di backend). -->
                  <div v-if="visit.report.systolic || visit.report.diastolic || visit.report.gda || visit.report.gdp || visit.report.gd2jpp || visit.report.uric_acid || visit.report.cholesterol" class="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                    <span v-if="visit.report.systolic || visit.report.diastolic">Tensi: <b>{{ visit.report.systolic ?? '-' }}/{{ visit.report.diastolic ?? '-' }}</b> mmHg</span>
                    <span v-if="visit.report.gda">GDA: <b>{{ visit.report.gda }}</b> mg/dL</span>
                    <span v-if="visit.report.gdp">GDP: <b>{{ visit.report.gdp }}</b> mg/dL</span>
                    <span v-if="visit.report.gd2jpp">GD2JPP: <b>{{ visit.report.gd2jpp }}</b> mg/dL</span>
                    <span v-if="visit.report.uric_acid">Asam Urat: <b>{{ visit.report.uric_acid }}</b> mg/dL</span>
                    <span v-if="visit.report.cholesterol">Kolesterol: <b>{{ visit.report.cholesterol }}</b> mg/dL</span>
                  </div>
                  <p v-if="visit.report.tindakan?.length"><span class="font-semibold text-slate-700">Tindakan:</span> {{ formatTindakan(visit.report.tindakan) }}</p>
                  <p v-if="visit.report.cara_rujukan"><span class="font-semibold text-slate-700">Cara Rujukan:</span> {{ CARA_RUJUKAN_LABELS[visit.report.cara_rujukan] ?? visit.report.cara_rujukan }}</p>

                  <!-- PMO mingguan (kader) -- kepatuhan minum obat + sisa obat. -->
                  <div v-if="visit.report.kepatuhan_obat || visit.report.sisa_obat" class="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                    <span v-if="visit.report.kepatuhan_obat">Kepatuhan Obat: <b>{{ KEPATUHAN_OBAT_LABELS[visit.report.kepatuhan_obat] ?? visit.report.kepatuhan_obat }}</b></span>
                    <span v-if="visit.report.sisa_obat">Sisa Obat: <b>{{ SISA_OBAT_LABELS[visit.report.sisa_obat] ?? visit.report.sisa_obat }}</b></span>
                  </div>
                </div>
                <div class="mt-3 pt-3 border-t border-slate-50 flex justify-end">
                  <NuxtLink :to="`/dashboard/kunjungan/${visit.id}`" class="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                    Lihat Detail Kunjungan
                    <LucideArrowRight class="w-3.5 h-3.5" />
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Riwayat & Tren Kondisi (revisi Bu Kadis, Fase 5) -- GET /patients/{id}/risk-history,
           tabel riwayat klasifikasi + Chart.js line chart tingkat risiko dari waktu ke waktu. -->
      <div v-if="!isLoadingRiskHistory && riskHistory.length > 0" class="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
        <div class="flex items-center justify-between mb-5 border-b border-slate-100 pb-4">
          <h3 class="font-bold text-accent text-base flex items-center gap-2">
            <LucideTrendingUp class="w-4 h-4 text-primary" />
            Riwayat & Tren Kondisi
          </h3>
        </div>

        <p v-if="riskHistoryError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2 mb-4">{{ riskHistoryError }}</p>

        <div v-if="riskHistory.length > 1" class="h-64 mb-6">
          <Line :data="trendChartData" :options="trendChartOptions" />
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr class="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th class="py-3 px-3 font-semibold">Tanggal</th>
                <th class="py-3 px-3 font-semibold">Tingkat Risiko</th>
                <th class="py-3 px-3 font-semibold">Dasar Klasifikasi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="entry in riskHistory" :key="entry.id" class="hover:bg-slate-50/80 transition-colors" :class="{ 'bg-danger/5': entry.level === 'berat' }">
                <td class="py-3 px-3 text-sm font-semibold text-slate-700">{{ formatCriteriaDate(entry.assessment_date ?? entry.computed_at) }}</td>
                <td class="py-3 px-3">
                  <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider" :class="getRiskColor(entry.level)">
                    {{ getRiskLabel(entry.level) }}
                  </span>
                  <AppTooltip
                     v-if="entry.early_detection_flag"
                     :text="entry.early_detection_reason?.map(r => r.message).join(' — ') ?? ''"
                  >
                     <LucideAlertTriangle class="w-3.5 h-3.5 text-danger inline-block ml-1.5 align-middle" />
                  </AppTooltip>
                </td>
                <td class="py-3 px-3 text-xs text-slate-500">
                  <template v-if="entry.criteria_snapshot.length">{{ entry.criteria_snapshot.map(c => c.parameter).join(', ') }}</template>
                  <span v-else class="text-slate-300">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Riwayat Pengajuan Perubahan Data -- GET /patients/{id}/update-history, dibaca LIVE
           dari SiLAKES (bukan salinan lokal), cuma tampil untuk role yang boleh mengajukan
           (canProposeUpdate: super_admin/admin_puskesmas/pj_prolanis sepuskesmas). -->
      <div v-if="canProposeUpdate" class="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
        <div class="flex items-center justify-between mb-5 border-b border-slate-100 pb-4">
          <h3 class="font-bold text-accent text-base flex items-center gap-2">
            <LucideHistory class="w-4 h-4 text-secondary" />
            Riwayat Pengajuan Perubahan Data
          </h3>
        </div>

        <!-- Saran sinkronisasi -- muncul kalau ada usulan yang DISETUJUI SETELAH sync lokal
             terakhir (data pasien di KOPIPU masih versi lama). super_admin: tombol langsung
             memicu sinkronisasi. Role lain: cuma teks anjuran, mereka tidak berwenang sync. -->
        <div v-if="pendingSyncSuggestion" class="mb-5 flex items-center gap-3 bg-success/5 border border-success/20 rounded-2xl px-5 py-3.5">
          <div class="w-9 h-9 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0">
            <LucideCheckCircle2 class="w-4.5 h-4.5" />
          </div>
          <p class="flex-1 text-sm font-semibold text-accent">
            Ada usulan yang <span class="text-success">disetujui SiLAKES</span> namun belum tercermin di data pasien ini.
            <template v-if="isSuperAdminForSync">Jalankan sinkronisasi untuk memperbarui.</template>
            <template v-else>Hubungi super_admin untuk menjalankan sinkronisasi manual, atau tunggu jadwal otomatis (tiap 48 jam).</template>
          </p>
          <button
            v-if="isSuperAdminForSync"
            type="button"
            :disabled="isTriggeringSync"
            @click="triggerSyncFromHistory"
            class="shrink-0 flex items-center gap-1.5 text-xs font-bold text-success hover:text-success/80 bg-white border border-success/30 rounded-lg px-3 py-2 transition-colors disabled:opacity-60"
          >
            <LucideLoader2 v-if="isTriggeringSync" class="w-3.5 h-3.5 animate-spin" />
            <LucideRefreshCw v-else class="w-3.5 h-3.5" />
            {{ isTriggeringSync ? 'Menyinkronkan...' : 'Sinkronisasi Sekarang' }}
          </button>
        </div>

        <div v-if="isLoadingHistory" class="py-10 text-center text-slate-400">
          <LucideLoader2 class="w-5 h-5 mx-auto mb-2 animate-spin" />
          Memuat riwayat pengajuan...
        </div>
        <p v-else-if="historyError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{{ historyError }}</p>
        <div v-else-if="updateHistory.length === 0" class="py-10 text-center text-slate-400">
          <LucideHistory class="w-10 h-10 mx-auto mb-3 text-slate-200" />
          <p class="font-medium text-slate-500">Belum ada usulan perubahan yang pernah diajukan untuk pasien ini.</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr class="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th class="py-3 px-3 font-semibold">Field</th>
                <th class="py-3 px-3 font-semibold">Nilai Lama → Usulan</th>
                <th class="py-3 px-3 font-semibold">Sumber</th>
                <th class="py-3 px-3 font-semibold">Diajukan</th>
                <th class="py-3 px-3 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="item in updateHistory" :key="item.id" class="hover:bg-slate-50/80 transition-colors">
                <td class="py-3 px-3 text-sm font-bold text-slate-800">{{ historyItemLabel(item) }}</td>
                <td class="py-3 px-3 text-xs text-slate-600">
                  <span class="text-slate-400 line-through">{{ item.old_value || '(kosong)' }}</span>
                  <span class="mx-1 text-slate-300">→</span>
                  <span class="font-semibold text-slate-700">{{ item.new_value || '-' }}</span>
                </td>
                <td class="py-3 px-3 text-xs font-medium text-slate-600">{{ item.kopipu_kader_nama || 'Staf KOPIPU' }}</td>
                <td class="py-3 px-3 text-xs text-slate-500">{{ formatHistoryDate(item.created_at) }}</td>
                <td class="py-3 px-3 text-center">
                  <span class="px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider inline-block" :class="HISTORY_STATUS_COLORS[item.status]">
                    {{ HISTORY_STATUS_LABELS[item.status] }}
                  </span>
                  <p v-if="item.catatan_reviewer" class="text-[10px] text-slate-400 mt-1 max-w-[160px] mx-auto" :title="item.catatan_reviewer">{{ item.catatan_reviewer }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Modal Tugaskan Tenaga Kesehatan -- POST /care-assignments (revisi Bu Kadis). Ini
         SELALU menugaskan tenaga kesehatan BARU (rencana kunjungan berulang) -- kalau pasien
         sudah punya rencana aktif ke tenaga kesehatan yang sama, backend menolak (lihat
         CareAssignmentService::ensureTenagaKesehatanAvailable()); kunjungan tambahan mendesak
         untuk plan yang SUDAH ada punya endpoint terpisah (adhoc-visit), belum ada UI-nya di
         halaman ini -- menyusul kalau daftar rencana per-pasien sudah ditampilkan. -->
    <div v-if="showAssignTkModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div class="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
        <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
          <h3 class="font-bold text-accent text-lg flex items-center gap-2">
            <LucideStethoscope class="w-5 h-5 text-secondary" />
            Tugaskan Tenaga Kesehatan
          </h3>
          <button @click="showAssignTkModal = false" class="text-slate-400 hover:text-slate-600 p-1">
            <LucideX class="w-5 h-5" />
          </button>
        </div>
        <div class="p-6 space-y-4 overflow-y-auto">
          <p v-if="assignTkError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{{ assignTkError }}</p>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Tenaga Kesehatan</label>
            <select v-model.number="selectedTkId" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option :value="null">{{ isLoadingTkOptions ? 'Memuat...' : 'Pilih tenaga kesehatan...' }}</option>
              <option v-for="tk in tkOptions" :key="tk.id" :value="tk.id">{{ tk.user?.name }} &mdash; {{ tk.puskesmas?.nama }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Tanggal Kunjungan Pertama</label>
            <input v-model="assignTkDate" type="date" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Kader Pendamping (opsional)</label>
            <select v-model.number="selectedKaderId" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option :value="null">{{ isLoadingKaderOptions ? 'Memuat...' : 'Tanpa kader (nakes sendirian)' }}</option>
              <option v-for="kader in kaderOptions" :key="kader.id" :value="kader.id">{{ kader.user?.name }}</option>
            </select>
            <p class="text-xs text-slate-400 mt-1.5">Kunjungan hari pertama biasanya kader ikut mendampingi -- pilih kadernya di sini supaya rencana kunjungan mingguan kader ini langsung aktif juga.</p>
          </div>
        </div>
        <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
          <button @click="showAssignTkModal = false" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
          <button @click="assignTenagaKesehatan" :disabled="isAssigningTk || !selectedTkId" class="py-2.5 px-6 rounded-xl font-bold text-white bg-secondary hover:bg-secondary-600 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm">
            <LucideLoader2 v-if="isAssigningTk" class="w-4 h-4 animate-spin" />
            {{ isAssigningTk ? 'Menugaskan...' : 'Tugaskan' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Ajukan Update Data Pasien -- PATCH /patients/{id}/propose-update, jalur paralel
         dari usulan kader lewat POST /visit-reports. -->
    <div v-if="showUpdateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div class="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
          <h3 class="font-bold text-accent text-lg flex items-center gap-2">
            <LucidePencil class="w-5 h-5 text-primary" />
            Ajukan Update Data Pasien
          </h3>
          <button @click="showUpdateModal = false" class="text-slate-400 hover:text-slate-600 p-1">
            <LucideX class="w-5 h-5" />
          </button>
        </div>

        <div class="p-6 space-y-4 overflow-y-auto">
          <p class="text-sm text-slate-500">Isi apa yang Anda ketahui akurat tentang pasien ini — boleh sebagian saja. Usulan ini dikirim ke SiLAKES untuk ditinjau, tidak langsung diterapkan.</p>
          <p v-if="updateError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{{ updateError }}</p>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Alamat Lengkap</label>
            <textarea v-model="updateForm.alamat" rows="2" placeholder="Jl. ..." class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"></textarea>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">RT/RW</label>
              <input type="text" v-model="updateForm.rt_rw" placeholder="002/003" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Kecamatan</label>
              <USelectMenu
                :model-value="selectedKecamatanId"
                @update:model-value="onKecamatanChange"
                :items="kecamatanSelectItems"
                value-key="value"
                searchable
                placeholder="Pilih kecamatan..."
                class="w-full"
              />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Kel/Desa</label>
              <USelectMenu
                v-model="updateForm.kel_desa"
                :items="desaSelectItems"
                value-key="value"
                searchable
                :disabled="!selectedKecamatanId"
                :loading="isLoadingDesa"
                :placeholder="selectedKecamatanId ? 'Pilih kel/desa...' : 'Pilih kecamatan dulu'"
                class="w-full"
              />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Nomor Telepon</label>
            <input type="tel" v-model="updateForm.phone" placeholder="08..." class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Pekerjaan</label>
            <input type="text" v-model="updateForm.pekerjaan" placeholder="Mis. Petani, Pensiunan..." class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Status Perkawinan</label>
              <select v-model="updateForm.status_perkawinan" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                <option value="">Pilih...</option>
                <option value="BELUM KAWIN">Belum Kawin</option>
                <option value="KAWIN">Kawin</option>
                <option value="CERAI HIDUP">Cerai Hidup</option>
                <option value="CERAI MATI">Cerai Mati</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Golongan Darah</label>
              <select v-model="updateForm.golongan_darah" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                <option value="">Pilih...</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="AB">AB</option>
                <option value="O">O</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Agama</label>
              <select v-model="updateForm.agama" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                <option value="">Pilih...</option>
                <option value="ISLAM">Islam</option>
                <option value="KRISTEN">Kristen</option>
                <option value="KATOLIK">Katolik</option>
                <option value="HINDU">Hindu</option>
                <option value="BUDHA">Budha</option>
                <option value="KONGHUCU">Konghucu</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Status Perokok</label>
              <select v-model="updateForm.jenis_perokok" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                <option value="">Pilih...</option>
                <option value="AKTIF">Aktif Merokok</option>
                <option value="PASIF">Pasif / Tidak Merokok</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Jenis Prolanis</label>
            <select v-model="updateForm.jenis_prolanis" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
              <option value="">Pilih...</option>
              <option value="DM">Diabetes Mellitus (DM)</option>
              <option value="HT">Hipertensi (HT)</option>
              <option value="DM_HT">DM & Hipertensi</option>
            </select>
          </div>
          <div class="flex items-center gap-3 pt-2 border-t border-slate-100">
            <input type="checkbox" id="pasien_is_bpjs" v-model="updateForm.is_bpjs" class="w-4 h-4 rounded text-primary border-slate-300 focus:ring-primary" />
            <label for="pasien_is_bpjs" class="text-sm font-bold text-slate-700">Peserta BPJS</label>
          </div>
          <div v-if="updateForm.is_bpjs">
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Nomor BPJS</label>
            <input type="text" v-model="updateForm.no_bpjs" placeholder="0001234567890" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
        </div>

        <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
          <button @click="showUpdateModal = false" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
          <button
            @click="submitProposeUpdate"
            :disabled="isSavingUpdate"
            class="py-2.5 px-6 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <LucideLoader2 v-if="isSavingUpdate" class="w-4 h-4 animate-spin" />
            {{ isSavingUpdate ? 'Mengajukan...' : 'Ajukan Perubahan' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
