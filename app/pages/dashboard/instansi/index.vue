<script setup lang="ts">
import type { ApiSuccessEnvelope, Puskesmas, PuskesmasGeocodeAllResult, UpdatePuskesmasPayload } from '~/types/api'

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
const isPjProlanis = computed(() => (authStore.roles ?? []).includes('pj_prolanis'))

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

// --- Cari-otomatis koordinat se-Kabupaten Sumenep (super_admin, permintaan Bu Kadis) ---
// POST /puskesmas/geocode-all -- OpenStreetMap Nominatim, BUKAN Google (proyek ini sengaja
// tidak pakai Google Maps sama sekali). ~31 puskesmas x ~1,1 detik/request (rate limit
// Nominatim) = bisa sampai puluhan detik, ditunggu langsung (bukan queue job terpisah).
const isGeocodingAll = ref(false)
const geocodeResult = ref<PuskesmasGeocodeAllResult | null>(null)
const geocodeError = ref('')
const overwriteExistingCoords = ref(false)

async function runGeocodeAll() {
  isGeocodingAll.value = true
  geocodeError.value = ''
  geocodeResult.value = null
  try {
    const api = useApi()
    const res = await api('/puskesmas/geocode-all', {
      method: 'POST',
      body: { overwrite_existing: overwriteExistingCoords.value }
    }) as ApiSuccessEnvelope<PuskesmasGeocodeAllResult>
    geocodeResult.value = res.data
    useToast().add({
      title: `Geocoding selesai: ${res.data.updated} puskesmas diperbarui`,
      color: 'success'
    })
    // Refresh daftar supaya tabel/card langsung menampilkan koordinat baru tanpa reload manual.
    await loadPuskesmasList()
  } catch (e) {
    geocodeError.value = e instanceof ApiError ? e.message : 'Gagal mencari koordinat otomatis.'
  } finally {
    isGeocodingAll.value = false
  }
}

const searchQuery = ref('')
const filteredPuskesmas = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return puskesmasList.value
  return puskesmasList.value.filter((p) => p.nama.toLowerCase().includes(q) || p.kode_internal.toLowerCase().includes(q))
})

// Card personalisasi (permintaan Bu Kadis) -- admin_puskesmas/pj_prolanis melihat info
// puskesmas mereka sendiri lebih menonjol di atas tabel, bukan cuma dicari manual di antara 31
// baris. super_admin/kader tidak punya "puskesmas sendiri" yang relevan di sini.
const myPuskesmas = computed(() => {
  if (!isAdminPuskesmas.value && !isPjProlanis.value) return null
  const id = authStore.user?.puskesmas_id
  if (!id) return null
  return puskesmasList.value.find((p) => p.id === id) ?? null
})

function googleMapsUrl(p: Puskesmas): string | null {
  if (p.latitude == null || p.longitude == null) return null
  return `https://www.google.com/maps?q=${p.latitude},${p.longitude}`
}

// --- Edit — PATCH /api/v1/puskesmas/{id} (cuma field kontak, bukan nama/kode) ---
const showEditModal = ref(false)
const editingPuskesmas = ref<Puskesmas | null>(null)
const editForm = ref<UpdatePuskesmasPayload>({})
const isSaving = ref(false)
const saveError = ref('')
const fieldErrors = ref<Record<string, string[]>>({})

// Titik lokasi via peta drag-pin (MapLibre + tile server sendiri, BUKAN Google Maps -- proyek
// ini sengaja tidak pakai Google Maps sama sekali, lihat NUXT_PUBLIC_TILE_SERVER_URL) --
// menggantikan input angka latitude/longitude manual yang tidak user-friendly. Marker bisa
// diseret ATAU klik titik baru di peta, keduanya update editForm.latitude/longitude yang sama.
const mapPickerContainer = ref<HTMLElement | null>(null)
let pickerMapInstance: any = null
let pickerMarker: any = null
// Pusat default: Kabupaten Sumenep, dipakai kalau puskesmas belum punya titik sama sekali.
const SUMENEP_CENTER: [number, number] = [113.85, -7.02]

function setPickedLocation(lng: number, lat: number) {
  editForm.value.latitude = Number(lat.toFixed(7))
  editForm.value.longitude = Number(lng.toFixed(7))
}

