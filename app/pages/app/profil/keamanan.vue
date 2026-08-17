<script setup>
import { ref } from 'vue'

definePageMeta({
  layout: 'pwa',
  middleware: 'auth'
})
useHead({
  title: 'Keamanan & Sandi'
})

const authStore = useAuthStore()
const toast = useToast()

// --- Akun Google (GET /auth/google/link/redirect, DELETE /auth/google/unlink) -- SEBELUMNYA
// status "Belum Tertaut" hardcode total, tombol tanpa @click. Pola sama dengan
// /dashboard/profil/pengaturan (sisi staf).
const isGoogleConnected = computed(() => !!authStore.user?.google_id)
const isLinkingGoogle = ref(false)
const isUnlinkingGoogle = ref(false)
const googleError = ref('')

async function linkGoogle() {
  isLinkingGoogle.value = true
  googleError.value = ''
  try {
    const api = useApi()
    const res = await api('/auth/google/link/redirect')
    window.location.href = res.data.redirect_url
  } catch (err) {
    googleError.value = err instanceof ApiError ? err.message : 'Gagal memulai proses tautkan akun Google.'
    isLinkingGoogle.value = false
  }
}

async function unlinkGoogle() {
  const confirmed = await useConfirm().confirm({
    title: 'Lepas Tautan Akun Google?',
    description: 'Anda tetap dapat login menggunakan email dan kata sandi.',
    confirmLabel: 'Ya, Lepas Tautan',
    tone: 'warning'
  })
  if (!confirmed) return

  isUnlinkingGoogle.value = true
  googleError.value = ''
  try {
    const api = useApi()
    await api('/auth/google/unlink', { method: 'DELETE' })
    if (authStore.user) authStore.user = { ...authStore.user, google_id: null }
    toast.add({ title: 'Akun Google berhasil dilepas', color: 'success' })
  } catch (err) {
    googleError.value = err instanceof ApiError ? err.message : 'Gagal melepas tautan akun Google.'
  } finally {
    isUnlinkingGoogle.value = false
  }
}

// --- Ubah Password (POST /auth/change-password) -- SEBELUMNYA cuma setTimeout+alert(), tidak
// pernah memanggil API sama sekali.
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showCurrent = ref(false)
const showNew = ref(false)

const isSaving = ref(false)
const passwordError = ref('')

async function updatePassword() {
  passwordError.value = ''
  if (newPassword.value.length < 8) {
    passwordError.value = 'Kata sandi baru minimal 8 karakter.'
    return
  }
  if (newPassword.value === currentPassword.value) {
    passwordError.value = 'Kata sandi baru harus berbeda dari kata sandi lama.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Konfirmasi kata sandi baru tidak cocok.'
    return
  }
  isSaving.value = true
  try {
    const api = useApi()
    await api('/auth/change-password', {
      method: 'POST',
      body: { current_password: currentPassword.value, new_password: newPassword.value }
    })
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    toast.add({ title: 'Kata sandi berhasil diperbarui', color: 'success' })
  } catch (err) {
    passwordError.value = err instanceof ApiError ? err.message : 'Gagal mengganti kata sandi.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div>
    <!-- Sticky Header -->
    <div class="px-5 pt-8 pb-4 bg-white dark:bg-slate-900 sticky top-0 z-40 border-b border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
      <div class="flex items-center gap-3">
        <NuxtLink to="/app/profil" class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-all shrink-0">
          <LucideArrowLeft class="w-5 h-5" />
        </NuxtLink>
        <h1 class="text-xl font-extrabold text-accent dark:text-white transition-colors">Keamanan & Sandi</h1>
      </div>
    </div>

    <div class="p-5">
      <!-- Akun Tertaut -->
      <h3 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Akun Tertaut</h3>
      <div class="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-100 dark:border-slate-700 mb-8 flex items-center justify-between shadow-sm transition-colors duration-300">
         <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-800 transition-colors">
               <svg class="w-6 h-6" viewBox="0 0 24 24"><path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.409 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/><path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/><path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"/><path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/></svg>
            </div>
            <div>
               <h3 class="font-bold text-slate-800 dark:text-slate-200 text-base transition-colors">Google</h3>
               <p class="text-xs font-medium mt-0.5" :class="isGoogleConnected ? 'text-success' : 'text-danger'">
                 {{ isGoogleConnected ? 'Tertaut' : 'Belum Tertaut' }}
               </p>
            </div>
         </div>
         <button
           v-if="isGoogleConnected"
           @click="unlinkGoogle"
           :disabled="isUnlinkingGoogle"
           class="px-4 py-2 bg-danger/10 text-danger rounded-xl font-bold text-xs active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
         >
            <LucideLoader2 v-if="isUnlinkingGoogle" class="w-3.5 h-3.5 animate-spin" />
            Lepas Tautan
         </button>
         <button
           v-else
           @click="linkGoogle"
           :disabled="isLinkingGoogle"
           class="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
         >
            <LucideLoader2 v-if="isLinkingGoogle" class="w-3.5 h-3.5 animate-spin" />
            Tautkan
         </button>
      </div>
      <p v-if="googleError" class="text-xs font-semibold text-danger -mt-6 mb-8">{{ googleError }}</p>

      <!-- Ubah Kata Sandi -->
      <h3 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Ubah Kata Sandi</h3>
      <div class="space-y-4 mb-8">
        <p v-if="passwordError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-4 py-3">{{ passwordError }}</p>
        <div>
          <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Kata Sandi Saat Ini</label>
          <div class="relative">
            <input :type="showCurrent ? 'text' : 'password'" v-model="currentPassword" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder="••••••••" />
            <button @click="showCurrent = !showCurrent" class="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
               <LucideEyeOff v-if="showCurrent" class="w-5 h-5" />
               <LucideEye v-else class="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div>
          <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Kata Sandi Baru</label>
          <div class="relative">
            <input :type="showNew ? 'text' : 'password'" v-model="newPassword" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder="••••••••" />
            <button @click="showNew = !showNew" class="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
               <LucideEyeOff v-if="showNew" class="w-5 h-5" />
               <LucideEye v-else class="w-5 h-5" />
            </button>
          </div>
          <p class="text-[10px] text-slate-400 mt-1.5">Minimal 8 karakter, harus mengandung huruf dan angka.</p>
        </div>
        
        <div>
          <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Konfirmasi Kata Sandi Baru</label>
          <input type="password" v-model="confirmPassword" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder="••••••••" />
        </div>
      </div>

      <button @click="updatePassword" :disabled="isSaving || !currentPassword || !newPassword || !confirmPassword" class="w-full py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed">
        <LucideLoader2 v-if="isSaving" class="w-5 h-5 animate-spin" />
        <LucideSave v-else class="w-5 h-5" />
        {{ isSaving ? 'Menyimpan...' : 'Perbarui Sandi' }}
      </button>
    </div>
  </div>
</template>
