<script setup lang="ts">
import type { ApiSuccessEnvelope, Kader } from '~/types/api'

definePageMeta({
  layout: 'pwa',
  middleware: 'auth'
})
useHead({
  title: 'Profil Kader'
})

// Konfirmasi logout -- BUKAN window.confirm() bawaan browser. SEBELUMNYA juga tidak pernah
// panggil authStore.logout() sama sekali (cuma navigateTo, sesi/token TETAP tersimpan) --
// diperbaiki sekalian karena langsung terkait tombol yang sama.
const authStore = useAuthStore()
const toast = useToast()
const showLogoutConfirm = ref(false)
const isLoggingOut = ref(false)

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

// Identitas ASLI -- SEBELUMNYA "Siti Aminah" + "Kader Prolanis • Puskesmas Pamolokan" hardcode
// total di header, tidak pernah ambil dari sesi login/GET /kader/profile sama sekali.
const initials = computed(() => {
  const name = authStore.user?.name ?? ''
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
})
const puskesmasName = ref('')
async function loadKaderProfile() {
  try {
    const api = useApi()
    const res = await api('/kader/profile') as ApiSuccessEnvelope<Kader>
    if (res.data.puskesmas) puskesmasName.value = res.data.puskesmas.nama
  } catch (e) {
    console.error('Gagal memuat profil kader', e)
  }
}
onMounted(loadKaderProfile)

// --- Akun Google (GET /auth/google/link/redirect, DELETE /auth/google/unlink) -- SEBELUMNYA
// kartu ini SELALU tampil sebagai "Belum Tertaut" dengan tombol tanpa @click, terlepas status
// sesungguhnya. Pola sama persis dengan /dashboard/profil/pengaturan (sisi staf).
const isGoogleConnected = computed(() => !!authStore.user?.google_id)
const isLinkingGoogle = ref(false)

async function linkGoogle() {
  isLinkingGoogle.value = true
  try {
    const api = useApi()
    const res = await api('/auth/google/link/redirect') as ApiSuccessEnvelope<{ redirect_url: string }>
    window.location.href = res.data.redirect_url
  } catch (e) {
    toast.add({ title: e instanceof ApiError ? e.message : 'Gagal memulai proses tautkan akun Google.', color: 'error' })
    isLinkingGoogle.value = false
  }
}
</script>

