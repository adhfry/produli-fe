<script setup lang="ts">
import type { ApiSuccessEnvelope, DashboardSummary, DashboardPuskesmasPerformance } from '~/types/api'
import flatpickr from 'flatpickr'
import 'flatpickr/dist/flatpickr.css'
import { Indonesian } from 'flatpickr/dist/l10n/id.js'

// Halaman "Selengkapnya" dari widget "Top 5 Puskesmas Kinerja Terbaik" di /dashboard (permintaan
// user -- tombol itu sebelumnya tidak diberi handler apa pun, dead button). Leaderboard SE-
// KABUPATEN untuk SEMUA role (sama seperti widget-nya, lihat App\Services\Performance\
// PuskesmasPerformanceScoringService di backend) -- TIDAK ada filter puskesmas di sini, cuma
// filter periode (skor performance memang period-dependent, beda dari risiko kecamatan yang
// snapshot kondisi terkini).
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
useHead({
  title: 'Kinerja Puskesmas'
})

const route = useRoute()

// Deep-link dari /dashboard (permintaan user, konteks periode yang sedang dilihat admin ikut
// terbawa) -- ?date_from=&date_to= divalidasi format tanggal sederhana, bukan langsung dipakai
// apa adanya.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
function queryDate(key: string): string | null {
  const v = route.query[key]
  return typeof v === 'string' && ISO_DATE_RE.test(v) ? v : null
}
const dateRangeFrom = ref<string | null>(queryDate('date_from'))
const dateRangeTo = ref<string | null>(queryDate('date_to'))
const dateRangeInputRef = ref<HTMLInputElement | null>(null)
const dateRangeLabel = computed(() => {
  if (!dateRangeFrom.value || !dateRangeTo.value) return 'Semua Tanggal'
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmt(dateRangeFrom.value)} - ${fmt(dateRangeTo.value)}`
})

function initDateRangePicker() {
  if (!dateRangeInputRef.value) return
  flatpickr(dateRangeInputRef.value, {
    mode: 'range',
    locale: Indonesian,
    dateFormat: 'j M Y',
    defaultDate: dateRangeFrom.value && dateRangeTo.value ? [dateRangeFrom.value, dateRangeTo.value] : undefined,
    onChange: (selectedDates) => {
      if (selectedDates.length === 2) {
        const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        dateRangeFrom.value = toIso(selectedDates[0])
        dateRangeTo.value = toIso(selectedDates[1])
        loadData()
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
  loadData()
}

const rows = ref<DashboardPuskesmasPerformance[]>([])
const isLoading = ref(false)
const loadError = ref('')

async function loadData() {
  isLoading.value = true
  loadError.value = ''
  try {
    const api = useApi()
    const query: Record<string, string> = {}
    if (dateRangeFrom.value) query.date_from = dateRangeFrom.value
    if (dateRangeTo.value) query.date_to = dateRangeTo.value
    const res = await api('/dashboard/summary', { query }) as ApiSuccessEnvelope<DashboardSummary>
    // Sudah terurut final_score desc dari backend (deterministic tie-break) -- tampilkan apa adanya.
    rows.value = res.data.puskesmas_performance
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Gagal memuat data kinerja puskesmas.'
  } finally {
    isLoading.value = false
  }
}
onMounted(() => {
  loadData()
  nextTick(() => initDateRangePicker())
})
</script>

<template>
  <div class="space-y-6">
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
      <NuxtLink to="/dashboard" class="hover:text-primary transition-colors">Dashboard</NuxtLink>
      <LucideChevronRight class="w-3 h-3" />
      <span class="text-slate-600">Kinerja Puskesmas</span>
    </div>

    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 class="text-2xl font-extrabold text-accent flex items-center gap-2">
          <LucideTrendingUp class="w-6 h-6 text-success" />
          Kinerja Puskesmas
        </h1>
        <p class="text-sm text-slate-500 mt-1">Skor kinerja (0-100) dari keberhasilan intervensi tervalidasi menurunkan risiko pasien, se-Kabupaten Sumenep.</p>
      </div>
      <NuxtLink to="/dashboard" class="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
        <LucideArrowLeft class="w-4 h-4" /> Kembali ke Dashboard
      </NuxtLink>
    </div>

    <!-- Filter periode -- sama polanya dgn dashboard/index.vue (initDateRangePicker), skor
         performance memang period-dependent (beda dari risiko kecamatan yang snapshot terkini). -->
    <div class="flex items-center gap-2">
      <div class="relative">
        <LucideCalendar class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref="dateRangeInputRef"
          type="text"
          readonly
          :placeholder="dateRangeLabel"
          class="pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white cursor-pointer w-56"
        />
      </div>
      <button v-if="dateRangeFrom" type="button" @click="clearDateRange" class="text-slate-400 hover:text-slate-600 p-0.5 shrink-0" title="Hapus filter tanggal">
        <LucideX class="w-4 h-4" />
      </button>
    </div>

    <div class="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
      <div v-if="isLoading" class="p-12 text-center text-slate-400">
        <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
        Memuat data...
      </div>
      <p v-else-if="loadError" class="p-8 text-center text-danger font-semibold">{{ loadError }}</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <th class="py-3 px-5 font-semibold w-12">#</th>
              <th class="py-3 px-5 font-semibold">Puskesmas</th>
              <th class="py-3 px-5 font-semibold text-right">Skor</th>
              <th class="py-3 px-5 font-semibold text-right">Improvement</th>
              <th class="py-3 px-5 font-semibold text-right">Risk Reduction</th>
              <th class="py-3 px-5 font-semibold text-right">Stability</th>
              <th class="py-3 px-5 font-semibold text-right">Pasien Eligible</th>
              <th class="py-3 px-5 font-semibold text-right">Membaik</th>
              <th class="py-3 px-5 font-semibold text-right">Kunjungan Tervalidasi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="row in rows" :key="row.puskesmas_id" class="hover:bg-slate-50 transition-colors">
              <td class="py-3 px-5 text-sm font-bold text-slate-400">{{ row.rank }}</td>
              <td class="py-3 px-5 text-sm font-semibold text-slate-800">{{ row.puskesmas_nama }}</td>
              <td class="py-3 px-5 text-sm font-bold text-success text-right">{{ row.final_score }}%</td>
              <td class="py-3 px-5 text-sm text-slate-600 text-right">{{ row.improvement_rate }}%</td>
              <td class="py-3 px-5 text-sm text-slate-600 text-right">{{ row.risk_reduction_score }}%</td>
              <td class="py-3 px-5 text-sm text-slate-600 text-right">{{ row.stability_rate }}%</td>
              <td class="py-3 px-5 text-sm text-slate-600 text-right">{{ row.eligible_patients }}</td>
              <td class="py-3 px-5 text-sm text-slate-600 text-right">{{ row.improved_patients }}</td>
              <td class="py-3 px-5 text-sm text-slate-600 text-right">{{ row.validated_visits }}</td>
            </tr>
            <tr v-if="!rows.length">
              <td colspan="9" class="py-10 text-center text-sm text-slate-400">Belum ada transisi risiko dengan kunjungan tervalidasi pada periode ini.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
