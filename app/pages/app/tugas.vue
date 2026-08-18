<script setup lang="ts">
import type { AssignmentStatus, RiskLevel, VisitAssignment } from '~/types/api'

definePageMeta({
  layout: 'pwa',
  middleware: 'auth'
})
useHead({
  title: 'Daftar Tugas Kunjungan'
})

// GET /visit-assignments -- sudah ter-scope backend (VisitAssignmentService::scopedQuery):
// kader murni cuma lihat tugasnya sendiri (primer + yang dia dampingi/companion), role lain
// (pj_prolanis dkk) lihat semua di puskesmasnya. Halaman ini khusus mode kader (layout 'pwa').
const assignmentStore = useAssignmentStore()
onMounted(() => {
  assignmentStore.fetchAll()
  loadDraftCount()
})

// Badge jumlah laporan belum terkirim (docs/planning/10 §3) -- link ke /app/draft. SENGAJA
// tidak menghitung draft WIP ('draft', docs/planning/14) -- badge ini "perlu perhatian karena
// belum sampai server", bukan "ada kerja belum selesai" (itu urusan kader sendiri di halaman
// kunjungannya, sudah ada indikator auto-save di sana).
const offlineQueue = useOfflineQueue()
const draftCount = ref(0)
async function loadDraftCount() {
  draftCount.value = (await offlineQueue.getPendingDrafts()).length
}

const activeTab = ref('semua')

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10)
}

const todayCount = computed(
  () => assignmentStore.assignments.filter((a) => isToday(a.scheduled_date) && ['pending', 'in_progress'].includes(a.status)).length
)
const selesaiCount = computed(() => assignmentStore.assignments.filter((a) => a.status === 'completed').length)

const filteredTasks = computed(() => {
  const all = assignmentStore.assignments
  if (activeTab.value === 'hari_ini') {
    return all.filter((a) => isToday(a.scheduled_date) && ['pending', 'in_progress'].includes(a.status))
  }
  if (activeTab.value === 'selesai') {
    return all.filter((a) => a.status === 'completed')
  }
  return all
})

// "Diulang" -- assignment.status kembali 'pending' TAPI sudah punya laporan lama berstatus
// invalid (super_admin menolak, VisitReportReviewService membuka lagi assignment.status,
// docs/planning/02 §11). Beda makna dari 'pending' biasa (belum pernah dikerjakan sama sekali)
// -- kader perlu tahu ini kunjungan ULANGAN, bukan tugas baru.
function isRepeat(task: VisitAssignment): boolean {
  return task.status === 'pending' && task.report?.validation_status === 'invalid'
}

// Kunjungan hari-1 bersama kader+nakes (revisi Bu Kadis PMO) -- companion di assignment milik
// nakes berarti YANG DIDAMPINGI adalah nakes, bukan "kader lain" seperti kunjungan berombongan
// kader biasa (assignment.tenaga_kesehatan/.kader saling eksklusif, lihat types/api.ts).
function companionLabel(task: VisitAssignment): string {
  if (task.tenaga_kesehatan) return `Anda mendampingi tenaga kesehatan ${task.tenaga_kesehatan.name ?? ''}`.trim()
  return `Anda mendampingi ${task.kader?.name ?? 'kader lain'}`
}

const getRiskColor = (risk: RiskLevel) => {
  if (risk === 'berat') return 'text-danger bg-danger/10 border-danger/20'
  if (risk === 'sedang') return 'text-warning bg-warning/10 border-warning/20'
  if (risk === 'ringan') return 'text-success bg-success/10 border-success/20'
  return 'text-slate-600 bg-slate-100 border-slate-200'
}

const STATUS_LABELS: Record<AssignmentStatus, string> = {
  pending: 'Belum Dikunjungi',
  in_progress: 'Berlangsung',
  completed: 'Selesai',
  cancelled: 'Dibatalkan'
}

