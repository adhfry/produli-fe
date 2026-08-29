<script setup lang="ts">
import type { ApiSuccessEnvelope, CreatePengantarSampelPayload, PengantarSampel, Puskesmas, UpdatePengantarSampelPayload } from '~/types/api'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
useHead({
  title: 'Data Pengantar Sampel'
})

// Role-visibility -- pola sama persis dashboard/tenaga-kesehatan/index.vue (PengantarSampelPolicy::
// viewAny/create sama-sama true utk ketiga role ini, tidak ada beda kewenangan).
const authStore = useAuthStore()
const isSuperAdmin = computed(() => (authStore.roles ?? []).includes('super_admin'))
const isAdminPuskesmas = computed(() => (authStore.roles ?? []).includes('admin_puskesmas'))
const isPjProlanis = computed(() => (authStore.roles ?? []).includes('pj_prolanis'))
const canManage = computed(() => isSuperAdmin.value || isAdminPuskesmas.value || isPjProlanis.value)

const list = ref<PengantarSampel[]>([])
const isLoading = ref(false)
const loadError = ref('')

async function loadList() {
  isLoading.value = true
  loadError.value = ''
  try {
    const api = useApi()
    list.value = await fetchAllPages((page) => api('/pengantar-sampel', { query: { per_page: 100, page } }))
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Gagal memuat data pengantar sampel.'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadList()
  if (isSuperAdmin.value) loadPuskesmasList()
})

const searchQuery = ref('')
const filterPuskesmas = ref('')
const filterStatus = ref('')

const puskesmasOptions = computed(() => {
  if (isSuperAdmin.value && puskesmasList.value.length > 0) {
    return [...puskesmasList.value].map((p) => p.nama).sort()
  }
  const set = new Set(list.value.map((t) => t.puskesmas?.nama).filter(Boolean))
  return [...set].sort()
})

const filteredList = computed(() => {
  return list.value.filter(t => {
    const q = searchQuery.value.toLowerCase()
    const matchSearch = q ? (t.user?.name ?? '').toLowerCase().includes(q) : true
    const matchPuskesmas = filterPuskesmas.value ? t.puskesmas?.nama === filterPuskesmas.value : true
    const matchStatus = filterStatus.value ? String(t.status_aktif) === filterStatus.value : true
    return matchSearch && matchPuskesmas && matchStatus
  })
})

// --- Daftar Pengantar Sampel Baru — POST /api/v1/pengantar-sampel ---
const showAddModal = ref(false)
const isSaving = ref(false)
const saveError = ref('')
const fieldErrors = ref<Record<string, string[]>>({})

const emptyForm = (): CreatePengantarSampelPayload => ({
  name: '', email: '', no_hp: '', no_wa: '', puskesmas_id: null
})
const form = ref<CreatePengantarSampelPayload>(emptyForm())

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

function openAddModal() {
  form.value = emptyForm()
  saveError.value = ''
  fieldErrors.value = {}
  showAddModal.value = true
  if (isSuperAdmin.value) loadPuskesmasList()
}

// --- Aktifkan/Nonaktifkan -- PATCH /api/v1/pengantar-sampel/{id}/status ---
const togglingId = ref<number | null>(null)
const toggleStatusError = ref('')
const showDeactivateConfirm = ref(false)
const toDeactivate = ref<PengantarSampel | null>(null)

async function setStatus(item: PengantarSampel, active: boolean) {
  togglingId.value = item.id
  toggleStatusError.value = ''
  try {
    const api = useApi()
    const res = await api(`/pengantar-sampel/${item.id}/status`, {
      method: 'PATCH',
      body: { status_aktif: active }
    }) as ApiSuccessEnvelope<PengantarSampel>
    const idx = list.value.findIndex((t) => t.id === item.id)
    if (idx !== -1) list.value[idx] = res.data
    useToast().add({ title: active ? 'Pengantar sampel diaktifkan kembali' : 'Pengantar sampel dinonaktifkan', color: 'success' })
  } catch (e) {
    toggleStatusError.value = e instanceof ApiError ? e.message : 'Gagal mengubah status.'
  } finally {
    togglingId.value = null
  }
}

function requestToggleStatus(item: PengantarSampel) {
  if (item.status_aktif) {
    toDeactivate.value = item
    showDeactivateConfirm.value = true
  } else {
    setStatus(item, true)
  }
}

async function confirmDeactivate() {
  if (!toDeactivate.value) return
  await setStatus(toDeactivate.value, false)
  showDeactivateConfirm.value = false
  toDeactivate.value = null
}

