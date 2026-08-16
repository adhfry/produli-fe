<script setup lang="ts">
import type { ApiSuccessEnvelope, PaginatedData, Rujukan, RujukanStatus } from '~/types/api'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
useHead({
  title: 'Rujukan Pasien'
})

// GET /rujukan -- ter-scope backend (RujukanService::scopedQuery): admin_puskesmas/pj_prolanis
// cuma rujukan dari kader/nakes DI PUSKESMASNYA sendiri, super_admin semua.
const rujukanList = ref<Rujukan[]>([])
const isLoading = ref(false)
const loadError = ref('')
const filterStatus = ref<'' | RujukanStatus>('')

async function loadRujukan() {
  isLoading.value = true
  loadError.value = ''
  try {
    const api = useApi()
    const items = await fetchAllPages<Rujukan>((page) =>
      api('/rujukan', { query: { per_page: 50, page, rujukan_status: filterStatus.value || undefined } }) as Promise<ApiSuccessEnvelope<PaginatedData<Rujukan>>>
    )
    detectNewRujukan(items)
    rujukanList.value = items
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Gagal memuat data rujukan.'
  } finally {
    isLoading.value = false
  }
}

// Polling 15 detik (docs plan Fase 3) -- BUKAN websocket, cukup untuk kebutuhan "admin/PJ segera
// tahu ada rujukan baru". Alarm HANYA dibunyikan saat benar-benar ada baris baru dibanding load
// sebelumnya (bandingkan Set of id, bukan cuma "count berubah" -- count bisa turun/naik karena
// filter status juga berubah oleh konfirmasi/pembatalan, itu bukan "rujukan baru"). Load pertama
// TIDAK memicu alarm (belum ada baseline sama sekali, semua baris "lama").
const seenIds = ref<Set<number> | null>(null)
function detectNewRujukan(items: Rujukan[]) {
  const currentIds = new Set(items.filter((r) => r.rujukan_status === 'menunggu_konfirmasi').map((r) => r.id))
  if (seenIds.value !== null) {
    const hasNew = [...currentIds].some((id) => !seenIds.value!.has(id))
    if (hasNew) useNotificationSound().playAlarm()
  }
  seenIds.value = currentIds
}

let pollTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  loadRujukan()
  pollTimer = setInterval(loadRujukan, 15000)
})
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
watch(filterStatus, () => loadRujukan())

const CARA_RUJUKAN_LABELS: Record<string, string> = {
  datang_sendiri: 'Datang Sendiri', dijemput_ambulan: 'Dijemput Ambulan',
  diantar_keluarga: 'Diantar Keluarga', diantar_nakes_kader: 'Diantar Nakes/Kader'
}
const STATUS_LABELS: Record<string, string> = {
  menunggu_konfirmasi: 'Menunggu Konfirmasi', dikonfirmasi: 'Dikonfirmasi', dibatalkan: 'Dibatalkan'
}
function statusColor(status: string | null) {
  if (status === 'menunggu_konfirmasi') return 'bg-danger/10 text-danger border border-danger/20'
  if (status === 'dikonfirmasi') return 'bg-success/10 text-success border border-success/20'
  if (status === 'dibatalkan') return 'bg-slate-100 text-slate-600 border border-slate-200'
  return 'bg-slate-100 text-slate-600'
}

// super_admin cuma bisa MELIHAT (VisitReportPolicy::viewAnyRujukan) -- konfirmasi/batalkan
// SENGAJA ditolak backend (VisitReportPolicy::confirmRujukan, plan eksplisit "hanya
// admin_puskesmas/pj_prolanis"), jadi tombolnya disembunyikan di sini juga (bukan cuma andalkan
// 403 dari server).
const authStore = useAuthStore()
const canConfirm = computed(() => {
  const roles = authStore.roles ?? []
  return roles.includes('admin_puskesmas') || roles.includes('pj_prolanis')
})

