<script setup lang="ts">
import type { ApiSuccessEnvelope, PaginatedData, Patient, SearchPatientByNikPayload, Kecamatan } from '~/types/api'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
useHead({
  title: 'Data Pasien'
})

// GET /api/v1/patients -- SEMUA filter (wilayah_status/risk_level/kecamatan_id/search) SEKARANG
// diterapkan SERVER-SIDE, termasuk kecamatan_id yang match ke kolom patients_cache.kecamatan_id
// (id kanonik hasil WilayahResolver, BUKAN teks bebas kecamatan_raw). SEBELUMNYA kecamatan &
// pencarian cuma menyaring window 100 pasien pertama yang ke-fetch -- itu sebabnya hasilnya
// beda-beda tergantung filter LAIN yang aktif (bug nyata: "Semua Status Wilayah" + Gapura tampil
// 3 pasien, "Wilayah Cocok" + Gapura tampil 47 -- padahal "Semua" seharusnya superset, bukan
// subset). Backend sekarang selalu mengembalikan hasil gabungan filter yang benar dari SELURUH
// data, bukan cuma yang kebetulan sudah dimuat di klien.
const patients = ref<Patient[]>([])
const totalCount = ref(0)
const currentPage = ref(1)
const lastPage = ref(1)
const isLoading = ref(false)
const loadError = ref('')
const PER_PAGE = 50

const authStore = useAuthStore()
const isSuperAdmin = computed(() => (authStore.roles ?? []).includes('super_admin'))

const searchQuery = ref('')
const filterRisk = ref('')
const filterKecamatanId = ref<number | null>(null)
const filterWilayahStatus = ref('')

// admin_puskesmas/pj_prolanis: kecamatan filter OTOMATIS terkunci ke kecamatan puskesmas
// mereka sendiri (docs/planning §7 lanjutan) -- backend GET /patients SUDAH scope ke puskesmas
// sendiri (PatientQueryService), ini murni UX supaya mereka tidak bisa "mencari" kecamatan lain
// yang toh datanya tidak akan pernah ada utk mereka. super_admin TETAP bebas pilih apa saja.
async function lockKecamatanToOwnPuskesmas() {
  if (isSuperAdmin.value || !authStore.user?.puskesmas_id) return
  try {
    const api = useApi()
    const res = await api(`/puskesmas/${authStore.user.puskesmas_id}`) as ApiSuccessEnvelope<{ kecamatan: { id: number, nama: string } | null }>
    if (res.data.kecamatan) {
      filterKecamatanId.value = res.data.kecamatan.id
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

async function loadPatients(page = 1) {
  isLoading.value = true
  loadError.value = ''
  try {
    const api = useApi()
    const res = await api('/patients', {
      query: {
        per_page: PER_PAGE,
        page,
        ...(filterRisk.value ? { risk_level: filterRisk.value } : {}),
        ...(filterWilayahStatus.value ? { wilayah_status: filterWilayahStatus.value } : {}),
        ...(filterKecamatanId.value ? { kecamatan_id: filterKecamatanId.value } : {}),
        ...(searchQuery.value.trim() ? { search: searchQuery.value.trim() } : {})
      }
    }) as ApiSuccessEnvelope<PaginatedData<Patient>>
    patients.value = res.data.items
    totalCount.value = res.data.pagination.total
    currentPage.value = res.data.pagination.current_page
    lastPage.value = res.data.pagination.last_page
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Gagal memuat data pasien.'
  } finally {
    isLoading.value = false
  }
}

function goToPage(page: number) {
  if (page < 1 || page > lastPage.value || page === currentPage.value || isLoading.value) return
  loadPatients(page)
}

onMounted(() => {
  loadPatients()
  lockKecamatanToOwnPuskesmas()
})

// Reload otomatis begitu sinkronisasi SiLAKES berhasil -- tetap di halaman & filter yang
// sama (loadPatients(currentPage.value) pakai filter/halaman yang sedang aktif di ref,
// bukan reset ke halaman 1).
const silakesSyncSignal = useSilakesSyncSignal()
watch(silakesSyncSignal, () => {
  loadPatients(currentPage.value)
})
// Ganti filter apa pun -> selalu balik ke halaman 1 (halaman 5 hasil filter lama biasanya
// tidak nyambung sama sekali dengan hasil filter baru).
watch(filterRisk, () => loadPatients(1))
watch(filterWilayahStatus, () => loadPatients(1))
watch(filterKecamatanId, () => loadPatients(1))

// Debounce pencarian nama/no. registrasi -- SERVER-SIDE sekarang, jangan panggil API di setiap
// ketukan huruf.
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => loadPatients(1), 350)
})

