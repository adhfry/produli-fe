<script setup lang="ts">
import type { ApiSuccessEnvelope, CreateKaderPayload, Kader, PjOption, Puskesmas } from '~/types/api'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
useHead({
  title: 'Data Kader Prolanis'
})

// Role-visibility -- reuse pola dari dashboard/index.vue (isSuperAdmin computed dari
// authStore.roles), bukan mock toggle currentUserRole seperti di dashboard/kunjungan/index.vue.
const authStore = useAuthStore()
const isSuperAdmin = computed(() => (authStore.roles ?? []).includes('super_admin'))
const isAdminPuskesmas = computed(() => (authStore.roles ?? []).includes('admin_puskesmas'))
const isPjProlanis = computed(() => (authStore.roles ?? []).includes('pj_prolanis'))
// KaderPolicy::viewAny/create sama-sama true utk ketiga role ini (tidak ada beda kewenangan
// baca/daftar kader antar super_admin/admin_puskesmas/pj_prolanis) -- gerbang di sini murni
// defensif, bukan mencerminkan pembedaan kewenangan nyata seperti di /dashboard/staf.
const canManageKader = computed(() => isSuperAdmin.value || isAdminPuskesmas.value || isPjProlanis.value)

// GET /api/v1/kader -- KaderPolicy::viewAny scoping (super_admin: semua, admin_puskesmas/
// pj_prolanis: puskesmas sendiri) sudah dilakukan backend, frontend tidak perlu filter ulang.
const kaderList = ref<Kader[]>([])
const isLoading = ref(false)
const loadError = ref('')

async function loadKader() {
  isLoading.value = true
  loadError.value = ''
  try {
    const api = useApi()
    kaderList.value = await fetchAllPages((page) => api('/kader', { query: { per_page: 100, page } }))
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Gagal memuat data kader.'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadKader()
  // Opsi filter puskesmas SEBELUMNYA diturunkan dari kaderList yang sudah dimuat -- kalau
  // kebetulan cuma ada kader di 1 puskesmas (data dev/awal), opsi jadi cuma 1 walau se-kabupaten
  // py 31 puskesmas. Sekarang pakai puskesmasList LENGKAP (sudah ada, dipakai juga oleh modal
  // "Daftar Kader Baru") khusus super_admin.
  if (isSuperAdmin.value) loadPuskesmasList()
})

const searchQuery = ref('')
const filterPuskesmas = ref('')
const filterStatus = ref('')

const puskesmasOptions = computed(() => {
  if (isSuperAdmin.value && puskesmasList.value.length > 0) {
    return [...puskesmasList.value].map((p) => p.nama).sort()
  }
  const set = new Set(kaderList.value.map((k) => k.puskesmas?.nama).filter(Boolean))
  return [...set].sort()
})

const filteredKader = computed(() => {
  return kaderList.value.filter(k => {
    const q = searchQuery.value.toLowerCase()
    const matchSearch = q ? (k.user?.name ?? '').toLowerCase().includes(q) : true
    const matchPuskesmas = filterPuskesmas.value ? k.puskesmas?.nama === filterPuskesmas.value : true
    const matchStatus = filterStatus.value ? String(k.status_aktif) === filterStatus.value : true
    return matchSearch && matchPuskesmas && matchStatus
  })
})

// --- Daftar Kader Baru — POST /api/v1/kader ---
const showAddModal = ref(false)
const isSaving = ref(false)
const saveError = ref('')
const fieldErrors = ref<Record<string, string[]>>({})

const emptyForm = (): CreateKaderPayload => ({
  name: '', email: '', no_hp: '', no_wa: '', alamat: '', gender: null, tgl_lahir: '', puskesmas_id: null, pj_id: null
})
const kaderForm = ref<CreateKaderPayload>(emptyForm())

// puskesmas_id cuma relevan utk super_admin (admin_puskesmas/pj_prolanis dipaksa ke puskesmas
// sendiri di KaderService, field ini disembunyikan utk mereka, bukan cuma dikosongkan).
const puskesmasList = ref<Puskesmas[]>([])
const isLoadingPuskesmas = ref(false)

async function loadPuskesmasList() {
  if (puskesmasList.value.length) return
  isLoadingPuskesmas.value = true
  try {
    const api = useApi()
    puskesmasList.value = await fetchAllPages((page) => api('/puskesmas', { query: { per_page: 100, page } }))
  } catch (e) {
    console.error(e)
  } finally {
    isLoadingPuskesmas.value = false
  }
}

