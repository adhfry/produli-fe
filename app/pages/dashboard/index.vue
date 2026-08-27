<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  LucideUsers,
  LucideAlertTriangle,
  LucideAlertCircle,
  LucideCheckCircle2,
  LucideUserPlus,
  LucideActivity,
  LucideMapPin,
  LucideMaximize,
  LucidePlus,
  LucideMinus,
  LucidePieChart,
  LucideTarget,
  LucideActivitySquare,
  LucideBarChart4,
  LucideBellRing,
  LucideSearch,
  LucideFilter,
  LucideCalendar,
  LucideBuilding2,
  LucideChevronDown,
  LucideTrendingUp,
  LucideShieldCheck
} from "#components"
import { resolveAnnouncementIcon } from '~/utils/announcement-icons'

import type { ApiSuccessEnvelope, DashboardSummary, DashboardKecamatanRisk, DashboardDesaRisk, DashboardPuskesmasPerformance, PaginatedData, Announcement, Puskesmas } from '~/types/api'
import flatpickr from 'flatpickr'
import 'flatpickr/dist/flatpickr.css'
import { Indonesian } from 'flatpickr/dist/l10n/id.js'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend } from 'chart.js'

// Donut chart kartu "Tingkat Kepatuhan" (revisi Bu Kadis) -- registrasi terpisah dari
// pasien/[id].vue (Line chart riwayat risiko), tiap halaman yang pakai Chart.js daftar sendiri
// (ChartJS.register idempotent, aman dipanggil ulang).
ChartJS.register(ArcElement, ChartTooltip, ChartLegend)

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

useHead({
  title: 'Ringkasan'
})

// --- Ringkasan & peta GIS — GET /api/v1/dashboard/summary (docs/planning/02 §7/§13) ---
const TOP_DISTRICT_COLORS = ['bg-danger', 'bg-orange-500', 'bg-warning', 'bg-primary', 'bg-primary/60']

function formatId(n: number): string {
  return n.toLocaleString('id-ID')
}

function initialsOf(nama: string | null): string {
  if (!nama) return '?'
  return nama.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

function formatWaktuAktivitas(iso: string | null): string {
  if (!iso) return 'Belum ada aktivitas'
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' WIB'
}

// Kader tanpa target hari ini (belum ada assignment terjadwal) -> 0%, bukan NaN/Infinity.
function kaderProgressPercent(kader: { achieved: number, target: number }): number {
  return kader.target > 0 ? Math.round((kader.achieved / kader.target) * 100) : 0
}

const dashboardSummary = ref<DashboardSummary | null>(null)
const summaryError = ref('')

const stats = ref<any[]>([])
const riskDistribution = ref<any[]>([])
const totalRiskValue = ref({ targetValue: '0', displayValue: '0' })
const progressValue = ref({ targetValue: '0%', displayValue: '0%' })
const progressPercent = ref(0)
const assignmentTotals = ref({ completed: 0, total: 0 })

// Donut chart kecil di kartu "Tingkat Kepatuhan" (revisi Bu Kadis) -- proporsi kunjungan
// selesai vs belum selesai, data SAMA dengan panel "Progres Kunjungan" di Middle Section
// (assignmentTotals), cuma divisualisasikan lagi dalam bentuk ringkas di kartu stat.
const tingkatKepatuhanChartData = computed(() => ({
  labels: ['Selesai', 'Belum Selesai'],
  datasets: [{
    data: [assignmentTotals.value.completed, Math.max(assignmentTotals.value.total - assignmentTotals.value.completed, 0)],
    backgroundColor: ['#0d9488', '#e2e8f0'],
    borderWidth: 0
  }]
}))
const tingkatKepatuhanChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '72%',
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { label: string, parsed: number }) => `${ctx.label}: ${ctx.parsed}`
      }
    }
  }
}
const TINGKAT_KEPATUHAN_EXPLAINER = 'Tingkat Kepatuhan = persentase kunjungan yang sudah diselesaikan (completed) dari seluruh kunjungan yang dijadwalkan pada periode ini.'
const activities = ref<any[]>([])
const topDistricts = ref<any[]>([])
const puskesmasPerformanceRows = ref<any[]>([])

// Detail skor "Top 5 Puskesmas Kinerja Terbaik" (tooltip bar) -- lihat App\Services\Performance\
// PuskesmasPerformanceScoringService di backend untuk arti tiap komponen.
function formatPerformanceDetail(p: DashboardPuskesmasPerformance): string {
  return `Improvement Rate ${p.improvement_rate}% · Risk Reduction ${p.risk_reduction_score}% · `
    + `Stability ${p.stability_rate}% · ${p.eligible_patients} pasien eligible, ${p.improved_patients} membaik, `
    + `${p.validated_visits} kunjungan tervalidasi`
}

async function loadDashboardSummary() {
  summaryError.value = ''
  try {
    const api = useApi()
    const query: Record<string, string | number> = {}
    if (selectedPuskesmasId.value !== null) query.puskesmas_id = selectedPuskesmasId.value
    if (dateRangeFrom.value) query.date_from = dateRangeFrom.value
    if (dateRangeTo.value) query.date_to = dateRangeTo.value
    const res = await api('/dashboard/summary', { query }) as ApiSuccessEnvelope<DashboardSummary>
    const data = res.data
    dashboardSummary.value = data
    refreshMapRiskData()

    const risk = data.patients_per_risk_level
    const visits = data.visits_per_status

    // "Lihat Detail" per card -- reuse halaman yang sudah ada + query param, docs/planning/02
    // §17 tabel mapping (JANGAN bikin halaman baru).
    stats.value = [
      // "3.900 dari total 5.000 pasien Prolanis" (revisi Bu Kadis) -- totalSuffix statis
      // (tidak dianimasikan, animateNumber() cuma memparse SATU angka per objek) ditampilkan
      // setelah displayValue yang tetap dianimasikan seperti biasa. total_patients ("Total
      // Pasien Aktif") = pasien yang levelnya SEDANG berisiko sekarang (ringan/sedang/berat),
      // BUKAN "pernah dievaluasi" (revisi kelima -- lihat DashboardService::summaryFor()).
      { label: 'Total Pasien Aktif', targetValue: formatId(data.total_patients), displayValue: '0', totalSuffix: `/ ${formatId(data.total_patients_prolanis)}`, icon: LucideUsers, colorClass: 'text-primary', bgClass: 'bg-primary/10', to: '/dashboard/pasien' },
      // "Pasien Tidak Berisiko" = SELISIH total_patients_prolanis - total_patients (murni
      // pengurangan) -- backend sekarang menjamin SETIAP pasien eligible selalu punya baris
      // klasifikasi minimal 'tidak_berisiko' (RiskClassificationService revisi keempat), jadi
      // selisih ini otomatis = jumlah baris tidak_berisiko sungguhan, sama persis dengan yang
      // muncul kalau kartu ini diklik (?risk_level=tidak_berisiko) -- tidak perlu lagi
      // menggabungkan 2 sumber angka seperti sebelumnya.
      { label: 'Pasien Tidak Berisiko', targetValue: formatId(data.total_patients_prolanis - data.total_patients), displayValue: '0', icon: LucideShieldCheck, colorClass: 'text-success', bgClass: 'bg-success/10', to: '/dashboard/pasien?risk_level=tidak_berisiko' },
      { label: 'Risiko Berat', targetValue: formatId(risk.berat), displayValue: '0', icon: LucideAlertTriangle, colorClass: 'text-danger', bgClass: 'bg-danger/10', to: '/dashboard/pasien?risk_level=berat' },
      { label: 'Risiko Sedang', targetValue: formatId(risk.sedang), displayValue: '0', icon: LucideAlertCircle, colorClass: 'text-warning', bgClass: 'bg-warning/10', to: '/dashboard/pasien?risk_level=sedang' },
      { label: 'Kunjungan Selesai', targetValue: formatId(visits.completed), displayValue: '0', icon: LucideCheckCircle2, colorClass: 'text-success', bgClass: 'bg-success/10', to: '/dashboard/kunjungan?status=completed' },
      { label: 'Kader Aktif', targetValue: formatId(data.kader_aktif_count), displayValue: '0', icon: LucideUserPlus, colorClass: 'text-info', bgClass: 'bg-info/10', to: '/dashboard/kader' },
    ]
    // "Tingkat Kepatuhan" SENGAJA dikeluarkan dari array stats generik di atas -- kartu ini
    // dirender terpisah di template (bukan lewat v-for) karena butuh layout khusus (memanjang
    // 2 baris + donut chart), reuse progressValue/progressPercent yang sudah ada (sama persis
    // dipakai panel "Progres Kunjungan" di Middle Section, supaya tidak duplikat state).

    const totalRisk = risk.ringan + risk.sedang + risk.berat
    const pct = (n: number) => totalRisk > 0 ? (n / totalRisk * 100).toFixed(1).replace('.', ',') : '0,0'
    riskDistribution.value = [
      { label: 'Berat', targetValue: risk.berat, displayValue: 0, percentage: pct(risk.berat), color: 'bg-danger', dotClass: 'bg-danger' },
      { label: 'Sedang', targetValue: risk.sedang, displayValue: 0, percentage: pct(risk.sedang), color: 'bg-warning', dotClass: 'bg-warning' },
      { label: 'Ringan', targetValue: risk.ringan, displayValue: 0, percentage: pct(risk.ringan), color: 'bg-success', dotClass: 'bg-success' },
    ]
    totalRiskValue.value = { targetValue: formatId(totalRisk), displayValue: '0' }

    progressValue.value = { targetValue: `${data.tingkat_kepatuhan}%`, displayValue: '0%' }
    progressPercent.value = data.tingkat_kepatuhan
    assignmentTotals.value = { completed: visits.completed, total: data.total_assignments }

    activities.value = data.aktivitas_hari_ini.map((a) => ({
      name: a.nama ?? `Kader #${a.kader_id}`,
      role: 'Kader Prolanis',
      achieved: a.selesai_hari_ini,
      target: a.target_hari_ini,
      initials: initialsOf(a.nama),
      lastUpdate: formatWaktuAktivitas(a.last_update_at)
    }))

    // SENGAJA pakai risiko_per_kecamatan_se_kabupaten (unscoped) -- widget ini perbandingan
    // se-Kabupaten Sumenep untuk SEMUA role, beda dari risiko_per_kecamatan (scoped) yang
    // dipakai peta lewat refreshMapRiskData().
    const maxBerat = Math.max(...data.risiko_per_kecamatan_se_kabupaten.map((k) => k.berat), 1)
    topDistricts.value = [...data.risiko_per_kecamatan_se_kabupaten]
      .sort((a, b) => (b.berat - a.berat) || ((b.berat + b.sedang + b.ringan) - (a.berat + a.sedang + a.ringan)))
      .slice(0, 5)
      .map((k, idx) => ({
        name: `Kec. ${k.kecamatan_nama}`,
        targetValue: k.berat,
        displayValue: 0,
        percentage: Math.round((k.berat / maxBerat) * 100),
        colorClass: TOP_DISTRICT_COLORS[idx] ?? 'bg-primary/60'
      }))

    // Leaderboard SE-KABUPATEN (revisi Bu Kadis) -- backend (PuskesmasPerformanceScoringService)
    // SENGAJA mengirim data seluruh puskesmas tanpa scope role, sama untuk semua role login
    // (super_admin/admin_puskesmas/pj_prolanis), supaya "Top 5 Puskesmas Kinerja Terbaik" tetap
    // jadi pembanding se-Kabupaten Sumenep, bukan cuma puskesmas sendiri. Sudah terurut
    // final_score desc dari backend (deterministic tie-break), tinggal dipotong 5 teratas.
    // Kinerja dinilai dari keberhasilan meningkatkan kondisi pasien (transisi risiko dengan
    // kunjungan TERVALIDASI sebagai bukti intervensi) -- BUKAN jumlah kunjungan mentah.
    puskesmasPerformanceRows.value = data.puskesmas_performance.slice(0, 5).map((p) => ({
      name: p.puskesmas_nama,
      // Wajib string ber-akhiran '%' (bukan angka desimal polos) -- animateNumber() salah
      // membaca titik desimal sebagai pemisah ribuan di cabang `hasDot` kalau bukan format
      // persen (lihat komentar bug serupa di animateNumber untuk tingkat_kepatuhan).
      targetValue: `${p.final_score}%`,
      displayValue: '0%',
      // final_score sudah dalam skala 0-100 -- persentase bar langsung dari skor absolut, bukan
      // relatif terhadap puskesmas lain (beda dari topDistricts di atas yang memang perbandingan).
      percentage: Math.round(p.final_score),
      breakdownText: formatPerformanceDetail(p)
    }))

    // Reload akibat filter puskesmas/tanggal berubah -- animasikan count-up lagi supaya angka
    // baru tidak nyangkut di displayValue lama '0' (bug ditemukan: sebelumnya animateNumber
    // cuma pernah dipanggil SEKALI, di dalam onMounted -- jadi tiap kali filter diganti, objek
    // stats/riskDistribution/dst dibuat ULANG dengan displayValue direset ke '0' tapi tidak ada
    // yang memicu animasinya lagi, kartu jadi permanen menampilkan 0 walau data & peta sudah
    // benar). Load PERTAMA sengaja dilewati di sini -- onMounted yang urus lewat delay 800ms
    // supaya entrance animation (donut/progress bar) tetap serempak seperti semula.
    if (hasLoadedOnce.value) {
      triggerCardAnimations()
    }
  } catch (e) {
    summaryError.value = e instanceof ApiError ? e.message : 'Gagal memuat ringkasan dashboard.'
    console.error(e)
  }
}