function formatId(n: number): string {
  return n.toLocaleString('id-ID')
}

function calculateAge(dob) {
  if (!dob) return null
  const diffMs = Date.now() - new Date(dob).getTime()
  return Math.abs(new Date(diffMs).getUTCFullYear() - 1970)
}

// Daftar kecamatan KANONIK dari GET /api/v1/kecamatan (id asli 27 kecamatan Sumenep) -- filter
// sekarang kirim kecamatan_id ke backend, bukan lagi cocokkan teks bebas kecamatan_raw yang
// kapitalisasi/ejaannya beda-beda dari SiLAKES (lihat catatan bug di atas).
const kecamatanList = ref<Kecamatan[]>([])
async function loadKecamatanList() {
  try {
    const api = useApi()
    const res = await api('/kecamatan') as ApiSuccessEnvelope<Kecamatan[]>
    kecamatanList.value = res.data
  } catch (e) {
    console.error('Gagal memuat daftar kecamatan', e)
  }
}
onMounted(loadKecamatanList)

// USelectMenu (Nuxt UI) -- typeahead, cari nama kecamatan langsung sambil ketik daripada scroll
// dropdown panjang 27 opsi. value-key eksplisit -- default USelectMenu tanpa value-key
// mengembalikan OBJEK item utuh, bukan number id yang dipakai filterKecamatanId.
const kecamatanSelectItems = computed(() => kecamatanList.value.map((k) => ({ label: k.nama, value: k.id })))

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

// jenis_prolanis BISA null walau is_prolanis=true (SiLAKES cuma tahu pasien ikut Prolanis,
// jenisnya belum tercatat) -- ditangani sebagai "Belum Diketahui" secara eksplisit, BUKAN
// dikosongkan begitu saja, supaya jelas bedanya dari data yang genuinely tidak ada vs field
// yang lupa ditampilkan.
const getProlanisLabel = (jenis: string | null) => {
  if (jenis === 'DM') return 'Diabetes Mellitus'
  if (jenis === 'HT') return 'Hipertensi'
  if (jenis === 'DM_HT') return 'DM & Hipertensi'
  return 'Belum Diketahui'
}

const getProlanisColor = (jenis: string | null) => {
  if (jenis === 'DM') return 'bg-danger/10 text-danger border border-danger/20'
  if (jenis === 'HT') return 'bg-warning/10 text-warning border border-warning/20'
  if (jenis === 'DM_HT') return 'bg-secondary/10 text-secondary border border-secondary/20'
  return 'bg-slate-100 text-slate-500 border border-slate-200'
}

// Ringkasan kalimat gabungan SEMUA filter aktif (risiko + status wilayah + kata kunci +
// kecamatan), mis. "122 Data Pasien dengan Risiko Sedang dan Status Wilayah Cocok di Kecamatan
// Gapura" -- totalCount dari pagination.total (hasil query TERFILTER backend, bukan window
// klien), jadi selalu akurat gabungan seluruh filter, bukan cuma yang kebetulan sudah dimuat.
const RISK_LABELS: Record<string, string> = { berat: 'Risiko Berat', sedang: 'Risiko Sedang', ringan: 'Risiko Ringan' }
const WILAYAH_STATUS_LABELS: Record<string, string> = {
  resolved: 'Status Wilayah Cocok',
  unresolved: 'Status Wilayah Belum Cocok',
  unknown: 'Status Wilayah Tidak Diketahui',
  out_of_scope: 'Status Luar Cakupan'
}

