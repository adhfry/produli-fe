<script setup lang="ts">
import type { ApiSuccessEnvelope, ProlanisSchedule, ProlanisScheduleStatus, Puskesmas } from '~/types/api'
import flatpickr from 'flatpickr'
import 'flatpickr/dist/flatpickr.css'
import { Indonesian } from 'flatpickr/dist/l10n/id.js'

// Permintaan user -- kalender jadwal kegiatan Prolanis otomatis, dihitung backend dari tanggal
// lab terbaru pasien (BUKAN created_at) + interval sesuai jenis_prolanis (DM 3 bulan, HT 6
// bulan, lihat ProlanisScheduleService di backend). Halaman ini murni TAMPILKAN + kelola manual
// (reschedule/status) -- generate otomatis jalan di scheduler backend (produli:generate-
// prolanis-schedules, dailyAt 04:00).
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
useHead({
  title: 'Jadwal Prolanis'
})

const authStore = useAuthStore()
const isSuperAdmin = computed(() => (authStore.roles ?? []).includes('super_admin'))

const STATUS_LABELS: Record<ProlanisScheduleStatus, string> = {
  terjadwal: 'Terjadwal', selesai: 'Selesai', dibatalkan: 'Dibatalkan'
}
const STATUS_DOT: Record<ProlanisScheduleStatus, string> = {
  terjadwal: 'bg-info', selesai: 'bg-success', dibatalkan: 'bg-slate-400'
}

// --- Bulan yang sedang ditampilkan -- Y-m lokal (bukan toISOString, konsisten dgn pola tanggal
// lain di app ini yang sudah membahas alasan yang sama berulang kali). ------------------------
const today = new Date()
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth()) // 0-indexed

const monthLabel = computed(() => new Date(viewYear.value, viewMonth.value, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }))

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Grid kalender -- MINGGU dimulai Senin (konvensi Indonesia), sel di luar bulan berjalan tetap
// ditampilkan (abu-abu) supaya grid selalu genap 6 baris x 7 kolom, tidak "loncat" antar bulan.
const calendarWeeks = computed(() => {
  const firstOfMonth = new Date(viewYear.value, viewMonth.value, 1)
  const startOffset = (firstOfMonth.getDay() + 6) % 7 // Minggu=0 -> geser jadi Senin=0
  const gridStart = new Date(viewYear.value, viewMonth.value, 1 - startOffset)

  const weeks: { date: Date, ymd: string, inMonth: boolean }[][] = []
  for (let w = 0; w < 6; w++) {
    const week: { date: Date, ymd: string, inMonth: boolean }[] = []
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(gridStart)
      cellDate.setDate(gridStart.getDate() + w * 7 + d)
      week.push({ date: cellDate, ymd: toYmd(cellDate), inMonth: cellDate.getMonth() === viewMonth.value })
    }
    weeks.push(week)
  }
  return weeks
})

const gridRangeFrom = computed(() => calendarWeeks.value[0]![0]!.ymd)
const gridRangeTo = computed(() => calendarWeeks.value[5]![6]!.ymd)

// --- Puskesmas filter (KHUSUS super_admin -- role lain otomatis terkunci backend). ------------
const puskesmasList = ref<Puskesmas[]>([])
const filterPuskesmasId = ref<number | null>(null)
async function loadPuskesmasList() {
  if (!isSuperAdmin.value) return
  try {
    puskesmasList.value = await fetchAllPages<Puskesmas>((page) => useApi()('/puskesmas', { query: { per_page: 100, page } }))
  } catch (e) {
    console.error('Gagal memuat daftar puskesmas', e)
  }
}

// --- Data jadwal utk rentang grid yang sedang tampil. ------------------------------------------
const schedules = ref<ProlanisSchedule[]>([])
const isLoading = ref(false)
const loadError = ref('')

async function loadSchedules() {
  isLoading.value = true
  loadError.value = ''
  try {
    const api = useApi()
    const res = await api('/jadwal-prolanis', {
      query: {
        date_from: gridRangeFrom.value,
        date_to: gridRangeTo.value,
        ...(isSuperAdmin.value && filterPuskesmasId.value ? { puskesmas_id: filterPuskesmasId.value } : {})
      }
    }) as ApiSuccessEnvelope<ProlanisSchedule[]>
    schedules.value = res.data
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Gagal memuat jadwal Prolanis.'
  } finally {
    isLoading.value = false
  }
}

const schedulesByDate = computed(() => {
  const map = new Map<string, ProlanisSchedule[]>()
  for (const s of schedules.value) {
    if (!map.has(s.scheduled_date)) map.set(s.scheduled_date, [])
    map.get(s.scheduled_date)!.push(s)
  }
  return map
})