<template>
  <div>
  <div class="px-5 pt-8 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-sm sticky top-0 z-40 transition-colors duration-300">
    <h1 class="text-2xl font-extrabold text-accent dark:text-white transition-colors">Profil Saya</h1>
  </div>
  
  <div class="p-5">
     <!-- Profile Header -->
     <div class="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 mb-6 flex flex-col items-center text-center transition-colors duration-300">
        <div class="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center border-4 border-primary/20 shadow-sm mb-4 transition-colors relative overflow-hidden">
           <img v-if="authStore.user?.avatar_url" :src="authStore.user.avatar_url" alt="Foto profil" class="w-full h-full object-cover" />
           <span v-else class="text-primary font-black text-3xl">{{ initials }}</span>
           <div v-if="!isGoogleConnected" class="absolute bottom-0 right-0 w-6 h-6 bg-warning rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center transition-colors">
              <LucideAlertCircle class="w-3.5 h-3.5 text-white" />
           </div>
        </div>
        <h2 class="text-xl font-black text-slate-800 dark:text-white mb-1 transition-colors">{{ authStore.user?.name ?? '...' }}</h2>
        <p class="text-base text-slate-500 dark:text-slate-400 font-medium transition-colors">Kader Prolanis<template v-if="puskesmasName"> &bull; {{ puskesmasName }}</template></p>
     </div>

     <!-- Google Link Warning -- cuma tampil kalau BENAR belum tertaut (SEBELUMNYA selalu
          tampil "Belum Tertaut" dengan tombol mati, terlepas status sesungguhnya). -->
     <div v-if="!isGoogleConnected" class="bg-warning/10 dark:bg-warning/5 border border-warning/20 dark:border-warning/10 rounded-3xl p-5 mb-6 flex flex-col gap-4 shadow-sm transition-colors duration-300">
        <div class="flex items-start gap-3.5">
           <div class="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-colors">
              <svg class="w-5 h-5" viewBox="0 0 24 24"><path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.409 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/><path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/><path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"/><path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/></svg>
           </div>
           <div>
              <h3 class="font-bold text-slate-800 dark:text-slate-200 text-base mb-0.5 transition-colors">Tautkan Akun Google</h3>
              <p class="text-base text-slate-600 dark:text-slate-400 font-medium leading-relaxed transition-colors">Amankan akses masuk akun Anda tanpa perlu menghafal kata sandi lagi.</p>
           </div>
        </div>
        <button @click="linkGoogle" :disabled="isLinkingGoogle" class="w-full py-3 bg-white dark:bg-slate-800 border border-warning/30 dark:border-warning/20 text-warning-600 dark:text-warning-400 font-bold text-base uppercase tracking-wider rounded-xl shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
           <LucideLoader2 v-if="isLinkingGoogle" class="w-4 h-4 animate-spin" />
           Tautkan Sekarang
        </button>
     </div>
     
     <!-- Menu Items -->
     <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden mb-6 transition-colors duration-300">
        <NuxtLink to="/app/profil/informasi-pribadi" class="w-full flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700 active:bg-slate-50 dark:active:bg-slate-700 transition-colors">
           <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-info/10 text-info rounded-xl flex items-center justify-center">
                 <LucideUser class="w-5 h-5" />
              </div>
              <span class="font-bold text-slate-700 dark:text-slate-200 transition-colors">Informasi Pribadi</span>
           </div>
           <LucideChevronRight class="w-5 h-5 text-slate-300 dark:text-slate-600 transition-colors" />
        </NuxtLink>
        <NuxtLink to="/app/profil/notifikasi" class="w-full flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700 active:bg-slate-50 dark:active:bg-slate-700 transition-colors">
           <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-warning/10 text-warning rounded-xl flex items-center justify-center">
                 <LucideBell class="w-5 h-5" />
              </div>
              <span class="font-bold text-slate-700 dark:text-slate-200 transition-colors">Pengaturan Notifikasi</span>
           </div>
           <LucideChevronRight class="w-5 h-5 text-slate-300 dark:text-slate-600 transition-colors" />
        </NuxtLink>
        <NuxtLink to="/app/profil/keamanan" class="w-full flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700 active:bg-slate-50 dark:active:bg-slate-700 transition-colors">
           <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-success/10 text-success rounded-xl flex items-center justify-center">
                 <LucideShieldCheck class="w-5 h-5" />
              </div>
              <span class="font-bold text-slate-700 dark:text-slate-200 transition-colors">Keamanan & Sandi</span>
           </div>
           <LucideChevronRight class="w-5 h-5 text-slate-300 dark:text-slate-600 transition-colors" />
        </NuxtLink>
        <NuxtLink to="/app/profil/riwayat-pengajuan" class="w-full flex items-center justify-between p-4 active:bg-slate-50 dark:active:bg-slate-700 transition-colors">
           <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-secondary/10 text-secondary rounded-xl flex items-center justify-center">
                 <LucideHistory class="w-5 h-5" />
              </div>
              <span class="font-bold text-slate-700 dark:text-slate-200 transition-colors">Riwayat Pengajuan Perubahan Data</span>
           </div>
           <LucideChevronRight class="w-5 h-5 text-slate-300 dark:text-slate-600 transition-colors" />
        </NuxtLink>
     </div>
     
     <!-- Tentang Aplikasi -->
     <div class="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 mb-6 transition-colors duration-300 text-center flex flex-col items-center">
        <!-- App Logo -->
        <div class="w-16 h-16 mb-4 flex items-center justify-center">
           <img src="/logo/logo-no-text.png" alt="PRODULI" class="w-full h-full object-contain drop-shadow-sm" />
        </div>
        <h3 class="text-lg font-black text-slate-800 dark:text-white mb-1 transition-colors">PRODULI</h3>
        <p class="text-xs text-primary dark:text-primary-400 font-bold mb-3 transition-colors">Versi 1.0.0</p>
        
        <p class="text-base font-bold italic text-slate-700 dark:text-slate-300 mb-2 transition-colors">"Mewujudkan Pelayanan Kesehatan yang Proaktif"</p>
        <p class="text-base text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-5 transition-colors">
          Sistem aplikasi pendamping cerdas untuk mempermudah tugas pemantauan kesehatan Prolanis agar pelayanan masyarakat lebih cepat, akurat, dan terpadu.
        </p>

        <div class="w-full h-px bg-slate-100 dark:bg-slate-700 mb-4 transition-colors"></div>

        <p class="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-2 transition-colors">Dikembangkan Oleh</p>
        <p class="text-base text-slate-700 dark:text-slate-200 font-bold transition-colors">Pengolah Data dan Informasi</p>
        <p class="text-base text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed transition-colors">
          UPTD Laboratorium Kesehatan Daerah<br>
          Kabupaten Sumenep
        </p>
     </div>
     
     <button @click="showLogoutConfirm = true" class="w-full bg-danger/10 text-danger border border-danger/20 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:bg-danger/20 transition-colors">
        <LucideLogOut class="w-5 h-5" />
        Keluar Akun
     </button>
  </div>
  </div>

  <!-- Konfirmasi Logout -- bukan window.confirm() bawaan browser. -->
  <div v-if="showLogoutConfirm" class="fixed inset-0 z-70 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
     <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 sm:zoom-in duration-200">
        <div class="p-6 overflow-y-auto text-center flex flex-col items-center">
           <div class="w-16 h-16 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mb-4">
              <LucideLogOut class="w-8 h-8" />
           </div>
           <h3 class="font-black text-slate-800 dark:text-white text-lg mb-1">Keluar Akun?</h3>
           <p class="text-base text-slate-500 dark:text-slate-400 leading-relaxed">Anda perlu masuk kembali dengan email dan kata sandi untuk melanjutkan.</p>
        </div>
        <div class="px-6 py-5 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-3 shrink-0">
           <button
              @click="confirmLogout"
              :disabled="isLoggingOut"
              class="w-full py-4 rounded-2xl font-bold text-white bg-danger disabled:opacity-50 active:bg-danger/90 transition-colors flex items-center justify-center gap-2"
           >
              <LucideLoader2 v-if="isLoggingOut" class="w-5 h-5 animate-spin" />
              Ya, Keluar
           </button>
           <button @click="showLogoutConfirm = false" class="w-full py-4 rounded-2xl font-bold text-slate-600 dark:text-slate-300 active:bg-slate-100 dark:active:bg-slate-700 transition-colors">
              Batal
           </button>
        </div>
     </div>
  </div>
</template>