async function save() {
  isSaving.value = true
  saveError.value = ''
  fieldErrors.value = {}
  try {
    const api = useApi()
    const payload = { ...form.value }
    if (!isSuperAdmin.value) delete payload.puskesmas_id
    await api('/pengantar-sampel', { method: 'POST', body: payload })
    showAddModal.value = false
    useToast().add({ title: 'Pengantar sampel berhasil didaftarkan', color: 'success' })
    await loadList()
  } catch (e) {
    if (e instanceof ApiError) {
      saveError.value = e.message
      fieldErrors.value = e.errors ?? {}
    } else {
      saveError.value = 'Gagal mendaftarkan pengantar sampel.'
    }
  } finally {
    isSaving.value = false
  }
}

// --- Ubah Data — PATCH /api/v1/pengantar-sampel/{id} (PengantarSampelPolicy::update) ---
const showEditModal = ref(false)
const isSavingEdit = ref(false)
const editError = ref('')
const editFieldErrors = ref<Record<string, string[]>>({})
const itemBeingEdited = ref<PengantarSampel | null>(null)
const editForm = ref<UpdatePengantarSampelPayload>({})

function openEditModal(item: PengantarSampel) {
  itemBeingEdited.value = item
  editForm.value = {
    name: item.user?.name ?? '',
    email: item.user?.email ?? '',
    no_hp: item.no_hp,
    no_wa: item.no_wa
  }
  editError.value = ''
  editFieldErrors.value = {}
  showEditModal.value = true
}

async function saveEdit() {
  if (!itemBeingEdited.value) return
  isSavingEdit.value = true
  editError.value = ''
  editFieldErrors.value = {}
  try {
    const api = useApi()
    const res = await api(`/pengantar-sampel/${itemBeingEdited.value.id}`, {
      method: 'PATCH',
      body: editForm.value
    }) as ApiSuccessEnvelope<PengantarSampel>
    const idx = list.value.findIndex((t) => t.id === itemBeingEdited.value!.id)
    if (idx !== -1) list.value[idx] = res.data
    showEditModal.value = false
    useToast().add({ title: 'Data pengantar sampel berhasil diperbarui', color: 'success' })
  } catch (e) {
    if (e instanceof ApiError) {
      editError.value = e.message
      editFieldErrors.value = e.errors ?? {}
    } else {
      editError.value = 'Gagal memperbarui data pengantar sampel.'
    }
  } finally {
    isSavingEdit.value = false
  }
}

// --- Hapus PERMANEN — DELETE /api/v1/pengantar-sampel/{id} ---
const showDeleteConfirm = ref(false)
const itemToDelete = ref<PengantarSampel | null>(null)
const isDeleting = ref(false)
const deleteError = ref('')

function requestDelete(item: PengantarSampel) {
  itemToDelete.value = item
  deleteError.value = ''
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (!itemToDelete.value) return
  isDeleting.value = true
  deleteError.value = ''
  try {
    const api = useApi()
    await api(`/pengantar-sampel/${itemToDelete.value.id}`, { method: 'DELETE' })
    list.value = list.value.filter((t) => t.id !== itemToDelete.value!.id)
    showDeleteConfirm.value = false
    itemToDelete.value = null
    useToast().add({ title: 'Pengantar sampel berhasil dihapus', color: 'success' })
  } catch (e) {
    deleteError.value = e instanceof ApiError ? e.message : 'Gagal menghapus pengantar sampel.'
  } finally {
    isDeleting.value = false
  }
}

// --- Reset Password — POST /api/v1/pengantar-sampel/{id}/reset-password (super_admin saja). ---
const showResetPasswordConfirm = ref(false)
const itemToReset = ref<PengantarSampel | null>(null)
const isResettingPassword = ref(false)
const resetPasswordError = ref('')
const resetPasswordSuccess = ref('')

function requestResetPassword(item: PengantarSampel) {
  itemToReset.value = item
  resetPasswordError.value = ''
  showResetPasswordConfirm.value = true
}