function goToMonth(delta: number) {
  const d = new Date(viewYear.value, viewMonth.value + delta, 1)
  viewYear.value = d.getFullYear()
  viewMonth.value = d.getMonth()
}
function goToToday() {
  viewYear.value = today.getFullYear()
  viewMonth.value = today.getMonth()
}

watch([gridRangeFrom, gridRangeTo, filterPuskesmasId], loadSchedules)
onMounted(() => {
  loadPuskesmasList()
  loadSchedules()
})

// --- Detail hari (permintaan user, manajemen tanggal per puskesmas) -- klik sel tanggal buka
// panel daftar pasien hari itu, dari situ bisa reschedule/ubah status per pasien. --------------
const selectedDayYmd = ref<string | null>(null)
const selectedDaySchedules = computed(() => selectedDayYmd.value ? (schedulesByDate.value.get(selectedDayYmd.value) ?? []) : [])

function openDay(ymd: string) {
  selectedDayYmd.value = ymd
}

const rescheduleTarget = ref<ProlanisSchedule | null>(null)
const rescheduleDate = ref('')
const rescheduleDateInputRef = ref<HTMLInputElement | null>(null)
const isSavingReschedule = ref(false)
const actionError = ref('')

async function openReschedule(schedule: ProlanisSchedule) {
  rescheduleTarget.value = schedule
  rescheduleDate.value = schedule.scheduled_date
  actionError.value = ''
  await nextTick()
  if (rescheduleDateInputRef.value) {
    flatpickr(rescheduleDateInputRef.value, {
      locale: Indonesian,
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'j F Y',
      defaultDate: rescheduleDate.value,
      onChange: (selectedDates) => {
        const d = selectedDates[0]
        if (d) rescheduleDate.value = toYmd(d)
      }
    })
  }
}

async function submitReschedule() {
  if (!rescheduleTarget.value || !rescheduleDate.value) return
  isSavingReschedule.value = true
  actionError.value = ''
  try {
    const api = useApi()
    await api(`/jadwal-prolanis/${rescheduleTarget.value.id}/reschedule`, {
      method: 'PATCH',
      body: { scheduled_date: rescheduleDate.value }
    })
    rescheduleTarget.value = null
    await loadSchedules()
    useToast().add({ title: 'Jadwal berhasil diatur ulang', icon: 'i-lucide-check-circle-2' })
  } catch (e) {
    actionError.value = e instanceof ApiError ? e.message : 'Gagal mengatur ulang jadwal.'
  } finally {
    isSavingReschedule.value = false
  }
}

