<script setup lang="ts">
import type { ApiSuccessEnvelope, PaginatedData, Patient, SearchPatientByNikPayload } from '~/types/api'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
useHead({
  title: 'Data Pasien'
})

// GET /api/v1/patients (docs/planning/05) -- backend cuma dukung filter wilayah_status/risk_level
// + pagination (per_page dibatasi 100), tidak ada search/kecamatan di query. Search & filter
// kecamatan di bawah cuma jalan di window yang sudah ke-fetch (100 pertama), BUKAN seluruh data --
// sama seperti pola filter kecamatan di modal bulk-assignment /dashboard/kunjungan.
const patients = ref<Patient[]>([])
const totalCount = ref(0)
const isLoading = ref(false)
const loadError = ref('')

const authStore = useAuthStore()
const isSuperAdmin = computed(() => (authStore.roles ?? []).includes('super_admin'))

const searchQuery = ref('')
const filterRisk = ref('')
const filterKecamatan = ref('')

// admin_puskesmas/pj_prolanis: kecamatan filter OTOMATIS terkunci ke kecamatan puskesmas
// mereka sendiri (docs/planning §7 lanjutan) -- backend GET /patients SUDAH scope ke puskesmas
// sendiri (PatientQueryService), ini murni UX supaya mereka tidak bisa "mencari" kecamatan lain
// yang toh datanya tidak akan pernah ada utk mereka. super_admin TETAP bebas pilih apa saja.
async function lockKecamatanToOwnPuskesmas() {
  if (isSuperAdmin.value || !authStore.user?.puskesmas_id) return
  try {
    const api = useApi()
    const res = await api(`/puskesmas/${authStore.user.puskesmas_id}`) as ApiSuccessEnvelope<{ kecamatan: { nama: string } | null }>
    if (res.data.kecamatan) {
      filterKecamatan.value = res.data.kecamatan.nama
    }
  } catch (e) {
    console.error('Gagal memuat kecamatan puskesmas sendiri', e)
  }
}

// Deep-link dari card "Lihat Detail" di /dashboard (docs/planning/02 §17) — ?risk_level=berat|
// sedang|ringan pre-select filter di atas. Validasi ketat (bukan langsung pakai apa adanya) --
// query URL bisa diubah manual/dibagikan, jangan biarkan nilai sembarangan lolos ke request API.
const VALID_RISK_LEVELS = ['berat', 'sedang', 'ringan']
const route = useRoute()
if (typeof route.query.risk_level === 'string' && VALID_RISK_LEVELS.includes(route.query.risk_level)) {
  filterRisk.value = route.query.risk_level
}

async function loadPatients() {
  isLoading.value = true
  loadError.value = ''
  try {
    const api = useApi()
    const res = await api('/patients', {
      query: {
        per_page: 100,
        ...(filterRisk.value ? { risk_level: filterRisk.value } : {})
      }
    }) as ApiSuccessEnvelope<PaginatedData<Patient>>
    patients.value = res.data.items
    totalCount.value = res.data.pagination.total
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Gagal memuat data pasien.'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadPatients()
  lockKecamatanToOwnPuskesmas()
})
watch(filterRisk, loadPatients)

function calculateAge(dob) {
  if (!dob) return null
  const diffMs = Date.now() - new Date(dob).getTime()
  return Math.abs(new Date(diffMs).getUTCFullYear() - 1970)
}

// Opsi kecamatan SEBELUMNYA diturunkan dari 100 pasien pertama yang ke-fetch -- makanya
// pilihannya cuma sedikit walau Sumenep py 27 kecamatan. Sekarang ambil daftar LENGKAP dari
// /sumenep.geojson (sumber kebenaran nama kecamatan yang SAMA dipakai peta dashboard), bukan
// diturunkan dari data pasien yang kebetulan ter-load.
const kecamatanFullList = ref<string[]>([])
async function loadKecamatanFullList() {
  try {
    const geo = await (await fetch('/sumenep.geojson')).json()
    kecamatanFullList.value = geo.features
      .map((f: any) => f.properties?.name as string)
      .filter(Boolean)
      .sort()
  } catch (e) {
    console.error('Gagal memuat daftar kecamatan', e)
  }
}
onMounted(loadKecamatanFullList)

