<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  LucideMapPin,
  LucideLayoutDashboard,
  LucideUsers,
  LucideHeartPulse,
  LucideCalendarCheck,
  LucideUserCog,
  LucideBuilding2,
  LucideSettings,
  LucideSun,
  LucideMoon,
  LucideBell,
  LucideMenu,
  LucideSearch,
  LucideUser,
  LucideChevronDown,
  LucideRefreshCw,
  LucideLogOut,
  LucideCheckCircle2,
  LucideAlertTriangle,
  LucideSmartphone,
  LucideStethoscope,
  LucideAmbulance
} from "#components"
import type { ApiSuccessEnvelope, Role } from '~/types/api'

const isSidebarOpen = ref(true)

// Identitas user login asli -- dipakai di widget sapaan header + dropdown profil (dulu
// hardcode "dr. Budi" / "dr. Amanda Putri" / "amanda.putri@silakes.go.id", beda-beda pula
// antara dua tempat yang seharusnya sama).
const authStore = useAuthStore()

const userRoleLabel = computed(() => {
  return resolveRolesLabel(authStore.roles)
})

useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} - PRODULI` : 'Dashboard - PRODULI'
  }
})

// Widget Info State
const now = useNow()

const greeting = computed(() => {
  const h = now.value.getHours()
  if (h >= 5 && h < 11) return "Selamat Pagi"
  if (h >= 11 && h < 15) return "Selamat Siang"
  if (h >= 15 && h < 18) return "Selamat Sore"
  return "Selamat Malam"
})

const timeString = computed(() => 
  now.value.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }) + " WIB"
)

// Geolocation real-time
const userLocation = ref("Mendeteksi lokasi...")
onMounted(() => {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude
          const lon = position.coords.longitude
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=id`)
          const data = await res.json()
          const address = data.address || {}
          
          const desa = address.village || address.suburb || address.neighbourhood || address.hamlet || ''
          const kecamatan = address.city_district || address.municipality || address.town || ''
          const kabupaten = address.city || address.regency || address.county || ''
          
          const parts = []
          if (desa) parts.push(desa.replace(/^(desa|kelurahan)\s+/i, ''))
          if (kecamatan) {
            const namaKec = kecamatan.replace(/^(kecamatan|kec\.)\s+/i, '')
            parts.push(`Kec. ${namaKec}`)
          }
          if (kabupaten) {
            const namaKab = kabupaten.replace(/^(kabupaten|kab\.|kota)\s+/i, '')
            const isKota = kabupaten.toLowerCase().includes('kota')
            parts.push(isKota ? `Kota ${namaKab}` : `Kab. ${namaKab}`)
          }
          
          if (parts.length > 0) {
             userLocation.value = parts.join(", ")
          } else {
             const fallbackState = address.state || ''
             userLocation.value = fallbackState || "Lokasi ditemukan"
          }
        } catch(e) {
          userLocation.value = "Gagal melacak nama daerah"
        }
      },
      (error) => {
        userLocation.value = "Akses lokasi ditolak"
      }
    )
  } else {
    userLocation.value = "GPS tidak didukung"
  }
})

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