const updatingStatusId = ref<number | null>(null)
async function updateStatus(schedule: ProlanisSchedule, status: ProlanisScheduleStatus) {
  updatingStatusId.value = schedule.id
  actionError.value = ''
  try {
    const api = useApi()
    await api(`/jadwal-prolanis/${schedule.id}/status`, { method: 'PATCH', body: { status } })
    await loadSchedules()
  } catch (e) {
    actionError.value = e instanceof ApiError ? e.message : 'Gagal memperbarui status.'
  } finally {
    updatingStatusId.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <div class="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wider">
        <NuxtLink to="/dashboard" class="hover:text-primary transition-colors">Dashboard</NuxtLink>
        <LucideChevronRight class="w-3 h-3" />
        <span class="text-slate-600">Jadwal Prolanis</span>
      </div>
      <h1 class="text-2xl font-extrabold text-accent">Jadwal Prolanis</h1>
      <p class="text-sm text-slate-500 mt-1">Jadwal kegiatan Prolanis berikutnya per pasien, dihitung otomatis dari tanggal pemeriksaan lab terakhir.</p>
    </div>

    <p v-if="loadError || actionError" class="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm font-semibold">{{ loadError || actionError }}</p>

    <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div class="flex items-center gap-2">
          <button type="button" @click="goToMonth(-1)" class="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <LucideChevronLeft class="w-4 h-4" />
          </button>
          <h2 class="font-bold text-accent text-lg w-48 text-center capitalize">{{ monthLabel }}</h2>
          <button type="button" @click="goToMonth(1)" class="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <LucideChevronRight class="w-4 h-4" />
          </button>
          <button type="button" @click="goToToday" class="ml-2 text-xs font-bold text-primary hover:underline">Hari Ini</button>
        </div>

        <select v-if="isSuperAdmin" v-model="filterPuskesmasId" class="py-2 px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option :value="null">Semua Puskesmas</option>
          <option v-for="p in puskesmasList" :key="p.id" :value="p.id">{{ p.nama }}</option>
        </select>
      </div>

      <div v-if="isLoading" class="py-16 text-center text-slate-400">
        <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
        Memuat jadwal...
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse min-w-[840px]">
          <thead>
            <tr>
              <th v-for="d in ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']" :key="d" class="py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center">{{ d }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(week, wi) in calendarWeeks" :key="wi">
              <td
                v-for="cell in week"
                :key="cell.ymd"
                class="align-top border border-slate-100 h-28 w-[14.28%] p-1.5 cursor-pointer hover:bg-slate-50/80 transition-colors"
                :class="!cell.inMonth ? 'bg-slate-50/50' : ''"
                @click="openDay(cell.ymd)"
              >
                <p class="text-xs font-bold mb-1" :class="[!cell.inMonth ? 'text-slate-300' : 'text-slate-600', cell.ymd === toYmd(today) ? 'text-primary' : '']">
                  {{ cell.date.getDate() }}
                </p>
                <div class="space-y-0.5">
                  <div
                    v-for="s in (schedulesByDate.get(cell.ymd) ?? []).slice(0, 3)"
                    :key="s.id"
                    class="text-[10px] font-semibold px-1.5 py-0.5 rounded truncate flex items-center gap-1"
                    :class="s.status === 'dibatalkan' ? 'bg-slate-100 text-slate-400 line-through' : 'bg-info/10 text-info'"
                  >
                    <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="STATUS_DOT[s.status]"></span>
                    {{ s.patient?.nama ?? '-' }}
                  </div>
                  <p v-if="(schedulesByDate.get(cell.ymd) ?? []).length > 3" class="text-[10px] font-bold text-slate-400 pl-1">
                    +{{ (schedulesByDate.get(cell.ymd) ?? []).length - 3 }} lagi
                  </p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Panel Detail Hari (permintaan user, manajemen tanggal per puskesmas) -->
    <div v-if="selectedDayYmd" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div class="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[85vh] flex flex-col">
        <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
          <h3 class="font-bold text-accent text-lg flex items-center gap-2">
            <LucideCalendarClock class="w-5 h-5 text-info" />
            {{ new Date(selectedDayYmd + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) }}
          </h3>
          <button @click="selectedDayYmd = null" class="text-slate-400 hover:text-slate-600 p-1">
            <LucideX class="w-5 h-5" />
          </button>
        </div>

        <div class="p-6 overflow-y-auto space-y-3">
          <p v-if="selectedDaySchedules.length === 0" class="text-sm text-slate-400 text-center py-8">Tidak ada pasien terjadwal di tanggal ini.</p>
          <div v-for="s in selectedDaySchedules" :key="s.id" class="border border-slate-100 rounded-xl p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-bold text-slate-800">{{ s.patient?.nama ?? '-' }}</p>
                <p class="text-[11px] text-slate-500 mt-0.5">{{ s.puskesmas?.nama ?? '-' }} &bull; Jenis {{ s.jenis_prolanis ?? '-' }}</p>
                <p class="text-[11px] text-slate-400 mt-0.5">Lab terakhir: {{ s.source_lab_date ? new Date(s.source_lab_date).toLocaleDateString('id-ID') : '-' }}</p>
              </div>
              <span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0" :class="s.status === 'selesai' ? 'bg-success/10 text-success' : s.status === 'dibatalkan' ? 'bg-slate-100 text-slate-500' : 'bg-info/10 text-info'">
                {{ STATUS_LABELS[s.status] }}
              </span>
            </div>
            <div class="flex items-center gap-2 mt-3">
              <button @click="openReschedule(s)" class="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                <LucideCalendarCog class="w-3.5 h-3.5" /> Atur Ulang Tanggal
              </button>
              <span class="text-slate-300">&middot;</span>
              <button
                v-if="s.status !== 'selesai'"
                :disabled="updatingStatusId === s.id"
                @click="updateStatus(s, 'selesai')"
                class="text-xs font-bold text-success hover:underline disabled:opacity-50"
              >
                Tandai Selesai
              </button>
              <button
                v-if="s.status === 'terjadwal'"
                :disabled="updatingStatusId === s.id"
                @click="updateStatus(s, 'dibatalkan')"
                class="text-xs font-bold text-slate-500 hover:underline disabled:opacity-50"
              >
                Batalkan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Atur Ulang Tanggal -->
    <div v-if="rescheduleTarget" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div class="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
        <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h3 class="font-bold text-accent text-lg">Atur Ulang Tanggal</h3>
          <button @click="rescheduleTarget = null" class="text-slate-400 hover:text-slate-600 p-1">
            <LucideX class="w-5 h-5" />
          </button>
        </div>
        <div class="p-6 space-y-4">
          <p class="text-sm text-slate-500">Pasien <b class="text-slate-700">{{ rescheduleTarget.patient?.nama }}</b></p>
          <input ref="rescheduleDateInputRef" type="text" readonly class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm cursor-pointer" />
        </div>
        <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button @click="rescheduleTarget = null" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
          <button :disabled="isSavingReschedule" @click="submitReschedule" class="py-2.5 px-6 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 transition-colors disabled:opacity-50">
            {{ isSavingReschedule ? 'Menyimpan...' : 'Simpan' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