const filterSummaryText = computed(() => {
  const qualifiers: string[] = []
  if (filterRisk.value && RISK_LABELS[filterRisk.value]) qualifiers.push(RISK_LABELS[filterRisk.value])
  if (filterWilayahStatus.value && WILAYAH_STATUS_LABELS[filterWilayahStatus.value]) {
    qualifiers.push(WILAYAH_STATUS_LABELS[filterWilayahStatus.value])
  }
  if (searchQuery.value.trim()) qualifiers.push(`kata kunci "${searchQuery.value.trim()}"`)

  let sentence = `${formatId(totalCount.value)} Data Pasien`
  if (qualifiers.length === 1) {
    sentence += ` dengan ${qualifiers[0]}`
  } else if (qualifiers.length === 2) {
    sentence += ` dengan ${qualifiers[0]} dan ${qualifiers[1]}`
  } else if (qualifiers.length > 2) {
    sentence += ` dengan ${qualifiers.slice(0, -1).join(', ')}, dan ${qualifiers[qualifiers.length - 1]}`
  }

  const kecamatanNama = kecamatanSelectItems.value.find((k) => k.value === filterKecamatanId.value)?.label
  if (kecamatanNama) sentence += ` di Kecamatan ${kecamatanNama}`

  return sentence
})

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
          <select v-model="filterWilayahStatus" class="flex-1 md:w-48 py-2.5 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
            <option value="">Semua Status Wilayah</option>
            <option value="resolved">Wilayah Cocok</option>
            <option value="unresolved">Belum Cocok</option>
            <option value="unknown">Wilayah Tidak Diketahui</option>
            <option value="out_of_scope">Luar Cakupan</option>
          </select>
          <USelectMenu
            v-model="filterKecamatanId"
            :items="kecamatanSelectItems"
            value-key="value"
            placeholder="Semua Kecamatan"
            :disabled="!isSuperAdmin"
            class="flex-1 md:w-48"
          />
        </div>
      </div>

      <!-- Ringkasan hasil filter -- selalu tampil, kalimatnya menyesuaikan filter apa saja yang
           aktif (risiko/status wilayah/kata kunci/kecamatan), angka dari pagination.total (query
           TERFILTER backend, akurat gabungan semua filter, bukan cuma window yang ke-fetch).
           SAAT isLoading: tampilkan status "Sedang Mencari Data..." dulu, BUKAN teks lama --
           filterKecamatanId/filterRisk dkk sudah berubah duluan (v-model reaktif instan) sebelum
           totalCount hasil fetch baru datang, jadi tanpa ini sempat muncul kombinasi
           menyesatkan (mis. total lama "174" digabung nama kecamatan BARU "Gapura"). -->
      <div class="px-5 py-3 border-b border-slate-100 bg-primary/5 flex items-center gap-2">
        <LucideLoader2 v-if="isLoading" class="w-4 h-4 text-primary shrink-0 animate-spin" />
        <LucideMapPin v-else class="w-4 h-4 text-primary shrink-0" />
        <span class="text-sm font-semibold text-slate-700">
          <template v-if="isLoading">Sedang Mencari Data...</template>
          <template v-else>{{ filterSummaryText }}</template>
        </span>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[1150px]">
          <thead>
            <tr class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <th class="py-4 px-5 font-semibold">Nama Pasien</th>
              <th class="py-4 px-5 font-semibold">No. Registrasi</th>
              <th class="py-4 px-5 font-semibold text-center">Usia / JK</th>
              <th class="py-4 px-5 font-semibold">Alamat & Lokasi</th>
              <th class="py-4 px-5 font-semibold">Status Prolanis</th>
              <th class="py-4 px-5 font-semibold">Tingkat Risiko</th>
              <th class="py-4 px-5 font-semibold text-center">Status Wilayah</th>
              <th class="py-4 px-5 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="isLoading">
               <td colspan="8" class="py-12 text-center text-slate-400">
                  <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
                  Memuat data pasien...
               </td>
            </tr>
            <tr v-for="patient in patients" :key="patient.id" class="hover:bg-slate-50/80 transition-colors group">
               <td class="py-4 px-5">
                  <div class="flex items-center gap-3">
                     <div class="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shadow-sm border border-primary/20 shrink-0">
                        {{ patient.nama.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() }}
                     </div>
                     <div>
                        <span class="font-bold text-slate-800 block">{{ patient.nama }}</span>
                        <span v-if="patient.phone" class="text-[11px] font-medium text-slate-500">{{ patient.phone }}</span>
                     </div>
                  </div>
               </td>
               <td class="py-4 px-5 text-sm font-medium text-slate-600">{{ patient.no_reg || '-' }}</td>
               <td class="py-4 px-5 text-sm font-semibold text-slate-700 text-center">
                  <template v-if="calculateAge(patient.tgl_lahir)">{{ calculateAge(patient.tgl_lahir) }} thn <span class="text-slate-400 font-normal">/</span> {{ patient.gender || '-' }}</template>
                  <span v-else class="text-slate-300">-</span>
               </td>
               <td class="py-4 px-5 max-w-[220px]">
                  <p class="text-sm font-semibold text-slate-700 truncate" :title="patient.alamat || undefined">{{ patient.alamat || '-' }}</p>
                  <p class="text-[11px] font-medium text-slate-500 mt-0.5">{{ patient.kecamatan_raw || '-' }} &middot; Desa {{ patient.kel_desa_raw || '-' }}</p>
               </td>
               <td class="py-4 px-5">
                  <span class="px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider inline-block" :class="getProlanisColor(patient.jenis_prolanis)">
                     {{ getProlanisLabel(patient.jenis_prolanis) }}
                  </span>
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
            <tr v-if="!isLoading && patients.length === 0">
               <td colspan="8" class="py-12 text-center">
                 <div class="flex flex-col items-center justify-center text-slate-400">
                    <LucideSearchX class="w-10 h-10 mb-3 text-slate-300" />
                    <p class="font-medium">Tidak ada data pasien yang ditemukan.</p>
                 </div>
               </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Ringkasan + Pagination -- totalCount/currentPage/lastPage dari pagination.total hasil
           query TERFILTER backend (bukan window klien), jadi selalu akurat gabungan semua filter
           aktif (search/risiko/status wilayah/kecamatan). -->
      <div class="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
        <span class="text-sm text-slate-500">
          Menampilkan <b class="text-slate-700">{{ patients.length }}</b> dari total <b class="text-slate-700">{{ formatId(totalCount) }}</b> pasien
          <template v-if="lastPage > 1"> (halaman {{ currentPage }} dari {{ lastPage }})</template>
        </span>
        <div v-if="lastPage > 1" class="flex items-center gap-1.5">
          <button
            type="button"
            :disabled="currentPage <= 1 || isLoading"
            @click="goToPage(currentPage - 1)"
            class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-white hover:text-primary disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-600 transition-colors"
          >
            <LucideChevronLeft class="w-4 h-4" />
          </button>
          <span class="text-xs font-semibold text-slate-600 px-2">{{ currentPage }} / {{ lastPage }}</span>
          <button
            type="button"
            :disabled="currentPage >= lastPage || isLoading"
            @click="goToPage(currentPage + 1)"
            class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-white hover:text-primary disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-600 transition-colors"
          >
            <LucideChevronRight class="w-4 h-4" />
          </button>
        </div>
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
