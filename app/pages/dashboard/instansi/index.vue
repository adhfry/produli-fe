<script setup lang="ts">
import type { ApiSuccessEnvelope, Puskesmas, UpdatePuskesmasPayload } from '~/types/api'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
useHead({
  title: 'Data Instansi'
})

// Role-visibility -- reuse pola dari dashboard/index.vue (isSuperAdmin computed dari
// authStore.roles).
const authStore = useAuthStore()
const isSuperAdmin = computed(() => (authStore.roles ?? []).includes('super_admin'))
const isAdminPuskesmas = computed(() => (authStore.roles ?? []).includes('admin_puskesmas'))

// PuskesmasPolicy::update -- super_admin bebas edit puskesmas mana pun, admin_puskesmas cuma
// puskesmasnya sendiri, role lain (pj_prolanis/kader) cuma bisa lihat (viewAny semua role login).
function canEdit(puskesmas: Puskesmas): boolean {
  if (isSuperAdmin.value) return true
  if (isAdminPuskesmas.value) return authStore.user?.puskesmas_id === puskesmas.id
  return false
}

// GET /api/v1/puskesmas -- semua role login, tanpa scope (PuskesmasPolicy::viewAny).
const puskesmasList = ref<Puskesmas[]>([])
const isLoading = ref(false)
const loadError = ref('')

async function loadPuskesmasList() {
  isLoading.value = true
  loadError.value = ''
  try {
    const api = useApi()
    puskesmasList.value = await fetchAllPages((page) => api('/puskesmas', { query: { per_page: 100, page } }))
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Gagal memuat data instansi.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadPuskesmasList)

const searchQuery = ref('')
const filteredPuskesmas = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return puskesmasList.value
  return puskesmasList.value.filter((p) => p.nama.toLowerCase().includes(q) || p.kode_internal.toLowerCase().includes(q))
})

// --- Edit — PATCH /api/v1/puskesmas/{id} (cuma field kontak, bukan nama/kode) ---
const showEditModal = ref(false)
const editingPuskesmas = ref<Puskesmas | null>(null)
const editForm = ref<UpdatePuskesmasPayload>({})
const isSaving = ref(false)
const saveError = ref('')
const fieldErrors = ref<Record<string, string[]>>({})

function openEditModal(p: Puskesmas) {
  editingPuskesmas.value = p
  editForm.value = {
    alamat: p.alamat,
    no_telp: p.no_telp,
    no_wa: p.no_wa,
    latitude: p.latitude,
    longitude: p.longitude,
    deskripsi: p.deskripsi
  }
  saveError.value = ''
  fieldErrors.value = {}
  showEditModal.value = true
}

