<script setup lang="ts">
import type { ApiSuccessEnvelope, Patient, RiskClassificationHistory, VisitAssignment, PatientRiskLevel } from '~/types/api'
import { Line } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, LineElement, CategoryScale, LinearScale, PointElement } from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, LineElement, CategoryScale, LinearScale, PointElement)

definePageMeta({
  layout: 'pwa',
  middleware: 'auth'
})
useHead({
  title: 'Riwayat Pasien'
})

// Versi ringkas mobile dari dashboard/pasien/[id].vue -- kader/nakes butuh lihat riwayat pasien
// SEBELUM menekan "Input Hasil Tensi & Laporan" (temuan lapangan), tapi layout 'dashboard' (desktop,
// sidebar dkk) tidak cocok dipakai di /app. Endpoint & policy SAMA PERSIS (PatientsCachePolicy::view
// via canAccessPatientRecord -- kader/nakes murni sudah discope ke assignment miliknya sendiri),
// cuma tampilan dipangkas ke yang relevan buat kunjungan lapangan: identitas, tren kondisi, riwayat
// kunjungan. "Dasar Klasifikasi"/hasil lab detail SENGAJA tidak diikutkan (informasi klinis lengkap
// itu ranah dashboard, di sini cukup konteks buat kunjungan berikutnya).
const route = useRoute()

const patient = ref<Patient | null>(null)
const isLoadingPatient = ref(false)
const patientError = ref('')
async function loadPatient() {
  isLoadingPatient.value = true
  patientError.value = ''
  try {
    const api = useApi()
    const res = await api(`/patients/${route.params.id}`) as ApiSuccessEnvelope<Patient>
    patient.value = res.data
  } catch (e) {
    patientError.value = e instanceof ApiError ? e.message : 'Gagal memuat data pasien.'
  } finally {
    isLoadingPatient.value = false
  }
}

const riskHistory = ref<RiskClassificationHistory[]>([])
const isLoadingRiskHistory = ref(false)
async function loadRiskHistory() {
  isLoadingRiskHistory.value = true
  try {
    const api = useApi()
    const res = await api(`/patients/${route.params.id}/risk-history`) as ApiSuccessEnvelope<RiskClassificationHistory[]>
    riskHistory.value = res.data
  } catch {
    // Diam-diam gagal -- info sekunder, tidak menghalangi halaman ini dipakai kalau cuma
    // riwayat tren yang gagal muat (identitas pasien tetap tampil).
  } finally {
    isLoadingRiskHistory.value = false
  }
}

const visitHistoryList = ref<VisitAssignment[]>([])
const isLoadingVisitHistory = ref(false)
async function loadVisitHistory() {
  isLoadingVisitHistory.value = true
  try {
    const api = useApi()
    const res = await api(`/patients/${route.params.id}/visit-history`) as ApiSuccessEnvelope<VisitAssignment[]>
    visitHistoryList.value = res.data
  } catch {
    // sama seperti riskHistory di atas
  } finally {
    isLoadingVisitHistory.value = false
  }
}

onMounted(() => {
  loadPatient()
  loadRiskHistory()
  loadVisitHistory()
})

const getRiskColor = (risk: string | null | undefined) => {
  if (risk === 'berat') return 'bg-danger/10 text-danger border border-danger/20'
  if (risk === 'sedang') return 'bg-warning/10 text-warning border border-warning/20'
  if (risk === 'ringan') return 'bg-success/10 text-success border border-success/20'
  if (risk === 'tidak_berisiko') return 'bg-primary/10 text-primary border border-primary/20'
  return 'bg-slate-100 text-slate-600 border border-slate-200'
}
const getRiskLabel = (risk: string | null | undefined) => {
  if (risk === 'berat') return 'Risiko Berat'
  if (risk === 'sedang') return 'Risiko Sedang'
  if (risk === 'ringan') return 'Risiko Ringan'
  if (risk === 'tidak_berisiko') return 'Tidak Berisiko'
  return 'Belum Dihitung'
}

function formatCriteriaDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

const SEVERITY_ORDER: PatientRiskLevel[] = ['tidak_berisiko', 'ringan', 'sedang', 'berat']
const SEVERITY_POINT_COLOR: Record<string, string> = {
  tidak_berisiko: '#2563eb', ringan: '#16a34a', sedang: '#d97706', berat: '#dc2626'
}
const RISK_LABEL_SHORT: Record<string, string> = {
  tidak_berisiko: 'Tidak Berisiko', ringan: 'Ringan', sedang: 'Sedang', berat: 'Berat'
}