// Menu sidebar (docs/planning/02 §17) -- rute NYATA (bukan href="#" dummy), setiap item flat
// (tanpa children -- "Jadwal Kader" dihapus karena datanya sama persis dengan Kunjungan, bukan
// halaman terpisah; "Laporan Kinerja"/"Pemetaan" dihapus karena tidak/belum punya halaman
// sendiri -- peta sebaran sudah jadi bagian /dashboard, bukan menu terpisah).
const menuGroups = ref([
  {
    label: 'OPERASIONAL',
    items: [
      { name: 'Dashboard', icon: LucideLayoutDashboard, to: '/dashboard' },
      { name: 'Data Pasien', icon: LucideHeartPulse, to: '/dashboard/pasien' },
      { name: 'Kunjungan', icon: LucideCalendarCheck, to: '/dashboard/kunjungan' },
      // Fase 3 (docs plan) -- rujukan dari kader/nakes, digerbangi VisitReportPolicy::viewAnyRujukan
      // (super_admin/admin_puskesmas/pj_prolanis, scope puskesmas ditegakkan di backend).
      { name: 'Rujukan', icon: LucideAmbulance, to: '/dashboard/rujukan', roles: ['admin_puskesmas', 'pj_prolanis', 'super_admin'] },
    ]
  },
  {
    label: 'MANAJEMEN',
    items: [
      // KaderPolicy::viewAny -- super_admin/admin_puskesmas/pj_prolanis.
      { name: 'Manajemen Kader', icon: LucideUsers, to: '/dashboard/kader', roles: ['pj_prolanis', 'admin_puskesmas', 'super_admin'] },
      // TenagaKesehatanPolicy::viewAny -- gerbang sama persis dengan Manajemen Kader di atas
      // (revisi Bu Kadis, peran baru pemeriksaan lanjutan di rumah pasien).
      { name: 'Manajemen Tenaga Kesehatan', icon: LucideStethoscope, to: '/dashboard/tenaga-kesehatan', roles: ['pj_prolanis', 'admin_puskesmas', 'super_admin'] },
      // StaffController::index -- super_admin/admin_puskesmas/pj_prolanis boleh LIHAT (pj_prolanis
      // sebelumnya 403 total, sekarang boleh lihat staf puskesmasnya sendiri); store() (daftarkan
      // staf baru) TETAP super_admin/admin_puskesmas saja, digerbangi terpisah di halamannya sendiri.
      { name: 'Manajemen Staf', icon: LucideUserCog, to: '/dashboard/staf', roles: ['admin_puskesmas', 'pj_prolanis', 'super_admin'] },
      // PuskesmasPolicy::viewAny -- SEMUA role login boleh lihat (tidak ada `roles` di sini
      // sengaja); edit (admin_puskesmas puskesmas sendiri/super_admin bebas) digerbangi di
      // dalam halaman itu sendiri, bukan di menu.
      { name: 'Data Instansi', icon: LucideBuilding2, to: '/dashboard/instansi' },
    ]
  },
  {
    label: 'SISTEM',
    items: [
      { name: 'Pengaturan', icon: LucideSettings, to: '/dashboard/pengaturan', roles: ['super_admin'] },
    ]
  }
])

// Item ber-`roles` cuma tampil kalau role login cocok salah satu. Grup yang semua isinya
// ke-filter ikut disembunyikan, bukan cuma menyisakan label kosong.
const visibleMenuGroups = computed(() => {
  const roles = authStore.roles ?? []
  return menuGroups.value
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || item.roles.some((r: Role) => roles.includes(r)))
    }))
    .filter((group) => group.items.length > 0)
})

const route = useRoute()
// '/dashboard' exact-match saja (kalau prefix, dia akan ikut "aktif" di SEMUA halaman /dashboard/*
// juga karena semuanya diawali path yang sama) -- item lain prefix-match (mis. /dashboard/pasien/5
// tetap menandai "Data Pasien" aktif).
function isItemActive(item: { to: string }) {
  return item.to === '/dashboard' ? route.path === '/dashboard' : route.path.startsWith(item.to)
}

// Dual-role pj_prolanis + kader (docs/planning §7) -- homeRoute tetap /dashboard (tidak diubah,
// itu keputusan terpisah di useAuthStore), ini cuma jalan pintas opsional yang jelas ke /app.
const isPjProlanisWithKader = computed(() => {
  const roles = authStore.roles ?? []
  return roles.includes('pj_prolanis') && roles.includes('kader')
})