const kecamatanOptions = computed(() => {
  if (kecamatanFullList.value.length > 0) return kecamatanFullList.value
  const set = new Set(patients.value.map((p) => p.kecamatan_raw).filter(Boolean))
  return [...set].sort()
})
// USelectMenu (Nuxt UI) -- typeahead, cari nama kecamatan langsung sambil ketik daripada
// scroll dropdown panjang 27 opsi. value-key eksplisit -- default USelectMenu tanpa value-key
// mengembalikan OBJEK item utuh, bukan string filterKecamatan yang dipakai computed di atas.
// TIDAK ada item sentinel "Semua Kecamatan" bervalue '' -- ComboboxItem menolak value string
// kosong (dipakai secara internal utk clear-selection), placeholder sudah cukup mewakili
// "belum pilih apa-apa" begitu v-model kosong (lihat props di template).
const kecamatanSelectItems = computed(() => kecamatanOptions.value.map((k) => ({ label: k, value: k })))

const filteredPatients = computed(() => {
  return patients.value.filter((p) => {
    const q = searchQuery.value.toLowerCase()
    const matchSearch = q
      ? p.nama.toLowerCase().includes(q) || (p.no_reg ?? '').toLowerCase().includes(q)
      : true
    const matchKecamatan = filterKecamatan.value ? p.kecamatan_raw === filterKecamatan.value : true
    return matchSearch && matchKecamatan
  })
})

const getRiskColor = (risk) => {
  if (risk === 'berat') return 'bg-danger/10 text-danger border border-danger/20'
  if (risk === 'sedang') return 'bg-warning/10 text-warning border border-warning/20'
  if (risk === 'ringan') return 'bg-success/10 text-success border border-success/20'
  return 'bg-slate-100 text-slate-600 border border-slate-200'
}

const getRiskLabel = (risk) => {
  if (risk === 'berat') return 'Risiko Berat'
  if (risk === 'sedang') return 'Risiko Sedang'
  if (risk === 'ringan') return 'Risiko Ringan'
  return 'Belum Dihitung'
}

const getWilayahColor = (status) => {
  if (status === 'resolved') return 'bg-success/10 text-success border border-success/20'
  if (status === 'unresolved') return 'bg-warning/10 text-warning border border-warning/20'
  return 'bg-slate-100 text-slate-600 border border-slate-200'
}

const getWilayahLabel = (status) => {
  if (status === 'resolved') return 'Wilayah Cocok'
  if (status === 'unresolved') return 'Belum Cocok'
  if (status === 'out_of_scope') return 'Luar Cakupan'
  return 'Tidak Diketahui'
}

// --- Pencarian by NIK (POST /patients/search-nik) -----------------------------------------
// KOPIPU tidak pernah menyimpan NIK asli (patients_cache cuma punya nik_hash HMAC dari
// SiLAKES) -- pencarian ini cuma cocokkan hash-vs-hash di server, TIDAK PERNAH bisa
// menampilkan digit NIK asli. Deteksi otomatis: begitu kotak pencarian berisi PERSIS 16 digit
// angka, itu jelas maksudnya NIK (bukan nama/no. registrasi) -- langsung minta konfirmasi
// password sebelum benar-benar mencari (step-up auth, pencarian identitas presisi ini lebih
// sensitif daripada browse list biasa).
const NIK_PATTERN = /^\d{16}$/
let lastPromptedNik = ''

const showNikPasswordModal = ref(false)
const pendingNik = ref('')
const nikPassword = ref('')
const isSearchingNik = ref(false)
const nikSearchError = ref('')
const showNikNotFoundModal = ref(false)

watch(searchQuery, (value) => {
  const trimmed = value.trim()
  if (NIK_PATTERN.test(trimmed) && trimmed !== lastPromptedNik) {
    lastPromptedNik = trimmed
    pendingNik.value = trimmed
    nikPassword.value = ''
    nikSearchError.value = ''
    showNikPasswordModal.value = true
  }
  if (!NIK_PATTERN.test(trimmed)) {
    lastPromptedNik = ''
  }
})

function closeNikPasswordModal() {
  showNikPasswordModal.value = false
  nikPassword.value = ''
  nikSearchError.value = ''
}