// GET /kader/pj-options -- dropdown pilihan PJ Prolanis, cuma relevan admin_puskesmas/
// super_admin (pj_prolanis: pj_id-nya otomatis dirinya sendiri di backend, dropdown tidak
// ditampilkan sama sekali utk role itu). Utk super_admin, opsi di-scope ke puskesmas_id yang
// dipilih (backend mixed-puskesmas kalau tidak dikirim) -- di-refetch tiap puskesmas_id ganti.
const pjOptions = ref<PjOption[]>([])
const isLoadingPjOptions = ref(false)

async function loadPjOptions(puskesmasId?: number | null) {
  isLoadingPjOptions.value = true
  try {
    const api = useApi()
    const res = await api('/kader/pj-options', {
      query: puskesmasId ? { puskesmas_id: puskesmasId } : {}
    }) as ApiSuccessEnvelope<PjOption[]>
    pjOptions.value = res.data
  } catch (e) {
    console.error(e)
    pjOptions.value = []
  } finally {
    isLoadingPjOptions.value = false
  }
}

watch(() => kaderForm.value.puskesmas_id, (newVal) => {
  if (!isSuperAdmin.value) return
  pjOptions.value = []
  kaderForm.value.pj_id = null
  if (newVal) loadPjOptions(newVal)
})

function openAddModal() {
  kaderForm.value = emptyForm()
  saveError.value = ''
  fieldErrors.value = {}
  pjOptions.value = []
  showAddModal.value = true
  if (isSuperAdmin.value) {
    loadPuskesmasList()
  } else if (isAdminPuskesmas.value) {
    loadPjOptions()
  }
}

// --- Aktifkan/Nonaktifkan Kader -- PATCH /api/v1/kader/{id}/status (KaderPolicy::update) ---
// Nonaktifkan pakai modal konfirmasi (dampak operasional -- kader nonaktif otomatis tersaring
// dari opsi "Tugaskan Kader" & scopedActiveKaders dashboard), aktifkan langsung tanpa konfirmasi
// (reversibel, risiko rendah). BUKAN window.confirm() bawaan browser.
const togglingKaderId = ref<number | null>(null)
const toggleStatusError = ref('')
const showDeactivateConfirm = ref(false)
const kaderToDeactivate = ref<Kader | null>(null)

async function setKaderStatus(kader: Kader, active: boolean) {
  togglingKaderId.value = kader.id
  toggleStatusError.value = ''
  try {
    const api = useApi()
    const res = await api(`/kader/${kader.id}/status`, {
      method: 'PATCH',
      body: { status_aktif: active }
    }) as ApiSuccessEnvelope<Kader>
    const idx = kaderList.value.findIndex((k) => k.id === kader.id)
    if (idx !== -1) kaderList.value[idx] = res.data
  } catch (e) {
    toggleStatusError.value = e instanceof ApiError ? e.message : 'Gagal mengubah status kader.'
  } finally {
    togglingKaderId.value = null
  }
}

function requestToggleStatus(kader: Kader) {
  if (kader.status_aktif) {
    kaderToDeactivate.value = kader
    showDeactivateConfirm.value = true
  } else {
    setKaderStatus(kader, true)
  }
}

async function confirmDeactivate() {
  if (!kaderToDeactivate.value) return
  await setKaderStatus(kaderToDeactivate.value, false)
  showDeactivateConfirm.value = false
  kaderToDeactivate.value = null
}

