<script setup lang="ts">
import type { ApiSuccessEnvelope, PaginatedData, Rujukan, RujukanStatus, TindakanPuskesmas } from '~/types/api'

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

// REVISI (permintaan user, realtime lewat produli-wss) -- SEBELUMNYA polling 15 detik jadi
// jalur utama. Sekarang event "pasien_dirujuk" dari topic dashboardTopic() (puskesmas:{id} atau
// role:super_admin, lihat useRealtime.ts & RealtimeBroadcastService sisi backend) memicu
// loadRujukan() nyaris seketika begitu kader/nakes submit rujukan. Polling 2 menit dipertahankan
// TURUN dari 15 detik jadi cuma jaring pengaman (socket gagal connect/offline/produli-wss down)
// -- alarm sfx tetap sama seperti sebelumnya, dipicu detectNewRujukan() setiap loadRujukan()
// selesai, tidak peduli dipanggil dari websocket atau fallback poll.
let pollTimer: ReturnType<typeof setInterval> | null = null
let unsubscribeRealtime: (() => void) | null = null
onMounted(async () => {
  loadRujukan()
  pollTimer = setInterval(loadRujukan, 120_000)

  const { subscribe, dashboardTopic } = useRealtime()
  const topic = dashboardTopic()
  if (topic) {
    unsubscribeRealtime = await subscribe(topic, 'pasien_dirujuk', () => loadRujukan())
  }
})
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  unsubscribeRealtime?.()
})
watch(filterStatus, () => loadRujukan())

const CARA_RUJUKAN_LABELS: Record<string, string> = {
  datang_sendiri: 'Datang Sendiri', dijemput_ambulan: 'Dijemput Ambulan',
  diantar_keluarga: 'Diantar Keluarga', diantar_nakes_kader: 'Diantar Nakes/Kader'
}
const STATUS_LABELS: Record<string, string> = {
  menunggu_konfirmasi: 'Menunggu Konfirmasi', dikonfirmasi: 'Dikonfirmasi', dibatalkan: 'Dibatalkan'
}
const TINDAKAN_PUSKESMAS_LABELS: Record<TindakanPuskesmas, string> = {
  rawat_inap: 'Rawat Inap', edukasi: 'Edukasi', obat_tambahan: 'Diberi Obat Tambahan', lainnya: 'Lainnya'
}
const TINDAKAN_PUSKESMAS_OPTIONS: TindakanPuskesmas[] = ['rawat_inap', 'edukasi', 'obat_tambahan', 'lainnya']
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
    useToast().add({
      title: status === 'dikonfirmasi' ? 'Rujukan dikonfirmasi' : 'Rujukan dibatalkan',
      color: status === 'dikonfirmasi' ? 'success' : 'warning'
    })
  } catch (e) {
    confirmError.value = e instanceof ApiError ? e.message : 'Gagal memperbarui status rujukan.'
  } finally {
    confirmingId.value = null
  }
}

// --- Input Tindakan Lanjutan (permintaan user) -- hasil diagnosa/penanganan puskesmas SETELAH
// pasien dikonfirmasi datang (rawat inap/edukasi/obat tambahan/dst) + catatan bebas. HANYA
// relevan utk rujukan yang rujukan_status='dikonfirmasi' (backend menolak selain itu, lihat
// RujukanService::inputTindakanLanjutan()) -- tombolnya digerbang sama di template.
const showTindakanModal = ref(false)
const tindakanTarget = ref<Rujukan | null>(null)
const tindakanForm = ref<TindakanPuskesmas[]>([])
const catatanForm = ref('')
const isSubmittingTindakan = ref(false)
const tindakanError = ref('')

function openTindakanModal(row: Rujukan) {
  tindakanTarget.value = row
  // Prefill dari yang sudah tersimpan -- boleh diisi ULANG/dikoreksi, bukan write-once.
  tindakanForm.value = row.tindakan_puskesmas ? [...row.tindakan_puskesmas] : []
  catatanForm.value = row.catatan_tindakan_puskesmas ?? ''
  tindakanError.value = ''
  showTindakanModal.value = true
}