// Drawer input manual lat/long (permintaan user) -- tersembunyi di belakang link "Input Detail
// Latitude dan Longitude" di bawah peta, buat kasus staf sudah PUNYA koordinat presisi (mis.
// dari GPS device lapangan) dan tidak mau menerka via klik peta. Tetap sinkron DUA ARAH dengan
// picker peta: ubah manual di sini ikut menggeser marker (syncMarkerFromManualInput), ubah lewat
// peta tetap update angka di drawer ini juga (v-model ke editForm yang sama).
const showLatLngDrawer = ref(false)

function syncMarkerFromManualInput() {
  const lat = editForm.value.latitude
  const lng = editForm.value.longitude
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return
  if (!pickerMapInstance || !pickerMarker) return
  pickerMarker.setLngLat([lng, lat])
  pickerMapInstance.flyTo({ center: [lng, lat] })
}

function loadMapLibreScript(): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).maplibregl) {
      resolve()
      return
    }
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css'
    document.head.appendChild(css)

    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js'
    script.onload = () => resolve()
    document.head.appendChild(script)
  })
}

async function initMapPicker() {
  await loadMapLibreScript()
  await nextTick()
  if (!mapPickerContainer.value) return

  const maplibregl = (window as any).maplibregl
  const config = useRuntimeConfig()
  const hasExisting = editForm.value.latitude != null && editForm.value.longitude != null
  const center: [number, number] = hasExisting
    ? [editForm.value.longitude as number, editForm.value.latitude as number]
    : SUMENEP_CENTER

  pickerMapInstance = new maplibregl.Map({
    container: mapPickerContainer.value,
    style: `${config.public.tileServerUrl}/styles/basemap/style.json`,
    center,
    zoom: hasExisting ? 15 : 11,
    minZoom: 9
  })
  pickerMapInstance.addControl(new maplibregl.NavigationControl(), 'top-right')

  pickerMarker = new maplibregl.Marker({ draggable: true, color: '#0f766e' })
    .setLngLat(center)
    .addTo(pickerMapInstance)

  pickerMarker.on('dragend', () => {
    const { lng, lat } = pickerMarker.getLngLat()
    setPickedLocation(lng, lat)
  })

  // Klik di mana pun di peta juga memindahkan titik -- tidak wajib menyeret marker presisi
  // dulu, staf puskesmas (bukan semuanya mahir peta digital) bisa langsung klik lokasi yang
  // benar berkali-kali sampai pas.
  pickerMapInstance.on('click', (e: any) => {
    pickerMarker.setLngLat(e.lngLat)
    setPickedLocation(e.lngLat.lng, e.lngLat.lat)
  })

  pickerMapInstance.on('load', () => pickerMapInstance.resize())
}

function destroyMapPicker() {
  if (pickerMapInstance) {
    pickerMapInstance.remove()
    pickerMapInstance = null
    pickerMarker = null
  }
}

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
  showLatLngDrawer.value = false
  showEditModal.value = true
  nextTick(() => initMapPicker())
}

function closeEditModal() {
  showEditModal.value = false
  destroyMapPicker()
}