async function saveKader() {
  isSaving.value = true
  saveError.value = ''
  fieldErrors.value = {}
  try {
    const api = useApi()
    const payload = { ...kaderForm.value }
    if (!isSuperAdmin.value) delete payload.puskesmas_id
    await api('/kader', { method: 'POST', body: payload })
    showAddModal.value = false
    await loadKader()
  } catch (e) {
    if (e instanceof ApiError) {
      saveError.value = e.message
      fieldErrors.value = e.errors ?? {}
    } else {
      saveError.value = 'Gagal mendaftarkan kader.'
    }
  } finally {
    isSaving.value = false
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
        <span class="text-slate-600">Data Kader</span>
      </div>
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-extrabold text-accent">Data Kader Prolanis</h1>
          <p class="text-sm text-slate-500 mt-1">Kelola data Kader lapangan dan pantau performa kunjungan bulanan.</p>
          <p v-if="loadError" class="text-xs font-semibold text-danger mt-1">{{ loadError }}</p>
        </div>
        <div v-if="canManageKader" class="flex items-center gap-3">
          <button @click="openAddModal" class="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-600 transition-colors shadow-sm">
            <LucideUserPlus class="w-4 h-4" />
            <span>Daftar Kader Baru</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Filters & Table Card -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-card flex flex-col overflow-hidden">

      <!-- Toolbar -->
      <div class="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50">
        <div class="relative w-full md:w-80">
          <LucideSearch class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari nama kader..."
            class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
          />
        </div>

        <div class="flex items-center gap-3 w-full md:w-auto">
          <select v-model="filterPuskesmas" class="flex-1 md:w-48 py-2.5 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
            <option value="">Semua Puskesmas</option>
            <option v-for="pkm in puskesmasOptions" :key="pkm" :value="pkm">{{ pkm }}</option>
          </select>
          <select v-model="filterStatus" class="flex-1 md:w-40 py-2.5 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
            <option value="">Semua Status</option>
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </select>
        </div>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[850px]">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <th class="py-4 px-5 font-semibold">Nama Kader</th>
              <th class="py-4 px-5 font-semibold">Puskesmas</th>
              <th class="py-4 px-5 font-semibold">PJ Prolanis</th>
              <th class="py-4 px-5 font-semibold text-center">Status Akun</th>
              <th v-if="canManageKader" class="py-4 px-5 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="isLoading">
               <td :colspan="canManageKader ? 5 : 4" class="py-12 text-center text-slate-400">
                  <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
                  Memuat data kader...
               </td>
            </tr>
            <tr v-for="kader in filteredKader" :key="kader.id" class="hover:bg-slate-50/80 transition-colors group">
               <td class="py-4 px-5">
                  <div class="flex items-center gap-3">
                     <div class="w-9 h-9 rounded-full bg-info/10 text-info flex items-center justify-center font-bold text-sm shadow-sm border border-info/20 shrink-0">
                        {{ (kader.user?.name ?? '?').split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() }}
                     </div>
                     <div>
                        <span class="font-bold text-slate-800 block">{{ kader.user?.name ?? '-' }}</span>
                        <span class="text-[11px] text-slate-500 font-medium">{{ kader.no_hp }}</span>
                     </div>
                  </div>
               </td>
               <td class="py-4 px-5">
                  <p class="text-sm font-bold text-slate-700">{{ kader.puskesmas?.nama || '-' }}</p>
               </td>
               <td class="py-4 px-5">
                  <p class="text-sm font-medium text-slate-600">{{ kader.pj?.name || '-' }}</p>
               </td>
               <td class="py-4 px-5 text-center">
                  <span v-if="kader.status_aktif" class="inline-flex items-center gap-1.5 text-xs font-bold text-success bg-success/10 px-2.5 py-1 rounded-full border border-success/20">
                     <span class="w-1.5 h-1.5 rounded-full bg-success"></span> Aktif
                  </span>
                  <span v-else class="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                     <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Nonaktif
                  </span>
               </td>
               <td v-if="canManageKader" class="py-4 px-5 text-right">
                  <button
                     @click="requestToggleStatus(kader)"
                     :disabled="togglingKaderId === kader.id"
                     class="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
                     :class="kader.status_aktif ? 'text-danger border-danger/30 hover:bg-danger/5' : 'text-success border-success/30 hover:bg-success/5'"
                  >
                     <LucideLoader2 v-if="togglingKaderId === kader.id" class="w-3.5 h-3.5 animate-spin" />
                     {{ kader.status_aktif ? 'Nonaktifkan' : 'Aktifkan' }}
                  </button>
               </td>
            </tr>
            <tr v-if="!isLoading && filteredKader.length === 0">
               <td :colspan="canManageKader ? 5 : 4" class="py-12 text-center">
                 <div class="flex flex-col items-center justify-center text-slate-400">
                    <LucideUsers class="w-10 h-10 mb-3 text-slate-300" />
                    <p class="font-medium">Tidak ada data kader yang ditemukan.</p>
                 </div>
               </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Ringkasan -->
      <div class="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
        <span class="text-sm text-slate-500">Menampilkan <b class="text-slate-700">{{ filteredKader.length }}</b> dari <b class="text-slate-700">{{ kaderList.length }}</b> kader</span>
      </div>
    </div>

    <!-- Add Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
       <div class="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
          <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
             <h3 class="font-bold text-accent text-lg flex items-center gap-2">
               <LucideUserPlus class="w-5 h-5 text-primary" />
               Pendaftaran Kader Baru
             </h3>
             <button @click="showAddModal = false" class="text-slate-400 hover:text-slate-600 p-1">
                <LucideX class="w-5 h-5" />
             </button>
          </div>

          <div class="p-6 space-y-4 overflow-y-auto">
             <p v-if="saveError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{{ saveError }}</p>

             <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Nama Lengkap Kader</label>
                <input v-model="kaderForm.name" type="text" placeholder="Masukkan nama..." class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                <p v-if="fieldErrors.name" class="text-xs text-danger mt-1">{{ fieldErrors.name[0] }}</p>
             </div>

             <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Email</label>
                <input v-model="kaderForm.email" type="email" placeholder="email@contoh.com" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                <p v-if="fieldErrors.email" class="text-xs text-danger mt-1">{{ fieldErrors.email[0] }}</p>
             </div>

             <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">No. Handphone (WhatsApp)</label>
                <input v-model="kaderForm.no_hp" type="text" placeholder="08..." class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                <p v-if="fieldErrors.no_hp" class="text-xs text-danger mt-1">{{ fieldErrors.no_hp[0] }}</p>
             </div>

             <!-- puskesmas_id cuma dipilih manual utk super_admin -- admin_puskesmas/pj_prolanis
                  otomatis ke puskesmasnya sendiri di backend, field ini disembunyikan utk mereka. -->
             <div v-if="isSuperAdmin">
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Puskesmas</label>
                <select v-model.number="kaderForm.puskesmas_id" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                   <option :value="null">{{ isLoadingPuskesmas ? 'Memuat...' : 'Pilih puskesmas...' }}</option>
                   <option v-for="pkm in puskesmasList" :key="pkm.id" :value="pkm.id">{{ pkm.nama }}</option>
                </select>
                <p v-if="fieldErrors.puskesmas_id" class="text-xs text-danger mt-1">{{ fieldErrors.puskesmas_id[0] }}</p>
             </div>

             <!-- PJ Prolanis: opsional, cuma utk admin_puskesmas/super_admin (pj_prolanis yang
                  mendaftarkan otomatis jadi PJ-nya sendiri di backend, tidak perlu dipilih). -->
             <div v-if="isSuperAdmin || isAdminPuskesmas">
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">PJ Prolanis (Opsional)</label>
                <select
                  v-model.number="kaderForm.pj_id"
                  :disabled="isSuperAdmin && !kaderForm.puskesmas_id"
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-100 disabled:text-slate-400"
                >
                   <option :value="null">
                     {{ isSuperAdmin && !kaderForm.puskesmas_id ? 'Pilih puskesmas dahulu...' : isLoadingPjOptions ? 'Memuat...' : 'Tidak ditentukan' }}
                   </option>
                   <option v-for="pj in pjOptions" :key="pj.id" :value="pj.id">{{ pj.name }}</option>
                </select>
                <p v-if="fieldErrors.pj_id" class="text-xs text-danger mt-1">{{ fieldErrors.pj_id[0] }}</p>
             </div>
          </div>

          <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
             <button @click="showAddModal = false" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
             <button @click="saveKader" :disabled="isSaving" class="py-2.5 px-6 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm">
                <LucideLoader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
                {{ isSaving ? 'Menyimpan...' : 'Daftarkan Kader' }}
             </button>
          </div>
       </div>
    </div>

    <!-- Konfirmasi Nonaktifkan Kader -- bukan window.confirm() bawaan browser. -->
    <div v-if="showDeactivateConfirm && kaderToDeactivate" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
       <div class="bg-white rounded-3xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
          <div class="p-6 overflow-y-auto">
             <div class="w-14 h-14 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mb-4">
                <LucideAlertTriangle class="w-7 h-7" />
             </div>
             <h3 class="font-bold text-accent text-lg mb-1">Nonaktifkan Kader?</h3>
             <p class="text-sm text-slate-500 leading-relaxed mb-1">
                <span class="font-bold text-slate-700">{{ kaderToDeactivate.user?.name ?? 'Kader ini' }}</span> tidak akan lagi bisa ditugaskan kunjungan baru sampai diaktifkan kembali. Riwayat kunjungan & laporan sebelumnya tetap tersimpan.
             </p>
             <p v-if="toggleStatusError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2 mt-4">{{ toggleStatusError }}</p>
          </div>
          <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
             <button @click="showDeactivateConfirm = false; kaderToDeactivate = null" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
             <button
                @click="confirmDeactivate"
                :disabled="togglingKaderId === kaderToDeactivate.id"
                class="py-2.5 px-6 rounded-xl font-bold text-white bg-danger hover:bg-danger/90 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
             >
                <LucideLoader2 v-if="togglingKaderId === kaderToDeactivate.id" class="w-4 h-4 animate-spin" />
                Ya, Nonaktifkan
             </button>
          </div>
       </div>
    </div>
  </div>
</template>
