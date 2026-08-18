<script setup lang="ts">
import type { ApiSuccessEnvelope, Kader, TenagaKesehatan } from '~/types/api'

definePageMeta({
  layout: 'pwa',
  middleware: 'auth'
})
useHead({
  title: 'Beranda'
})

const colorMode = useColorMode()
const toggleDark = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

// Hysteresis dua-ambang (bukan satu threshold tunggal) -- SEBELUMNYA `computed(() => scrollY > 60)`
// bikin isScrolled flip-flop tiap kali posisi scroll goyang beberapa px di sekitar 60 (lazim
// terjadi pas scroll pelan/momentum scroll di HP), tiap flip me-restart transisi 500ms di
// ~10 elemen sekaligus -- itu yang tampak sebagai glitch/jitter. Naik butuh lewat 80, turun
// harus di bawah 40 -- rentang aman di antaranya bikin state stabil, tidak ada re-trigger beruntun.
const { y: scrollY } = useWindowScroll()
const isScrolled = ref(false)
watch(scrollY, (y) => {
  if (!isScrolled.value && y > 80) isScrolled.value = true
  else if (isScrolled.value && y < 40) isScrolled.value = false
})

const greeting = ref('Selamat Pagi,')
const currentTime = ref('')
const currentDate = ref('')
const activeLocation = ref('Mendeteksi lokasi...')

// Identitas kader ASLI -- SEBELUMNYA hardcode "Siti Aminah" + inisial "SA" statis di template,
// tidak pernah diambil dari sesi login sama sekali.
const authStore = useAuthStore()
const kaderName = computed(() => authStore.user?.name ?? '...')
const kaderInitials = computed(() => {
  const name = authStore.user?.name ?? ''
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
})

// GET /kader/profile ATAU /tenaga-kesehatan/profile (tergantung role, revisi Bu Kadis PMO) --
// dipakai kartu "Kontak Puskesmas" di bawah (nomor telepon/WA puskesmas sendiri, bukan data
// pasien).
const kaderPuskesmas = ref<{ id: number, nama: string, no_telp?: string | null, no_wa?: string | null, alamat?: string | null } | null>(null)
async function loadKaderPuskesmas() {
  try {
    const api = useApi()
    const endpoint = authStore.roles?.includes('tenaga_kesehatan') ? '/tenaga-kesehatan/profile' : '/kader/profile'
    const res = await api(endpoint) as ApiSuccessEnvelope<Kader | TenagaKesehatan>
    if (res.data.puskesmas) {
      const detail = await api(`/puskesmas/${res.data.puskesmas.id}`) as ApiSuccessEnvelope<{ id: number, nama: string, no_telp: string | null, no_wa: string | null, alamat: string | null }>
      kaderPuskesmas.value = detail.data
    }
  } catch (e) {
    console.error('Gagal memuat data puskesmas', e)
  }
}
onMounted(loadKaderPuskesmas)

const showKontakPuskesmasModal = ref(false)