// Theme Toggle
const isDark = ref(false)
const toggleTheme = () => {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

// Notification Dropdown -- GET /api/v1/notifications (tabel `notifications` bawaan Laravel,
// ter-scope ke user login sendiri lewat backend). Logic (load/format/markRead) diekstrak ke
// useNotifications() (composables/useNotifications.ts) supaya dipakai bersama layouts/pwa.vue.
const isNotifOpen = ref(false)
const {
  headerNotifications,
  unreadCount,
  isLoadingNotif,
  notifError,
  loadNotifications,
  formatNotification,
  notifIcon,
  markAllRead,
  openNotification,
  isDangerNotif
} = useNotifications()

onMounted(loadNotifications)

// Push notification (FCM) -- daftarkan token sekali per sesi dashboard, no-op kalau config
// Firebase belum lengkap atau user belum kasih izin notifikasi browser (lihat useFcm.ts).
onMounted(() => {
  useFcm().registerAndSendToken()
})

// User Profile
const isProfileOpen = ref(false)
const isGoogleConnected = computed(() => !!authStore.user?.google_id)

// Konfirmasi logout -- BUKAN window.confirm() bawaan browser, modal sendiri konsisten dengan
// gaya modal lain di dashboard (rounded-3xl, dsb).
const showLogoutConfirm = ref(false)
const isLoggingOut = ref(false)

function requestLogout() {
  isProfileOpen.value = false
  showLogoutConfirm.value = true
}

async function confirmLogout() {
  isLoggingOut.value = true
  try {
    await authStore.logout()
    await navigateTo('/auth/login')
  } finally {
    isLoggingOut.value = false
    showLogoutConfirm.value = false
  }
}

// --- Sinkronisasi SiLAKES manual (sidebar) -- super_admin saja -----------------------------
// GET /silakes/sync-status + POST /silakes/sync (backend baru, SilakesSyncController) --
// tombol ini SEBELUMNYA statis (tidak ada handler klik, "Terakhir sinkronisasi: 10 menit lalu"
// hardcode, tidak digerbangi role). Sekarang: hanya tampil untuk super_admin, klik memicu
// sync SUNGGUHAN (synchronous di request HTTP, throttle 48 jam TIDAK berlaku untuk trigger
// manual ini -- operator secara eksplisit minta sync sekarang), dan label waktu diambil dari
// integration_sync_logs yang sesungguhnya.
const toast = useToast()
const isSuperAdmin = computed(() => (authStore.roles ?? []).includes('super_admin'))
const isSyncing = ref(false)
// State DIBAGI (bukan ref lokal) -- sync bisa dipicu dari sini ATAU dari tombol
// "Sinkronisasi Sekarang" di halaman detail pasien, label ini harus tetap akurat dari
// manapun sync-nya dipicu.
const lastSyncedAt = useSilakesLastSyncedAt()

function formatLastSynced(iso: string | null): string {
  if (!iso) return 'Belum pernah sinkron'
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return 'Baru saja'
  if (diffMin < 60) return `${diffMin} menit lalu`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} jam lalu`
  const diffDay = Math.floor(diffHour / 24)
  return `${diffDay} hari lalu`
}
const lastSyncedLabel = computed(() => formatLastSynced(lastSyncedAt.value))

async function loadSyncStatus() {
  if (!isSuperAdmin.value) return
  try {
    const api = useApi()
    const res = await api('/silakes/sync-status') as ApiSuccessEnvelope<{ last_synced_at: string | null }>
    lastSyncedAt.value = res.data.last_synced_at
  } catch (e) {
    console.error('Gagal memuat status sinkronisasi SiLAKES', e)
  }
}

async function triggerSilakesSync() {
  if (isSyncing.value) return
  isSyncing.value = true
  try {
    const api = useApi()
    const res = await api('/silakes/sync', { method: 'POST' }) as ApiSuccessEnvelope<{ last_synced_at: string, result: { patients_synced: number, lab_results_synced: number, patients_classified: number } }>
    const { patients_synced, patients_classified } = res.data.result
    toast.add({
      title: 'Sinkronisasi SiLAKES berhasil',
      description: `${patients_synced} pasien diproses, ${patients_classified} diklasifikasi ulang.`,
      color: 'success'
    })
    // Update label waktu + beritahu halaman aktif (dashboard/dashboard-pasien/detail
    // pasien) untuk reload datanya sendiri -- tanpa ini angka di halaman tetap versi lama
    // sampai user refresh manual, padahal sync barusan sukses.
    signalSilakesSyncCompleted(res.data.last_synced_at)
  } catch (e) {
    toast.add({
      title: 'Sinkronisasi SiLAKES gagal',
      description: e instanceof ApiError ? e.message : 'Terjadi kesalahan tidak terduga.',
      color: 'error'
    })
  } finally {
    isSyncing.value = false
  }
}

onMounted(loadSyncStatus)
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex text-slate-800 font-sans theme-transition">
    
    <!-- Sidebar -->
    <aside 
      class="fixed top-0 left-0 h-screen w-64 bg-accent flex flex-col z-20 transition-transform duration-300 shadow-xl"
      :class="isSidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <!-- Logo Area -->
      <div class="h-16 flex items-center px-6 bg-white shrink-0 border-b border-slate-200 theme-transition">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
            <img src="/logo/logo-no-text.png" alt="Logo PRODULI" class="w-full h-full object-contain" />
          </div>
          <div class="flex flex-col">
            <span class="font-extrabold text-accent leading-tight tracking-tight text-lg">PRODULI</span>
            <span class="text-[10px] text-slate-500 font-semibold uppercase tracking-wider leading-none">PELAYANAN PROAKTIF</span>
          </div>
        </div>
      </div>

      <!-- Navigation -->
      <div class="flex-1 overflow-y-auto py-6 px-4 no-scrollbar flex flex-col gap-6">
        <div v-for="(group, idx) in visibleMenuGroups" :key="idx">
          <p class="px-3 text-xs font-semibold text-slate-400 mb-2 tracking-wider">{{ group.label }}</p>
          <ul class="flex flex-col gap-1">
            <li v-for="item in group.items" :key="item.name">
              <NuxtLink :to="item.to"
                class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200"
                :class="isItemActive(item) ? 'bg-primary/10 text-primary border-l-4 border-primary font-medium' : 'text-slate-300 hover:bg-white/5 hover:text-white border-l-4 border-transparent'"
              >
                <component :is="item.icon" class="w-5 h-5" :class="isItemActive(item) ? 'text-primary' : 'text-slate-400'" />
                <span class="text-sm flex-1">{{ item.name }}</span>
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>

      <!-- Bottom Button -- sinkronisasi manual SiLAKES, super_admin saja (lihat script:
           triggerSilakesSync). admin_puskesmas/pj_prolanis/kader TIDAK melihat tombol ini sama
           sekali -- mereka bukan yang mengelola integrasi SiLAKES. -->
      <div v-if="isSuperAdmin" class="p-4 shrink-0 border-t border-white/10">
        <button
          type="button"
          :disabled="isSyncing"
          @click="triggerSilakesSync"
          class="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white rounded-xl py-3 transition-colors border border-white/10 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <LucideRefreshCw class="w-4 h-4" :class="{ 'animate-spin': isSyncing }" />
          <span class="text-sm font-semibold">{{ isSyncing ? 'Menyinkronkan...' : 'Sinkronisasi SiLAKES' }}</span>
        </button>
        <p class="text-center text-[10px] text-slate-400 mt-2">Terakhir sinkronisasi: {{ lastSyncedLabel }}</p>
      </div>
    </aside>

    <!-- Main Content Wrapper -->
    <div 
      class="flex-1 flex flex-col min-h-screen transition-all duration-300"
      :class="isSidebarOpen ? 'ml-0 md:ml-64' : 'ml-0'"
    >
      <!-- Header -->
      <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40 shadow-sm theme-transition">
        <div class="flex items-center gap-4">
          <button @click="toggleSidebar" class="text-slate-500 hover:text-primary transition-colors p-2 rounded-lg hover:bg-slate-50">
            <LucideMenu class="w-5 h-5" />
          </button>
          
          <!-- Widget Info (Sapaan, Waktu, Lokasi) -->
          <div class="hidden sm:flex items-center gap-2 text-sm ml-2">
            <span class="font-semibold text-accent">{{ greeting }}, {{ authStore.user?.name ?? '...' }}</span>
            <span class="text-slate-300">•</span>
            
            <ClientOnly>
              <span class="text-slate-500 font-medium">{{ timeString }}</span>
              <template #fallback>
                <span class="text-slate-500 font-medium">--:-- WIB</span>
              </template>
            </ClientOnly>
            
            <span class="text-slate-300">•</span>
            
            <ClientOnly>
              <span class="flex items-center gap-1.5 text-slate-500 font-medium">
                <LucideMapPin class="w-3.5 h-3.5 text-slate-400" />
                {{ userLocation }}
              </span>
              <template #fallback>
                <span class="flex items-center gap-1.5 text-slate-500 font-medium">
                  <LucideMapPin class="w-3.5 h-3.5 text-slate-400" />
                  Mendeteksi lokasi...
                </span>
              </template>
            </ClientOnly>
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-4">

          <!-- Dual-role pj_prolanis+kader: jalan pintas opsional ke /app, dashboard tetap
               default (homeRoute tidak diubah) -- ini cuma tombol pindah mode. -->
          <NuxtLink
            v-if="isPjProlanisWithKader"
            to="/app"
            class="hidden md:flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 transition-colors px-3.5 py-2 rounded-lg text-sm font-bold shrink-0"
          >
            <LucideSmartphone class="w-4 h-4" />
            <span>Buka Mode Kader</span>
          </NuxtLink>

          <!-- Light/Dark Toggle -->
          <button @click="toggleTheme" class="relative text-slate-500 hover:text-primary transition-colors overflow-hidden w-9 h-9 rounded-lg hover:bg-slate-50 flex items-center justify-center cursor-pointer shrink-0">
            <Transition name="fade-slide">
               <LucideSun v-if="!isDark" class="w-5 h-5 absolute" />
               <LucideMoon v-else class="w-5 h-5 absolute" />
            </Transition>
          </button>
          
          <!-- Notification Dropdown -->
          <div class="relative">
             <!-- Overlay untuk klik di luar -->
             <div v-if="isNotifOpen" @click="isNotifOpen = false" class="fixed inset-0 z-40 cursor-default"></div>

             <button @click="isNotifOpen = !isNotifOpen" class="relative z-50 text-slate-500 hover:text-primary transition-colors w-9 h-9 rounded-lg hover:bg-slate-50 flex items-center justify-center cursor-pointer shrink-0">
               <LucideBell class="w-5 h-5" />
               <template v-if="unreadCount > 0">
                 <!-- Titik merah radar (ping) -->
                 <span class="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full animate-ping opacity-75"></span>
                 <span class="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full border border-white"></span>
               </template>
             </button>
             
             <!-- Dropdown Popup -->
             <Transition
               enter-active-class="transition duration-300 ease-out"
               enter-from-class="transform scale-95 opacity-0 -translate-y-2"
               enter-to-class="transform scale-100 opacity-100 translate-y-0"
               leave-active-class="transition duration-200 ease-in"
               leave-from-class="transform scale-100 opacity-100 translate-y-0"
               leave-to-class="transform scale-95 opacity-0 -translate-y-2"
             >
               <div v-if="isNotifOpen" class="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-100 z-50 overflow-hidden theme-transition">
                 <div class="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 class="font-extrabold text-accent">Notifikasi Sistem</h3>
                    <button v-if="unreadCount > 0" @click="markAllRead" class="text-[11px] font-bold text-primary hover:underline px-2 py-1 hover:bg-primary/10 rounded-md transition-colors cursor-pointer">Tandai dibaca semua</button>
                 </div>

                 <div class="max-h-[400px] overflow-y-auto no-scrollbar bg-white">
                    <div v-if="isLoadingNotif" class="p-8 text-center text-slate-400 text-sm">
                       Memuat notifikasi...
                    </div>
                    <div v-else-if="notifError" class="p-8 text-center text-danger text-xs font-semibold">
                       {{ notifError }}
                    </div>
                    <div v-else-if="headerNotifications.length === 0" class="p-8 text-center text-slate-400 text-sm">
                       Tidak ada notifikasi.
                    </div>
                    <div v-for="n in headerNotifications" :key="n.id" @click="openNotification(n)"
                         class="p-4 border-b border-slate-50 last:border-0 cursor-pointer transition-all duration-300 relative"
                         :class="n.is_read ? 'bg-white hover:bg-slate-50' : (isDangerNotif(n) ? 'bg-danger/5 hover:bg-danger/10 border-l-[3px] border-l-danger' : 'bg-primary/5 hover:bg-primary/10 border-l-[3px] border-l-primary')">

                       <div class="flex items-start gap-3">
                          <div class="w-8 h-8 rounded-full flex items-center justify-center shadow-sm border shrink-0"
                               :class="isDangerNotif(n) ? 'bg-danger/10 text-danger border-danger/30' : 'bg-slate-100 text-slate-500 border-slate-200'">
                             <component :is="notifIcon(n.type)" class="w-4 h-4" />
                          </div>
                          <div class="flex-1 min-w-0">
                             <p class="text-sm font-bold text-slate-800">{{ formatNotification(n).title }}</p>
                             <p v-if="formatNotification(n).desc" class="text-[11px] font-medium text-slate-500 mt-1 leading-relaxed">{{ formatNotification(n).desc }}</p>
                             <div class="flex items-center justify-between mt-2">
                                <p class="text-[10px] font-bold text-slate-400">{{ new Date(n.created_at).toLocaleString('id-ID') }}</p>
                                <span v-if="!n.is_read" class="text-[10px] font-bold" :class="isDangerNotif(n) ? 'text-danger' : 'text-primary'">{{ isDangerNotif(n) ? 'Perlu Tindakan' : 'Baru' }}</span>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
               </div>
             </Transition>
          </div>
          
          <div class="h-6 w-px bg-slate-200 mx-1"></div>

          <!-- User Profile -->
          <div class="relative">
            <!-- Overlay untuk klik di luar -->
            <div v-if="isProfileOpen" @click="isProfileOpen = false" class="fixed inset-0 z-40 cursor-default"></div>
            
            <div @click="isProfileOpen = !isProfileOpen" class="flex items-center gap-3 cursor-pointer group relative z-50">
              <div class="text-right hidden sm:block">
                <p class="text-sm font-bold text-accent group-hover:text-primary transition-colors">{{ authStore.user?.name ?? '...' }}</p>
                <p class="text-xs text-slate-500">{{ userRoleLabel }}</p>
              </div>
              <div class="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden text-primary">
                 <img v-if="authStore.user?.avatar_url" :src="authStore.user.avatar_url" alt="" class="w-full h-full object-cover" />
                 <LucideUser v-else class="w-5 h-5" />
              </div>
              <LucideChevronDown class="w-4 h-4 text-slate-400 hidden sm:block transition-transform" :class="isProfileOpen ? 'rotate-180' : ''" />
            </div>

            <!-- Profile Dropdown -->
            <Transition
               enter-active-class="transition duration-200 ease-out"
               enter-from-class="transform scale-95 opacity-0 -translate-y-2"
               enter-to-class="transform scale-100 opacity-100 translate-y-0"
               leave-active-class="transition duration-150 ease-in"
               leave-from-class="transform scale-100 opacity-100 translate-y-0"
               leave-to-class="transform scale-95 opacity-0 -translate-y-2"
             >
              <div v-if="isProfileOpen" class="absolute right-0 mt-4 w-72 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-100 z-50 overflow-hidden theme-transition">
                 <div class="p-4 border-b border-slate-100 bg-slate-50/50">
                    <p class="text-[10px] font-bold text-slate-400 mb-0.5 uppercase tracking-wider">Signed in as</p>
                    <p class="font-bold text-accent truncate text-sm">{{ authStore.user?.email ?? '...' }}</p>
                 </div>
                 
                 <!-- Google Status -->
                 <div class="p-3 border-b border-slate-100">
                    <div v-if="isGoogleConnected" class="flex items-center gap-2 text-success bg-success/10 border border-success/20 px-3 py-2 rounded-xl">
                       <LucideCheckCircle2 class="w-4 h-4 shrink-0" />
                       <span class="text-xs font-bold">Terhubung ke Akun Google</span>
                    </div>
                    <div v-else class="flex flex-col gap-2 bg-warning/10 border border-warning/20 p-3 rounded-xl">
                       <div class="flex items-start gap-2 text-warning-700">
                          <LucideAlertTriangle class="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                             <p class="text-xs font-bold">Belum Tertaut</p>
                             <p class="text-[10px] opacity-80 mt-0.5">Tautkan akun Google Anda untuk akses lebih cepat.</p>
                          </div>
                       </div>
                       <NuxtLink to="/dashboard/profil/pengaturan" @click="isProfileOpen = false" class="w-full flex items-center justify-center gap-2 bg-white border border-warning/30 hover:bg-warning/10 text-warning-700 text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer shadow-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                          </svg>
                          Tautkan Sekarang
                       </NuxtLink>
                    </div>
                 </div>

                 <!-- Menu Items -->
                 <div class="p-2 space-y-1">
                    <NuxtLink to="/dashboard/profil" @click="isProfileOpen = false" class="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors cursor-pointer">
                       <LucideUser class="w-4 h-4 text-slate-400" />
                       Profil Saya
                    </NuxtLink>
                    <NuxtLink to="/dashboard/profil/pengaturan" @click="isProfileOpen = false" class="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors cursor-pointer">
                       <LucideSettings class="w-4 h-4 text-slate-400" />
                       Pengaturan
                    </NuxtLink>
                    <div class="h-px bg-slate-100 my-1 mx-2"></div>
                    <button @click="requestLogout" class="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-danger hover:bg-danger/5 rounded-lg transition-colors cursor-pointer">
                       <LucideLogOut class="w-4 h-4" />
                       Keluar (Logout)
                    </button>
                 </div>
              </div>
            </Transition>
          </div>
        </div>
      </header>

      <!-- Page Content -->
      <main class="flex-1 p-4 sm:p-6 lg:p-8 bg-surface theme-transition">
        <slot />
      </main>
    </div>
    
    <!-- Mobile Overlay -->
    <div
      v-if="isSidebarOpen"
      @click="toggleSidebar"
      class="fixed inset-0 bg-accent/50 backdrop-blur-sm z-10 md:hidden"
    ></div>

    <!-- Konfirmasi Logout -- bukan window.confirm() bawaan browser. -->
    <div v-if="showLogoutConfirm" class="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
       <div class="bg-white rounded-3xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
          <div class="p-6 overflow-y-auto">
             <div class="w-14 h-14 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mb-4">
                <LucideLogOut class="w-7 h-7" />
             </div>
             <h3 class="font-bold text-accent text-lg mb-1">Keluar dari PRODULI?</h3>
             <p class="text-sm text-slate-500 leading-relaxed">Anda perlu masuk kembali dengan email dan kata sandi untuk melanjutkan.</p>
          </div>
          <div class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
             <button @click="showLogoutConfirm = false" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Batal</button>
             <button
                @click="confirmLogout"
                :disabled="isLoggingOut"
                class="py-2.5 px-6 rounded-xl font-bold text-white bg-danger hover:bg-danger/90 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
             >
                <LucideLoader2 v-if="isLoggingOut" class="w-4 h-4 animate-spin" />
                Ya, Keluar
             </button>
          </div>
       </div>
    </div>
  </div>
</template>

<style>
/* Global smooth theme transition */
.theme-transition {
  transition: background-color 0.5s ease, border-color 0.5s ease, color 0.5s ease;
}

/* Optional custom scrollbar */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  scrollbar-width: none;
}

/* Icon Sun/Moon Fade Slide */
.fade-slide-enter-active, .fade-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-slide-enter-from { 
  opacity: 0; 
  transform: translateY(10px) rotate(-90deg); 
}
.fade-slide-leave-to { 
  opacity: 0; 
  transform: translateY(-10px) rotate(90deg); 
}
</style>
