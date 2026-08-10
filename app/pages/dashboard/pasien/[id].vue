<script setup lang="ts">
import type { ApiSuccessEnvelope, Patient, PatientFieldUpdates, PatientFieldUpdateHistoryItem } from '~/types/api'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

const route = useRoute()
const authStore = useAuthStore()
const toast = useToast()

// GET /api/v1/patients/{id} -- PatientsCachePolicy::update() ada, TAPI tidak ada route
// PATCH/PUT untuk itu di routes/api.php (cuma index+show), dan delete() SENGAJA selalu false
// ("data pasien ditarik dari SiLAKES, tidak ada hapus manual dari UI") -- makanya tombol
// Edit/Hapus di halaman ini dihapus, bukan cuma disembunyikan.
const patient = ref<Patient | null>(null)
const isLoading = ref(false)
const loadError = ref('')

async function loadPatient() {
  isLoading.value = true
  loadError.value = ''
  try {
    const api = useApi()
    const res = await api(`/patients/${route.params.id}`) as ApiSuccessEnvelope<Patient>
    patient.value = res.data
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Gagal memuat data pasien.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadPatient)

// Reload otomatis begitu sinkronisasi SiLAKES berhasil (dipicu dari sidebar ATAU tombol
// "Sinkronisasi Sekarang" di riwayat pengajuan pada halaman ini sendiri) -- biodata,
// wilayah, status risiko, DAN riwayat pengajuan semuanya perlu dimuat ulang bersamaan.
const silakesSyncSignal = useSilakesSyncSignal()
watch(silakesSyncSignal, () => {
  loadPatient()
  loadUpdateHistory()
})

useHead({
  title: computed(() => patient.value ? `Detail Pasien - ${patient.value.nama}` : 'Detail Pasien')
})

function calculateAge(dob) {
  if (!dob) return null
  const diffMs = Date.now() - new Date(dob).getTime()
  return Math.abs(new Date(diffMs).getUTCFullYear() - 1970)
}

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

const getWilayahLabel = (status) => {
  if (status === 'resolved') return 'Wilayah Cocok'
  if (status === 'unresolved') return 'Belum Cocok'
  if (status === 'out_of_scope') return 'Luar Cakupan'
  return 'Tidak Diketahui'
}

const getGeoLabel = (status) => {
  if (status === 'verified') return 'Terverifikasi'
  if (status === 'approximate') return 'Perkiraan (Desa)'
  return 'Belum Diketahui'
}

// --- Ajukan Update Data Pasien (PATCH /patients/{id}/propose-update) ---
// Jalur PARALEL dari usulan kader lewat POST /visit-reports (itu terikat satu laporan
// kunjungan) -- PatientsCachePolicy::update sudah scoped ke puskesmas yang sama, staf cuma bisa
// ajukan untuk pasien di wilayah kerjanya sendiri. SELALU pending_review di SiLAKES, TIDAK
// PERNAH auto-apply ke data KOPIPU sendiri (docs/planning/01 §9).
const canProposeUpdate = computed(() => {
  const roles = authStore.roles ?? []
  if (roles.includes('super_admin')) return true
  if (roles.includes('admin_puskesmas') || roles.includes('pj_prolanis')) {
    return authStore.user?.puskesmas_id === patient.value?.puskesmas?.id
  }
  return false
})

const showUpdateModal = ref(false)
const updateForm = ref<PatientFieldUpdates>({})
const isSavingUpdate = ref(false)
const updateError = ref('')

function openUpdateModal() {
  updateForm.value = {
    alamat: patient.value?.alamat ?? '',
    rt_rw: patient.value?.rt_rw ?? '',
    kel_desa: patient.value?.kel_desa_raw ?? '',
    kecamatan: patient.value?.kecamatan_raw ?? '',
    phone: patient.value?.phone ?? '',
    jenis_prolanis: patient.value?.jenis_prolanis ?? '',
    jenis_perokok: patient.value?.jenis_perokok ?? ''
  }
  updateError.value = ''
  showUpdateModal.value = true
}

async function submitProposeUpdate() {
  const hasAnyValue = Object.values(updateForm.value).some((v) => typeof v === 'string' ? v.trim() !== '' : v !== undefined)
  if (!hasAnyValue) {
    updateError.value = 'Isi minimal satu field yang ingin diajukan perubahannya.'
    return
  }
  isSavingUpdate.value = true
  updateError.value = ''
  try {
    const api = useApi()
    const payload: PatientFieldUpdates = {}
    for (const [key, value] of Object.entries(updateForm.value)) {
      if (typeof value === 'string' && value.trim() !== '') (payload as any)[key] = value.trim()
      else if (typeof value === 'boolean') (payload as any)[key] = value
    }
    await api(`/patients/${route.params.id}/propose-update`, { method: 'PATCH', body: payload })
    showUpdateModal.value = false
    toast.add({ title: 'Usulan perubahan data pasien berhasil diajukan', color: 'success' })
    // Usulan baru muncul di riwayat dengan status pending_review -- muat ulang supaya
    // langsung terlihat, bukan menunggu reload halaman manual.
    loadUpdateHistory()
  } catch (e) {
    updateError.value = e instanceof ApiError ? e.message : 'Gagal mengajukan usulan perubahan.'
  } finally {
    isSavingUpdate.value = false
  }
}

// --- Riwayat Pengajuan Perubahan Data (GET /patients/{id}/update-history) ------------------
// Dibaca LIVE dari SiLAKES (patient_field_updates, sumber kopipu_*) -- KOPIPU tidak menyimpan
// salinan lokal status approval, SiLAKES tetap satu-satunya sumber kebenaran. Gerbang akses
// SAMA dengan canProposeUpdate (kalau boleh mengajukan, boleh lihat riwayatnya).
const updateHistory = ref<PatientFieldUpdateHistoryItem[]>([])
const isLoadingHistory = ref(false)
const historyError = ref('')

async function loadUpdateHistory() {
  if (!canProposeUpdate.value) return
  isLoadingHistory.value = true
  historyError.value = ''
  try {
    const api = useApi()
    const res = await api(`/patients/${route.params.id}/update-history`) as ApiSuccessEnvelope<PatientFieldUpdateHistoryItem[]>
    updateHistory.value = res.data
  } catch (e) {
    historyError.value = e instanceof ApiError ? e.message : 'Gagal memuat riwayat pengajuan.'
  } finally {
    isLoadingHistory.value = false
  }
}

// canProposeUpdate baru pasti terisi SETELAH patient.value ada (bergantung puskesmas pasien) --
// watch, bukan langsung onMounted, supaya tidak memuat riwayat sebelum gerbang aksesnya jelas.
watch(canProposeUpdate, (allowed) => {
  if (allowed) loadUpdateHistory()
}, { immediate: true })

const HISTORY_STATUS_LABELS: Record<string, string> = {
  pending_review: 'Menunggu Peninjauan',
  approved: 'Disetujui',
  rejected: 'Ditolak'
}
const HISTORY_STATUS_COLORS: Record<string, string> = {
  pending_review: 'bg-warning/10 text-warning border border-warning/20',
  approved: 'bg-success/10 text-success border border-success/20',
  rejected: 'bg-danger/10 text-danger border border-danger/20'
}
const HISTORY_KATEGORI_LABELS: Record<string, string> = { geo: 'Titik Lokasi', kontak: 'Kontak/Alamat', identitas: 'Identitas' }

function historyItemLabel(item: PatientFieldUpdateHistoryItem): string {
  if (item.kategori === 'geo') return 'Titik Lokasi Rumah'
  return item.field_name ?? HISTORY_KATEGORI_LABELS[item.kategori] ?? item.kategori
}

function formatHistoryDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Usulan disetujui SiLAKES SETELAH sinkronisasi lokal terakhir -- berarti data pasien di
// KOPIPU masih versi lama, belum menangkap perubahan yang baru disetujui itu (dibandingkan
// lewat reviewed_at vs patient.last_synced_at, bukan cuma "ada status approved" -- approval
// LAMA yang sudah tertangkap sync sebelumnya tidak perlu terus disarankan sync ulang).
const pendingSyncSuggestion = computed(() => {
  if (!patient.value) return false
  const lastSynced = patient.value.last_synced_at ? new Date(patient.value.last_synced_at).getTime() : 0
  return updateHistory.value.some((item) =>
    item.status === 'approved' && item.reviewed_at && new Date(item.reviewed_at).getTime() > lastSynced
  )
})

const isSuperAdminForSync = computed(() => (authStore.roles ?? []).includes('super_admin'))
const isTriggeringSync = ref(false)

async function triggerSyncFromHistory() {
  if (isTriggeringSync.value) return
  isTriggeringSync.value = true
  try {
    const api = useApi()
    const res = await api('/silakes/sync', { method: 'POST' }) as ApiSuccessEnvelope<{ last_synced_at: string }>
    toast.add({ title: 'Sinkronisasi SiLAKES berhasil', description: 'Data pasien ini sudah dimuat ulang dengan versi terbaru.', color: 'success' })
    // Tidak perlu reload manual di sini -- signalSilakesSyncCompleted() memicu watcher
    // silakesSyncSignal di bawah, yang sudah memanggil loadPatient()+loadUpdateHistory()
    // (satu jalur reload, dipakai baik trigger dari sini maupun dari sidebar).
    signalSilakesSyncCompleted(res.data.last_synced_at)
  } catch (e) {
    toast.add({
      title: 'Sinkronisasi SiLAKES gagal',
      description: e instanceof ApiError ? e.message : 'Terjadi kesalahan tidak terduga.',
      color: 'error'
    })
  } finally {
    isTriggeringSync.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
      <NuxtLink to="/dashboard" class="hover:text-primary transition-colors">Dashboard</NuxtLink>
      <LucideChevronRight class="w-3 h-3" />
      <NuxtLink to="/dashboard/pasien" class="hover:text-primary transition-colors">Data Pasien</NuxtLink>
      <LucideChevronRight class="w-3 h-3" />
      <span class="text-slate-600">Detail Pasien</span>
    </div>

    <div v-if="isLoading" class="bg-white rounded-2xl border border-slate-100 shadow-card p-12 text-center text-slate-400">
      <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
      Memuat data pasien...
    </div>

    <div v-else-if="loadError" class="bg-white rounded-2xl border border-danger/20 shadow-card p-8 text-center">
      <LucideAlertTriangle class="w-8 h-8 mx-auto mb-3 text-danger" />
      <p class="font-semibold text-danger">{{ loadError }}</p>
    </div>

    <template v-else-if="patient">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-2xl shadow-sm border border-primary/20 shrink-0">
            {{ patient.nama.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() }}
          </div>
          <div>
            <h1 class="text-2xl font-extrabold text-accent flex items-center gap-3 flex-wrap">
               {{ patient.nama }}
               <span class="px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider" :class="getRiskColor(patient.risk_level)">
                  {{ getRiskLabel(patient.risk_level) }}
               </span>
            </h1>
            <p class="text-sm text-slate-500 mt-1 font-medium">No. Registrasi: <span class="text-slate-700 font-bold">{{ patient.no_reg || '-' }}</span></p>
          </div>
        </div>
        <button
          v-if="canProposeUpdate"
          @click="openUpdateModal"
          class="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm text-primary bg-primary/10 hover:bg-primary/20 transition-colors border border-primary/20 shrink-0"
        >
          <LucidePencil class="w-4 h-4" />
          Ajukan Update Data
        </button>
      </div>

      <!-- Layout Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <!-- Left Column: Biodata -->
        <div class="lg:col-span-1 space-y-6">
          <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <h3 class="font-bold text-accent text-base mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <LucideUser class="w-4 h-4 text-primary" />
              Informasi Pribadi
            </h3>

            <div class="space-y-4">
              <div>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Usia & Jenis Kelamin</p>
                <p class="text-sm font-bold text-slate-800">
                  <template v-if="calculateAge(patient.tgl_lahir)">{{ calculateAge(patient.tgl_lahir) }} Tahun / {{ patient.gender === 'L' ? 'Laki-laki' : patient.gender === 'P' ? 'Perempuan' : '-' }}</template>
                  <span v-else class="text-slate-400">Tidak diketahui</span>
                </p>
              </div>
              <div>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Telepon</p>
                <p class="text-sm font-bold text-slate-800">{{ patient.phone || '-' }}</p>
              </div>
              <div>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Alamat Domisili</p>
                <p class="text-sm font-bold text-slate-800">{{ patient.alamat || '-' }}</p>
                <p class="text-xs text-slate-500 font-medium mt-0.5">RT/RW {{ patient.rt_rw || '-' }}, Desa {{ patient.kel_desa_raw || '-' }}, Kec. {{ patient.kecamatan_raw || '-' }}</p>
              </div>
              <div>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Puskesmas Binaan</p>
                <p class="text-sm font-bold text-slate-800">{{ patient.puskesmas?.nama || '-' }}</p>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <h3 class="font-bold text-accent text-base mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <LucideActivitySquare class="w-4 h-4 text-danger" />
              Informasi Prolanis
            </h3>

            <div class="flex flex-wrap gap-2 mt-2">
              <span v-if="patient.is_prolanis" class="bg-danger/10 text-danger border border-danger/20 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">
                {{ patient.jenis_prolanis === 'DM_HT' ? 'Diabetes & Hipertensi' : (patient.jenis_prolanis || 'Peserta Prolanis') }}
              </span>
              <span v-else class="bg-slate-100 text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">
                Bukan Peserta Prolanis
              </span>
              <span v-if="patient.is_perokok" class="bg-warning/10 text-warning border border-warning/20 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">
                Perokok{{ patient.jenis_perokok ? ` (${patient.jenis_perokok})` : '' }}
              </span>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <h3 class="font-bold text-accent text-base mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <LucideMapPin class="w-4 h-4 text-info" />
              Status Wilayah & Sinkronisasi
            </h3>
            <div class="space-y-4">
              <div>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Kecocokan Wilayah</p>
                <p class="text-sm font-bold text-slate-800">{{ getWilayahLabel(patient.wilayah_status) }}</p>
              </div>
              <div>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Titik Lokasi (GPS)</p>
                <p class="text-sm font-bold text-slate-800">{{ getGeoLabel(patient.geo_status) }}</p>
              </div>
              <div>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Terakhir Disinkron</p>
                <p class="text-sm font-bold text-slate-800">{{ patient.last_synced_at ? new Date(patient.last_synced_at).toLocaleString('id-ID') : 'Belum pernah' }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Riwayat Kunjungan -->
        <div class="lg:col-span-2">
          <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5 h-full flex flex-col">
            <div class="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
              <h3 class="font-bold text-accent text-base flex items-center gap-2">
                <LucideCalendarClock class="w-4 h-4 text-info" />
                Riwayat Kunjungan Kader
              </h3>
            </div>

            <!-- Belum ada endpoint riwayat kunjungan per-pasien yang tersambung -- lihat
                 /dashboard/kunjungan untuk daftar laporan kunjungan (masih terpisah, belum
                 difilter per pasien). -->
            <div class="text-center text-slate-400 py-16 flex flex-col items-center justify-center flex-1">
               <LucideHistory class="w-12 h-12 mb-4 text-slate-200" />
               <p class="font-medium text-slate-500">Riwayat kunjungan belum tersedia di halaman ini.</p>
               <p class="text-xs text-slate-400 mt-1">Lihat daftar laporan kunjungan lengkap di menu Data Kunjungan.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Riwayat Pengajuan Perubahan Data -- GET /patients/{id}/update-history, dibaca LIVE
           dari SiLAKES (bukan salinan lokal), cuma tampil untuk role yang boleh mengajukan
           (canProposeUpdate: super_admin/admin_puskesmas/pj_prolanis sepuskesmas). -->
      <div v-if="canProposeUpdate" class="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
        <div class="flex items-center justify-between mb-5 border-b border-slate-100 pb-4">
          <h3 class="font-bold text-accent text-base flex items-center gap-2">
            <LucideHistory class="w-4 h-4 text-secondary" />
            Riwayat Pengajuan Perubahan Data
          </h3>
        </div>

        <!-- Saran sinkronisasi -- muncul kalau ada usulan yang DISETUJUI SETELAH sync lokal
             terakhir (data pasien di KOPIPU masih versi lama). super_admin: tombol langsung
             memicu sinkronisasi. Role lain: cuma teks anjuran, mereka tidak berwenang sync. -->
        <div v-if="pendingSyncSuggestion" class="mb-5 flex items-center gap-3 bg-success/5 border border-success/20 rounded-2xl px-5 py-3.5">
          <div class="w-9 h-9 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0">
            <LucideCheckCircle2 class="w-4.5 h-4.5" />
          </div>
          <p class="flex-1 text-sm font-semibold text-accent">
            Ada usulan yang <span class="text-success">disetujui SiLAKES</span> namun belum tercermin di data pasien ini.
            <template v-if="isSuperAdminForSync">Jalankan sinkronisasi untuk memperbarui.</template>
            <template v-else>Hubungi super_admin untuk menjalankan sinkronisasi manual, atau tunggu jadwal otomatis (tiap 48 jam).</template>
          </p>
          <button
            v-if="isSuperAdminForSync"
            type="button"
            :disabled="isTriggeringSync"
            @click="triggerSyncFromHistory"
            class="shrink-0 flex items-center gap-1.5 text-xs font-bold text-success hover:text-success/80 bg-white border border-success/30 rounded-lg px-3 py-2 transition-colors disabled:opacity-60"
          >
            <LucideLoader2 v-if="isTriggeringSync" class="w-3.5 h-3.5 animate-spin" />
            <LucideRefreshCw v-else class="w-3.5 h-3.5" />
            {{ isTriggeringSync ? 'Menyinkronkan...' : 'Sinkronisasi Sekarang' }}
          </button>
        </div>

        <div v-if="isLoadingHistory" class="py-10 text-center text-slate-400">
          <LucideLoader2 class="w-5 h-5 mx-auto mb-2 animate-spin" />
          Memuat riwayat pengajuan...
        </div>
        <p v-else-if="historyError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{{ historyError }}</p>
        <div v-else-if="updateHistory.length === 0" class="py-10 text-center text-slate-400">
          <LucideHistory class="w-10 h-10 mx-auto mb-3 text-slate-200" />
          <p class="font-medium text-slate-500">Belum ada usulan perubahan yang pernah diajukan untuk pasien ini.</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr class="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th class="py-3 px-3 font-semibold">Field</th>
                <th class="py-3 px-3 font-semibold">Nilai Lama → Usulan</th>
                <th class="py-3 px-3 font-semibold">Sumber</th>
                <th class="py-3 px-3 font-semibold">Diajukan</th>
                <th class="py-3 px-3 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="item in updateHistory" :key="item.id" class="hover:bg-slate-50/80 transition-colors">
                <td class="py-3 px-3 text-sm font-bold text-slate-800">{{ historyItemLabel(item) }}</td>
                <td class="py-3 px-3 text-xs text-slate-600">
                  <span class="text-slate-400 line-through">{{ item.old_value || '(kosong)' }}</span>
                  <span class="mx-1 text-slate-300">→</span>
                  <span class="font-semibold text-slate-700">{{ item.new_value || '-' }}</span>
                </td>
                <td class="py-3 px-3 text-xs font-medium text-slate-600">{{ item.kopipu_kader_nama || 'Staf KOPIPU' }}</td>
                <td class="py-3 px-3 text-xs text-slate-500">{{ formatHistoryDate(item.created_at) }}</td>
                <td class="py-3 px-3 text-center">
                  <span class="px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider inline-block" :class="HISTORY_STATUS_COLORS[item.status]">
                    {{ HISTORY_STATUS_LABELS[item.status] }}
                  </span>
                  <p v-if="item.catatan_reviewer" class="text-[10px] text-slate-400 mt-1 max-w-[160px] mx-auto" :title="item.catatan_reviewer">{{ item.catatan_reviewer }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Modal Ajukan Update Data Pasien -- PATCH /patients/{id}/propose-update, jalur paralel
         dari usulan kader lewat POST /visit-reports. -->
    <div v-if="showUpdateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div class="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
          <h3 class="font-bold text-accent text-lg flex items-center gap-2">
            <LucidePencil class="w-5 h-5 text-primary" />
            Ajukan Update Data Pasien
          </h3>
          <button @click="showUpdateModal = false" class="text-slate-400 hover:text-slate-600 p-1">
            <LucideX class="w-5 h-5" />
          </button>
        </div>

        <div class="p-6 space-y-4 overflow-y-auto">
          <p class="text-sm text-slate-500">Isi apa yang Anda ketahui akurat tentang pasien ini — boleh sebagian saja. Usulan ini dikirim ke SiLAKES untuk ditinjau, tidak langsung diterapkan.</p>
          <p v-if="updateError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{{ updateError }}</p>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Alamat Lengkap</label>
            <textarea v-model="updateForm.alamat" rows="2" placeholder="Jl. ..." class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"></textarea>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">RT/RW</label>
              <input type="text" v-model="updateForm.rt_rw" placeholder="002/003" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Kel/Desa</label>
              <input type="text" v-model="updateForm.kel_desa" placeholder="Pamolokan" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Kecamatan</label>
              <input type="text" v-model="updateForm.kecamatan" placeholder="Kota Sumenep" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Nomor Telepon</label>
            <input type="tel" v-model="updateForm.phone" placeholder="08..." class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Pekerjaan</label>
            <input type="text" v-model="updateForm.pekerjaan" placeholder="Mis. Petani, Pensiunan..." class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Status Perkawinan</label>
              <select v-model="updateForm.status_perkawinan" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                <option value="">Pilih...</option>
                <option value="BELUM KAWIN">Belum Kawin</option>
                <option value="KAWIN">Kawin</option>
                <option value="CERAI HIDUP">Cerai Hidup</option>
                <option value="CERAI MATI">Cerai Mati</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Golongan Darah</label>
              <select v-model="updateForm.golongan_darah" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                <option value="">Pilih...</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="AB">AB</option>
                <option value="O">O</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Agama</label>
              <select v-model="updateForm.agama" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                <option value="">Pilih...</option>
                <option value="ISLAM">Islam</option>
                <option value="KRISTEN">Kristen</option>
                <option value="KATOLIK">Katolik</option>
                <option value="HINDU">Hindu</option>
                <option value="BUDHA">Budha</option>
                <option value="KONGHUCU">Konghucu</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Status Perokok</label>
              <select v-model="updateForm.jenis_perokok" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                <option value="">Pilih...</option>
                <option value="AKTIF">Aktif Merokok</option>
                <option value="PASIF">Pasif / Tidak Merokok</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Jenis Prolanis</label>
            <select v-model="updateForm.jenis_prolanis" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
              <option value="">Pilih...</option>
              <option value="DM">Diabetes Mellitus (DM)</option>
              <option value="HT">Hipertensi (HT)</option>
              <option value="DM_HT">DM & Hipertensi</option>
            </select>
          </div>
          <div class="flex items-center gap-3 pt-2 border-t border-slate-100">
            <input type="checkbox" id="pasien_is_bpjs" v-model="updateForm.is_bpjs" class="w-4 h-4 rounded text-primary border-slate-300 focus:ring-primary" />
            <label for="pasien_is_bpjs" class="text-sm font-bold text-slate-700">Peserta BPJS</label>
          </div>
          <div v-if="updateForm.is_bpjs">
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Nomor BPJS</label>
            <input type="text" v-model="updateForm.no_bpjs" placeholder="0001234567890" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
        </div>

        <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
          <button @click="showUpdateModal = false" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
          <button
            @click="submitProposeUpdate"
            :disabled="isSavingUpdate"
            class="py-2.5 px-6 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <LucideLoader2 v-if="isSavingUpdate" class="w-4 h-4 animate-spin" />
            {{ isSavingUpdate ? 'Mengajukan...' : 'Ajukan Perubahan' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