const updateTime = () => {
  const now = new Date()
  const hour = now.getHours()
  if (hour < 11) greeting.value = 'Selamat Pagi,'
  else if (hour < 15) greeting.value = 'Selamat Siang,'
  else if (hour < 18) greeting.value = 'Selamat Sore,'
  else greeting.value = 'Selamat Malam,'
  
  // Added seconds so it visibly ticks
  currentTime.value = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  currentDate.value = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

let timer: ReturnType<typeof setInterval>

const fetchLocation = () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json`)
        const data = await res.json()
        
        const local = data.address.village || data.address.suburb || data.address.town || data.address.city_district || ''
        const kab = data.address.county || data.address.city || ''
        
        if (local && kab && local !== kab) {
          activeLocation.value = `${local}, ${kab}`
        } else {
          activeLocation.value = local || kab || 'Lokasi Ditemukan'
        }
      } catch(e) {
        activeLocation.value = 'Gagal memuat peta'
      }
    }, (error) => {
      activeLocation.value = 'Akses Lokasi Ditolak'
    })
  } else {
    activeLocation.value = 'GPS Tidak Didukung'
  }
}

onMounted(() => {
  updateTime()
  timer = setInterval(updateTime, 1000)
  fetchLocation()
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

// --- Unduh Peta Wilayah Kerja (docs/planning/10 §5, docs/planning/11 §9) -----------------
// GET /visit-assignments (sudah scoped ke kader login) -- bounding box dari tugas HARI INI yang
// lokasinya diketahui (patient.latitude/longitude terisi), bukan seluruh riwayat.
const assignmentStore = useAssignmentStore()
const tileDownload = useMapTileDownload()

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10)
}

const todayAssignments = computed(() =>
  assignmentStore.assignments.filter((a) => isToday(a.scheduled_date))
)
const todayAssignmentsWithLocation = computed(() =>
  todayAssignments.value.filter((a) => a.patient?.latitude !== null && a.patient?.latitude !== undefined && a.patient?.longitude !== null && a.patient?.longitude !== undefined)
)

// Statistik ASLI dari assignmentStore -- SEBELUMNYA "Ada 3 Tugas Baru!", progress ring 80%,
// dan "12/15 Kunjungan" semua angka hardcode di template, tidak pernah dihitung dari data
// tugas yang sebenarnya sudah di-fetch di halaman ini.
const activeTasksCount = computed(() =>
  assignmentStore.assignments.filter((a) => ['pending', 'in_progress'].includes(a.status)).length
)

// "cancelled" TIDAK dihitung sama sekali (bukan cuma di luar "selesai") -- indikator ini
// mengukur kinerja atas tugas yang benar-benar ditugaskan (termasuk yang sudah lewat tenggat/
// terlambat, statusnya tetap 'pending'), bukan penugasan yang batal sebelum sempat dikerjakan
// (temuan lapangan).
const monthlyAssignments = computed(() => {
  const now = new Date()
  return assignmentStore.assignments.filter((a) => {
    if (a.status === 'cancelled') return false
    const d = new Date(a.scheduled_date)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
})
const monthlyCompletedCount = computed(() => monthlyAssignments.value.filter((a) => a.status === 'completed').length)
const monthlyTotalCount = computed(() => monthlyAssignments.value.length)
const monthlyProgressPercent = computed(() =>
  monthlyTotalCount.value > 0 ? Math.round((monthlyCompletedCount.value / monthlyTotalCount.value) * 100) : 0
)
// stroke-dasharray lingkaran = 251.2 (SVG r=40) -- offset dihitung dari persentase asli,
// mengecil dari penuh (251.2, kosong) ke nilai sebenarnya. Transisi CSS (lihat template,
// transition-all duration-1000) sudah cukup untuk efek "mengisi", tidak perlu animasi
// setTimeout palsu lagi.
const progressDashOffset = computed(() => 251.2 - (251.2 * monthlyProgressPercent.value) / 100)

// GET laporan offline tertunda (docs/planning/10 §3) -- pola sama dengan /app/tugas. Tidak
// menghitung draft WIP ('draft', docs/planning/14) -- lihat catatan di tugas.vue.
const offlineQueue = useOfflineQueue()
const draftCount = ref(0)
async function loadDraftCount() {
  draftCount.value = (await offlineQueue.getPendingDrafts()).length
}

const isDownloadingMap = ref(false)
const mapDownloadProgress = ref({ current: 0, total: 0 })
const mapDownloadError = ref('')
const mapDownloadResult = ref('')
const cachedTileCount = ref(0)

async function refreshCachedTileInfo() {
  const info = await tileDownload.getCachedTileInfo()
  cachedTileCount.value = info.count
}

async function downloadWorkAreaMap() {
  isDownloadingMap.value = true
  mapDownloadError.value = ''
  mapDownloadResult.value = ''
  mapDownloadProgress.value = { current: 0, total: 0 }
  try {
    const result = await tileDownload.downloadTilesForAssignments(todayAssignments.value, (progress) => {
      mapDownloadProgress.value = progress
    })
    if (!result.ok) {
      mapDownloadError.value = result.error ?? 'Gagal mengunduh peta.'
    } else {
      mapDownloadResult.value = `${result.downloaded} dari ${result.total} berkas peta berhasil diunduh untuk dipakai offline.`
      await refreshCachedTileInfo()
    }
  } catch (e) {
    mapDownloadError.value = 'Gagal mengunduh peta. Coba lagi saat koneksi lebih stabil.'
  } finally {
    isDownloadingMap.value = false
  }
}

onMounted(async () => {
  if (assignmentStore.assignments.length === 0) {
    await assignmentStore.fetchAll()
  }
  await refreshCachedTileInfo()
  await loadDraftCount()
})
</script>

<template>
  <div>
    <!-- Header Section with dark mode toggle and scroll shrink effect -->
    <div
      class="bg-white dark:bg-slate-900 shadow-sm transition-all duration-300 ease-in-out sticky top-0 z-40 origin-top [transform:translateZ(0)] [backface-visibility:hidden]"
      :class="isScrolled ? 'rounded-b-3xl px-5 pt-4 pb-4 mb-4' : 'rounded-b-[2.5rem] px-5 pt-8 pb-6 mb-6'"
    >
      <div class="flex items-center justify-between transition-all duration-300 ease-in-out" :class="isScrolled ? 'mb-4' : 'mb-8'">
        <div>
          <p class="font-medium text-slate-500 dark:text-slate-400 transition-all duration-300 ease-in-out" :class="isScrolled ? 'text-[10px] mb-0 opacity-80' : 'text-sm mb-1'">{{ greeting }}</p>
          <h1 class="font-extrabold text-accent dark:text-white transition-all duration-300 ease-in-out" :class="isScrolled ? 'text-lg' : 'text-2xl'">{{ kaderName }}</h1>
        </div>
        
        <div class="flex items-center gap-3">
          <!-- Dark Mode Toggle (Disappears smoothly when scrolled) -->
          <div class="overflow-hidden transition-all duration-300 ease-in-out" :class="isScrolled ? 'w-0 opacity-0 scale-50' : 'w-10 opacity-100 scale-100'">
             <button @click="toggleDark" class="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 shadow-inner">
               <Transition name="swap" mode="out-in">
                 <LucideSun v-if="colorMode.value === 'dark'" class="w-5 h-5 text-warning" />
                 <LucideMoon v-else class="w-5 h-5 text-slate-500" />
               </Transition>
             </button>
          </div>
          
          <div class="bg-primary/10 rounded-full flex items-center justify-center border-2 border-primary/20 shadow-sm relative shrink-0 overflow-hidden transition-all duration-300 ease-in-out" :class="isScrolled ? 'w-10 h-10' : 'w-14 h-14'">
            <img v-if="authStore.user?.avatar_url" :src="authStore.user.avatar_url" alt="Foto profil" class="w-full h-full object-cover" />
            <span v-else class="text-primary font-black transition-all duration-300 ease-in-out" :class="isScrolled ? 'text-sm' : 'text-xl'">{{ kaderInitials }}</span>
            <div class="absolute bg-success rounded-full border-2 border-white dark:border-slate-900 transition-all duration-300 ease-in-out" :class="isScrolled ? 'w-2.5 h-2.5 -top-0.5 -right-0.5' : 'w-3.5 h-3.5 top-0 right-0'"></div>
          </div>
        </div>
      </div>
      
      <!-- Date & Location -->
      <div class="flex items-center justify-between px-1 transition-all duration-300 ease-in-out" :class="isScrolled ? 'mb-3' : 'mb-6'">
        <div class="flex items-center gap-2">
          <LucideClock class="text-primary transition-all duration-300 ease-in-out" :class="isScrolled ? 'w-3 h-3' : 'w-4 h-4'" />
          <div>
            <p class="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider transition-all duration-300 ease-in-out" :class="isScrolled ? 'text-[8px] leading-tight' : 'text-[10px]'">Waktu Aktif</p>
            <p class="font-bold text-slate-700 dark:text-slate-200 transition-all duration-300 ease-in-out" :class="isScrolled ? 'text-[10px] leading-tight' : 'text-xs'">{{ currentTime }} <span class="font-medium text-slate-500 dark:text-slate-400">WIB</span></p>
          </div>
        </div>
        <div class="w-px bg-slate-200 dark:bg-slate-700 transition-all duration-300 ease-in-out" :class="isScrolled ? 'h-5' : 'h-8'"></div>
        <div class="flex items-center gap-2">
          <LucideMapPin class="text-primary transition-all duration-300 ease-in-out" :class="isScrolled ? 'w-3 h-3' : 'w-4 h-4'" />
          <div>
            <p class="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider transition-all duration-300 ease-in-out" :class="isScrolled ? 'text-[8px] leading-tight' : 'text-[10px]'">Lokasi Aktif</p>
            <p class="font-bold text-slate-700 dark:text-slate-200 transition-all duration-300 ease-in-out line-clamp-1" :class="isScrolled ? 'text-[10px] leading-tight max-w-[120px]' : 'text-xs max-w-[160px]'">{{ activeLocation }}</p>
          </div>
        </div>
      </div>
      
      <!-- Hero / Alert Card -->
      <div class="bg-gradient-to-br from-primary to-primary-600 text-white relative overflow-hidden transition-all duration-300 ease-in-out transform origin-top shadow-primary/30"
           :class="isScrolled ? 'rounded-[1rem] p-3 shadow-md' : 'rounded-3xl p-6 shadow-lg'">
        <!-- Decorative circles -->
        <div class="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
        <div class="absolute -left-6 -bottom-6 w-32 h-32 bg-black/10 rounded-full blur-2xl"></div>
        
        <div class="relative z-10 flex transition-all duration-300 ease-in-out" :class="isScrolled ? 'items-center justify-between' : 'flex-col'">
          <div class="flex items-center gap-3 transition-all duration-300 ease-in-out" :class="isScrolled ? 'mb-0' : 'mb-4 items-start'">
            <div class="bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm transition-all duration-300 ease-in-out" :class="isScrolled ? 'w-8 h-8 rounded-xl' : 'w-12 h-12 rounded-2xl animate-pulse'">
              <LucideBell class="text-white transition-all duration-300 ease-in-out" :class="isScrolled ? 'w-4 h-4' : 'w-6 h-6'" />
            </div>
            <div>
              <h2 class="font-bold leading-tight transition-all duration-300 ease-in-out" :class="isScrolled ? 'text-sm' : 'text-lg mb-1'">
                {{ activeTasksCount > 0 ? `Ada ${activeTasksCount} Tugas Aktif!` : 'Semua Tugas Selesai' }}
              </h2>
              <div class="transition-all duration-300 ease-in-out overflow-hidden" :class="isScrolled ? 'max-h-0 opacity-0' : 'max-h-20 opacity-100'">
                 <p class="text-sm text-primary-100 opacity-90 leading-tight">
                   {{ activeTasksCount > 0 ? 'Kunjungan pasien Prolanis belum diselesaikan.' : 'Tidak ada kunjungan yang tertunda saat ini.' }}
                 </p>
              </div>
            </div>
          </div>
          <NuxtLink to="/app/tugas" class="bg-white text-primary text-center font-extrabold shadow-sm active:scale-[0.98] transition-all duration-300 ease-in-out shrink-0"
                    :class="isScrolled ? 'py-1.5 px-4 rounded-lg text-xs' : 'block w-full py-3 rounded-xl text-base'">
            <span v-if="isScrolled">Lihat{{ activeTasksCount > 0 ? ` (${activeTasksCount})` : '' }}</span>
            <span v-else>Lihat Tugas Sekarang</span>
          </NuxtLink>
        </div>
      </div>
    </div>

    <div class="px-5 space-y-6">

      <!-- Draf Offline Notification -- cuma tampil kalau BENAR ada draf tertunda (SEBELUMNYA
           selalu tampil dengan angka "3" hardcode, terlepas ada draf sungguhan atau tidak). -->
      <div v-if="draftCount > 0" class="bg-warning/10 border border-warning/20 rounded-3xl p-4 flex items-center justify-between shadow-sm">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-warning/20 text-warning-700 rounded-2xl flex items-center justify-center">
            <LucideCloudOff class="w-5 h-5" />
          </div>
          <div>
            <h3 class="font-bold text-warning-800 dark:text-warning-500 text-sm">{{ draftCount }} Draf Tertunda</h3>
            <p class="text-xs text-warning-700/80 dark:text-warning-600/80">Belum disinkronkan</p>
          </div>
        </div>
        <NuxtLink to="/app/draft" class="px-4 py-2 bg-warning text-warning-950 font-bold text-xs rounded-xl shadow-sm active:scale-95 transition-transform">
          Lihat Draf
        </NuxtLink>
      </div>

      <!-- Unduh Peta Wilayah Kerja (docs/planning/10 §5, docs/planning/11 §9) -->
      <div class="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 transition-colors duration-300">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 bg-info/10 text-info rounded-2xl flex items-center justify-center shrink-0">
            <LucideMap class="w-5 h-5" />
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-slate-800 dark:text-white text-sm">Peta Offline Wilayah Kerja</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ todayAssignmentsWithLocation.length }} dari {{ todayAssignments.length }} tugas hari ini punya titik lokasi
              <template v-if="cachedTileCount > 0"> &bull; {{ cachedTileCount }} berkas peta tersimpan offline</template>
            </p>
          </div>
        </div>

        <div v-if="isDownloadingMap" class="mb-1">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-bold text-info flex items-center gap-1.5">
              <LucideLoader2 class="w-3.5 h-3.5 animate-spin" />
              Mengunduh {{ mapDownloadProgress.current }} / {{ mapDownloadProgress.total }}...
            </span>
          </div>
          <div class="h-2 w-full bg-info/10 rounded-full overflow-hidden">
            <div class="h-full bg-info transition-all duration-300" :style="{ width: mapDownloadProgress.total ? `${(mapDownloadProgress.current / mapDownloadProgress.total) * 100}%` : '0%' }"></div>
          </div>
        </div>
        <button
          v-else
          @click="downloadWorkAreaMap"
          class="w-full py-2.5 bg-info/10 text-info rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <LucideDownload class="w-4 h-4" />
          Unduh Peta Wilayah Kerja
        </button>

        <p v-if="mapDownloadError" class="text-xs font-semibold text-danger mt-2">{{ mapDownloadError }}</p>
        <p v-else-if="mapDownloadResult" class="text-xs font-semibold text-success mt-2">{{ mapDownloadResult }}</p>
        <!-- docs/planning/12: tombol TETAP aktif walau 0 tugas berkoordinat -- downloadWorkAreaMap
             otomatis jatuh ke cakupan Kabupaten Sumenep penuh (computeKabupatenBoundingBox), jadi
             ini murni informasi, bukan lagi alasan tombol dimatikan. -->
        <p v-else-if="todayAssignmentsWithLocation.length === 0" class="text-xs text-slate-400 mt-2">Belum ada tugas hari ini dengan lokasi diketahui — unduhan akan mencakup seluruh Kabupaten Sumenep.</p>

        <NuxtLink to="/app/mode-offline" class="mt-3 w-full py-2.5 border border-info/30 text-info rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 active:scale-[0.98] hover:bg-info/5">
          <LucidePackageCheck class="w-4 h-4" />
          Siapkan Mode Offline Lengkap
        </NuxtLink>
      </div>

      <!-- Progress Kinerja -->
      <div>
        <h3 class="text-base font-bold text-slate-800 dark:text-slate-300 uppercase tracking-widest mb-3 transition-colors">Kinerja Bulan Ini</h3>
        <div class="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-5 transition-colors duration-300">
          <div class="relative w-20 h-20 flex items-center justify-center shrink-0">
            <!-- Circular Progress SVG -->
            <svg class="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle class="text-slate-100 dark:text-slate-700 stroke-current transition-colors duration-300" stroke-width="8" cx="50" cy="50" r="40" fill="transparent"></circle>
              <circle class="text-success stroke-current drop-shadow-md transition-all duration-1000 ease-out" stroke-width="8" stroke-linecap="round" cx="50" cy="50" r="40" fill="transparent" stroke-dasharray="251.2" :stroke-dashoffset="progressDashOffset"></circle>
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-lg font-black text-slate-800 dark:text-white leading-none transition-colors">{{ monthlyProgressPercent }}%</span>
            </div>
          </div>
          <div>
            <p class="font-black text-slate-800 dark:text-white text-xl mb-0.5 transition-colors">{{ monthlyCompletedCount }} <span class="text-base text-slate-500 font-bold">/ {{ monthlyTotalCount }} Kunjungan</span></p>
            <p v-if="monthlyTotalCount === 0" class="text-base text-slate-500 font-medium leading-relaxed">Belum ada kunjungan terjadwal bulan ini.</p>
            <p v-else-if="monthlyCompletedCount >= monthlyTotalCount" class="text-base text-slate-500 font-medium leading-relaxed">Semua kunjungan bulan ini sudah selesai. Kerja bagus!</p>
            <p v-else class="text-base text-slate-500 font-medium leading-relaxed">{{ monthlyTotalCount - monthlyCompletedCount }} kunjungan lagi untuk mencapai target bulan ini. Semangat!</p>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div>
        <h3 class="text-base font-bold text-slate-800 dark:text-slate-300 uppercase tracking-widest mb-3 transition-colors">Pintasan Cepat</h3>
        <div class="grid grid-cols-2 gap-4">
          <!-- Item 1: Mulai Kunjungan (Bounce) -->
          <NuxtLink to="/app/tugas" class="group bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center gap-3 active:bg-slate-50 dark:active:bg-slate-700 transition-colors duration-300">
            <div class="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors duration-300">
              <LucideMapPin class="w-6 h-6 group-hover:animate-bounce" />
            </div>
            <span class="text-base font-bold text-slate-700 dark:text-slate-300 transition-colors">Mulai Kunjungan</span>
          </NuxtLink>

          <!-- Item 2: Riwayat Pengajuan -- SEBELUMNYA "Riwayat Medis" tanpa @click sama sekali
               (tombol mati), diganti ke halaman yang sungguhan sudah ada. -->
          <NuxtLink to="/app/profil/riwayat-pengajuan" class="group bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center gap-3 active:bg-slate-50 dark:active:bg-slate-700 transition-colors duration-300">
            <div class="w-12 h-12 bg-warning/10 text-warning rounded-2xl flex items-center justify-center group-hover:bg-warning group-hover:text-white transition-colors duration-300">
              <LucideHistory class="w-6 h-6 group-hover:animate-spin" style="animation-direction: reverse;" />
            </div>
            <span class="text-base font-bold text-slate-700 dark:text-slate-300 transition-colors">Riwayat Pengajuan</span>
          </NuxtLink>

          <!-- Item 3: Pasien Binaan -- SEBELUMNYA tombol mati tanpa @click. Daftar pasien binaan
               kader = daftar tugas kunjungannya sendiri (assignment selalu terikat 1 pasien),
               jadi cukup arahkan ke /app/tugas, bukan halaman baru terpisah. -->
          <NuxtLink to="/app/tugas" class="group bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center gap-3 active:bg-slate-50 dark:active:bg-slate-700 transition-colors duration-300">
            <div class="w-12 h-12 bg-info/10 text-info rounded-2xl flex items-center justify-center group-hover:bg-info group-hover:text-white transition-colors duration-300">
              <LucideUsers class="w-6 h-6 group-hover:scale-125 transition-transform duration-300" />
            </div>
            <span class="text-base font-bold text-slate-700 dark:text-slate-300 transition-colors">Pasien Binaan</span>
          </NuxtLink>

          <!-- Item 4: Kontak Pusk. -- SEBELUMNYA tombol mati. Sekarang buka modal berisi
               kontak puskesmas ASLI (GET /puskesmas/{id}, dimuat lewat loadKaderPuskesmas()). -->
          <button @click="showKontakPuskesmasModal = true" class="group bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center gap-3 active:bg-slate-50 dark:active:bg-slate-700 transition-colors duration-300">
            <div class="w-12 h-12 bg-danger/10 text-danger rounded-2xl flex items-center justify-center group-hover:bg-danger group-hover:text-white transition-colors duration-300">
              <LucidePhoneCall class="w-6 h-6 group-hover:animate-[wiggle_0.3s_ease-in-out_infinite]" />
            </div>
            <span class="text-base font-bold text-slate-700 dark:text-slate-300 transition-colors">Kontak Pusk.</span>
          </button>
        </div>
      </div>
      
    </div>

    <!-- Modal Kontak Puskesmas -- data ASLI (GET /puskesmas/{id}), diganti dari tombol mati
         "Kontak Pusk." sebelumnya. -->
    <div v-if="showKontakPuskesmasModal" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" @click="showKontakPuskesmasModal = false">
      <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in duration-200" @click.stop>
        <div class="p-6 text-center">
          <div class="w-16 h-16 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mx-auto mb-4">
            <LucidePhoneCall class="w-8 h-8" />
          </div>
          <h3 class="font-black text-slate-800 dark:text-white text-lg mb-1">{{ kaderPuskesmas?.nama ?? 'Memuat...' }}</h3>
          <p v-if="kaderPuskesmas?.alamat" class="text-base text-slate-500 dark:text-slate-400 leading-relaxed mb-4">{{ kaderPuskesmas.alamat }}</p>
          <p v-else class="text-base text-slate-400 mb-4">Alamat belum diisi admin puskesmas.</p>

          <div class="space-y-2">
            <a v-if="kaderPuskesmas?.no_telp" :href="`tel:${kaderPuskesmas.no_telp}`" class="w-full py-3.5 rounded-2xl font-bold text-white bg-primary active:bg-primary-600 transition-colors flex items-center justify-center gap-2">
              <LucidePhoneCall class="w-4 h-4" /> Telepon {{ kaderPuskesmas.no_telp }}
            </a>
            <a v-if="kaderPuskesmas?.no_wa" :href="`https://wa.me/${kaderPuskesmas.no_wa.replace(/^0/, '62').replace(/\D/g, '')}`" target="_blank" rel="noopener" class="w-full py-3.5 rounded-2xl font-bold text-success bg-success/10 active:bg-success/20 transition-colors flex items-center justify-center gap-2">
              WhatsApp {{ kaderPuskesmas.no_wa }}
            </a>
            <p v-if="kaderPuskesmas && !kaderPuskesmas.no_telp && !kaderPuskesmas.no_wa" class="text-sm text-slate-400">Nomor kontak belum diisi admin puskesmas.</p>
          </div>
        </div>
        <button @click="showKontakPuskesmasModal = false" class="w-full py-4 border-t border-slate-100 dark:border-slate-700 font-bold text-slate-500 dark:text-slate-400 active:bg-slate-50 dark:active:bg-slate-700 transition-colors">
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes wiggle {
  0%, 100% { transform: rotate(-10deg); }
  50% { transform: rotate(10deg); }
}

.swap-enter-active,
.swap-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.swap-enter-from {
  opacity: 0;
  transform: rotate(90deg) scale(0.5);
}
.swap-leave-to {
  opacity: 0;
  transform: rotate(-90deg) scale(0.5);
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