const confirmingId = ref<number | null>(null)
const confirmError = ref('')
async function konfirmasi(row: Rujukan, status: 'dikonfirmasi' | 'dibatalkan') {
  confirmingId.value = row.id
  confirmError.value = ''
  try {
    const api = useApi()
    const res = await api(`/rujukan/${row.id}/konfirmasi`, { method: 'PATCH', body: { status } }) as ApiSuccessEnvelope<Rujukan>
    const idx = rujukanList.value.findIndex((r) => r.id === row.id)
    if (idx !== -1) rujukanList.value[idx] = res.data
  } catch (e) {
    confirmError.value = e instanceof ApiError ? e.message : 'Gagal memperbarui status rujukan.'
  } finally {
    confirmingId.value = null
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
        <span class="text-slate-600">Rujukan</span>
      </div>
      <div>
        <h1 class="text-2xl font-extrabold text-accent">Rujukan Pasien</h1>
        <p class="text-sm text-slate-500 mt-1">Pasien yang dirujuk kader/tenaga kesehatan ke puskesmas, menunggu konfirmasi kedatangan.</p>
      </div>
    </div>

    <div v-if="confirmError" class="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm font-semibold">
      {{ confirmError }}
    </div>

    <!-- Filter & Table Card -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-card flex flex-col overflow-hidden">
      <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <select v-model="filterStatus" class="w-full md:w-64 py-2.5 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
          <option value="">Semua Status</option>
          <option value="menunggu_konfirmasi">Menunggu Konfirmasi</option>
          <option value="dikonfirmasi">Dikonfirmasi</option>
          <option value="dibatalkan">Dibatalkan</option>
        </select>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <th class="py-4 px-5 font-semibold">Pasien</th>
              <th class="py-4 px-5 font-semibold">Pelapor</th>
              <th class="py-4 px-5 font-semibold">Cara Rujukan</th>
              <th class="py-4 px-5 font-semibold">Waktu</th>
              <th class="py-4 px-5 font-semibold text-center">Status</th>
              <th v-if="canConfirm" class="py-4 px-5 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="isLoading && rujukanList.length === 0">
              <td :colspan="canConfirm ? 6 : 5" class="py-12 text-center text-slate-400">
                <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
                Memuat data rujukan...
              </td>
            </tr>
            <tr v-else-if="loadError">
              <td :colspan="canConfirm ? 6 : 5" class="py-8 text-center text-sm font-semibold text-danger">{{ loadError }}</td>
            </tr>
            <tr v-else-if="rujukanList.length === 0">
              <td :colspan="canConfirm ? 6 : 5" class="py-12 text-center text-slate-400 text-sm">Tidak ada data rujukan.</td>
            </tr>
            <tr v-for="row in rujukanList" v-else :key="row.id" class="hover:bg-slate-50/80 transition-colors">
              <td class="py-4 px-5">
                <span class="font-bold text-slate-800">{{ row.patient?.nama ?? 'Pasien tidak diketahui' }}</span>
              </td>
              <td class="py-4 px-5">
                <p class="text-sm font-bold text-slate-700 flex items-center gap-1.5"><LucideUser class="w-3.5 h-3.5 text-slate-400" /> {{ row.petugas?.nama ?? '-' }}</p>
                <p class="text-[11px] text-slate-500 font-medium mt-1">{{ row.petugas?.tipe === 'tenaga_kesehatan' ? 'Tenaga Kesehatan' : 'Kader' }} &bull; {{ row.puskesmas?.nama ?? '-' }}</p>
              </td>
              <td class="py-4 px-5">
                <span class="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <LucideAmbulance class="w-4 h-4 text-slate-400" />
                  {{ row.cara_rujukan ? (CARA_RUJUKAN_LABELS[row.cara_rujukan] ?? row.cara_rujukan) : '-' }}
                </span>
              </td>
              <td class="py-4 px-5">
                <span class="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <LucideCalendar class="w-4 h-4 text-slate-400" />
                  {{ row.created_at ? new Date(row.created_at).toLocaleString('id-ID') : '-' }}
                </span>
              </td>
              <td class="py-4 px-5 text-center">
                <span class="px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider" :class="statusColor(row.rujukan_status)">
                  {{ row.rujukan_status ? (STATUS_LABELS[row.rujukan_status] ?? row.rujukan_status) : '-' }}
                </span>
              </td>
              <td v-if="canConfirm" class="py-4 px-5 text-right">
                <div v-if="row.rujukan_status === 'menunggu_konfirmasi'" class="flex items-center justify-end gap-2">
                  <button
                    :disabled="confirmingId === row.id"
                    @click="konfirmasi(row, 'dikonfirmasi')"
                    class="flex items-center gap-1.5 bg-success text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-success/90 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    <LucideLoader2 v-if="confirmingId === row.id" class="w-3.5 h-3.5 animate-spin" />
                    <LucideCheck v-else class="w-3.5 h-3.5" />
                    Konfirmasi
                  </button>
                  <button
                    :disabled="confirmingId === row.id"
                    @click="konfirmasi(row, 'dibatalkan')"
                    class="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    <LucideX class="w-3.5 h-3.5" />
                    Batalkan
                  </button>
                </div>
                <span v-else class="text-xs text-slate-400 font-semibold italic">Sudah diproses</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
