<script setup lang="ts">
import type { VisitAssignment } from '~/types/api'

definePageMeta({
  layout: 'pwa',
  middleware: 'auth'
})
useHead({
  title: 'Riwayat Kunjungan Saya'
})

// GET /visit-assignments SUDAH ter-scope backend ke kader/nakes yang login sendiri
// (VisitAssignmentService::scopedQuery) dan sudah eager-load latestReport lengkap (photo_url,
// validation_status, dst -- VisitAssignmentController::index()) -- reuse assignmentStore yang
// sama dipakai /app/tugas, tidak perlu endpoint baru sama sekali.
const assignmentStore = useAssignmentStore()
onMounted(() => assignmentStore.fetchAll())

// Riwayat = kunjungan yang SUDAH selesai dikunjungi (ada laporan tersimpan) -- pending/
// in_progress/cancelled bukan "riwayat", itu tugas yang belum/tidak jadi dikerjakan (sudah ada
// tempatnya sendiri di /app/tugas).
const completedVisits = computed(() =>
  [...assignmentStore.assignments]
    .filter((a) => a.status === 'completed' && a.report)
    .sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime())
)

const VALIDATION_LABELS: Record<string, string> = {
  pending: 'Menunggu Validasi Admin', valid: 'Divalidasi Admin', invalid: 'Ditolak Admin'
}
const VALIDATION_COLORS: Record<string, string> = {
  pending: 'bg-warning/10 text-warning-700 border border-warning/20',
  valid: 'bg-success/10 text-success border border-success/20',
  invalid: 'bg-danger/10 text-danger border border-danger/20'
}

const TINDAKAN_LABELS: Record<string, string> = {
  diberi_obat: 'Diberi Obat', dirujuk_puskesmas: 'Dirujuk ke Puskesmas', tidak_ada: 'Tidak Ada Tindakan'
}
function formatTindakan(tindakan: string[] | null): string {
  if (!tindakan?.length) return '-'
  return tindakan.map((t) => TINDAKAN_LABELS[t] ?? t).join(', ')
}

const expandedId = ref<number | null>(null)
function toggleExpand(visit: VisitAssignment) {
  expandedId.value = expandedId.value === visit.id ? null : visit.id
}

const previewPhotoUrl = ref<string | null>(null)
</script>

