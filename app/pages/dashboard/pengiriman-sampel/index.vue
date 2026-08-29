<script setup lang="ts">
import type { PengirimanSampel } from '~/types/api'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
useHead({
  title: 'Pengiriman Sampel ke Labkesda'
})

const authStore = useAuthStore()
const isSuperAdmin = computed(() => (authStore.roles ?? []).includes('super_admin'))

const list = ref<PengirimanSampel[]>([])
const isLoading = ref(false)
const loadError = ref('')

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draf',
  terkunci: 'Terkunci',
  ditugaskan: 'Ditugaskan',
  otw: 'OTW ke Labkesda',
  tiba_labkesda: 'Tiba di Labkesda',
  dikonfirmasi_labkesda: 'Dikonfirmasi Labkesda',
  dibatalkan: 'Dibatalkan'
}
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  terkunci: 'bg-primary/10 text-primary border-primary/20',
  ditugaskan: 'bg-warning/10 text-warning border-warning/20',
  otw: 'bg-warning/10 text-warning border-warning/20',
  tiba_labkesda: 'bg-success/10 text-success border-success/20',
  dikonfirmasi_labkesda: 'bg-success/10 text-success border-success/20',
  dibatalkan: 'bg-danger/10 text-danger border-danger/20'
}

async function loadList() {
  isLoading.value = true
  loadError.value = ''
  try {
    const api = useApi()
    list.value = await fetchAllPages((page) => api('/pengiriman-sampel', { query: { per_page: 100, page } }))
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Gagal memuat daftar pengiriman sampel.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadList)

const isCreating = ref(false)
const createError = ref('')

async function createBatch() {
  isCreating.value = true
  createError.value = ''
  try {
    const api = useApi()
    const res = await api('/pengiriman-sampel', { method: 'POST' }) as { data: PengirimanSampel }
    await navigateTo(`/dashboard/pengiriman-sampel/${res.data.id}`)
  } catch (e) {
    createError.value = e instanceof ApiError ? e.message : 'Gagal membuat antrian baru.'
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <div class="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wider">
        <NuxtLink to="/dashboard" class="hover:text-primary transition-colors">Dashboard</NuxtLink>
        <LucideChevronRight class="w-3 h-3" />
        <span class="text-slate-600">Pengiriman Sampel ke Labkesda</span>
      </div>
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-extrabold text-accent">Pengiriman Sampel ke Labkesda</h1>
          <p class="text-sm text-slate-500 mt-1">Susun antrian pasien Prolanis yang akan dikirim ke Labkesda Sumenep.</p>
          <p v-if="loadError" class="text-xs font-semibold text-danger mt-1">{{ loadError }}</p>
          <p v-if="createError" class="text-xs font-semibold text-danger mt-1">{{ createError }}</p>
        </div>
        <button
          @click="createBatch"
          :disabled="isCreating"
          class="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-sm"
        >
          <LucideLoader2 v-if="isCreating" class="w-4 h-4 animate-spin" />
          <LucidePlus v-else class="w-4 h-4" />
          <span>Buat Antrian Baru</span>
        </button>
      </div>
    </div>

    <div class="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <th class="py-4 px-5 font-semibold">Tanggal Dibuat</th>
              <th v-if="isSuperAdmin" class="py-4 px-5 font-semibold">Puskesmas</th>
              <th class="py-4 px-5 font-semibold text-center">Jumlah Pasien</th>
              <th class="py-4 px-5 font-semibold text-center">Status</th>
              <th class="py-4 px-5 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="isLoading && list.length === 0">
              <td :colspan="isSuperAdmin ? 5 : 4" class="py-12 text-center text-slate-400">
                <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
                Memuat data...
              </td>
            </tr>
            <tr v-for="item in list" :key="item.id" class="hover:bg-slate-50/80 transition-colors">
              <td class="py-4 px-5 text-sm font-semibold text-slate-700">
                {{ new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) }}
              </td>
              <td v-if="isSuperAdmin" class="py-4 px-5 text-sm font-bold text-slate-700">{{ item.puskesmas?.nama || '-' }}</td>
              <td class="py-4 px-5 text-center text-sm font-bold text-slate-700">{{ item.jumlah_pasien ?? 0 }}</td>
              <td class="py-4 px-5 text-center">
                <span class="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border" :class="STATUS_COLORS[item.status]">
                  {{ STATUS_LABELS[item.status] }}
                </span>
              </td>
              <td class="py-4 px-5 text-right">
                <NuxtLink
                  :to="`/dashboard/pengiriman-sampel/${item.id}`"
                  class="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                >
                  Buka <LucideChevronRight class="w-3.5 h-3.5" />
                </NuxtLink>
              </td>
            </tr>
            <tr v-if="!isLoading && list.length === 0">
              <td :colspan="isSuperAdmin ? 5 : 4" class="py-12 text-center">
                <div class="flex flex-col items-center justify-center text-slate-400">
                  <LucideTruck class="w-10 h-10 mb-3 text-slate-300" />
                  <p class="font-medium">Belum ada antrian pengiriman sampel.</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
