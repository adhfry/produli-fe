<script setup lang="ts">
import type { ApiSuccessEnvelope, KaderUpdateRequest, PaginatedData } from '~/types/api'

definePageMeta({
  layout: 'pwa',
  middleware: 'auth'
})
useHead({
  title: 'Riwayat Pengajuan Perubahan Data'
})

// GET /kader/update-requests ATAU /tenaga-kesehatan/update-requests (tergantung role, revisi Bu
// Kadis PMO) -- riwayat usulan pembaruan data pasien yang PERNAH DIAJUKAN kader/tenaga_kesehatan
// ini sendiri saat kunjungan (docs/planning/01 §9), BUKAN daftar tugas/kunjungan biasa. Cuma
// laporan kunjungan yang benar-benar mengusulkan sesuatu (geo dikonfirmasi atau field lain
// diisi) yang muncul di sini -- lihat catatan lengkap di KaderController::updateRequests.
const authStore = useAuthStore()
const updateRequestsEndpoint = computed(() => (authStore.roles?.includes('tenaga_kesehatan') ? '/tenaga-kesehatan/update-requests' : '/kader/update-requests'))

const requests = ref<KaderUpdateRequest[]>([])
const currentPage = ref(1)
const lastPage = ref(1)
const isLoading = ref(false)
const loadError = ref('')