const trendChartData = computed(() => {
  const rows = [...riskHistory.value].reverse()
  return {
    labels: rows.map((r) => formatCriteriaDate(r.assessment_date ?? r.computed_at)),
    datasets: [{
      label: 'Tingkat Risiko',
      data: rows.map((r) => SEVERITY_ORDER.indexOf(r.level)),
      borderColor: '#0d9488',
      backgroundColor: '#0d9488',
      pointBackgroundColor: rows.map((r) => SEVERITY_POINT_COLOR[r.level] ?? '#94a3b8'),
      pointRadius: 4,
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
    tooltip: { callbacks: { label: (ctx: { parsed: { y: number } }) => RISK_LABEL_SHORT[SEVERITY_ORDER[ctx.parsed.y]] ?? '-' } }
  },
  scales: {
    y: { min: 0, max: 3, ticks: { stepSize: 1, callback: (value: number) => RISK_LABEL_SHORT[SEVERITY_ORDER[value]] ?? '' } }
  }
}

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
</script>

<template>
  <div class="pb-8">
    <div class="px-5 pt-8 pb-4 bg-white dark:bg-slate-900 sticky top-0 z-40 border-b border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
      <button @click="$router.back()" class="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-transform shrink-0">
        <LucideArrowLeft class="w-4 h-4" />
      </button>
      <h1 class="text-lg font-extrabold text-accent dark:text-white truncate">Riwayat Pasien</h1>
    </div>

    <div v-if="isLoadingPatient" class="flex flex-col items-center justify-center py-16 text-slate-400">
      <LucideLoader2 class="w-8 h-8 animate-spin mb-3" />
      <p class="text-base font-medium">Memuat data pasien...</p>
    </div>
    <p v-else-if="patientError" class="m-5 text-base font-semibold text-danger bg-danger/10 border border-danger/20 rounded-2xl px-4 py-3">{{ patientError }}</p>

    <div v-else-if="patient" class="p-5 space-y-4">
      <!-- Identitas -->
      <div class="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
        <div class="flex items-start justify-between gap-3 mb-2">
          <h2 class="text-lg font-black text-slate-800 dark:text-white leading-tight">{{ patient.nama }}</h2>
          <span class="px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0" :class="getRiskColor(patient.risk_level)">
            {{ getRiskLabel(patient.risk_level) }}
          </span>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400 flex items-start gap-2">
          <LucideMapPin class="w-4 h-4 shrink-0 mt-0.5" />
          {{ patient.alamat || 'Alamat belum tercatat' }}
        </p>
      </div>

      <!-- Tren Kondisi -->
      <div class="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
        <h3 class="font-bold text-accent dark:text-white text-sm mb-3 flex items-center gap-2">
          <LucideTrendingUp class="w-4 h-4 text-info" />
          Riwayat & Tren Kondisi
        </h3>
        <div v-if="isLoadingRiskHistory" class="py-8 text-center text-slate-400 text-sm">Memuat...</div>
        <div v-else-if="riskHistory.length === 0" class="py-8 text-center text-slate-400 text-sm">Belum ada riwayat klasifikasi risiko.</div>
        <div v-else-if="riskHistory.length === 1" class="text-sm text-slate-600 dark:text-slate-300">
          Klasifikasi terakhir: <b>{{ getRiskLabel(riskHistory[0]!.level) }}</b> ({{ formatCriteriaDate(riskHistory[0]!.assessment_date ?? riskHistory[0]!.computed_at) }})
        </div>
        <div v-else class="h-48">
          <Line :data="trendChartData" :options="trendChartOptions" />
        </div>
      </div>

      <!-- Riwayat Kunjungan -->
      <div class="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
        <h3 class="font-bold text-accent dark:text-white text-sm mb-3 flex items-center gap-2">
          <LucideCalendarClock class="w-4 h-4 text-info" />
          Riwayat Kunjungan
        </h3>
        <div v-if="isLoadingVisitHistory" class="py-8 text-center text-slate-400 text-sm">Memuat...</div>
        <div v-else-if="visitHistoryList.length === 0" class="py-8 text-center text-slate-400 text-sm">Belum ada kunjungan tercatat untuk pasien ini.</div>
        <div v-else class="space-y-3">
          <div v-for="visit in visitHistoryList" :key="visit.id" class="border border-slate-100 dark:border-slate-700 rounded-2xl p-4">
            <div class="flex items-start justify-between gap-3 mb-1">
              <div>
                <p class="text-sm font-bold text-slate-800 dark:text-white">{{ new Date(visit.scheduled_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{{ visitAssigneeName(visit) }}</p>
              </div>
              <span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0" :class="VISIT_STATUS_COLORS[visit.status] ?? 'bg-slate-100 text-slate-500 border border-slate-200'">
                {{ VISIT_STATUS_LABELS[visit.status] ?? visit.status }}
              </span>
            </div>
            <div v-if="visit.report" class="mt-2 pt-2 border-t border-slate-50 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <p v-if="visit.report.kondisi"><span class="font-semibold">Kondisi:</span> {{ visit.report.kondisi }}</p>
              <p v-if="visit.report.keluhan"><span class="font-semibold">Keluhan:</span> {{ visit.report.keluhan }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