function toggleTindakanForm(value: TindakanPuskesmas) {
  const idx = tindakanForm.value.indexOf(value)
  if (idx === -1) tindakanForm.value.push(value)
  else tindakanForm.value.splice(idx, 1)
}

async function submitTindakan() {
  if (!tindakanTarget.value || tindakanForm.value.length === 0) return
  isSubmittingTindakan.value = true
  tindakanError.value = ''
  try {
    const api = useApi()
    const res = await api(`/rujukan/${tindakanTarget.value.id}/tindakan-lanjutan`, {
      method: 'PATCH',
      body: { tindakan_puskesmas: tindakanForm.value, catatan: catatanForm.value.trim() || null }
    }) as ApiSuccessEnvelope<Rujukan>
    const idx = rujukanList.value.findIndex((r) => r.id === tindakanTarget.value!.id)
    if (idx !== -1) rujukanList.value[idx] = res.data
    showTindakanModal.value = false
    useToast().add({ title: 'Tindak lanjut berhasil disimpan', icon: 'i-lucide-check-circle-2' })
  } catch (e) {
    tindakanError.value = e instanceof ApiError ? e.message : 'Gagal menyimpan tindak lanjut.'
  } finally {
    isSubmittingTindakan.value = false
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
              <th class="py-4 px-5 font-semibold">Tanggal Lapor</th>
              <th class="py-4 px-5 font-semibold text-center">Status</th>
              <th class="py-4 px-5 font-semibold">Tindak Lanjut Puskesmas</th>
              <th v-if="canConfirm" class="py-4 px-5 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="isLoading && rujukanList.length === 0">
              <td :colspan="canConfirm ? 7 : 6" class="py-12 text-center text-slate-400">
                <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
                Memuat data rujukan...
              </td>
            </tr>
            <tr v-else-if="loadError">
              <td :colspan="canConfirm ? 7 : 6" class="py-8 text-center text-sm font-semibold text-danger">{{ loadError }}</td>
            </tr>
            <tr v-else-if="rujukanList.length === 0">
              <td :colspan="canConfirm ? 7 : 6" class="py-12 text-center text-slate-400 text-sm">Tidak ada data rujukan.</td>
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
                <!-- Permintaan user: tanggal lapor + tooltip sebutkan siapa yang melaporkan. -->
                <AppTooltip :text="`Dilaporkan oleh ${row.petugas?.nama ?? 'petugas tidak diketahui'}`">
                  <span class="text-sm font-semibold text-slate-700 flex items-center gap-2 w-fit">
                    <LucideCalendar class="w-4 h-4 text-slate-400" />
                    {{ row.created_at ? new Date(row.created_at).toLocaleString('id-ID') : '-' }}
                  </span>
                </AppTooltip>
              </td>
              <td class="py-4 px-5 text-center">
                <span class="px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider" :class="statusColor(row.rujukan_status)">
                  {{ row.rujukan_status ? (STATUS_LABELS[row.rujukan_status] ?? row.rujukan_status) : '-' }}
                </span>
                <!-- Permintaan user: dikonfirmasi kedatangannya jam berapa oleh siapa. -->
                <p v-if="row.confirmed_at" class="text-[10px] text-slate-400 font-medium mt-1.5">
                  {{ new Date(row.confirmed_at).toLocaleString('id-ID') }}<br />oleh {{ row.confirmed_by?.name ?? '-' }}
                </p>
              </td>
              <td class="py-4 px-5">
                <!-- Permintaan user: hasil diagnosa/penanganan puskesmas (rawat inap/edukasi/
                     obat tambahan) -- HANYA relevan setelah dikonfirmasi. -->
                <template v-if="row.tindakan_puskesmas?.length">
                  <AppTooltip :text="row.catatan_tindakan_puskesmas || 'Tidak ada catatan tambahan.'">
                    <div class="flex flex-wrap gap-1 w-fit">
                      <span v-for="t in row.tindakan_puskesmas" :key="t" class="px-2 py-1 rounded-md text-[10px] font-bold bg-info/10 text-info border border-info/20">
                        {{ TINDAKAN_PUSKESMAS_LABELS[t] ?? t }}
                      </span>
                    </div>
                  </AppTooltip>
                  <p class="text-[10px] text-slate-400 font-medium mt-1.5">oleh {{ row.tindakan_puskesmas_by?.name ?? '-' }}</p>
                </template>
                <span v-else-if="row.rujukan_status === 'dikonfirmasi'" class="text-xs text-slate-400 italic">Belum diisi</span>
                <span v-else class="text-slate-300">-</span>
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
                <button
                  v-else-if="row.rujukan_status === 'dikonfirmasi'"
                  @click="openTindakanModal(row)"
                  class="flex items-center gap-1.5 bg-info/10 text-info px-3 py-2 rounded-lg text-xs font-bold hover:bg-info/20 transition-colors ml-auto"
                >
                  <LucideStethoscope class="w-3.5 h-3.5" />
                  {{ row.tindakan_puskesmas?.length ? 'Ubah Tindakan' : 'Input Tindakan Lanjutan' }}
                </button>
                <span v-else class="text-xs text-slate-400 font-semibold italic">Sudah diproses</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Input Tindakan Lanjutan (permintaan user) -- hasil diagnosa/penanganan puskesmas
         setelah pasien dikonfirmasi datang. -->
    <div v-if="showTindakanModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div class="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
        <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
          <h3 class="font-bold text-accent text-lg flex items-center gap-2">
            <LucideStethoscope class="w-5 h-5 text-info" />
            Input Tindakan Lanjutan
          </h3>
          <button @click="showTindakanModal = false" class="text-slate-400 hover:text-slate-600 p-1">
            <LucideX class="w-5 h-5" />
          </button>
        </div>

        <div class="p-6 space-y-5 overflow-y-auto">
          <p class="text-sm text-slate-500 -mt-2">
            Pasien <b class="text-slate-700">{{ tindakanTarget?.patient?.nama }}</b> -- bagaimana kondisinya ditangani di puskesmas?
          </p>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Tindakan (bisa lebih dari satu)</label>
            <div class="grid grid-cols-2 gap-2">
              <label
                v-for="opt in TINDAKAN_PUSKESMAS_OPTIONS"
                :key="opt"
                class="flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors"
                :class="tindakanForm.includes(opt) ? 'border-info bg-info/10 text-info' : 'border-slate-200 text-slate-600 hover:border-slate-300'"
              >
                <input type="checkbox" :checked="tindakanForm.includes(opt)" @change="toggleTindakanForm(opt)" class="w-4 h-4 rounded border-slate-300 text-info focus:ring-info/30" />
                <span class="text-sm font-semibold">{{ TINDAKAN_PUSKESMAS_LABELS[opt] }}</span>
              </label>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Catatan / Hasil Diagnosa (opsional)</label>
            <textarea
              v-model="catatanForm"
              rows="4"
              placeholder="Mis. Tekanan darah tinggi, dirawat inap 2 hari, diberi edukasi pola makan..."
              class="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-info/20 focus:border-info resize-none"
            ></textarea>
          </div>

          <p v-if="tindakanError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{{ tindakanError }}</p>
        </div>

        <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
          <button @click="showTindakanModal = false" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
          <button
            @click="submitTindakan"
            :disabled="isSubmittingTindakan || tindakanForm.length === 0"
            class="py-2.5 px-6 rounded-xl font-bold text-white bg-info hover:bg-info/90 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <LucideLoader2 v-if="isSubmittingTindakan" class="w-4 h-4 animate-spin" />
            {{ isSubmittingTindakan ? 'Menyimpan...' : 'Simpan' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