onUnmounted(destroyMapPicker)

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
    closeEditModal()
    useToast().add({ title: 'Data instansi berhasil diperbarui', color: 'success' })
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

    <!-- Cari-otomatis koordinat se-Kabupaten Sumenep (super_admin, permintaan Bu Kadis) -->
    <div v-if="isSuperAdmin" class="bg-white rounded-2xl border border-slate-100 shadow-card p-5 sm:p-6">
       <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-start gap-3">
             <div class="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <LucideMapPinned class="w-5 h-5" />
             </div>
             <div>
                <h2 class="text-base font-bold text-accent">Cari Otomatis Koordinat Se-Kabupaten Sumenep</h2>
                <p class="text-xs text-slate-500 mt-0.5">Cari titik lokasi seluruh puskesmas sekaligus lewat OpenStreetMap, berdasarkan nama dan alamat. Admin puskesmas tetap bisa mengoreksi manual di peta kalau hasilnya kurang tepat.</p>
             </div>
          </div>
          <button
             @click="runGeocodeAll"
             :disabled="isGeocodingAll"
             class="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-primary hover:bg-primary-600 disabled:opacity-50 transition-colors shadow-sm shrink-0"
          >
             <LucideLoader2 v-if="isGeocodingAll" class="w-4 h-4 animate-spin" />
             <LucideSearch v-else class="w-4 h-4" />
             {{ isGeocodingAll ? 'Mencari...' : 'Cari Sekarang' }}
          </button>
       </div>

       <label class="flex items-center gap-2 mt-4 text-xs font-medium text-slate-600 cursor-pointer">
          <input v-model="overwriteExistingCoords" type="checkbox" class="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30" />
          Timpa juga puskesmas yang sudah punya koordinat (biasanya cukup dilewati -- default aman)
       </label>

       <p v-if="isGeocodingAll" class="text-xs text-slate-500 mt-3">Mohon tunggu, ~1 detik per puskesmas (batas kebijakan pemakaian OpenStreetMap Nominatim) -- bisa sampai satu menit untuk seluruh Sumenep.</p>
       <p v-if="geocodeError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2 mt-3">{{ geocodeError }}</p>

       <div v-if="geocodeResult" class="mt-4 border-t border-slate-100 pt-4">
          <div class="flex flex-wrap gap-3 text-xs font-bold">
             <span class="bg-success/10 text-success px-2.5 py-1 rounded-full">{{ geocodeResult.updated }} berhasil</span>
             <span class="bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">{{ geocodeResult.skipped }} dilewati (sudah punya koordinat)</span>
             <span v-if="geocodeResult.failed > 0" class="bg-danger/10 text-danger px-2.5 py-1 rounded-full">{{ geocodeResult.failed }} gagal</span>
          </div>
          <div v-if="geocodeResult.failed > 0" class="mt-3 max-h-40 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100">
             <div v-for="d in geocodeResult.details.filter((x) => x.status === 'failed')" :key="d.puskesmas_id" class="px-3 py-2 text-xs">
                <span class="font-bold text-slate-700">{{ d.nama }}</span>
                <span class="text-slate-400"> — {{ d.reason }}</span>
             </div>
          </div>
       </div>
    </div>

    <!-- Card Personalisasi Puskesmas Sendiri (admin_puskesmas/pj_prolanis) -->
    <div v-if="myPuskesmas" class="bg-white rounded-2xl border border-primary/20 shadow-card p-5 sm:p-6">
       <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div class="flex items-start gap-3">
             <div class="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <LucideBuilding2 class="w-5 h-5" />
             </div>
             <div>
                <p class="text-[10px] font-bold text-primary uppercase tracking-wide">Puskesmas Anda</p>
                <h2 class="text-lg font-extrabold text-accent">{{ myPuskesmas.nama }}</h2>
                <span class="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{{ myPuskesmas.kode_internal }}</span>
             </div>
          </div>
          <button
             v-if="isAdminPuskesmas"
             @click="openEditModal(myPuskesmas)"
             class="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-primary hover:bg-primary-600 transition-colors shadow-sm shrink-0"
          >
             <LucideEdit class="w-4 h-4" />
             Edit Info Puskesmas
          </button>
       </div>

       <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          <div class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
             <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Alamat</p>
             <p class="text-sm font-bold text-slate-700 mt-0.5">{{ myPuskesmas.alamat || '-' }}</p>
          </div>
          <div class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
             <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Kontak</p>
             <p class="text-sm font-bold text-slate-700 mt-0.5">{{ myPuskesmas.no_telp || '-' }}<template v-if="myPuskesmas.no_wa"> &bull; WA: {{ myPuskesmas.no_wa }}</template></p>
          </div>
          <div class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
             <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Status</p>
             <p class="text-sm font-bold mt-0.5" :class="myPuskesmas.status_aktif ? 'text-success' : 'text-slate-500'">{{ myPuskesmas.status_aktif ? 'Aktif' : 'Nonaktif' }}</p>
          </div>
          <div class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
             <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Titik Lokasi</p>
             <a
                v-if="googleMapsUrl(myPuskesmas)"
                :href="googleMapsUrl(myPuskesmas)!"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm font-bold text-primary hover:underline mt-0.5 inline-flex items-center gap-1"
             >
                Buka di Google Maps <LucideExternalLink class="w-3 h-3" />
             </a>
             <p v-else class="text-sm font-bold text-slate-400 mt-0.5">Belum ditandai</p>
          </div>
       </div>
       <p v-if="myPuskesmas.deskripsi" class="text-sm text-slate-600 mt-4 border-t border-slate-100 pt-4">{{ myPuskesmas.deskripsi }}</p>
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
              <th class="py-4 px-5 font-semibold text-center">Lokasi</th>
              <th class="py-4 px-5 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <!-- Skeleton HANYA saat load pertama/belum ada data -- geocode-all (bisa ~1 menit)
                 memicu refetch di akhir, tidak boleh mengosongkan tabel yang sedang dilihat user
                 selama itu. Pola sama dgn dashboard/rujukan/index.vue. -->
            <tr v-if="isLoading && puskesmasList.length === 0">
               <td colspan="6" class="py-12 text-center text-slate-400">
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
               <td class="py-4 px-5 text-center">
                  <a
                     v-if="googleMapsUrl(puskesmas)"
                     :href="googleMapsUrl(puskesmas)!"
                     target="_blank"
                     rel="noopener noreferrer"
                     class="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  >
                     <LucideMapPin class="w-3.5 h-3.5" /> Peta
                  </a>
                  <span v-else class="text-slate-300 text-xs">-</span>
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
               <td colspan="6" class="py-12 text-center">
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
       <div class="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
          <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
             <h3 class="font-bold text-accent text-lg flex items-center gap-2">
               <LucideEdit class="w-5 h-5 text-primary" />
               Edit Data Instansi
             </h3>
             <button @click="closeEditModal" class="text-slate-400 hover:text-slate-600 p-1">
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

             <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Titik Lokasi Puskesmas</label>
                <p class="text-[11px] text-slate-500 mb-2">Seret pin atau klik titik yang benar di peta.</p>
                <div ref="mapPickerContainer" class="w-full h-64 rounded-xl overflow-hidden border border-slate-200 bg-slate-100"></div>
                <p class="text-[11px] text-slate-500 mt-1.5">
                   <template v-if="editForm.latitude != null && editForm.longitude != null">
                      Koordinat: {{ editForm.latitude }}, {{ editForm.longitude }}
                   </template>
                   <template v-else>Belum ada titik lokasi -- klik di peta untuk menandai.</template>
                </p>
                <p v-if="fieldErrors.latitude" class="text-xs text-danger mt-1">{{ fieldErrors.latitude[0] }}</p>
                <p v-if="fieldErrors.longitude" class="text-xs text-danger mt-1">{{ fieldErrors.longitude[0] }}</p>

                <!-- Drawer input manual (permintaan user) -- opsi kedua di belakang link ini
                     untuk staf yang sudah punya koordinat presisi sendiri, tidak perlu klik peta. -->
                <button
                   type="button"
                   @click="showLatLngDrawer = !showLatLngDrawer"
                   class="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                >
                   <LucideChevronDown class="w-3.5 h-3.5 transition-transform" :class="showLatLngDrawer ? 'rotate-180' : ''" />
                   Input Detail Latitude dan Longitude
                </button>
                <div v-if="showLatLngDrawer" class="mt-2 grid grid-cols-2 gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
                   <div>
                      <label class="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Latitude</label>
                      <input
                         v-model.number="editForm.latitude"
                         @change="syncMarkerFromManualInput"
                         type="number"
                         step="any"
                         placeholder="-7.0123456"
                         class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                   </div>
                   <div>
                      <label class="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Longitude</label>
                      <input
                         v-model.number="editForm.longitude"
                         @change="syncMarkerFromManualInput"
                         type="number"
                         step="any"
                         placeholder="113.8765432"
                         class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                   </div>
                </div>
             </div>

             <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Deskripsi</label>
                <textarea v-model="editForm.deskripsi" rows="2" placeholder="Deskripsi singkat..." class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"></textarea>
                <p v-if="fieldErrors.deskripsi" class="text-xs text-danger mt-1">{{ fieldErrors.deskripsi[0] }}</p>
             </div>
          </div>

          <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
             <button @click="closeEditModal" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
             <button @click="saveEdit" :disabled="isSaving" class="py-2.5 px-6 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm">
                <LucideLoader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
                {{ isSaving ? 'Menyimpan...' : 'Simpan Perubahan' }}
             </button>
          </div>
       </div>
    </div>
  </div>
</template>
