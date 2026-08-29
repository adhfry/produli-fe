<script setup lang="ts">
import type { PengirimanSampel } from '~/types/api'

definePageMeta({
  layout: 'pwa',
  middleware: 'auth'
})
useHead({
  title: 'Tugas Antar Sampel'
})

const list = ref<PengirimanSampel[]>([])
const isLoading = ref(true)
const loadError = ref('')

const STATUS_LABELS: Record<string, string> = {
  ditugaskan: 'Menunggu Diberangkatkan',
  otw: 'Sedang Perjalanan',
  tiba_labkesda: 'Sudah Tiba',
  dikonfirmasi_labkesda: 'Dikonfirmasi Labkesda'
}
const STATUS_COLORS: Record<string, string> = {
  ditugaskan: 'bg-warning/10 text-warning',
  otw: 'bg-primary/10 text-primary',
  tiba_labkesda: 'bg-success/10 text-success',
  dikonfirmasi_labkesda: 'bg-success/10 text-success'
}

async function loadList() {
  isLoading.value = true
  loadError.value = ''
  try {
    const api = useApi()
    const res = await api('/pengiriman-sampel/mine') as { data: { items: PengirimanSampel[] } }
    list.value = res.data.items
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Gagal memuat daftar tugas.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadList)
</script>

<template>
  <div class="p-4 space-y-4 pb-24">
    <h1 class="text-xl font-black text-slate-800 dark:text-white">Tugas Antar Sampel</h1>
    <p v-if="loadError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-4 py-3">{{ loadError }}</p>

    <div v-if="isLoading" class="py-16 text-center text-slate-400">
      <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
      Memuat...
    </div>

    <div v-else-if="list.length === 0" class="py-16 text-center text-slate-400">
      <LucideTruck class="w-10 h-10 mx-auto mb-3 text-slate-300" />
      <p class="font-medium">Belum ada tugas antar sampel untuk Anda.</p>
    </div>

    <NuxtLink
      v-for="item in list"
      :key="item.id"
      :to="`/app/pengiriman/${item.id}`"
      class="block bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 active:scale-[0.98] transition-transform"
    >
      <div class="flex items-center justify-between mb-2">
        <span class="font-bold text-slate-800 dark:text-white">{{ item.puskesmas?.nama }}</span>
        <span class="text-[11px] font-bold px-2.5 py-1 rounded-full" :class="STATUS_COLORS[item.status]">
          {{ STATUS_LABELS[item.status] ?? item.status }}
        </span>
      </div>
      <p class="text-sm text-slate-500 dark:text-slate-400">{{ item.jumlah_pasien ?? item.pasien?.length ?? 0 }} pasien Prolanis</p>
    </NuxtLink>
  </div>
</template>