// --- Informasi Pembaruan Sistem — GET/POST /api/v1/announcements (docs/planning/02 §13) ---
// GET: semua role login. POST: super_admin saja (SystemAnnouncementPolicy).
function formatRelativeTime(iso: string | null): string {
  if (!iso) return ''
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return 'Baru saja'
  if (diffMin < 60) return `${diffMin} menit lalu`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} jam lalu`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay === 1) return 'Kemarin'
  if (diffDay < 7) return `${diffDay} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

const notifications = ref<(Announcement & { time: string })[]>([])
const isLoadingAnnouncements = ref(false)
const announcementsError = ref('')

async function loadAnnouncements() {
  isLoadingAnnouncements.value = true
  announcementsError.value = ''
  try {
    const api = useApi()
    const res = await api('/announcements', { query: { per_page: 10 } }) as ApiSuccessEnvelope<PaginatedData<Announcement>>
    notifications.value = res.data.items.map((a) => ({ ...a, time: formatRelativeTime(a.created_at) }))
  } catch (e) {
    announcementsError.value = e instanceof ApiError ? e.message : 'Gagal memuat pengumuman.'
    console.error(e)
  } finally {
    isLoadingAnnouncements.value = false
  }
}

// Resolusi ikon dinamis by-nama (Announcement.icon, string) -- ikon lain di import block atas
// cuma dipakai statis di template. Sumber kebenaran ~/utils/announcement-icons.ts (dipakai
// bersama dashboard/pengumuman/index.vue & AnnouncementInboxModal.vue) -- lihat docblock di
// sana untuk kenapa lookup dinamis WAJIB lewat import eksplisit '@lucide/vue', bukan wildcard
// '#components' (bug 500 "icons is not defined" di build produksi).
function iconComponentFor(name: string) {
  return resolveAnnouncementIcon(name)
}

// Form posting pengumuman baru — super_admin saja (gerbang sesungguhnya tetap di backend Policy,
// ini cuma menyembunyikan tombolnya dari role lain).
const authStore = useAuthStore()
const isSuperAdmin = computed(() => (authStore.roles ?? []).includes('super_admin'))

// Filter puskesmas -- super_admin: dropdown NYATA berisi seluruh puskesmas (GET /puskesmas,
// dikirim sebagai ?puskesmas_id= ke GET /dashboard/summary, DashboardService::summaryFor HANYA
// menghormati param ini utk full-access, lihat backend). admin_puskesmas/pj_prolanis: SUDAH
// terkunci ke puskesmasnya sendiri di backend (tidak pernah benar-benar "semua"), tombolnya
// cuma label non-interaktif berisi nama puskesmas sendiri (GET /puskesmas/{id}, boleh semua
// role staf -- PuskesmasPolicy::view), bukan dropdown karena memang tidak ada pilihan lain.
const selectedPuskesmasId = ref<number | null>(null)
const puskesmasOptions = ref<Puskesmas[]>([])
const isLoadingPuskesmasOptions = ref(false)
const puskesmasScopeLabel = ref('Semua Puskesmas')

async function loadPuskesmasScopeLabel() {
  if (isSuperAdmin.value || !authStore.user?.puskesmas_id) return
  try {
    const api = useApi()
    const res = await api(`/puskesmas/${authStore.user.puskesmas_id}`) as ApiSuccessEnvelope<{ nama: string }>
    puskesmasScopeLabel.value = res.data.nama
  } catch {
    puskesmasScopeLabel.value = '-'
  }
}

async function loadPuskesmasOptions() {
  if (!isSuperAdmin.value) return
  isLoadingPuskesmasOptions.value = true
  try {
    puskesmasOptions.value = await fetchAllPages<Puskesmas>((page) =>
      useApi()('/puskesmas', { query: { per_page: 100, page } })
    )
  } catch (e) {
    console.error('Gagal memuat daftar puskesmas', e)
  } finally {
    isLoadingPuskesmasOptions.value = false
  }
}

function onPuskesmasFilterChange() {
  loadDashboardSummary()
}

// USelectMenu (Nuxt UI) -- typeahead, super_admin cari nama puskesmas langsung sambil ketik
// daripada scroll dropdown panjang (31 puskesmas), pola sama seperti filter kecamatan di
// /dashboard/pasien. Tidak ada item sentinel "Semua Puskesmas" (value null ditolak Combobox
// sebagai item sungguhan) -- clear-selection bawaan komponen sudah cukup, placeholder mewakili
// "belum pilih apa-apa".
const puskesmasSelectItems = computed(() => puskesmasOptions.value.map((p) => ({ label: p.nama, value: p.id })))

// Nama puskesmas terpilih -- dipakai banner personalisasi di bawah header.
const selectedPuskesmasName = computed(() =>
  puskesmasOptions.value.find((p) => p.id === selectedPuskesmasId.value)?.nama ?? null
)

function resetPuskesmasFilter() {
  selectedPuskesmasId.value = null
  onPuskesmasFilterChange()
}