async function loadRequests(page = 1) {
  isLoading.value = true
  loadError.value = ''
  try {
    const api = useApi()
    const res = await api(updateRequestsEndpoint.value, { query: { per_page: 20, page } }) as ApiSuccessEnvelope<PaginatedData<KaderUpdateRequest>>
    requests.value = res.data.items
    currentPage.value = res.data.pagination.current_page
    lastPage.value = res.data.pagination.last_page
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Gagal memuat riwayat pengajuan.'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => loadRequests())

// Reload otomatis begitu sinkronisasi SiLAKES berhasil (dipicu super_admin dari sidebar
// dashboard) -- status persetujuan usulan bisa berubah dari pending_review begitu staf
// Labkesda approve/reject, kader perlu lihat status terbaru tanpa refresh manual.
const silakesSyncSignal = useSilakesSyncSignal()
watch(silakesSyncSignal, () => loadRequests(currentPage.value))

function goToPage(page: number) {
  if (page < 1 || page > lastPage.value || page === currentPage.value || isLoading.value) return
  loadRequests(page)
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const PUSH_STATUS_META: Record<string, { label: string; class: string }> = {
  pending: { label: 'Sedang Dikirim', class: 'bg-warning/10 text-warning border-warning/20' },
  synced: { label: 'Terkirim ke SiLAKES', class: 'bg-info/10 text-info border-info/20' },
  failed: { label: 'Gagal Terkirim', class: 'bg-danger/10 text-danger border-danger/20' }
}

const FIELD_STATUS_META: Record<string, { label: string; class: string }> = {
  pending_review: { label: 'Menunggu Peninjauan', class: 'bg-warning/10 text-warning border-warning/20' },
  approved: { label: 'Disetujui', class: 'bg-success/10 text-success border-success/20' },
  rejected: { label: 'Ditolak', class: 'bg-danger/10 text-danger border-danger/20' }
}

const KATEGORI_LABELS: Record<string, string> = { geo: 'Titik Lokasi', kontak: 'Kontak/Alamat', identitas: 'Identitas' }

function fieldLabel(field: { kategori: string, field_name: string | null }): string {
  if (field.kategori === 'geo') return 'Titik Lokasi Rumah'
  return field.field_name ?? KATEGORI_LABELS[field.kategori] ?? field.kategori
}

// Ringkasan status keseluruhan 1 kunjungan -- kalau ADA satu saja field yang masih
// pending_review, tampilkan "menunggu" (paling relevan buat kader tahu apa yang masih
// ditunggu); kalau SEMUA sudah diputuskan, tampilkan approved cuma kalau semuanya approved,
// selain itu "ada yang ditolak" -- supaya kader tidak perlu buka detail tiap field cuma
// untuk tahu ringkasannya.
function overallFieldStatus(request: KaderUpdateRequest): 'pending_review' | 'approved' | 'rejected' | null {
  if (request.fields.length === 0) return null
  if (request.fields.some((f) => f.status === 'pending_review')) return 'pending_review'
  if (request.fields.every((f) => f.status === 'approved')) return 'approved'
  return 'rejected'
}
</script>

<template>
  <div>
    <div class="px-5 pt-8 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-sm sticky top-0 z-40 transition-colors duration-300 flex items-center gap-3">
      <NuxtLink to="/app/profil" class="text-slate-400 dark:text-slate-500 active:text-primary transition-colors shrink-0">
        <LucideChevronLeft class="w-6 h-6" />
      </NuxtLink>
      <h1 class="text-xl font-extrabold text-accent dark:text-white transition-colors">Riwayat Pengajuan Perubahan Data</h1>
    </div>

    <div class="p-5">
      <p class="text-base text-slate-500 dark:text-slate-400 font-medium mb-5 leading-relaxed">
        Daftar usulan perubahan/pelengkapan data pasien yang pernah Anda ajukan saat kunjungan.
      </p>

      <div v-if="isLoading && requests.length === 0" class="py-16 text-center text-slate-400 dark:text-slate-500">
        <LucideLoader2 class="w-8 h-8 mx-auto mb-3 animate-spin" />
        <p class="font-medium">Memuat riwayat pengajuan...</p>
      </div>

      <div v-else-if="loadError" class="bg-danger/10 border border-danger/20 rounded-2xl p-5 text-center">
        <LucideAlertTriangle class="w-8 h-8 mx-auto mb-2 text-danger" />
        <p class="text-sm font-semibold text-danger">{{ loadError }}</p>
      </div>

      <div v-else-if="requests.length === 0" class="py-16 text-center text-slate-400 dark:text-slate-500">
        <LucideHistory class="w-12 h-12 mx-auto mb-3 text-slate-200 dark:text-slate-700" />
        <p class="font-medium">Belum ada pengajuan perubahan data pasien.</p>
        <p class="text-sm mt-1">Muncul di sini setelah Anda mengonfirmasi lokasi rumah atau melengkapi data pasien saat kunjungan.</p>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="request in requests"
          :key="request.visit_report_id"
          class="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden transition-colors duration-300"
        >
          <!-- Header kunjungan -->
          <div class="p-4 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between gap-3">
            <div>
              <p class="font-bold text-slate-800 dark:text-white">{{ request.patient_nama }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{{ formatDate(request.kunjungan_tanggal) }}</p>
            </div>
            <span
              class="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border shrink-0 flex items-center gap-1"
              :class="PUSH_STATUS_META[request.push_status]?.class"
            >
              <LucideLoader2 v-if="request.push_status === 'pending'" class="w-3 h-3 animate-spin" />
              <LucideAlertTriangle v-else-if="request.push_status === 'failed'" class="w-3 h-3" />
              <LucideCheckCircle2 v-else class="w-3 h-3" />
              {{ PUSH_STATUS_META[request.push_status]?.label ?? request.push_status }}
            </span>
          </div>

          <!-- Gagal terkirim -- tampilkan alasannya, senior-friendly (bukan pesan teknis mentah) -->
          <div v-if="request.push_status === 'failed'" class="px-4 pt-3 text-xs text-danger bg-danger/5">
            Usulan ini gagal terkirim ke SiLAKES. Sistem akan mencoba lagi secara otomatis.
          </div>

          <!-- Ringkasan status persetujuan (kalau sudah terkirim) -->
          <div v-if="request.push_status === 'synced' && overallFieldStatus(request)" class="px-4 pt-3">
            <span
              class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border"
              :class="FIELD_STATUS_META[overallFieldStatus(request)!]?.class"
            >
              {{ FIELD_STATUS_META[overallFieldStatus(request)!]?.label }}
            </span>
          </div>

          <!-- Detail per field yang diusulkan -->
          <div v-if="request.fields.length > 0" class="divide-y divide-slate-50 dark:divide-slate-700/50">
            <div v-for="(field, idx) in request.fields" :key="idx" class="p-4 flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-slate-700 dark:text-slate-200">{{ fieldLabel(field) }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 break-words">
                  <span class="line-through text-slate-400 dark:text-slate-600">{{ field.old_value || '(kosong)' }}</span>
                  <span class="mx-1">&rarr;</span>
                  <span class="font-semibold text-slate-600 dark:text-slate-300">{{ field.new_value || '-' }}</span>
                </p>
                <p v-if="field.catatan_reviewer" class="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">"{{ field.catatan_reviewer }}"</p>
              </div>
              <span
                class="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border shrink-0"
                :class="FIELD_STATUS_META[field.status]?.class"
              >
                {{ FIELD_STATUS_META[field.status]?.label }}
              </span>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="lastPage > 1" class="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            :disabled="currentPage <= 1 || isLoading"
            @click="goToPage(currentPage - 1)"
            class="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 transition-colors"
          >
            <LucideChevronLeft class="w-5 h-5" />
          </button>
          <span class="text-sm font-semibold text-slate-600 dark:text-slate-300 px-2">{{ currentPage }} / {{ lastPage }}</span>
          <button
            type="button"
            :disabled="currentPage >= lastPage || isLoading"
            @click="goToPage(currentPage + 1)"
            class="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 transition-colors"
          >
            <LucideChevronRight class="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
