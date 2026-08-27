<script setup lang="ts">
import type { ApiSuccessEnvelope, DashboardSummary, DashboardKecamatanRisk } from '~/types/api'

// Halaman "Selengkapnya" dari widget "5 Kecamatan Risiko Tertinggi" di /dashboard (permintaan
// user -- tombol itu sebelumnya tidak diberi handler apa pun, dead button). Data SENGAJA dari
// risiko_per_kecamatan_se_kabupaten (unscoped, sama seperti widget-nya) -- perbandingan
// SE-KABUPATEN untuk semua role, bukan cuma wilayah puskesmas sendiri.
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
useHead({
  title: 'Risiko per Kecamatan'
})

const rows = ref<DashboardKecamatanRisk[]>([])
const isLoading = ref(false)
const loadError = ref('')

async function loadData() {
  isLoading.value = true
  loadError.value = ''
  try {
    const api = useApi()
    const res = await api('/dashboard/summary') as ApiSuccessEnvelope<DashboardSummary>
    // Urutan SAMA PERSIS dgn widget dashboard (berat desc, lalu total desc sbg tie-break).
    rows.value = [...res.data.risiko_per_kecamatan_se_kabupaten].sort(
      (a, b) => (b.berat - a.berat) || ((b.berat + b.sedang + b.ringan) - (a.berat + a.sedang + a.ringan))
    )
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Gagal memuat data risiko per kecamatan.'
  } finally {
    isLoading.value = false
  }
}
onMounted(loadData)

function total(row: DashboardKecamatanRisk): number {
  return row.berat + row.sedang + row.ringan
}
</script>

<template>
  <div class="space-y-6">
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
      <NuxtLink to="/dashboard" class="hover:text-primary transition-colors">Dashboard</NuxtLink>
      <LucideChevronRight class="w-3 h-3" />
      <span class="text-slate-600">Risiko per Kecamatan</span>
    </div>

    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-extrabold text-accent flex items-center gap-2">
          <LucideBarChart4 class="w-6 h-6 text-warning" />
          Risiko per Kecamatan
        </h1>
        <p class="text-sm text-slate-500 mt-1">Seluruh kecamatan di Kabupaten Sumenep, diurutkan dari risiko Berat tertinggi.</p>
      </div>
      <NuxtLink to="/dashboard" class="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
        <LucideArrowLeft class="w-4 h-4" /> Kembali ke Dashboard
      </NuxtLink>
    </div>

    <div class="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
      <div v-if="isLoading" class="p-12 text-center text-slate-400">
        <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
        Memuat data...
      </div>
      <p v-else-if="loadError" class="p-8 text-center text-danger font-semibold">{{ loadError }}</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <th class="py-3 px-5 font-semibold w-12">#</th>
              <th class="py-3 px-5 font-semibold">Kecamatan</th>
              <th class="py-3 px-5 font-semibold text-right">Berat</th>
              <th class="py-3 px-5 font-semibold text-right">Sedang</th>
              <th class="py-3 px-5 font-semibold text-right">Ringan</th>
              <th class="py-3 px-5 font-semibold text-right">Total</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="(row, idx) in rows" :key="row.kecamatan_id" class="hover:bg-slate-50 transition-colors">
              <td class="py-3 px-5 text-sm font-bold text-slate-400">{{ idx + 1 }}</td>
              <td class="py-3 px-5 text-sm font-semibold text-slate-800">{{ row.kecamatan_nama }}</td>
              <td class="py-3 px-5 text-sm font-bold text-danger text-right">{{ row.berat }}</td>
              <td class="py-3 px-5 text-sm font-bold text-warning text-right">{{ row.sedang }}</td>
              <td class="py-3 px-5 text-sm font-bold text-success text-right">{{ row.ringan }}</td>
              <td class="py-3 px-5 text-sm font-bold text-accent text-right">{{ total(row) }}</td>
            </tr>
            <tr v-if="!rows.length">
              <td colspan="6" class="py-10 text-center text-sm text-slate-400">Belum ada data risiko per kecamatan.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