async function confirmResetPassword() {
  if (!itemToReset.value) return
  isResettingPassword.value = true
  resetPasswordError.value = ''
  try {
    const api = useApi()
    const res = await api(`/pengantar-sampel/${itemToReset.value.id}/reset-password`, { method: 'POST' }) as ApiSuccessEnvelope<null>
    showResetPasswordConfirm.value = false
    resetPasswordSuccess.value = res.message
    itemToReset.value = null
    useToast().add({ title: 'Password pengantar sampel berhasil direset', color: 'success' })
  } catch (e) {
    resetPasswordError.value = e instanceof ApiError ? e.message : 'Gagal mereset password.'
  } finally {
    isResettingPassword.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <div class="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wider">
        <NuxtLink to="/dashboard" class="hover:text-primary transition-colors">Dashboard</NuxtLink>
        <LucideChevronRight class="w-3 h-3" />
        <span class="text-slate-600">Data Pengantar Sampel</span>
      </div>
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-extrabold text-accent">Data Pengantar Sampel</h1>
          <p class="text-sm text-slate-500 mt-1">Kelola kurir yang bisa ditugaskan mengantar sampel Prolanis ke Labkesda Sumenep.</p>
          <p v-if="loadError" class="text-xs font-semibold text-danger mt-1">{{ loadError }}</p>
        </div>
        <div v-if="canManage" class="flex items-center gap-3">
          <button @click="openAddModal" class="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-600 transition-colors shadow-sm">
            <LucideUserPlus class="w-4 h-4" />
            <span>Daftar Pengantar Sampel Baru</span>
          </button>
        </div>
      </div>
    </div>

    <p
      v-if="resetPasswordSuccess"
      class="text-sm font-semibold text-success bg-success/10 border border-success/20 rounded-xl px-4 py-3"
    >
      {{ resetPasswordSuccess }}
    </p>

    <div class="bg-white rounded-2xl border border-slate-100 shadow-card flex flex-col overflow-hidden">
      <div class="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50">
        <div class="relative w-full md:w-80">
          <LucideSearch class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari nama pengantar sampel..."
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

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <th class="py-4 px-5 font-semibold">Nama</th>
              <th class="py-4 px-5 font-semibold">Puskesmas</th>
              <th class="py-4 px-5 font-semibold text-center">Status Akun</th>
              <th v-if="canManage" class="py-4 px-5 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <!-- Skeleton HANYA saat load pertama/belum ada data, bukan tiap refetch setelah aksi
                 berhasil -- pola sama dgn dashboard/tenaga-kesehatan/index.vue. -->
            <tr v-if="isLoading && list.length === 0">
               <td :colspan="canManage ? 4 : 3" class="py-12 text-center text-slate-400">
                  <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
                  Memuat data...
               </td>
            </tr>
            <tr v-for="item in filteredList" :key="item.id" class="hover:bg-slate-50/80 transition-colors group">
               <td class="py-4 px-5">
                  <div class="flex items-center gap-3">
                     <div class="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center font-bold text-sm shadow-sm border border-secondary/20 shrink-0">
                        {{ (item.user?.name ?? '?').split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() }}
                     </div>
                     <div>
                        <span class="font-bold text-slate-800 block">{{ item.user?.name ?? '-' }}</span>
                        <span class="text-[11px] text-slate-500 font-medium">{{ item.no_hp }}</span>
                     </div>
                  </div>
               </td>
               <td class="py-4 px-5">
                  <p class="text-sm font-bold text-slate-700">{{ item.puskesmas?.nama || '-' }}</p>
               </td>
               <td class="py-4 px-5 text-center">
                  <span v-if="item.status_aktif" class="inline-flex items-center gap-1.5 text-xs font-bold text-success bg-success/10 px-2.5 py-1 rounded-full border border-success/20">
                     <span class="w-1.5 h-1.5 rounded-full bg-success"></span> Aktif
                  </span>
                  <span v-else class="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                     <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Nonaktif
                  </span>
               </td>
               <td v-if="canManage" class="py-4 px-5">
                  <div class="flex items-center justify-end gap-1.5 flex-wrap">
                     <button
                        @click="openEditModal(item)"
                        title="Ubah data"
                        class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-primary transition-colors"
                     >
                        <LucidePencil class="w-3.5 h-3.5" />
                     </button>
                     <button
                        @click="requestToggleStatus(item)"
                        :disabled="togglingId === item.id"
                        class="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
                        :class="item.status_aktif ? 'text-danger border-danger/30 hover:bg-danger/5' : 'text-success border-success/30 hover:bg-success/5'"
                     >
                        <LucideLoader2 v-if="togglingId === item.id" class="w-3.5 h-3.5 animate-spin" />
                        {{ item.status_aktif ? 'Nonaktifkan' : 'Aktifkan' }}
                     </button>
                     <button
                        v-if="isSuperAdmin"
                        @click="requestResetPassword(item)"
                        title="Reset password"
                        class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-warning transition-colors"
                     >
                        <LucideKeyRound class="w-3.5 h-3.5" />
                     </button>
                     <button
                        @click="requestDelete(item)"
                        title="Hapus permanen"
                        class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-danger/5 hover:text-danger hover:border-danger/30 transition-colors"
                     >
                        <LucideTrash2 class="w-3.5 h-3.5" />
                     </button>
                  </div>
               </td>
            </tr>
            <tr v-if="!isLoading && filteredList.length === 0">
               <td :colspan="canManage ? 4 : 3" class="py-12 text-center">
                 <div class="flex flex-col items-center justify-center text-slate-400">
                    <LucideTruck class="w-10 h-10 mb-3 text-slate-300" />
                    <p class="font-medium">Tidak ada data pengantar sampel yang ditemukan.</p>
                 </div>
               </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
        <span class="text-sm text-slate-500">Menampilkan <b class="text-slate-700">{{ filteredList.length }}</b> dari <b class="text-slate-700">{{ list.length }}</b> pengantar sampel</span>
      </div>
    </div>

    <!-- Add Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
       <div class="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
          <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
             <h3 class="font-bold text-accent text-lg flex items-center gap-2">
               <LucideUserPlus class="w-5 h-5 text-primary" />
               Pendaftaran Pengantar Sampel Baru
             </h3>
             <button @click="showAddModal = false" class="text-slate-400 hover:text-slate-600 p-1">
                <LucideX class="w-5 h-5" />
             </button>
          </div>

          <div class="p-6 space-y-4 overflow-y-auto">
             <p v-if="saveError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{{ saveError }}</p>

             <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Nama Lengkap</label>
                <input v-model="form.name" type="text" placeholder="Masukkan nama..." class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                <p v-if="fieldErrors.name" class="text-xs text-danger mt-1">{{ fieldErrors.name[0] }}</p>
             </div>

             <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Email</label>
                <input v-model="form.email" type="email" placeholder="email@contoh.com" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                <p v-if="fieldErrors.email" class="text-xs text-danger mt-1">{{ fieldErrors.email[0] }}</p>
             </div>

             <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">No. Handphone (WhatsApp)</label>
                <input v-model="form.no_hp" type="text" placeholder="08..." class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                <p v-if="fieldErrors.no_hp" class="text-xs text-danger mt-1">{{ fieldErrors.no_hp[0] }}</p>
             </div>

             <div v-if="isSuperAdmin">
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Puskesmas</label>
                <select v-model.number="form.puskesmas_id" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                   <option :value="null">{{ isLoadingPuskesmas ? 'Memuat...' : 'Pilih puskesmas...' }}</option>
                   <option v-for="pkm in puskesmasList" :key="pkm.id" :value="pkm.id">{{ pkm.nama }}</option>
                </select>
                <p v-if="fieldErrors.puskesmas_id" class="text-xs text-danger mt-1">{{ fieldErrors.puskesmas_id[0] }}</p>
             </div>
          </div>

          <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
             <button @click="showAddModal = false" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
             <button @click="save" :disabled="isSaving" class="py-2.5 px-6 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm">
                <LucideLoader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
                {{ isSaving ? 'Menyimpan...' : 'Daftarkan Pengantar Sampel' }}
             </button>
          </div>
       </div>
    </div>

    <!-- Konfirmasi Nonaktifkan -->
    <div v-if="showDeactivateConfirm && toDeactivate" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
       <div class="bg-white rounded-3xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
          <div class="p-6 overflow-y-auto">
             <div class="w-14 h-14 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mb-4">
                <LucideAlertTriangle class="w-7 h-7" />
             </div>
             <h3 class="font-bold text-accent text-lg mb-1">Nonaktifkan Pengantar Sampel?</h3>
             <p class="text-sm text-slate-500 leading-relaxed mb-1">
                <span class="font-bold text-slate-700">{{ toDeactivate.user?.name ?? 'Pengantar sampel ini' }}</span> tidak akan lagi bisa ditugaskan mengantar sampel sampai diaktifkan kembali. Riwayat pengiriman sebelumnya tetap tersimpan.
             </p>
             <p v-if="toggleStatusError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2 mt-4">{{ toggleStatusError }}</p>
          </div>
          <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
             <button @click="showDeactivateConfirm = false; toDeactivate = null" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
             <button
                @click="confirmDeactivate"
                :disabled="togglingId === toDeactivate.id"
                class="py-2.5 px-6 rounded-xl font-bold text-white bg-danger hover:bg-danger/90 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
             >
                <LucideLoader2 v-if="togglingId === toDeactivate.id" class="w-4 h-4 animate-spin" />
                Ya, Nonaktifkan
             </button>
          </div>
       </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
       <div class="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
          <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
             <h3 class="font-bold text-accent text-lg flex items-center gap-2">
               <LucidePencil class="w-5 h-5 text-primary" />
               Ubah Data Pengantar Sampel
             </h3>
             <button @click="showEditModal = false" class="text-slate-400 hover:text-slate-600 p-1">
                <LucideX class="w-5 h-5" />
             </button>
          </div>

          <div class="p-6 space-y-4 overflow-y-auto">
             <p v-if="editError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{{ editError }}</p>

             <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Nama Lengkap</label>
                <input v-model="editForm.name" type="text" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                <p v-if="editFieldErrors.name" class="text-xs text-danger mt-1">{{ editFieldErrors.name[0] }}</p>
             </div>

             <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Email</label>
                <input v-model="editForm.email" type="email" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                <p v-if="editFieldErrors.email" class="text-xs text-danger mt-1">{{ editFieldErrors.email[0] }}</p>
             </div>

             <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">No. Handphone (WhatsApp)</label>
                <input v-model="editForm.no_hp" type="text" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                <p v-if="editFieldErrors.no_hp" class="text-xs text-danger mt-1">{{ editFieldErrors.no_hp[0] }}</p>
             </div>

             <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">No. WhatsApp Alternatif</label>
                <input v-model="editForm.no_wa" type="text" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
             </div>
          </div>

          <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
             <button @click="showEditModal = false" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
             <button @click="saveEdit" :disabled="isSavingEdit" class="py-2.5 px-6 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm">
                <LucideLoader2 v-if="isSavingEdit" class="w-4 h-4 animate-spin" />
                {{ isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan' }}
             </button>
          </div>
       </div>
    </div>

    <!-- Konfirmasi Hapus Permanen -->
    <div v-if="showDeleteConfirm && itemToDelete" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
       <div class="bg-white rounded-3xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
          <div class="p-6 overflow-y-auto">
             <div class="w-14 h-14 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mb-4">
                <LucideTrash2 class="w-7 h-7" />
             </div>
             <h3 class="font-bold text-accent text-lg mb-1">Hapus Pengantar Sampel Permanen?</h3>
             <p class="text-sm text-slate-500 leading-relaxed mb-1">
                <span class="font-bold text-slate-700">{{ itemToDelete.user?.name ?? 'Pengantar sampel ini' }}</span> akan dihapus permanen dari sistem. Tindakan ini tidak bisa dibatalkan.
             </p>
             <p v-if="deleteError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2 mt-4">{{ deleteError }}</p>
          </div>
          <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
             <button @click="showDeleteConfirm = false; itemToDelete = null" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
             <button
                @click="confirmDelete"
                :disabled="isDeleting"
                class="py-2.5 px-6 rounded-xl font-bold text-white bg-danger hover:bg-danger/90 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
             >
                <LucideLoader2 v-if="isDeleting" class="w-4 h-4 animate-spin" />
                Ya, Hapus Permanen
             </button>
          </div>
       </div>
    </div>

    <!-- Konfirmasi Reset Password -->
    <div v-if="showResetPasswordConfirm && itemToReset" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
       <div class="bg-white rounded-3xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
          <div class="p-6 overflow-y-auto">
             <div class="w-14 h-14 rounded-2xl bg-warning/10 text-warning flex items-center justify-center mb-4">
                <LucideKeyRound class="w-7 h-7" />
             </div>
             <h3 class="font-bold text-accent text-lg mb-1">Reset Password?</h3>
             <p class="text-sm text-slate-500 leading-relaxed mb-1">
                Password baru akan otomatis dibuat sistem dan dikirim lewat email ke
                <span class="font-bold text-slate-700">{{ itemToReset.user?.email ?? 'pengantar sampel ini' }}</span>.
                Password lama tidak akan berlaku lagi dan semua sesi login aktif akan keluar otomatis.
             </p>
             <p v-if="resetPasswordError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2 mt-4">{{ resetPasswordError }}</p>
          </div>
          <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
             <button @click="showResetPasswordConfirm = false; itemToReset = null" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
             <button
                @click="confirmResetPassword"
                :disabled="isResettingPassword"
                class="py-2.5 px-6 rounded-xl font-bold text-white bg-warning hover:bg-warning/90 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
             >
                <LucideLoader2 v-if="isResettingPassword" class="w-4 h-4 animate-spin" />
                Ya, Reset Password
             </button>
          </div>
       </div>
    </div>
  </div>
</template>