async function submitNikSearch() {
  if (!nikPassword.value) {
    nikSearchError.value = 'Masukkan password Anda untuk melanjutkan.'
    return
  }
  isSearchingNik.value = true
  nikSearchError.value = ''
  try {
    const api = useApi()
    const payload: SearchPatientByNikPayload = { nik: pendingNik.value, password: nikPassword.value }
    const res = await api('/patients/search-nik', { method: 'POST', body: payload }) as ApiSuccessEnvelope<Patient | null>
    showNikPasswordModal.value = false
    if (res.data) {
      await navigateTo(`/dashboard/pasien/${res.data.id}`)
    } else {
      showNikNotFoundModal.value = true
    }
  } catch (e) {
    if (e instanceof ApiError) {
      nikSearchError.value = e.errors?.password?.[0] ?? e.errors?.nik?.[0] ?? e.message
    } else {
      nikSearchError.value = 'Gagal mencari pasien. Coba lagi.'
    }
  } finally {
    isSearchingNik.value = false
  }
}

function closeNikNotFoundModal() {
  showNikNotFoundModal.value = false
  searchQuery.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header Section -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-accent">Data Pasien Prolanis</h1>
        <p class="text-sm text-slate-500 mt-1">Kelola dan pantau seluruh data pasien Prolanis.</p>
        <!-- Data pasien ditarik dari SiLAKES via sinkronisasi backend (SyncSilakesService) --
             PatientsCachePolicy::create() SENGAJA selalu false, tidak ada tombol "Tambah Pasien"
             manual di sini. -->
        <p v-if="loadError" class="text-xs font-semibold text-danger mt-1">{{ loadError }}</p>
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
            inputmode="text"
            maxlength="16"
            placeholder="Cari nama, no. registrasi, atau NIK (16 digit)..."
            class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
          />
          <p v-if="/^\d+$/.test(searchQuery.trim()) && searchQuery.trim().length > 0 && searchQuery.trim().length < 16" class="absolute -bottom-5 left-1 text-[11px] font-semibold text-slate-400">
            Mendeteksi NIK — {{ searchQuery.trim().length }}/16 digit
          </p>
        </div>

        <div class="flex items-center gap-3 w-full md:w-auto">
          <select v-model="filterRisk" class="flex-1 md:w-40 py-2.5 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
            <option value="">Semua Risiko</option>
            <option value="berat">Risiko Berat</option>
            <option value="sedang">Risiko Sedang</option>
            <option value="ringan">Risiko Ringan</option>
          </select>
          <USelectMenu
            v-model="filterKecamatan"
            :items="kecamatanSelectItems"
            value-key="value"
            placeholder="Semua Kecamatan"
            :disabled="!isSuperAdmin"
            class="flex-1 md:w-48"
          />
        </div>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[950px]">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <th class="py-4 px-5 font-semibold">Nama Pasien</th>
              <th class="py-4 px-5 font-semibold">No. Registrasi</th>
              <th class="py-4 px-5 font-semibold text-center">Usia / JK</th>
              <th class="py-4 px-5 font-semibold">Lokasi</th>
              <th class="py-4 px-5 font-semibold">Tingkat Risiko</th>
              <th class="py-4 px-5 font-semibold text-center">Status Wilayah</th>
              <th class="py-4 px-5 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="isLoading">
               <td colspan="7" class="py-12 text-center text-slate-400">
                  <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
                  Memuat data pasien...
               </td>
            </tr>
            <tr v-for="patient in filteredPatients" :key="patient.id" class="hover:bg-slate-50/80 transition-colors group">
               <td class="py-4 px-5">
                  <div class="flex items-center gap-3">
                     <div class="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shadow-sm border border-primary/20 shrink-0">
                        {{ patient.nama.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() }}
                     </div>
                     <span class="font-bold text-slate-800">{{ patient.nama }}</span>
                  </div>
               </td>
               <td class="py-4 px-5 text-sm font-medium text-slate-600">{{ patient.no_reg || '-' }}</td>
               <td class="py-4 px-5 text-sm font-semibold text-slate-700 text-center">
                  <template v-if="calculateAge(patient.tgl_lahir)">{{ calculateAge(patient.tgl_lahir) }} thn <span class="text-slate-400 font-normal">/</span> {{ patient.gender || '-' }}</template>
                  <span v-else class="text-slate-300">-</span>
               </td>
               <td class="py-4 px-5">
                  <p class="text-sm font-bold text-slate-700">{{ patient.kecamatan_raw || '-' }}</p>
                  <p class="text-[11px] font-medium text-slate-500 mt-0.5">Desa {{ patient.kel_desa_raw || '-' }}</p>
               </td>
               <td class="py-4 px-5">
                  <span class="px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider" :class="getRiskColor(patient.risk_level)">
                     {{ getRiskLabel(patient.risk_level) }}
                  </span>
               </td>
               <td class="py-4 px-5 text-center">
                  <span class="px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider" :class="getWilayahColor(patient.wilayah_status)">
                     {{ getWilayahLabel(patient.wilayah_status) }}
                  </span>
               </td>
               <td class="py-4 px-5 text-right">
                  <NuxtLink :to="`/dashboard/pasien/${patient.id}`" class="inline-flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:text-primary hover:border-primary transition-colors p-2 rounded-xl shadow-sm">
                     <LucideEye class="w-4 h-4" />
                  </NuxtLink>
               </td>
            </tr>
            <tr v-if="!isLoading && filteredPatients.length === 0">
               <td colspan="7" class="py-12 text-center">
                 <div class="flex flex-col items-center justify-center text-slate-400">
                    <LucideSearchX class="w-10 h-10 mb-3 text-slate-300" />
                    <p class="font-medium">Tidak ada data pasien yang ditemukan.</p>
                 </div>
               </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Ringkasan -->
      <div class="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
        <span class="text-sm text-slate-500">
          Menampilkan <b class="text-slate-700">{{ filteredPatients.length }}</b> dari <b class="text-slate-700">{{ patients.length }}</b> pasien dimuat
          <template v-if="totalCount > patients.length"> (total <b class="text-slate-700">{{ totalCount }}</b> pasien di sistem — cari nama/no. registrasi kalau tidak ditemukan di halaman ini)</template>
        </span>
      </div>

    </div>

    <!-- Modal konfirmasi password sebelum cari-by-NIK -- step-up auth, pencarian identitas
         presisi ini lebih sensitif daripada browse list biasa. -->
    <Transition name="fade">
      <div v-if="showNikPasswordModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" @click="closeNikPasswordModal">
        <div class="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200" @click.stop>
          <div class="p-6">
            <div class="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <LucideShieldCheck class="w-7 h-7" />
            </div>
            <h3 class="font-bold text-accent text-lg mb-1">Konfirmasi Password</h3>
            <p class="text-sm text-slate-500 mb-5 leading-relaxed">
              Pencarian berdasarkan NIK adalah pencarian identitas presisi. Masukkan password akun Anda untuk melanjutkan.
            </p>

            <p v-if="nikSearchError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2 mb-4">{{ nikSearchError }}</p>

            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Password Anda</label>
            <input
              v-model="nikPassword"
              type="password"
              autocomplete="current-password"
              placeholder="Masukkan password login Anda"
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary mb-5"
              @keyup.enter="submitNikSearch"
            />

            <div class="flex gap-3">
              <button @click="closeNikPasswordModal" class="flex-1 py-2.5 px-4 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-colors">Batal</button>
              <button
                @click="submitNikSearch"
                :disabled="isSearchingNik"
                class="flex-1 py-2.5 px-4 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <LucideLoader2 v-if="isSearchingNik" class="w-4 h-4 animate-spin" />
                {{ isSearchingNik ? 'Mencari...' : 'Cari' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- "Sweet alert" custom -- NIK tidak ditemukan. Bukan browser alert() bawaan, dibuat
         sendiri agar terasa lembut & tidak menakutkan (bisa jadi cuma salah ketik, bukan error
         sistem). -->
    <Transition name="fade">
      <div v-if="showNikNotFoundModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" @click="closeNikNotFoundModal">
        <div class="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200 text-center p-8" @click.stop>
          <div class="w-16 h-16 rounded-full bg-warning/10 text-warning flex items-center justify-center mx-auto mb-5">
            <LucideSearchX class="w-8 h-8" />
          </div>
          <h3 class="font-bold text-accent text-lg mb-2">Pasien Tidak Ditemukan</h3>
          <p class="text-sm text-slate-500 leading-relaxed mb-6">
            Tidak ada data pasien dengan NIK tersebut di wilayah kerja Anda. Coba periksa kembali nomornya, atau mungkin pasien belum tersinkron dari SiLAKES.
          </p>
          <button @click="closeNikNotFoundModal" class="w-full py-3 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 transition-colors shadow-sm">
            Mengerti
          </button>
        </div>
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