function formatDueDate(dateStr: string): string {
  if (isToday(dateStr)) return 'Hari Ini'
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (dateStr === tomorrow.toISOString().slice(0, 10)) return 'Besok'
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()

const showActionSheet = ref(false)
const selectedTask = ref<VisitAssignment | null>(null)

const openAction = (task: VisitAssignment) => {
  selectedTask.value = task
  showActionSheet.value = true
}

// Kebijakan submitReport (VisitAssignmentPolicy) -- HANYA kader primer boleh submit laporan,
// pendamping (companion) tidak diotorisasi backend meski ikut hadir secara fisik.
const canSubmitReport = computed(() => {
  const t = selectedTask.value
  if (!t) return false
  return t.role_in_assignment !== 'companion' && ['pending', 'in_progress'].includes(t.status)
})

const swipeY = ref(0)
const isDragging = ref(false)
let startY = 0

const handleTouchStart = (e: PointerEvent) => {
  startY = e.clientY || 0
  isDragging.value = true
}

const handleTouchMove = (e: PointerEvent) => {
  if (!isDragging.value) return
  const currentY = e.clientY || 0
  if (currentY - startY > 5) {
    swipeY.value = currentY - startY
  }
}

const handleTouchEnd = () => {
  if (!isDragging.value) return
  isDragging.value = false
  if (swipeY.value > 100) {
    showActionSheet.value = false
  }
  swipeY.value = 0
}
</script>

<template>
  <div>
  <div class="px-5 pt-8 pb-4 bg-white dark:bg-slate-900 sticky top-0 z-40 border-b border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-extrabold text-accent dark:text-white transition-colors">Tugas Kunjungan</h1>
      <NuxtLink to="/app/draft" class="relative bg-slate-100 dark:bg-slate-800 p-2 rounded-full text-slate-500 dark:text-slate-400 active:scale-95 transition-all">
        <LucideCloudOff class="w-5 h-5" />
        <!-- Badge indicator -- cuma tampil kalau benar ada draft belum terkirim -->
        <span v-if="draftCount > 0" class="absolute -top-1 -right-1 flex h-3.5 w-3.5">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-warning border-2 border-white dark:border-slate-900"></span>
        </span>
      </NuxtLink>
    </div>

    <!-- Custom Tabs -->
    <div class="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors duration-300">
      <button
        @click="activeTab = 'semua'"
        class="flex-1 py-2 text-base font-bold rounded-lg transition-all"
        :class="activeTab === 'semua' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
      >
        Semua
      </button>
      <button
        @click="activeTab = 'hari_ini'"
        class="flex-1 py-2 text-base font-bold rounded-lg transition-all"
        :class="activeTab === 'hari_ini' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
      >
        Hari Ini ({{ todayCount }})
      </button>
      <button
        @click="activeTab = 'selesai'"
        class="flex-1 py-2 text-base font-bold rounded-lg transition-all"
        :class="activeTab === 'selesai' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
      >
        Selesai ({{ selesaiCount }})
      </button>
    </div>
  </div>

  <div class="p-5 space-y-4">
    <!-- docs/planning/12: fetch terakhir gagal karena jaringan mati, ini data tersimpan terakhir
         dari IndexedDB (useOfflineCache) -- bukan basi tanpa peringatan, kader perlu tahu ini
         bukan hasil GET yang baru saja sukses. Di LUAR rantai v-if/v-else di bawah (bukan
         v-else-if) supaya tidak memutus rantainya -- tetap tampil berbarengan dengan daftarnya. -->
    <div v-if="assignmentStore.loadedFromCache && !assignmentStore.isLoading" class="flex items-center gap-2 text-sm font-semibold text-info bg-info/10 border border-info/20 rounded-2xl px-4 py-2.5">
      <LucideDatabaseZap class="w-4 h-4 shrink-0" />
      <span>Menampilkan data tersimpan (offline) — mungkin tidak terbaru.</span>
    </div>

    <!-- Loading -->
    <div v-if="assignmentStore.isLoading" class="flex flex-col items-center justify-center py-16 text-slate-400">
      <LucideLoader2 class="w-8 h-8 animate-spin mb-3" />
      <p class="text-base font-medium">Memuat tugas kunjungan...</p>
    </div>

    <p v-else-if="assignmentStore.loadError" class="text-base font-semibold text-danger bg-danger/10 border border-danger/20 rounded-2xl px-4 py-3">
      {{ assignmentStore.loadError }}
    </p>

    <div v-else-if="filteredTasks.length === 0" class="flex flex-col items-center justify-center py-16 text-slate-400 text-center">
      <LucideClipboardCheck class="w-10 h-10 mb-3 text-slate-300" />
      <p class="text-base font-medium">Tidak ada tugas kunjungan di kategori ini.</p>
    </div>

    <!-- Task Cards -->
    <div v-for="task in filteredTasks" :key="task.id" class="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 active:scale-[0.98] transition-all relative overflow-hidden duration-300">
      <!-- Decorative Risk Indicator Edge -->
      <div class="absolute left-0 top-0 bottom-0 w-1.5" :class="task.priority === 'berat' ? 'bg-danger' : task.priority === 'sedang' ? 'bg-warning' : 'bg-success'"></div>

      <!-- Kunjungan berombongan: tugas ini milik kader lain, user login cuma mendampingi --
           ditandai jelas beda dari tugas milik sendiri (docs/planning/02 §16). -->
      <div v-if="task.role_in_assignment === 'companion'" class="flex items-center gap-2 mb-3 pl-2 -mt-1">
        <span class="inline-flex items-center gap-1.5 bg-info/10 text-info border border-info/20 px-2.5 py-1 rounded-full text-base font-bold">
          <LucideUsers class="w-4 h-4" />
          {{ companionLabel(task) }}
        </span>
      </div>

      <!-- Diulang: laporan sebelumnya ditolak Super Admin, assignment dibuka lagi
           (docs/planning/02 §11) -- beda jelas dari tugas baru biasa. -->
      <div v-if="isRepeat(task)" class="flex items-center gap-2 mb-3 pl-2 -mt-1">
        <span class="inline-flex items-center gap-1.5 bg-warning/10 text-warning border border-warning/20 px-2.5 py-1 rounded-full text-base font-bold">
          <LucideRotateCcw class="w-4 h-4" />
          Diulang &mdash; Laporan Sebelumnya Ditolak
        </span>
      </div>

      <div class="flex items-start justify-between mb-4 pl-2">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-sm border shrink-0" :class="getRiskColor(task.priority)">
            {{ initials(task.patient?.nama ?? '?') }}
          </div>
          <div>
            <h3 class="font-bold text-slate-800 dark:text-white leading-tight transition-colors">{{ task.patient?.nama ?? 'Pasien tidak diketahui' }}</h3>
            <p v-if="task.status !== 'pending'" class="text-base text-slate-500 dark:text-slate-400 font-medium transition-colors">{{ STATUS_LABELS[task.status] }}</p>
            <p v-else-if="task.assignment_method === 'phone_contact'" class="text-base text-warning-700 font-medium transition-colors">Lokasi belum diketahui &mdash; hubungi via telepon</p>
          </div>
        </div>
        <span class="px-2 py-1 rounded-md text-base font-bold uppercase tracking-wider border" :class="getRiskColor(task.priority)">
          Risiko {{ task.priority }}
        </span>
      </div>

      <!-- Alasan penolakan (validation_note) -- supaya kader tahu persis apa yang perlu
           diperbaiki sebelum mengulang kunjungan, bukan cuma tahu "ditolak". -->
      <div v-if="isRepeat(task) && task.report?.validation_note" class="mb-4 pl-2">
        <div class="bg-warning/5 border border-warning/20 rounded-xl px-3.5 py-2.5">
          <p class="text-[11px] font-bold text-warning-700 uppercase tracking-wide mb-0.5">Catatan dari Super Admin</p>
          <p class="text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{{ task.report.validation_note }}</p>
        </div>
      </div>

      <div class="pl-2 space-y-2.5 mb-5">
        <div class="flex items-start gap-2.5">
          <LucideMapPin class="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5 transition-colors" />
          <p class="text-base font-medium text-slate-600 dark:text-slate-300 leading-relaxed transition-colors">{{ task.patient?.alamat || 'Alamat belum tercatat' }}</p>
        </div>
        <div class="flex items-center gap-2.5">
          <LucideClock class="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 transition-colors" />
          <p class="text-base font-bold transition-colors" :class="formatDueDate(task.scheduled_date) === 'Hari Ini' ? 'text-danger' : 'text-slate-600 dark:text-slate-300'">Tenggat: {{ formatDueDate(task.scheduled_date) }}</p>
        </div>
      </div>

      <div class="pl-2">
        <button @click="openAction(task)" class="w-full py-3 bg-primary/10 dark:bg-primary/20 text-primary hover:bg-primary hover:text-white rounded-xl font-bold text-base transition-colors flex items-center justify-center gap-2">
          <LucideClipboardEdit class="w-4 h-4" />
          {{ task.status === 'completed' ? 'Lihat Detail' : 'Mulai Kunjungan' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Overlay Background -->
  <Transition
    enter-active-class="transition-opacity duration-300"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-200"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="showActionSheet" class="fixed inset-0 z-[50] bg-slate-900/40 dark:bg-slate-900/80 backdrop-blur-sm transition-colors" @click="showActionSheet = false"></div>
  </Transition>

  <!-- Action Sheet (Bottom Sheet) -->
  <Transition
    :duration="600"
    enter-from-class="translate-y-full"
    enter-to-class="translate-y-0"
    leave-from-class="translate-y-0"
    leave-to-class="translate-y-full"
  >
    <div v-if="showActionSheet"
         class="fixed inset-x-0 bottom-0 z-[60] mx-auto w-full bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border border-slate-100 dark:border-slate-800 transform transition-transform duration-[600ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-transform touch-none"
         :style="isDragging ? { transform: `translate3d(0, ${swipeY}px, 0)`, transition: 'none' } : {}"
         @pointerdown="handleTouchStart"
         @pointermove="handleTouchMove"
         @pointerup="handleTouchEnd"
         @pointerleave="handleTouchEnd">

        <div class="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
           <div class="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full transition-colors"></div>
        </div>

        <div class="p-6 pt-2">
           <div class="mb-5">
             <div v-if="selectedTask?.role_in_assignment === 'companion'" class="mb-2">
                <span class="inline-flex items-center gap-1.5 bg-info/10 text-info border border-info/20 px-2.5 py-1 rounded-full text-sm font-bold">
                   <LucideUsers class="w-4 h-4" />
                   {{ companionLabel(selectedTask) }}
                </span>
             </div>
             <div v-if="selectedTask && isRepeat(selectedTask)" class="mb-2">
                <span class="inline-flex items-center gap-1.5 bg-warning/10 text-warning border border-warning/20 px-2.5 py-1 rounded-full text-sm font-bold">
                   <LucideRotateCcw class="w-4 h-4" />
                   Diulang &mdash; Laporan Sebelumnya Ditolak
                </span>
             </div>
             <div class="flex items-center justify-between mb-1">
                <h3 class="text-xl font-black text-slate-800 dark:text-white transition-colors">{{ selectedTask?.patient?.nama ?? '-' }}</h3>
                <span class="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border" :class="getRiskColor(selectedTask?.priority ?? 'ringan')">
                   Risiko {{ selectedTask?.priority }}
                </span>
             </div>
             <div class="flex items-start gap-2 mt-2">
                <LucideMapPin class="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5 transition-colors" />
                <p class="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed transition-colors">{{ selectedTask?.patient?.alamat || 'Alamat belum tercatat' }}</p>
             </div>
             <div v-if="selectedTask && isRepeat(selectedTask) && selectedTask.report?.validation_note" class="mt-3 bg-warning/5 border border-warning/20 rounded-xl px-3.5 py-2.5">
                <p class="text-[11px] font-bold text-warning-700 uppercase tracking-wide mb-0.5">Catatan dari Super Admin</p>
                <p class="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{{ selectedTask.report.validation_note }}</p>
             </div>
           </div>

           <div class="flex justify-between items-center mb-3">
             <p class="text-base text-slate-500 dark:text-slate-400 font-medium transition-colors">Pilih tindakan kunjungan.</p>
             <button @click="showActionSheet = false" class="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 active:scale-95 transition-colors">
                <LucideX class="w-4 h-4" />
             </button>
           </div>

           <div class="space-y-3">
              <p v-if="!canSubmitReport && selectedTask?.role_in_assignment === 'companion'" class="text-sm font-semibold text-slate-500 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3">
                Anda hanya mendampingi kunjungan ini &mdash; laporan diisi oleh kader utama.
              </p>
              <p v-else-if="!canSubmitReport" class="text-sm font-semibold text-slate-500 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3">
                Kunjungan ini sudah {{ selectedTask ? STATUS_LABELS[selectedTask.status].toLowerCase() : '' }}.
              </p>
              <NuxtLink v-else :to="`/app/kunjungan/${selectedTask?.id}`" class="w-full flex items-center justify-between p-4 bg-primary text-white rounded-2xl font-bold active:scale-[0.98] transition-transform shadow-sm shadow-primary/20">
                 <div class="flex items-center gap-3">
                    <LucideClipboardCheck class="w-5 h-5" />
                    Input Hasil Tensi & Laporan
                 </div>
                 <LucideChevronRight class="w-5 h-5 opacity-70" />
              </NuxtLink>

              <button
                :disabled="!selectedTask?.patient?.latitude || !selectedTask?.patient?.longitude"
                :class="[
                  'w-full flex items-center justify-between p-4 rounded-2xl font-bold transition-all shadow-sm',
                  selectedTask?.patient?.latitude && selectedTask?.patient?.longitude
                    ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 active:bg-slate-50 dark:active:bg-slate-700'
                    : 'bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                ]"
              >
                 <div class="flex items-center gap-3">
                    <LucideMapPin class="w-5 h-5 transition-colors" :class="selectedTask?.patient?.latitude ? 'text-slate-400 dark:text-slate-500' : 'text-slate-300 dark:text-slate-600'" />
                    Lihat Koordinat Rumah
                 </div>
                 <LucideChevronRight class="w-5 h-5 transition-colors" :class="selectedTask?.patient?.latitude ? 'text-slate-300 dark:text-slate-600' : 'text-slate-200 dark:text-slate-700'" />
              </button>

              <a target="_blank" :href="`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((selectedTask?.patient?.alamat || selectedTask?.patient?.nama || '') + ', Kab. Sumenep')}`" class="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-bold active:bg-slate-50 dark:active:bg-slate-700 transition-colors shadow-sm">
                 <div class="flex items-center gap-3">
                    <LucideMap class="w-5 h-5 text-blue-500 transition-colors" />
                    Lihat Wilayah Pasien (Gmaps)
                 </div>
                 <LucideExternalLink class="w-5 h-5 text-slate-400 dark:text-slate-500 transition-colors" />
              </a>

              <div v-if="selectedTask?.patient?.phone" class="flex gap-3 w-full">
                <a :href="`https://wa.me/${selectedTask.patient.phone}?text=${encodeURIComponent('Halo Bapak/Ibu ' + selectedTask.patient.nama + ', kami dari Puskesmas ingin mengkonfirmasi jadwal kunjungan pemeriksaan kesehatan. Apakah Bapak/Ibu sedang berada di rumah?')}`" target="_blank" class="flex-1 flex items-center justify-center gap-2 p-3.5 bg-[#25D366]/10 text-[#1da851] border border-[#25D366]/20 rounded-2xl font-bold active:bg-[#25D366]/20 transition-colors shadow-sm">
                  <LucideMessageCircle class="w-5 h-5" />
                  WhatsApp
                </a>
                <a :href="`tel:+${selectedTask.patient.phone}`" class="flex-1 flex items-center justify-center gap-2 p-3.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-2xl font-bold active:bg-blue-500/20 transition-colors shadow-sm">
                  <LucidePhone class="w-5 h-5" />
                  Telepon
                </a>
              </div>

              <button @click="showActionSheet = false" class="w-full py-4 mt-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-bold active:bg-slate-200 dark:active:bg-slate-700 transition-colors">
                 Batal
              </button>
           </div>
        </div>
     </div>
  </Transition>
  </div>
</template>