async function saveEdit() {
  if (!editingPuskesmas.value) return
  isSaving.value = true
  saveError.value = ''
  fieldErrors.value = {}
  try {
    const api = useApi()
    const res = await api(`/puskesmas/${editingPuskesmas.value.id}`, {
      method: 'PATCH',
      body: editForm.value
    }) as ApiSuccessEnvelope<Puskesmas>
    const idx = puskesmasList.value.findIndex((p) => p.id === editingPuskesmas.value!.id)
    if (idx !== -1) puskesmasList.value[idx] = res.data
    showEditModal.value = false
  } catch (e) {
    if (e instanceof ApiError) {
      saveError.value = e.message
      fieldErrors.value = e.errors ?? {}
    } else {
      saveError.value = 'Gagal menyimpan data instansi.'
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
        <span class="text-slate-600">Data Instansi</span>
      </div>
      <h1 class="text-2xl font-extrabold text-accent">Data Instansi</h1>
      <p class="text-sm text-slate-500 mt-1">Data Puskesmas se-Kabupaten Sumenep. Identitas resmi (nama/kode) dikunci — cuma kontak yang bisa diubah.</p>
      <p v-if="loadError" class="text-xs font-semibold text-danger mt-1">{{ loadError }}</p>
    </div>

    <!-- Filters & Table Card -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-card flex flex-col overflow-hidden">

      <!-- Toolbar -->
      <div class="p-5 border-b border-slate-100 bg-slate-50/50">
        <div class="relative w-full md:w-80">
          <LucideSearch class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari nama atau kode puskesmas..."
            class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
          />
        </div>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <th class="py-4 px-5 font-semibold">Kode</th>
              <th class="py-4 px-5 font-semibold">Nama Instansi</th>
              <th class="py-4 px-5 font-semibold">Kontak</th>
              <th class="py-4 px-5 font-semibold text-center">Status</th>
              <th class="py-4 px-5 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="isLoading">
               <td colspan="5" class="py-12 text-center text-slate-400">
                  <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
                  Memuat data instansi...
               </td>
            </tr>
            <tr v-for="puskesmas in filteredPuskesmas" :key="puskesmas.id" class="hover:bg-slate-50/80 transition-colors group">
               <td class="py-4 px-5">
                  <span class="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{{ puskesmas.kode_internal }}</span>
               </td>
               <td class="py-4 px-5">
                  <span class="font-bold text-slate-800">{{ puskesmas.nama }}</span>
                  <p v-if="puskesmas.deskripsi" class="text-[11px] text-slate-500 font-medium mt-0.5 line-clamp-1">{{ puskesmas.deskripsi }}</p>
               </td>
               <td class="py-4 px-5">
                  <p class="text-sm font-medium text-slate-700">{{ puskesmas.alamat || '-' }}</p>
                  <p class="text-[11px] text-slate-500 mt-0.5">{{ puskesmas.no_telp || '-' }}<template v-if="puskesmas.no_wa"> &bull; WA: {{ puskesmas.no_wa }}</template></p>
               </td>
               <td class="py-4 px-5 text-center">
                  <span v-if="puskesmas.status_aktif" class="inline-flex items-center gap-1.5 text-xs font-bold text-success bg-success/10 px-2.5 py-1 rounded-full border border-success/20">
                     <span class="w-1.5 h-1.5 rounded-full bg-success"></span> Aktif
                  </span>
                  <span v-else class="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                     <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Nonaktif
                  </span>
               </td>
               <td class="py-4 px-5 text-right">
                  <button
                     v-if="canEdit(puskesmas)"
                     @click="openEditModal(puskesmas)"
                     class="inline-flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:text-primary hover:border-primary transition-colors p-2 rounded-xl shadow-sm"
                  >
                     <LucideEdit class="w-4 h-4" />
                  </button>
                  <span v-else class="text-slate-300 text-xs">-</span>
               </td>
            </tr>
            <tr v-if="!isLoading && filteredPuskesmas.length === 0">
               <td colspan="5" class="py-12 text-center">
                 <div class="flex flex-col items-center justify-center text-slate-400">
                    <LucideBuilding2 class="w-10 h-10 mb-3 text-slate-300" />
                    <p class="font-medium">Tidak ada data instansi yang ditemukan.</p>
                 </div>
               </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Ringkasan -->
      <div class="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
        <span class="text-sm text-slate-500">Menampilkan <b class="text-slate-700">{{ filteredPuskesmas.length }}</b> dari <b class="text-slate-700">{{ puskesmasList.length }}</b> instansi</span>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
       <div class="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
          <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
             <h3 class="font-bold text-accent text-lg flex items-center gap-2">
               <LucideEdit class="w-5 h-5 text-primary" />
               Edit Data Instansi
             </h3>
             <button @click="showEditModal = false" class="text-slate-400 hover:text-slate-600 p-1">
                <LucideX class="w-5 h-5" />
             </button>
          </div>

          <div class="p-6 space-y-4 overflow-y-auto">
             <p v-if="saveError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{{ saveError }}</p>

             <!-- Nama/kode dikunci -- read-only, cuma konteks, bukan field yang bisa diubah. -->
             <div class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{{ editingPuskesmas?.kode_internal }}</p>
                <p class="text-sm font-bold text-slate-700">{{ editingPuskesmas?.nama }}</p>
             </div>

             <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Alamat</label>
                <textarea v-model="editForm.alamat" rows="2" placeholder="Alamat lengkap..." class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"></textarea>
                <p v-if="fieldErrors.alamat" class="text-xs text-danger mt-1">{{ fieldErrors.alamat[0] }}</p>
             </div>

             <div class="grid grid-cols-2 gap-4">
                <div>
                   <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">No. Telepon</label>
                   <input v-model="editForm.no_telp" type="text" placeholder="0328..." class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                   <p v-if="fieldErrors.no_telp" class="text-xs text-danger mt-1">{{ fieldErrors.no_telp[0] }}</p>
                </div>
                <div>
                   <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">No. WhatsApp</label>
                   <input v-model="editForm.no_wa" type="text" placeholder="08..." class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                   <p v-if="fieldErrors.no_wa" class="text-xs text-danger mt-1">{{ fieldErrors.no_wa[0] }}</p>
                </div>
             </div>

             <div class="grid grid-cols-2 gap-4">
                <div>
                   <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Latitude</label>
                   <input v-model.number="editForm.latitude" type="number" step="any" placeholder="-7.0..." class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                   <p v-if="fieldErrors.latitude" class="text-xs text-danger mt-1">{{ fieldErrors.latitude[0] }}</p>
                </div>
                <div>
                   <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Longitude</label>
                   <input v-model.number="editForm.longitude" type="number" step="any" placeholder="113.8..." class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                   <p v-if="fieldErrors.longitude" class="text-xs text-danger mt-1">{{ fieldErrors.longitude[0] }}</p>
                </div>
             </div>

             <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Deskripsi</label>
                <textarea v-model="editForm.deskripsi" rows="2" placeholder="Deskripsi singkat..." class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"></textarea>
                <p v-if="fieldErrors.deskripsi" class="text-xs text-danger mt-1">{{ fieldErrors.deskripsi[0] }}</p>
             </div>
          </div>

          <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
             <button @click="showEditModal = false" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
             <button @click="saveEdit" :disabled="isSaving" class="py-2.5 px-6 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm">
                <LucideLoader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
                {{ isSaving ? 'Menyimpan...' : 'Simpan Perubahan' }}
             </button>
          </div>
       </div>
    </div>
  </div>
</template>