<template>
  <div class="pb-8">
    <div class="px-5 pt-8 pb-4 bg-white dark:bg-slate-900 sticky top-0 z-40 border-b border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
      <button @click="$router.back()" class="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-transform shrink-0">
        <LucideArrowLeft class="w-4 h-4" />
      </button>
      <h1 class="text-lg font-extrabold text-accent dark:text-white truncate">Riwayat Kunjungan Saya</h1>
    </div>

    <div v-if="assignmentStore.isLoading" class="flex flex-col items-center justify-center py-16 text-slate-400">
      <LucideLoader2 class="w-8 h-8 animate-spin mb-3" />
      <p class="text-base font-medium">Memuat riwayat kunjungan...</p>
    </div>
    <p v-else-if="assignmentStore.loadError" class="m-5 text-base font-semibold text-danger bg-danger/10 border border-danger/20 rounded-2xl px-4 py-3">{{ assignmentStore.loadError }}</p>

    <div v-else class="p-5 space-y-4">
      <div v-if="completedVisits.length === 0" class="flex flex-col items-center justify-center py-16 text-slate-400 text-center">
        <LucideHistory class="w-10 h-10 mb-3 text-slate-300" />
        <p class="text-base font-medium">Belum ada kunjungan yang selesai dilaporkan.</p>
      </div>

      <div v-for="visit in completedVisits" :key="visit.id" class="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <button type="button" @click="toggleExpand(visit)" class="w-full text-left p-4 flex items-center gap-3 active:bg-slate-50 dark:active:bg-slate-700 transition-colors">
          <img
            v-if="visit.report?.photo_url"
            :src="visit.report.photo_url"
            class="w-16 h-16 rounded-2xl object-cover shrink-0 border border-slate-100 dark:border-slate-700"
            @click.stop="previewPhotoUrl = visit.report!.photo_url"
          />
          <div v-else class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 text-slate-300">
            <LucideImageOff class="w-6 h-6" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-bold text-slate-800 dark:text-white truncate">{{ visit.patient?.nama ?? 'Pasien tidak diketahui' }}</p>
            <p class="text-sm text-slate-500 dark:text-slate-400">{{ new Date(visit.scheduled_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) }}</p>
            <span v-if="visit.report" class="inline-block mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider" :class="VALIDATION_COLORS[visit.report.validation_status] ?? 'bg-slate-100 text-slate-500'">
              {{ VALIDATION_LABELS[visit.report.validation_status] ?? visit.report.validation_status }}
            </span>
          </div>
          <LucideChevronDown class="w-5 h-5 text-slate-400 shrink-0 transition-transform" :class="expandedId === visit.id ? 'rotate-180' : ''" />
        </button>

        <div v-if="expandedId === visit.id && visit.report" class="px-4 pb-4 border-t border-slate-50 dark:border-slate-700 pt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <p v-if="visit.report.validation_note" class="text-warning-700 bg-warning/5 border border-warning/20 rounded-xl px-3 py-2">
            <span class="font-semibold">Catatan Admin:</span> {{ visit.report.validation_note }}
          </p>
          <p><span class="font-semibold text-slate-700 dark:text-slate-200">Kondisi:</span> {{ visit.report.kondisi }}</p>
          <p v-if="visit.report.keluhan"><span class="font-semibold text-slate-700 dark:text-slate-200">Keluhan:</span> {{ visit.report.keluhan }}</p>
          <p v-if="visit.report.catatan"><span class="font-semibold text-slate-700 dark:text-slate-200">Catatan:</span> {{ visit.report.catatan }}</p>

          <div v-if="visit.report.systolic || visit.report.diastolic || visit.report.gda || visit.report.gdp || visit.report.gd2jpp || visit.report.uric_acid || visit.report.cholesterol" class="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            <span v-if="visit.report.systolic || visit.report.diastolic">Tensi: <b>{{ visit.report.systolic ?? '-' }}/{{ visit.report.diastolic ?? '-' }}</b> mmHg</span>
            <span v-if="visit.report.gda">GDA: <b>{{ visit.report.gda }}</b> mg/dL</span>
            <span v-if="visit.report.gdp">GDP: <b>{{ visit.report.gdp }}</b> mg/dL</span>
            <span v-if="visit.report.gd2jpp">GD2JPP: <b>{{ visit.report.gd2jpp }}</b> mg/dL</span>
            <span v-if="visit.report.uric_acid">Asam Urat: <b>{{ visit.report.uric_acid }}</b> mg/dL</span>
            <span v-if="visit.report.cholesterol">Kolesterol: <b>{{ visit.report.cholesterol }}</b> mg/dL</span>
          </div>

          <p v-if="visit.report.tindakan?.length"><span class="font-semibold text-slate-700 dark:text-slate-200">Tindakan:</span> {{ formatTindakan(visit.report.tindakan) }}</p>

          <div v-if="visit.report.kepatuhan_obat || visit.report.sisa_obat" class="flex flex-wrap gap-x-4 gap-y-1">
            <span v-if="visit.report.kepatuhan_obat">Kepatuhan Obat: <b class="capitalize">{{ visit.report.kepatuhan_obat.replace('_', ' ') }}</b></span>
            <span v-if="visit.report.sisa_obat">Sisa Obat: <b class="capitalize">{{ visit.report.sisa_obat }}</b></span>
          </div>

          <button
            v-if="visit.report.photo_url"
            type="button"
            @click="previewPhotoUrl = visit.report.photo_url"
            class="mt-2 w-full py-2.5 bg-primary/10 text-primary rounded-xl font-bold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <LucideImage class="w-4 h-4" />
            Lihat Foto Dokumentasi Ukuran Penuh
          </button>
        </div>
      </div>
    </div>

    <!-- Preview foto ukuran penuh -->
    <Transition name="fade">
      <div v-if="previewPhotoUrl" class="fixed inset-0 z-[90] bg-black/90 flex items-center justify-center p-4" @click="previewPhotoUrl = null">
        <button class="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white active:scale-95 transition-transform">
          <LucideX class="w-5 h-5" />
        </button>
        <img :src="previewPhotoUrl" class="max-w-full max-h-full rounded-2xl object-contain" @click.stop />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