// Filter rentang tanggal -- kebutuhan enterprise/audit (docs/planning §7 lanjutan). Kosong
// secara default (TIDAK ada filter, sama seperti perilaku sebelum fitur ini ada) -- angka
// dashboard tetap "kondisi saat ini" sampai user secara eksplisit memilih rentang. Kunjungan
// (visits_per_status/tingkat_kepatuhan/total_assignments) difilter scheduled_date BETWEEN;
// metrik risiko pasien (total_patients/patients_per_risk_level/risiko_per_kecamatan/
// risiko_per_desa) direkonstruksi "as of" tanggal akhir rentang lewat RiskClassification.
// computed_at (DashboardService::effectiveRiskClassifications), BUKAN sekadar snapshot sekarang.
const dateRangeFrom = ref<string | null>(null)
const dateRangeTo = ref<string | null>(null)
const dateRangeInputRef = ref<HTMLInputElement | null>(null)
const dateRangeLabel = computed(() => {
  if (!dateRangeFrom.value || !dateRangeTo.value) return 'Semua Tanggal'
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmt(dateRangeFrom.value)} - ${fmt(dateRangeTo.value)}`
})

// "Lihat Selengkapnya" widget "Top 5 Puskesmas Kinerja Terbaik" (permintaan user, tombol
// sebelumnya dead) -- bawa periode yang sedang aktif di dashboard ke halaman detailnya, supaya
// konteksnya konsisten (bukan reset ke "Semua Tanggal").
const kinerjaPuskesmasLink = computed(() => ({
  path: '/dashboard/kinerja-puskesmas',
  query: dateRangeFrom.value && dateRangeTo.value ? { date_from: dateRangeFrom.value, date_to: dateRangeTo.value } : {}
}))

function initDateRangePicker() {
  if (!dateRangeInputRef.value) return
  flatpickr(dateRangeInputRef.value, {
    mode: 'range',
    locale: Indonesian,
    dateFormat: 'j M Y',
    onChange: (selectedDates) => {
      if (selectedDates.length === 2) {
        const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        dateRangeFrom.value = toIso(selectedDates[0])
        dateRangeTo.value = toIso(selectedDates[1])
        loadDashboardSummary()
      }
    }
  })
}

function clearDateRange() {
  dateRangeFrom.value = null
  dateRangeTo.value = null
  if (dateRangeInputRef.value) {
    ;(dateRangeInputRef.value as any)._flatpickr?.clear()
  }
  loadDashboardSummary()
}

// Pembuatan pengumuman DIPINDAH ke halaman khusus /dashboard/pengumuman (super_admin, editor
// urgensi/ikon/warna/gambar/tombol/target-role) -- dashboard ini sekarang cuma FEED baca-saja
// + tombol pintasan ke halaman itu. loadAnnouncements() di atas tetap dipanggil di sini untuk
// menampilkan riwayat, bukan lagi untuk modal buat-baru.

// ANIMASI MUNCUL DAN COUNT TO
const isLoaded = ref(false)

// === MAP SEARCH & FILTER STATE ===
const searchQuery = ref('')
const showSuggestions = ref(false)
const filteredSuggestions = ref<any[]>([])
// 'puskesmas' (circle per puskesmas, revisi Bu Kadis) jadi DEFAULT -- permintaan eksplisit user
// ("jadikan filter puskesmas sebagai default"), sebelumnya 'kecamatan' (choropleth poligon).
const mapMode = ref('puskesmas')
const showFilterMenu = ref(false)
const desaLoaded = ref(false)
const searchIndexData = ref<any[]>([])
let searchTimeout: any = null

const onSearchInput = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    const q = searchQuery.value.toLowerCase()
    if (!q) {
      filteredSuggestions.value = []
      return
    }
    filteredSuggestions.value = searchIndexData.value
      .filter((item: any) => item.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, 150)
}

// Sama persis WilayahTextNormalizer::normalize di backend (uppercase + buang non-alfanumerik)
// supaya "Guluk-Guluk" == "GULUK GULUK" == "Guluk Guluk" saat dicocokkan.
function normalizeWilayahName(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// Cocokkan poligon geojson (kecamatan ATAU desa) dengan agregat risiko dari GET /dashboard/
// summary lewat nama wilayah -- dipakai kecamatan (risiko_per_kecamatan) dan desa
// (risiko_per_desa, docs/planning/02 §17), TIDAK mengubah poligon/struktur peta, cuma mengisi
// properti risk per fitur. Properti FLAT (bukan objek nested risk_counts) -- MapLibre GL
// menyerialisasi properties lewat tile worker-nya sendiri, objek nested berubah jadi string
// JSON saat dibaca balik lewat event klik, bukan objek asli lagi (penyebab bug "Berat: undefined
// Sedang: undefined Ringan: undefined" di popup kecamatan sebelum ini diperbaiki).
function mergeRiskData<T extends { ringan: number, sedang: number, berat: number }>(
  geojson: any,
  rows: T[],
  getRowName: (row: T) => string,
  getFeatureName: (props: any) => string
) {
  const byName = new Map(rows.map((r) => [normalizeWilayahName(getRowName(r)), r]))

  geojson.features.forEach((f: any) => {
    const row = byName.get(normalizeWilayahName(getFeatureName(f.properties) || ''))

    if (!row) {
      f.properties.risk = null
      f.properties.risk_ringan = null
      f.properties.risk_sedang = null
      f.properties.risk_berat = null
      return
    }

    // Level agregat per poligon (istilah resmi backend RiskLevel: berat/sedang/ringan, BUKAN
    // tinggi/rendah) -- dipakai fill-color 'match' di bawah.
    f.properties.risk = row.berat > 0 ? 'berat' : row.sedang > 0 ? 'sedang' : row.ringan > 0 ? 'ringan' : null
    f.properties.risk_ringan = row.ringan
    f.properties.risk_sedang = row.sedang
    f.properties.risk_berat = row.berat
  })

  return geojson
}

// Salinan MENTAH geojson (sebelum mergeRiskData memutasinya) -- disimpan supaya filter
// puskesmas/tanggal bisa refresh warna arsiran peta (refreshMapRiskData) tanpa fetch ulang file
// & tanpa properti risk lama "menempel" dari merge sebelumnya (structuredClone tiap re-merge).
let rawKecamatanGeoJson: any = null
let rawDesaGeoJson: any = null

// Titik (BUKAN poligon) satu per puskesmas -- risiko_per_puskesmas SUDAH agregat siap pakai
// (UNSCOPED, semua 31 puskesmas, lihat DashboardService::risikoPerPuskesmas()), tidak perlu
// geojson eksternal seperti kecamatan/desa. Skip baris yang belum py koordinat (belum di-pin
// lewat dashboard/instansi) -- titik itu tidak punya tempat untuk digambar di peta.
// Warna 'risk' pakai prioritas keparahan SAMA PERSIS getRiskColor (dashboard/pasien/index.vue):
// berat > sedang > ringan > tidak_berisiko > null (belum ada data sama sekali).
function buildPuskesmasGeoJson() {
  const rows = dashboardSummary.value?.risiko_per_puskesmas ?? []
  return {
    type: 'FeatureCollection',
    features: rows
      .filter((r) => r.latitude !== null && r.longitude !== null)
      .map((r) => {
        const totalAktif = r.ringan + r.sedang + r.berat
        const risk = r.berat > 0 ? 'berat' : r.sedang > 0 ? 'sedang' : r.ringan > 0 ? 'ringan' : (r.tidak_berisiko > 0 ? 'tidak_berisiko' : null)
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
          properties: {
            puskesmas_id: r.puskesmas_id,
            name: r.puskesmas_nama,
            risk,
            tidak_berisiko: r.tidak_berisiko,
            ringan: r.ringan,
            sedang: r.sedang,
            berat: r.berat,
            total_aktif: totalAktif
          }
        }
      })
  }
}

function refreshMapRiskData() {
  if (!mapInstance) return
  if (rawKecamatanGeoJson && mapInstance.getSource('sumenep-districts')) {
    const merged = mergeRiskData(
      structuredClone(rawKecamatanGeoJson),
      dashboardSummary.value?.risiko_per_kecamatan ?? [],
      (r: DashboardKecamatanRisk) => r.kecamatan_nama,
      (props: any) => props.KECAMATAN || props.name || props.NAMOBJ || ''
    )
    mapInstance.getSource('sumenep-districts').setData(merged)
  }
  if (rawDesaGeoJson && mapInstance.getSource('sumenep-desa')) {
    const merged = mergeRiskData(
      structuredClone(rawDesaGeoJson),
      dashboardSummary.value?.risiko_per_desa ?? [],
      (r: DashboardDesaRisk) => r.desa_nama,
      (props: any) => props.name || props.NAMOBJ || props.DESA || props.WADMKD || ''
    )
    mapInstance.getSource('sumenep-desa').setData(merged)
  }
  if (mapInstance.getSource('sumenep-puskesmas')) {
    mapInstance.getSource('sumenep-puskesmas').setData(buildPuskesmasGeoJson())
  }
}

const setMapMode = async (mode: string) => {
  mapMode.value = mode
  showFilterMenu.value = false

  if (mode === 'desa' && !desaLoaded.value) {
    try {
      const geo = await (await fetch('/sumenep_desa.geojson')).json()
      rawDesaGeoJson = structuredClone(geo)

      // risiko_per_desa (docs/planning/02 §17) -- cakupan wajar kecil (cuma wilayah_status=
      // resolved), banyak desa tetap slate/"belum ada data risiko" sampai produli:import-desa-
      // puskesmas dijalankan penuh. TIDAK mengubah poligon/struktur peta, sama seperti kecamatan.
      const merged = mergeRiskData(
        geo,
        dashboardSummary.value?.risiko_per_desa ?? [],
        (r: DashboardDesaRisk) => r.desa_nama,
        (props: any) => props.name || props.NAMOBJ || props.DESA || props.WADMKD || ''
      )

      mapInstance.addSource('sumenep-desa', { type: 'geojson', data: merged })
      mapInstance.addLayer({
         id: 'desa-fills',
         type: 'fill',
         source: 'sumenep-desa',
         paint: {
            'fill-color': [
               'match',
               ['get', 'risk'],
               'berat', '#f43f5e', // rose-500
               'sedang', '#f59e0b', // amber-500
               'ringan', '#10b981', // emerald-500
               '#94a3b8' // default: belum ada data risiko (slate-400)
            ],
            'fill-opacity': 0.6
         }
      })
      mapInstance.addLayer({
         id: 'desa-borders',
         type: 'line',
         source: 'sumenep-desa',
         paint: { 'line-color': '#ffffff', 'line-width': 0.6 }
      })

      const maplibregl = (window as any).maplibregl
      mapInstance.on('click', 'desa-fills', (e: any) => {
         if (!e.features || e.features.length === 0) return;
         const feature = e.features[0];
         const name = feature.properties.name || feature.properties.NAMOBJ || feature.properties.DESA || 'Desa';
         const risk = feature.properties.risk;
         const hasCounts = feature.properties.risk_berat !== null && feature.properties.risk_berat !== undefined;
         const label = risk === 'berat' ? 'Perlu Tindakan Segera' :
                       risk === 'sedang' ? 'Perlu Atensi' :
                       risk === 'ringan' ? 'Aman' : 'Belum ada data risiko';
         const countsHtml = hasCounts
           ? `<p class="text-[11px] text-slate-500 mt-1">Berat: ${feature.properties.risk_berat} &middot; Sedang: ${feature.properties.risk_sedang} &middot; Ringan: ${feature.properties.risk_ringan}</p>`
           : '';
         new maplibregl.Popup()
           .setLngLat(e.lngLat)
           .setHTML(`<div class="p-1"><p class="font-bold text-accent text-sm">${name}</p><p class="text-xs font-semibold mt-1">Status: ${label}</p>${countsHtml}</div>`)
           .addTo(mapInstance);
      });
      mapInstance.on('mouseenter', 'desa-fills', () => {
         mapInstance.getCanvas().style.cursor = 'pointer';
      });
      mapInstance.on('mouseleave', 'desa-fills', () => {
         mapInstance.getCanvas().style.cursor = '';
      });

      desaLoaded.value = true
    } catch (err) {
      console.error("Gagal memuat batas desa", err)
    }
  }
  
  if (mapInstance) {
     ['sumenep-fills', 'sumenep-borders', 'sumenep-labels'].forEach(id => {
       if (mapInstance.getLayer(id)) {
         mapInstance.setLayoutProperty(id, 'visibility', mode === 'kecamatan' ? 'visible' : 'none')
       }
     })
     if (desaLoaded.value) {
       ['desa-fills', 'desa-borders'].forEach(id => {
         if (mapInstance.getLayer(id)) {
           mapInstance.setLayoutProperty(id, 'visibility', mode === 'desa' ? 'visible' : 'none')
         }
       })
     }
     ['puskesmas-circles', 'puskesmas-circles-stroke'].forEach(id => {
       if (mapInstance.getLayer(id)) {
         mapInstance.setLayoutProperty(id, 'visibility', mode === 'puskesmas' ? 'visible' : 'none')
       }
     })
  }
}

const selectSearchResult = async (item: any) => {
  searchQuery.value = item.name
  showSuggestions.value = false
  
  if (item.type === 'desa' && mapMode.value !== 'desa') {
    await setMapMode('desa')
  } else if (item.type === 'kecamatan' && mapMode.value !== 'kecamatan') {
    await setMapMode('kecamatan')
  }
  
  if (mapInstance && item.bbox) {
    mapInstance.fitBounds(item.bbox, { padding: 50, duration: 1000 })
    
    const highlightLayerId = 'search-highlight'
    if (mapInstance.getLayer(highlightLayerId)) {
       mapInstance.removeLayer(highlightLayerId)
    }
    
    const sourceId = mapMode.value === 'desa' ? 'sumenep-desa' : 'sumenep-districts'
    
    mapInstance.addLayer({
       id: highlightLayerId,
       type: 'line',
       source: sourceId,
       filter: [
         'any',
         ['==', ['get', 'name'], item.name],
         ['==', ['get', 'NAMOBJ'], item.name],
         ['==', ['get', 'KECAMATAN'], item.name],
         ['==', ['get', 'DESA'], item.name],
         ['==', ['get', 'WADMKC'], item.name],
         ['==', ['get', 'WADMKD'], item.name]
       ],
       paint: {
          'line-color': '#f59e0b',
          'line-width': 3
       }
    })
    
    setTimeout(() => {
       if (mapInstance && mapInstance.getLayer(highlightLayerId)) {
          mapInstance.removeLayer(highlightLayerId)
       }
    }, 4000)
  }
}

const animateNumber = (obj: any, keyTarget: string, keyDisplay: string, duration: number = 2500) => {
  const targetStr = String(obj[keyTarget])
  const isPercent = targetStr.includes('%')
  const hasDot = targetStr.includes('.')
  // Bug ditemukan (revisi Bu Kadis, kartu Tingkat Kepatuhan) -- persen di sini SUDAH desimal
  // polos (mis. "83.33%"), BUKAN dipisah ribuan (beda dari kartu non-persen seperti "3.900").
  // Membuang SEMUA titik sebelum parseFloat() salah untuk kasus persen -- "83.33%" jadi "8333"
  // (angka meledak 100x, sempat kelihatan sebagai lonjakan aneh mis. "3275%" di tengah animasi
  // count-up sebelum akhirnya "dikoreksi" balik ke targetStr persis di frame terakhir).
  const numericTarget = isPercent
    ? parseFloat(targetStr.replace('%', ''))
    : parseFloat(targetStr.replace(/\./g, ''))
  
  let startTime: number | null = null
  
  const update = (currentTime: number) => {
    if (!startTime) startTime = currentTime
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const ease = 1 - Math.pow(1 - progress, 3)
    
    const current = ease * numericTarget
    
    if (isPercent) {
      obj[keyDisplay] = Math.round(current) + '%'
    } else if (hasDot) {
      obj[keyDisplay] = Math.round(current).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    } else {
      obj[keyDisplay] = Math.round(current)
    }
    
    if (progress < 1) {
      requestAnimationFrame(update)
    } else {
      obj[keyDisplay] = targetStr
    }
  }
  requestAnimationFrame(update)
}

// Dipanggil sekali di onMounted (lewat delay 800ms, entrance animation) DAN tiap kali
// loadDashboardSummary() selesai memuat ulang akibat filter puskesmas/tanggal berubah --
// lihat catatan bug di loadDashboardSummary().
const hasLoadedOnce = ref(false)
function triggerCardAnimations() {
  stats.value.forEach(s => animateNumber(s, 'targetValue', 'displayValue'))
  riskDistribution.value.forEach(r => animateNumber(r, 'targetValue', 'displayValue'))
  topDistricts.value.forEach(d => animateNumber(d, 'targetValue', 'displayValue'))
  puskesmasPerformanceRows.value.forEach(p => animateNumber(p, 'targetValue', 'displayValue'))
  animateNumber(totalRiskValue.value, 'targetValue', 'displayValue')
  animateNumber(progressValue.value, 'targetValue', 'displayValue')
}

// Reload otomatis begitu sinkronisasi SiLAKES berhasil (dipicu dari sidebar ATAU dari
// halaman detail pasien) -- tanpa ini kartu/peta di halaman ini tetap versi lama sampai
// user refresh manual walau sync barusan sukses. loadDashboardSummary() sendiri sudah
// membaca ulang filter puskesmas/tanggal yang sedang aktif, jadi filter tidak ikut ter-reset.
const silakesSyncSignal = useSilakesSyncSignal()
watch(silakesSyncSignal, () => {
  loadDashboardSummary()
})

onMounted(async () => {
  loadAnnouncements()
  loadPuskesmasScopeLabel()
  loadPuskesmasOptions()
  initDateRangePicker()
  await loadDashboardSummary()

  setTimeout(() => {
    isLoaded.value = true
    triggerCardAnimations()
    hasLoadedOnce.value = true

    // Load search index
    fetch('/sumenep_search_index.json')
      .then(res => res.json())
      .then(data => { searchIndexData.value = data })
      .catch(e => console.error("Gagal memuat search index", e))
    
    // Injeksi Script MapLibre CDN untuk menghindari strict build modules & MIME worker dari Vite
    if (!(window as any).maplibregl) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css';
      document.head.appendChild(css);

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js';
      script.onload = () => {
        console.log("MapLibre Script Loaded:", !!(window as any).maplibregl);
        initMap();
      };
      document.head.appendChild(script);
    } else {
      initMap();
    }

  }, 800)
})

onUnmounted(() => {
  if (mapInstance) {
    mapInstance.remove()
  }
})

// === MAPLIBRE INTEGRATION ===
const mapContainer = ref<HTMLElement | null>(null)
let mapInstance: any = null

const initMap = () => {
  const container = document.getElementById('dashboard-map');
  if (!container) {
    console.error("Map container #dashboard-map not found!");
    return;
  }
  
  const maplibregl = (window as any).maplibregl;
  if (!maplibregl) {
    console.error("maplibregl object is not available on window!");
    return;
  }

  // Tile server sendiri (self-hosted, NUXT_PUBLIC_TILE_SERVER_URL) -- BUKAN CARTO lagi (free
  // basemap CARTO tidak untuk bulk/offline caching, docs/planning/10 §5). Style penuh (sources+
  // sprite+glyphs sudah lengkap di style.json itu sendiri) -- cukup kasih URL-nya langsung.
  const config = useRuntimeConfig()
  mapInstance = new maplibregl.Map({
    container: container,
    style: `${config.public.tileServerUrl}/styles/basemap/style.json`,
    center: [114.1, -7.0], // Center to view more of the islands
    // Tileset sumenep.mbtiles minzoom=9 (cek data/sumenep.json) -- di bawah itu TIDAK ADA data
    // sama sekali (bukan overzoom otomatis), peta jadi blank kalau zoom awal kurang dari ini.
    // Ketahuan lewat verifikasi visual, bukan cuma cek network 200 (style.json/sprite/font
    // semua 200 walau tile vektornya sendiri tidak pernah diminta di bawah minzoom). minZoom
    // mengunci batas ini juga untuk interactive zoom-out (scroll/pinch), bukan cuma initial load --
    // tanpa ini user bisa scroll-zoom-out sampai z8 dan peta jadi blank di tengah pemakaian.
    zoom: 9,
    minZoom: 9
  });

  mapInstance.addControl(new maplibregl.NavigationControl(), 'top-left');

  mapInstance.on('load', () => {
    mapInstance.resize(); // Force resize immediately
    
    // Fetch realistic boundaries from public folder
    fetch('/sumenep.geojson')
      .then(res => res.json())
      .then(geoJsonData => {
         rawKecamatanGeoJson = structuredClone(geoJsonData)

         // Cocokkan poligon geojson (properties.name, mis. "Kota Sumenep", "Talango") dengan
         // risiko_per_kecamatan dari GET /dashboard/summary -- mergeRiskData() di-share dengan
         // level desa (lihat setMapMode) di atas. TIDAK mengubah poligon/struktur peta, cuma
         // mengisi properti risk per fitur dari data API.
         const merged = mergeRiskData(
           geoJsonData,
           dashboardSummary.value?.risiko_per_kecamatan ?? [],
           (r: DashboardKecamatanRisk) => r.kecamatan_nama,
           (props: any) => props.KECAMATAN || props.name || props.NAMOBJ || ''
         );

         mapInstance.addSource('sumenep-districts', {
            type: 'geojson',
            data: merged
         });

         // Masking layer (fill)
         mapInstance.addLayer({
            id: 'sumenep-fills',
            type: 'fill',
            source: 'sumenep-districts',
            // Visibility awal ikuti mapMode SAAT map ini load ('puskesmas' sekarang default,
            // bukan lagi 'kecamatan') -- dipasang di sini (bukan andalkan setMapMode dipanggil
            // belakangan) karena addLayer ini sendiri di dalam .then() ASYNC, race dgn kode
            // lain yang berjalan sinkron setelah fetch di-trigger.
            layout: { visibility: mapMode.value === 'kecamatan' ? 'visible' : 'none' },
             paint: {
                'fill-color': [
                   'match',
                   ['get', 'risk'],
                   'berat', '#f43f5e', // rose-500
                   'sedang', '#f59e0b', // amber-500
                   'ringan', '#10b981', // emerald-500
                   '#94a3b8' // default: belum ada data risiko (slate-400)
                ],
                'fill-opacity': 0.6
             }
         });

         // Border layer (line)
         mapInstance.addLayer({
            id: 'sumenep-borders',
            type: 'line',
            source: 'sumenep-districts',
            layout: { visibility: mapMode.value === 'kecamatan' ? 'visible' : 'none' },
            paint: {
               'line-color': '#ffffff',
               'line-width': 1,
               'line-opacity': 0.7
            }
         });

         // Text label for district names -- 'Open Sans Bold'/'Arial Unicode MS Bold' TIDAK ada di
         // tile server sendiri (cuma 'Noto Sans Bold'/'Noto Sans Regular', cek data/sumenep.json
         // fonts), request glyph 400 -- ketahuan menyebabkan 'sumenep-fills' (fill layer sumber
         // yang SAMA, ditambah dalam batch yang sama) ikut GAGAL RENDER SAMA SEKALI, bukan cuma
         // labelnya sendiri yang hilang. Root cause "arsiran kecamatan tidak muncul" -- terverifikasi
         // lewat replika HTML standalone di luar Vue/Nuxt, fill balik normal begitu font-stack ini
         // diperbaiki. Mode desa TIDAK PERNAH kena bug ini karena desa-labels memang tidak pernah
         // ada (cuma desa-fills + desa-borders, lihat setMapMode).
         mapInstance.addLayer({
            id: 'sumenep-labels',
            type: 'symbol',
            source: 'sumenep-districts',
            layout: {
               'text-field': ['get', 'name'],
               'text-font': ['Noto Sans Bold'],
               'text-size': 10,
               'text-anchor': 'center',
               visibility: mapMode.value === 'kecamatan' ? 'visible' : 'none'
            },
             paint: {
                'text-color': '#1e293b',
                'text-halo-color': '#ffffff',
                'text-halo-width': 1.5
             }
         });
      })
      .catch(e => console.error("Gagal memuat batas wilayah", e));

    // Popups
    mapInstance.on('click', 'sumenep-fills', (e: any) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const risk = feature.properties.risk;
      const hasCounts = feature.properties.risk_berat !== null && feature.properties.risk_berat !== undefined;
      let label = risk === 'berat' ? 'Perlu Tindakan Segera' :
                  risk === 'sedang' ? 'Perlu Atensi' :
                  risk === 'ringan' ? 'Aman' : 'Belum ada data risiko';
      const countsHtml = hasCounts
        ? `<p class="text-[11px] text-slate-500 mt-1">Berat: ${feature.properties.risk_berat} &middot; Sedang: ${feature.properties.risk_sedang} &middot; Ringan: ${feature.properties.risk_ringan}</p>`
        : '';

      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`<div class="p-1"><p class="font-bold text-accent text-sm">${feature.properties.name}</p><p class="text-xs font-semibold mt-1">Status: ${label}</p>${countsHtml}</div>`)
        .addTo(mapInstance);
    });

    mapInstance.on('mouseenter', 'sumenep-fills', () => {
      mapInstance.getCanvas().style.cursor = 'pointer';
    });
    mapInstance.on('mouseleave', 'sumenep-fills', () => {
      mapInstance.getCanvas().style.cursor = '';
    });

    // --- Mode 'puskesmas' (revisi Bu Kadis, DEFAULT sekarang) -- circle satu per puskesmas,
    // BUKAN poligon, jadi tidak perlu fetch geojson eksternal seperti kecamatan/desa di atas.
    // Sinkron (bukan dalam .then()) karena datanya sudah tersedia dari dashboardSummary.value
    // (loadDashboardSummary() SELALU selesai sebelum initMap() dipanggil, lihat onMounted). ---
    mapInstance.addSource('sumenep-puskesmas', { type: 'geojson', data: buildPuskesmasGeoJson() });

    // Warna TOKEN TEMA RESMI (docs/planning wajib-harus-sama... primary/success/warning/danger),
    // BUKAN raw hex arbitrer seperti sumenep-fills di atas (poligon lama belum sempat dirapikan
    // ke token resmi) -- lingkaran ini baru, sekalian benar dari awal.
    mapInstance.addLayer({
      id: 'puskesmas-circles-stroke',
      type: 'circle',
      source: 'sumenep-puskesmas',
      layout: { visibility: mapMode.value === 'puskesmas' ? 'visible' : 'none' },
      paint: {
        'circle-radius': 12,
        'circle-color': '#ffffff',
        'circle-opacity': 1
      }
    });
    mapInstance.addLayer({
      id: 'puskesmas-circles',
      type: 'circle',
      source: 'sumenep-puskesmas',
      layout: { visibility: mapMode.value === 'puskesmas' ? 'visible' : 'none' },
      paint: {
        'circle-radius': 9,
        'circle-color': [
          'match',
          ['get', 'risk'],
          'berat', '#EF4444',
          'sedang', '#F59E0B',
          'ringan', '#10B981',
          'tidak_berisiko', '#00A59A',
          '#94a3b8' // belum ada data risiko sama sekali
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    mapInstance.on('click', 'puskesmas-circles', (e: any) => {
      if (!e.features || e.features.length === 0) return;
      const p = e.features[0].properties;
      const riskMeta: Record<string, { label: string, color: string, bg: string }> = {
        berat: { label: 'Perlu Tindakan Segera', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
        sedang: { label: 'Perlu Atensi', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
        ringan: { label: 'Terpantau Aman', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
        tidak_berisiko: { label: 'Seluruhnya Terkendali', color: '#00A59A', bg: 'rgba(0,165,154,0.12)' }
      };
      const meta = riskMeta[p.risk] ?? { label: 'Belum Ada Data Risiko', color: '#64748B', bg: 'rgba(100,116,139,0.12)' };

      const html = `
        <div class="min-w-[230px]">
          <div class="flex items-center gap-2.5 px-3.5 pt-3.5 pb-2.5 border-b border-slate-100">
            <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style="background:${meta.bg}">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${meta.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14l7-3 7 3v-3"/><path d="M9 22V12h6v4"/><path d="M12 7v5"/><path d="M9.5 9.5h5"/></svg>
            </div>
            <div class="min-w-0">
              <p class="font-bold text-accent text-sm truncate">${p.name}</p>
              <p class="text-[11px] font-bold" style="color:${meta.color}">${meta.label}</p>
            </div>
          </div>
          <div class="px-3.5 pt-2.5 pb-1">
            <div class="flex items-baseline gap-1.5">
              <span class="text-2xl font-extrabold text-accent leading-none">${p.total_aktif}</span>
              <span class="text-[11px] text-slate-500 font-semibold">pasien aktif</span>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-1.5 px-3.5 pb-3.5 pt-1.5">
            <div class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-primary/10">
              <span class="text-[11px] font-semibold text-primary">Terkendali</span>
              <span class="text-xs font-extrabold text-primary">${p.tidak_berisiko}</span>
            </div>
            <div class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-success/10">
              <span class="text-[11px] font-semibold text-success">Ringan</span>
              <span class="text-xs font-extrabold text-success">${p.ringan}</span>
            </div>
            <div class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-warning/10">
              <span class="text-[11px] font-semibold text-warning">Sedang</span>
              <span class="text-xs font-extrabold text-warning">${p.sedang}</span>
            </div>
            <div class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-danger/10">
              <span class="text-[11px] font-semibold text-danger">Berat</span>
              <span class="text-xs font-extrabold text-danger">${p.berat}</span>
            </div>
          </div>
        </div>
      `;

      new maplibregl.Popup({ className: 'produli-puskesmas-popup', closeButton: true, maxWidth: '260px', offset: 14 })
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(mapInstance);
    });
    mapInstance.on('mouseenter', 'puskesmas-circles', () => {
      mapInstance.getCanvas().style.cursor = 'pointer';
    });
    mapInstance.on('mouseleave', 'puskesmas-circles', () => {
      mapInstance.getCanvas().style.cursor = '';
    });
  });

  // Fallback resize if the container was loaded hidden/zero-sized
  setTimeout(() => {
    if (mapInstance) mapInstance.resize();
  }, 1000);
}
</script>

<template>
  <div class="space-y-6">
    
    <!-- Header Section -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-accent">Dashboard Utama</h1>
        <p class="text-sm text-slate-500 mt-1">Ringkasan data pemantauan pasien Prolanis hari ini.</p>
        <p v-if="summaryError" class="text-xs font-semibold text-danger mt-1">{{ summaryError }}</p>
      </div>
      <div class="flex items-center gap-3">
        <!-- Filter rentang tanggal (flatpickr, mode:range) -- kosong default = tanpa filter,
             dashboard tetap "kondisi saat ini". Diisi -> semua metrik ikut ter-filter, termasuk
             risiko pasien (direkonstruksi "as of" tanggal akhir, lihat DashboardService). -->
        <div class="relative flex items-center gap-2 bg-white border border-slate-200 pl-4 pr-2 py-2 rounded-xl text-sm font-medium text-slate-700 shadow-sm">
          <LucideCalendar class="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref="dateRangeInputRef"
            type="text"
            readonly
            :placeholder="dateRangeLabel"
            class="outline-none bg-transparent cursor-pointer w-36 sm:w-44 text-sm placeholder:text-slate-700"
          />
          <button v-if="dateRangeFrom" type="button" @click="clearDateRange" class="text-slate-400 hover:text-slate-600 p-0.5 shrink-0" title="Hapus filter tanggal">
            <LucideX class="w-4 h-4" />
          </button>
          <LucideChevronDown v-else class="w-4 h-4 text-slate-400 shrink-0" />
        </div>

        <!-- Filter puskesmas -- super_admin: USelectMenu typeahead (cari di antara 31 puskesmas
             sambil ketik). admin_puskesmas/pj_prolanis: label saja, sudah terkunci di backend. -->
        <div v-if="isSuperAdmin" class="relative flex items-center gap-2 bg-white border border-slate-200 pl-4 pr-3 py-2 rounded-xl text-sm font-medium text-slate-700 shadow-sm">
          <LucideBuilding2 class="w-4 h-4 text-slate-400 shrink-0" />
          <USelectMenu
            v-model="selectedPuskesmasId"
            :items="puskesmasSelectItems"
            :loading="isLoadingPuskesmasOptions"
            value-key="value"
            placeholder="Semua Puskesmas"
            class="w-44 sm:w-56"
            @update:model-value="onPuskesmasFilterChange"
          />
        </div>
        <div v-else class="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 shadow-sm">
          <LucideBuilding2 class="w-4 h-4 text-slate-400" />
          <span>{{ puskesmasScopeLabel }}</span>
        </div>
      </div>
    </div>

    <!-- Banner personalisasi -- muncul saat super_admin memfilter ke 1 puskesmas spesifik,
         supaya jelas seluruh kartu/peta/grafik di bawah ini terbatas ke wilayah kerja itu,
         bukan gambaran Kabupaten Sumenep secara keseluruhan. -->
    <div v-if="isSuperAdmin && selectedPuskesmasId !== null" class="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-2xl px-5 py-3.5">
      <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <LucideBuilding2 class="w-4.5 h-4.5" />
      </div>
      <p class="flex-1 text-sm font-semibold text-accent">
        Data Dipersonalisasi Khusus <span class="text-primary">{{ selectedPuskesmasName ?? 'Puskesmas Terpilih' }}</span> — seluruh ringkasan, peta, dan statistik di bawah ini terbatas pada wilayah kerja puskesmas ini.
      </p>
      <button
        type="button"
        @click="resetPuskesmasFilter"
        class="shrink-0 flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-600 bg-white border border-primary/30 rounded-lg px-3 py-2 transition-colors"
      >
        <LucideRotateCcw class="w-3.5 h-3.5" />
        Tampilkan Semua Puskesmas
      </button>
    </div>

    <!-- Top Stats -- grid 3 kolom (6 kartu generik) + kartu "Tingkat Kepatuhan" memanjang 2
         baris di sisi kanan (donut chart), sengaja NESTED grid (bukan row-span di grid yang
         sama) supaya auto-placement CSS Grid tidak perlu diakali -- kolom kanan otomatis
         setinggi blok 3x2 kartu generik di sebelahnya (satu grid item, stretch default). -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div class="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="(stat, index) in stats"
          :key="index"
          class="relative overflow-hidden group bg-white p-5 rounded-2xl border border-slate-100 shadow-card hover:-translate-y-1 transition-transform duration-300 flex flex-col justify-between"
        >
          <!-- Soft Animate Blob -->
          <div class="absolute -right-8 -bottom-8 w-32 h-32 rounded-full blur-3xl opacity-30 pointer-events-none group-hover:scale-125 transition-transform duration-700 animate-pulse" :class="stat.bgClass"></div>

          <div>
            <!-- Baris 1: Icon & Label -->
            <div class="relative z-10 flex items-center gap-3 mb-3">
              <div :class="['w-10 h-10 rounded-full flex items-center justify-center shrink-0', stat.bgClass, stat.colorClass]">
                <component :is="stat.icon" class="w-5 h-5" />
              </div>
              <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider leading-snug">{{ stat.label }}</p>
            </div>

            <!-- Baris 2: Value -->
            <p class="relative z-10 text-2xl font-black text-accent">
              {{ stat.displayValue }}
              <span v-if="stat.totalSuffix" class="text-sm font-bold text-slate-400 ml-0.5">{{ stat.totalSuffix }}</span>
            </p>
          </div>

          <NuxtLink :to="stat.to" class="relative z-10 mt-4 text-xs font-semibold text-primary hover:text-primary-600 transition-colors flex items-center gap-1">
            Lihat Detail <span aria-hidden="true">&rarr;</span>
          </NuxtLink>
        </div>
        <p v-if="!stats.length && !summaryError" class="col-span-full text-sm text-slate-400 text-center py-6">Memuat ringkasan...</p>
      </div>

      <!-- Kartu khusus "Tingkat Kepatuhan" -- memanjang 2 baris, donut chart kecil + tooltip
           penjelasan (UTooltip) saat hover angka persentase. -->
      <div class="lg:col-span-1 relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-100 shadow-card flex flex-col">
        <div class="absolute -right-8 -bottom-8 w-32 h-32 rounded-full blur-3xl opacity-30 pointer-events-none bg-secondary/10"></div>

        <div class="relative z-10 flex items-center gap-3 mb-1">
          <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-secondary/10 text-secondary">
            <LucideActivity class="w-5 h-5" />
          </div>
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider leading-snug">Tingkat Kepatuhan</p>
        </div>

        <div class="relative z-10 flex-1 flex flex-col items-center justify-center gap-3 py-2">
          <div class="relative w-32 h-32">
            <Doughnut :data="tingkatKepatuhanChartData" :options="tingkatKepatuhanChartOptions" />
            <div class="absolute inset-0 flex items-center justify-center">
              <AppTooltip :text="TINGKAT_KEPATUHAN_EXPLAINER">
                <span class="text-2xl font-black text-accent cursor-help">{{ progressValue.displayValue }}</span>
              </AppTooltip>
            </div>
          </div>
          <p class="text-xs font-semibold text-slate-500 text-center">
            {{ formatId(assignmentTotals.completed) }} dari {{ formatId(assignmentTotals.total) }} kunjungan selesai
          </p>
        </div>

        <NuxtLink to="/dashboard/kunjungan" class="relative z-10 mt-2 text-xs font-semibold text-primary hover:text-primary-600 transition-colors flex items-center gap-1">
          Lihat Detail <span aria-hidden="true">&rarr;</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Middle Section (Grid 4 columns) -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      
      <!-- Kiri: Peta Sebaran (Lebar 2 Kolom) -->
      <div class="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex flex-col">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 class="font-bold text-accent text-lg flex items-center gap-2">
            <LucideMapPin class="w-5 h-5 text-primary" />
            Peta Sebaran Pasien Risiko
          </h3>

          <div class="flex items-center gap-2">
            <!-- Search & Typeahead -->
            <div class="relative">
              <LucideSearch class="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input v-model="searchQuery" @input="onSearchInput" @focus="showSuggestions = true"
                placeholder="Cari desa/kecamatan..."
                class="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg w-48 focus:w-64 transition-all focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              
              <!-- Suggestions Dropdown -->
              <div v-if="showSuggestions && filteredSuggestions.length"
                class="absolute z-20 mt-1 w-64 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                <button v-for="item in filteredSuggestions" :key="item.kode_desa || item.kode_kec"
                  @click="selectSearchResult(item)"
                  class="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm flex justify-between items-center transition-colors border-b border-slate-50 last:border-0">
                  <span class="font-medium text-slate-700 truncate">{{ item.name }}</span>
                  <span class="text-[10px] text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded ml-2 whitespace-nowrap">{{ item.type === 'kecamatan' ? 'Kec.' : item.kecamatan }}</span>
                </button>
              </div>
            </div>

            <!-- Filter Mode Dropdown -->
            <div class="relative">
              <button @click="showFilterMenu = !showFilterMenu"
                class="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:text-primary transition-colors bg-white focus:outline-none"
                :class="{ 'bg-slate-50 text-primary border-primary/30': showFilterMenu }">
                <LucideFilter class="w-4 h-4" />
              </button>
              
              <div v-if="showFilterMenu" class="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-1">
                <button @click="setMapMode('puskesmas')"
                  :class="mapMode === 'puskesmas' ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 hover:bg-slate-50'"
                  class="w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between">
                  Per Puskesmas
                  <LucideCheckCircle2 v-if="mapMode === 'puskesmas'" class="w-3.5 h-3.5" />
                </button>
                <button @click="setMapMode('kecamatan')"
                  :class="mapMode === 'kecamatan' ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 hover:bg-slate-50'"
                  class="w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between mt-0.5">
                  Per Kecamatan
                  <LucideCheckCircle2 v-if="mapMode === 'kecamatan'" class="w-3.5 h-3.5" />
                </button>
                <button @click="setMapMode('desa')" 
                  :class="mapMode === 'desa' ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 hover:bg-slate-50'" 
                  class="w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between mt-0.5">
                  Per Desa/Kelurahan
                  <LucideCheckCircle2 v-if="mapMode === 'desa'" class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Fullscreen -->
            <button class="p-1.5 text-slate-400 hover:text-primary transition-colors ml-1">
              <LucideMaximize class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Caption personalisasi -- HANYA muncul kalau kecamatan puskesmas sendiri dibagi
        lebih dari 1 puskesmas (mis. Pandian & Pamolokan sama-sama di Kota Sumenep), supaya
        admin_puskesmas/pj_prolanis paham peta di bawah cuma pasien puskesmas MEREKA sendiri,
        bukan seluruh kecamatan. -->
        <p v-if="dashboardSummary?.kecamatan_context" class="text-xs text-slate-400 -mt-3 mb-4">
          Data untuk {{ dashboardSummary.kecamatan_context.puskesmas_nama }} yang berada di Kecamatan {{ dashboardSummary.kecamatan_context.kecamatan_nama }}
        </p>

        <!-- Real Map UI -->
        <div class="relative flex-1 min-h-[350px] bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
           <div id="dashboard-map" ref="mapContainer" class="absolute inset-0 w-full h-full"></div>
           
           <!-- Map Controls Floating -->
           <div class="absolute right-4 bottom-4 flex flex-col gap-2 z-10">
              <button @click="mapInstance?.zoomIn()" class="w-8 h-8 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center text-slate-600 hover:text-primary hover:bg-slate-50 cursor-pointer">
                <LucidePlus class="w-4 h-4" />
              </button>
              <button @click="mapInstance?.zoomOut()" class="w-8 h-8 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center text-slate-600 hover:text-primary hover:bg-slate-50 cursor-pointer">
                <LucideMinus class="w-4 h-4" />
              </button>
           </div>
        </div>

        <!-- Legend (Dipindah ke luar / bawah peta) -->
        <div class="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-center gap-6 text-[11px] font-bold text-slate-600">
           <div class="flex items-center gap-2">
             <span class="w-3.5 h-3.5 rounded-md bg-success shadow-sm"></span> 
             <span>Aman (Ringan)</span>
           </div>
           <div class="flex items-center gap-2">
             <span class="w-3.5 h-3.5 rounded-md bg-warning shadow-sm"></span> 
             <span>Perlu Atensi (Sedang)</span>
           </div>
           <div class="flex items-center gap-2">
             <span class="w-3.5 h-3.5 rounded-md bg-danger shadow-sm"></span> 
             <span class="text-danger">Perlu Tindakan Segera (Berat)</span>
           </div>
        </div>
      </div>

      <!-- Tengah: Distribusi Risiko (Lebar 1 Kolom) -->
      <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex flex-col">
        <h3 class="font-bold text-accent text-base mb-6 flex items-center gap-2">
          <LucidePieChart class="w-4 h-4 text-secondary" />
          Distribusi Risiko
        </h3>
        
        <div class="flex-1 flex flex-col items-center justify-center gap-6">
          <!-- Dummy Donut Chart (CSS) -->
          <div 
            class="w-40 h-40 rounded-full flex items-center justify-center shadow-sm relative overflow-hidden"
            :style="`background: conic-gradient(var(--color-danger) 0% ${isLoaded ? 15 : 0}%, var(--color-warning) ${isLoaded ? 15 : 0}% ${isLoaded ? 50 : 0}%, var(--color-success) ${isLoaded ? 50 : 0}% ${isLoaded ? 100 : 0}%)`"
            style="transition: background 2.5s ease-out;"
          >
            <div class="w-28 h-28 bg-white rounded-full flex flex-col items-center justify-center shadow-inner relative z-10">
               <span class="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Total</span>
               <span class="text-2xl font-black text-accent leading-none my-0.5">{{ totalRiskValue.displayValue }}</span>
               <span class="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Pasien</span>
            </div>
          </div>
          
          <!-- Legend -->
          <div class="w-full space-y-3 mt-4">
             <div v-for="risk in riskDistribution" :key="risk.label" class="flex items-center justify-between text-sm">
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full" :class="risk.dotClass"></span>
                  <span class="text-slate-600 font-medium">Risiko {{ risk.label }}</span>
                </div>
                <span class="font-bold text-accent">{{ risk.displayValue }} <span class="text-slate-400 font-normal ml-0.5">({{ risk.percentage }}%)</span></span>
             </div>
          </div>
          
          <NuxtLink to="/dashboard/pasien" class="w-full text-center text-sm font-semibold text-primary hover:text-primary-600 mt-auto pt-4 border-t border-slate-100 flex items-center justify-center gap-1 transition-colors">
            Lihat Selengkapnya <span aria-hidden="true">&rarr;</span>
          </NuxtLink>
        </div>
      </div>

      <!-- Kanan: Progres Kunjungan (Lebar 1 Kolom) -->
      <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex flex-col relative overflow-hidden">
        <div class="absolute -right-10 -top-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl"></div>
        <h3 class="font-bold text-accent text-base mb-6 flex items-center gap-2 relative z-10">
          <LucideTarget class="w-4 h-4 text-primary" />
          Progres Kunjungan
        </h3>
        
        <div class="flex-1 flex flex-col items-center justify-center gap-6 relative z-10">
          <!-- Dummy Circular Progress (CSS) -->
          <div
            class="w-40 h-40 rounded-full flex items-center justify-center shadow-sm relative overflow-hidden"
            :style="`background: conic-gradient(var(--color-primary) 0% ${isLoaded ? progressPercent : 0}%, #f1f5f9 ${isLoaded ? progressPercent : 0}% 100%)`"
            style="transition: background 1.5s ease-out;"
          >
            <div class="w-32 h-32 bg-white rounded-full flex flex-col items-center justify-center shadow-inner relative z-10">
               <span class="text-3xl font-black text-primary leading-none">{{ progressValue.displayValue }}</span>
               <span class="text-xs font-bold text-slate-700 mt-1">{{ formatId(assignmentTotals.completed) }} / {{ formatId(assignmentTotals.total) }}</span>
               <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 text-center leading-tight">Pasien<br/>Dikunjungi</span>
            </div>
          </div>

          <div class="w-full space-y-3 p-3 mt-2 border border-slate-100 rounded-xl">
             <div class="flex items-center justify-between text-sm">
                <span class="text-slate-500 font-medium">Total Ditugaskan</span>
                <span class="font-bold text-accent">{{ formatId(assignmentTotals.total) }}</span>
             </div>
             <div class="flex items-center justify-between text-sm">
                <span class="text-slate-500 font-medium">Belum Selesai</span>
                <span class="font-bold text-accent">{{ formatId(assignmentTotals.total - assignmentTotals.completed) }}</span>
             </div>
          </div>
          
          <NuxtLink to="/dashboard/kunjungan" class="w-full text-center text-sm font-semibold text-primary hover:text-primary-600 mt-auto pt-4 border-t border-slate-100 flex items-center justify-center gap-1 transition-colors">
            Lihat Detail <span aria-hidden="true">&rarr;</span>
          </NuxtLink>
        </div>
      </div>

    </div>

    <!-- Row A: 5 Kecamatan Risiko Tertinggi berdampingan dengan Top 5 Puskesmas Kinerja
         Terbaik (revisi Bu Kadis) -- keduanya bar-list horizontal senada, satu menyorot
         wilayah PALING BERISIKO, satunya menyorot puskesmas PALING BERHASIL menangani pasien. -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

      <!-- Kiri: 5 Kecamatan dengan Risiko Tertinggi -->
      <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex flex-col">
        <h3 class="font-bold text-accent text-base mb-5 flex items-center gap-2">
          <LucideBarChart4 class="w-4 h-4 text-warning" />
          5 Kecamatan Risiko Tertinggi
        </h3>

        <div class="space-y-3 flex-1 mt-2">
          <div v-for="(kec, idx) in topDistricts" :key="idx" class="flex items-center h-10">
             <div class="w-32 shrink-0 pr-3 flex justify-end">
                <AppTooltip :text="kec.name">
                   <span class="text-xs font-semibold text-slate-600 truncate block text-right">{{ kec.name }}</span>
                </AppTooltip>
             </div>
             <div class="flex-1 border-l-2 border-slate-200 flex items-center h-full pl-0">
                 <div class="flex-1 h-3 bg-slate-100 rounded-r-full overflow-hidden shadow-inner flex items-center">
                    <div class="h-full rounded-r-full transition-all duration-[2500ms] ease-out" :class="kec.colorClass" :style="{ width: isLoaded ? `${kec.percentage}%` : '0%' }"></div>
                 </div>
                 <div class="w-12 text-right shrink-0">
                    <span class="text-xs font-bold text-accent">{{ kec.displayValue }}</span>
                 </div>
             </div>
          </div>
          <p v-if="!topDistricts.length" class="text-sm text-slate-400 text-center py-6">Belum ada data risiko per kecamatan.</p>
        </div>

        <NuxtLink to="/dashboard/kecamatan-risiko" class="w-full text-center text-sm font-semibold text-primary hover:text-primary-600 mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-1 transition-colors">
          Lihat Selengkapnya <span aria-hidden="true">&rarr;</span>
        </NuxtLink>
      </div>

      <!-- Kanan: Top 5 Puskesmas Kinerja Terbaik -- skor gabungan (final_score, 0-100) dari
           improvement rate + risk reduction + stability rate, HANYA dari transisi risiko yang
           punya kunjungan TERVALIDASI sebagai bukti intervensi (bukan jumlah kunjungan mentah,
           bukan pasien yang kebetulan membaik tanpa program PRODULI -- lihat App\Services\
           Performance\PuskesmasPerformanceScoringService di backend). Leaderboard SE-KABUPATEN
           untuk SEMUA role (super_admin/admin_puskesmas/pj_prolanis) -- super_admin bisa
           persempit lewat filter puskesmas di atas, role lain tetap melihat puskesmas lain
           sebagai pembanding. -->
      <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex flex-col">
        <div class="flex items-center justify-between mb-1">
          <h3 class="font-bold text-accent text-base flex items-center gap-2">
            <LucideTrendingUp class="w-4 h-4 text-success" />
            Top 5 Puskesmas Kinerja Terbaik
          </h3>
          <span class="text-[11px] font-semibold text-slate-400">{{ dateRangeLabel }}</span>
        </div>
        <p class="text-[11px] text-slate-400 mb-4">Skor kinerja (0-100) dari keberhasilan intervensi tervalidasi menurunkan risiko pasien</p>

        <div class="space-y-3 flex-1 mt-2">
          <div v-for="(row, idx) in puskesmasPerformanceRows" :key="idx" class="flex items-center h-10">
             <div class="w-32 shrink-0 pr-3 flex justify-end">
                <AppTooltip :text="row.name">
                   <span class="text-xs font-semibold text-slate-600 truncate block text-right">{{ row.name }}</span>
                </AppTooltip>
             </div>
             <div class="flex-1 border-l-2 border-slate-200 flex items-center h-full pl-0">
                <AppTooltip :text="row.breakdownText || 'Belum ada transisi eligible pada periode ini.'">
                   <div class="flex-1 h-3 bg-slate-100 rounded-r-full overflow-hidden shadow-inner flex items-center cursor-help">
                      <div class="h-full rounded-r-full bg-success transition-all duration-[2500ms] ease-out" :style="{ width: isLoaded ? `${row.percentage}%` : '0%' }"></div>
                   </div>
                </AppTooltip>
                <div class="w-12 text-right shrink-0">
                   <span class="text-xs font-bold text-accent">{{ row.displayValue }}</span>
                </div>
             </div>
          </div>
          <p v-if="!puskesmasPerformanceRows.length" class="text-sm text-slate-400 text-center py-6">Belum ada transisi risiko dengan kunjungan tervalidasi pada periode ini.</p>
        </div>

        <NuxtLink :to="kinerjaPuskesmasLink" class="w-full text-center text-sm font-semibold text-primary hover:text-primary-600 mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-1 transition-colors">
          Lihat Selengkapnya <span aria-hidden="true">&rarr;</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Row B: Aktivitas Kunjungan Hari Ini digeser ke bawah, berdampingan dengan Informasi
         Pembaruan Sistem. -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

      <!-- Kiri: Aktivitas Kunjungan Hari Ini -->
      <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex flex-col">
        <div class="flex items-center justify-between mb-5">
          <h3 class="font-bold text-accent text-base flex items-center gap-2">
            <LucideActivitySquare class="w-4 h-4 text-info" />
            Aktivitas Kunjungan Hari Ini
          </h3>
          <button class="text-xs font-semibold text-primary hover:underline">Lihat Semua</button>
        </div>

        <div class="overflow-x-auto mt-2 flex-1">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <th class="pb-3 font-semibold px-2">Nama Kader</th>
                <th class="pb-3 font-semibold px-2 text-center">Kunjungan</th>
                <th class="pb-3 font-semibold px-2 text-center">Selesai</th>
                <th class="pb-3 font-semibold px-2">Progres</th>
                <th class="pb-3 font-semibold px-2 text-right">Terakhir Update</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="(kader, idx) in activities" :key="idx" class="hover:bg-slate-50 transition-colors">
                 <td class="py-3 px-2">
                    <div class="flex items-center gap-3">
                       <div class="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shadow-sm shrink-0">
                          {{ kader.initials }}
                       </div>
                       <div>
                          <p class="text-sm font-bold text-slate-800">{{ kader.name }}</p>
                          <p class="text-[10px] text-slate-500">{{ kader.role }}</p>
                       </div>
                    </div>
                 </td>
                 <td class="py-3 px-2 text-center text-sm font-semibold text-slate-600">{{ kader.target }}</td>
                 <td class="py-3 px-2 text-center text-sm font-bold text-accent">{{ kader.achieved }}</td>
                 <td class="py-3 px-2 w-24">
                    <div class="flex flex-col gap-1.5">
                       <span class="text-[10px] font-bold text-accent">{{ kaderProgressPercent(kader) }}%</span>
                       <div class="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div class="h-full bg-primary rounded-full transition-all duration-[2500ms] ease-out" :style="{ width: isLoaded ? `${kaderProgressPercent(kader)}%` : '0%' }"></div>
                       </div>
                    </div>
                 </td>
                 <td class="py-3 px-2 text-right text-xs text-slate-500 font-medium whitespace-nowrap">{{ kader.lastUpdate }}</td>
              </tr>
              <tr v-if="!activities.length">
                 <td colspan="5" class="py-6 text-center text-sm text-slate-400">Belum ada aktivitas kader hari ini.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Kanan: Pengumuman -->
      <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex flex-col">
        <div class="flex items-center justify-between mb-5">
          <h3 class="font-bold text-accent text-base flex items-center gap-2">
            <LucideBellRing class="w-4 h-4 text-slate-500" />
            Pengumuman
          </h3>
          <NuxtLink v-if="isSuperAdmin" to="/dashboard/pengumuman"
            class="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
            title="Buat Pengumuman Baru">
            <LucidePlus class="w-4 h-4" />
          </NuxtLink>
        </div>

        <p v-if="announcementsError" class="text-xs font-semibold text-danger mb-3">{{ announcementsError }}</p>

        <!-- Stack "|- [urgensi]" -- format sama dengan riwayat di /dashboard/pengumuman,
             konsisten di seluruh sistem. -->
        <div class="space-y-1 flex-1 overflow-y-auto pr-2 no-scrollbar mt-2">
          <div v-for="notif in notifications" :key="notif.id" class="flex items-start gap-2.5 py-2 border-b border-slate-50 last:border-0">
            <span class="text-slate-300 font-mono text-xs mt-0.5 shrink-0">|-</span>
            <component :is="iconComponentFor(announcementIconOf(notif))" class="w-3.5 h-3.5 mt-0.5 shrink-0" :class="ANNOUNCEMENT_COLOR_CLASSES[announcementColorOf(notif)].text" />
            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-start gap-2">
                <p class="text-sm font-bold text-slate-800 truncate">{{ notif.title }}</p>
                <span class="text-[10px] font-semibold text-slate-400 whitespace-nowrap mt-0.5">{{ notif.time }}</span>
              </div>
              <p class="text-xs text-slate-500 leading-relaxed line-clamp-2">{{ notif.description }}</p>
              <span v-if="notif.is_read === false" class="inline-block mt-1 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-danger/10 text-danger">Baru</span>
            </div>
          </div>
          <p v-if="!isLoadingAnnouncements && !notifications.length && !announcementsError" class="text-sm text-slate-400 text-center py-6">Belum ada pengumuman.</p>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* Optional custom scrollbar */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  scrollbar-width: none;
}
</style>

<style>
/* Popup peta puskesmas (mode 'puskesmas') -- konten di-inject via innerHTML (bukan template Vue,
   lihat click handler 'puskesmas-circles' di initMap()), jadi TIDAK bisa kena <style scoped>.
   Override default MapLibre popup (padding/border-radius kotak polos) supaya konten custom di
   atas (header+angka+grid breakdown) terasa satu kartu utuh, bukan nempel siku di tepi. */
.produli-puskesmas-popup .maplibregl-popup-content {
  padding: 0;
  border-radius: 1rem;
  box-shadow: 0 12px 32px -8px rgba(0, 59, 92, 0.25), 0 4px 10px -4px rgba(0, 59, 92, 0.12);
  overflow: hidden;
  animation: produli-popup-in 0.15s ease-out;
}
.produli-puskesmas-popup .maplibregl-popup-tip {
  border-top-color: #ffffff;
}
.produli-puskesmas-popup .maplibregl-popup-close-button {
  font-size: 18px;
  color: #94a3b8;
  padding: 4px 8px;
  transition: color 0.15s ease;
}
.produli-puskesmas-popup .maplibregl-popup-close-button:hover {
  color: #003b5c;
  background: transparent;
}
@keyframes produli-popup-in {
  from { opacity: 0; transform: translateY(4px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
