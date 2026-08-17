<script setup lang="ts">
import type { ApiSuccessEnvelope, ChangePasswordPayload, UpdateProfilePayload, User } from '~/types/api'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
useHead({
  title: 'Pengaturan Akun'
})

const authStore = useAuthStore()
const toast = useToast()

// --- Notifikasi email (PATCH /auth/profile) ---
const isSavingNotif = ref(false)
const notifError = ref('')

async function toggleEmailNotifications() {
  if (!authStore.user) return
  const next = !authStore.user.email_notifications_enabled
  isSavingNotif.value = true
  notifError.value = ''
  try {
    const api = useApi()
    const payload: UpdateProfilePayload = { email_notifications_enabled: next }
    const res = await api('/auth/profile', {
      method: 'PATCH',
      body: payload
    }) as ApiSuccessEnvelope<{ user: User }>
    authStore.user = res.data.user
    toast.add({
      title: next ? 'Notifikasi email diaktifkan' : 'Notifikasi email dimatikan',
      color: 'success'
    })
  } catch (err) {
    notifError.value = err instanceof ApiError ? err.message : 'Gagal menyimpan pengaturan notifikasi.'
  } finally {
    isSavingNotif.value = false
  }
}

// --- Akun Google (GET /auth/google/link/redirect, DELETE /auth/google/unlink) ---
const isGoogleConnected = computed(() => !!authStore.user?.google_id)
const isLinkingGoogle = ref(false)
const isUnlinkingGoogle = ref(false)
const googleError = ref('')

async function linkGoogle() {
  isLinkingGoogle.value = true
  googleError.value = ''
  try {
    const api = useApi()
    // Endpoint ini butuh Bearer token, browser navigasi langsung tidak bisa bawa header itu --
    // ambil redirect_url via fetch berautentikasi, baru window.location manual ke situ.
    const res = await api('/auth/google/link/redirect') as ApiSuccessEnvelope<{ redirect_url: string }>
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

// --- Ubah Password (POST /auth/change-password) ---
const currentPassword = ref('')
const newPassword = ref('')
const newPasswordConfirm = ref('')
const isSavingPassword = ref(false)
const passwordError = ref('')
const passwordFieldErrors = ref<Record<string, string[]>>({})

// Polesan interaktif -- tampilkan/sembunyikan tiap field password independen, dan indikator
// kecocokan konfirmasi real-time (feedback langsung, bukan cuma pas submit).
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

const passwordsMatch = computed(() => {
  if (!newPasswordConfirm.value) return null
  return newPassword.value === newPasswordConfirm.value
})
const newPasswordTooShort = computed(() => newPassword.value.length > 0 && newPassword.value.length < 8)
const newPasswordSameAsOld = computed(() => newPassword.value.length > 0 && newPassword.value === currentPassword.value)

async function submitChangePassword() {
  passwordError.value = ''
  passwordFieldErrors.value = {}

  if (newPassword.value.length < 8) {
    passwordError.value = 'Password baru minimal 8 karakter.'
    return
  }
  if (newPassword.value === currentPassword.value) {
    passwordError.value = 'Password baru harus berbeda dari password lama.'
    return
  }
  if (newPassword.value !== newPasswordConfirm.value) {
    passwordError.value = 'Konfirmasi password baru tidak cocok.'
    return
  }

  isSavingPassword.value = true
  try {
    const api = useApi()
    const payload: ChangePasswordPayload = {
      current_password: currentPassword.value,
      new_password: newPassword.value
    }
    await api('/auth/change-password', { method: 'POST', body: payload })
    currentPassword.value = ''
    newPassword.value = ''
    newPasswordConfirm.value = ''
    toast.add({ title: 'Password berhasil diganti', color: 'success' })
  } catch (err) {
    if (err instanceof ApiError) {
      passwordError.value = err.message
      passwordFieldErrors.value = err.errors ?? {}
    } else {
      passwordError.value = 'Gagal mengganti password.'
    }
  } finally {
    isSavingPassword.value = false
  }
}
</script>

<template>
  <div class="space-y-6 max-w-3xl">
    <!-- Breadcrumb & Header -->
    <div>
      <div class="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wider">
        <NuxtLink to="/dashboard" class="hover:text-primary transition-colors">Dashboard</NuxtLink>
        <LucideChevronRight class="w-3 h-3" />
        <NuxtLink to="/dashboard/profil" class="hover:text-primary transition-colors">Profil Saya</NuxtLink>
        <LucideChevronRight class="w-3 h-3" />
        <span class="text-slate-600">Pengaturan</span>
      </div>
      <h1 class="text-2xl font-extrabold text-accent">Pengaturan Akun</h1>
      <p class="text-sm text-slate-500 mt-1">Notifikasi, akun Google, dan password login Anda.</p>
    </div>

    <!-- Notifikasi -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
      <h3 class="font-bold text-accent flex items-center gap-2 mb-1">
        <LucideBell class="w-4 h-4 text-primary" />
        Notifikasi
      </h3>
      <p class="text-sm text-slate-500 mb-4">Atur apakah Anda ingin menerima notifikasi lewat email.</p>
      <div class="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
        <div>
          <p class="text-sm font-bold text-slate-700">Notifikasi Email</p>
          <p class="text-xs text-slate-500">Pengingat kunjungan dan info lain dikirim ke email Anda.</p>
        </div>
        <button
          type="button"
          role="switch"
          :aria-checked="!!authStore.user?.email_notifications_enabled"
          @click="toggleEmailNotifications"
          :disabled="isSavingNotif"
          class="relative inline-flex w-12 h-7 items-center rounded-full transition-colors shrink-0 disabled:opacity-50"
          :class="authStore.user?.email_notifications_enabled ? 'bg-primary' : 'bg-slate-300'"
        >
          <span
            class="inline-block w-5 h-5 rounded-full bg-white shadow-sm transition-transform"
            :class="authStore.user?.email_notifications_enabled ? 'translate-x-6' : 'translate-x-1'"
          ></span>
        </button>
      </div>
      <p v-if="notifError" class="text-xs font-semibold text-danger mt-2">{{ notifError }}</p>
    </div>

    <!-- Akun Google -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
      <h3 class="font-bold text-accent flex items-center gap-2 mb-1">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Akun Google
      </h3>
      <p class="text-sm text-slate-500 mb-4">Tautkan akun Google untuk login lebih cepat tanpa password.</p>

      <div v-if="isGoogleConnected" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-success/10 border border-success/20 rounded-xl px-4 py-3">
        <div class="flex items-center gap-2 text-success">
          <LucideCheckCircle2 class="w-4 h-4 shrink-0" />
          <span class="text-sm font-bold">Akun Google sudah tertaut</span>
        </div>
        <button
          @click="unlinkGoogle"
          :disabled="isUnlinkingGoogle"
          class="text-xs font-bold text-danger bg-white border border-danger/30 hover:bg-danger/5 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 justify-center"
        >
          <LucideLoader2 v-if="isUnlinkingGoogle" class="w-3.5 h-3.5 animate-spin" />
          Lepas Tautan
        </button>
      </div>
      <div v-else class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-warning/10 border border-warning/20 rounded-xl px-4 py-3">
        <div class="flex items-center gap-2 text-warning-700">
          <LucideAlertTriangle class="w-4 h-4 shrink-0" />
          <span class="text-sm font-bold">Belum tertaut ke akun Google</span>
        </div>
        <button
          @click="linkGoogle"
          :disabled="isLinkingGoogle"
          class="text-xs font-bold text-warning-700 bg-white border border-warning/30 hover:bg-warning/10 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 justify-center"
        >
          <LucideLoader2 v-if="isLinkingGoogle" class="w-3.5 h-3.5 animate-spin" />
          Tautkan Sekarang
        </button>
      </div>
      <p v-if="googleError" class="text-xs font-semibold text-danger mt-2">{{ googleError }}</p>
    </div>

    <!-- Ubah Password -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
      <h3 class="font-bold text-accent flex items-center gap-2 mb-1">
        <LucideKeyRound class="w-4 h-4 text-primary" />
        Ubah Password
      </h3>
      <p class="text-sm text-slate-500 mb-4">Password baru minimal 8 karakter dan harus berbeda dari password lama.</p>

      <div class="space-y-4">
        <p v-if="passwordError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{{ passwordError }}</p>

        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Password Lama</label>
          <div class="relative">
            <input
              v-model="currentPassword"
              :type="showCurrentPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="Masukkan password Anda saat ini"
              class="w-full pl-4 pr-11 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
            <button type="button" tabindex="-1" @click="showCurrentPassword = !showCurrentPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
              <LucideEyeOff v-if="showCurrentPassword" class="w-4 h-4" />
              <LucideEye v-else class="w-4 h-4" />
            </button>
          </div>
          <p v-if="passwordFieldErrors.current_password" class="text-xs text-danger mt-1">{{ passwordFieldErrors.current_password[0] }}</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Password Baru</label>
            <div class="relative">
              <input
                v-model="newPassword"
                :type="showNewPassword ? 'text' : 'password'"
                autocomplete="new-password"
                placeholder="Minimal 8 karakter"
                class="w-full pl-4 pr-11 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-colors"
                :class="newPasswordTooShort || newPasswordSameAsOld ? 'border-warning/50 focus:ring-warning/20 focus:border-warning' : 'border-slate-200 focus:ring-primary/20 focus:border-primary'"
              />
              <button type="button" tabindex="-1" @click="showNewPassword = !showNewPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                <LucideEyeOff v-if="showNewPassword" class="w-4 h-4" />
                <LucideEye v-else class="w-4 h-4" />
              </button>
            </div>
            <p v-if="passwordFieldErrors.new_password" class="text-xs text-danger mt-1">{{ passwordFieldErrors.new_password[0] }}</p>
            <p v-else-if="newPasswordSameAsOld" class="text-xs font-semibold text-warning-700 mt-1">Harus berbeda dari password lama.</p>
            <p v-else-if="newPasswordTooShort" class="text-xs text-slate-400 mt-1">{{ newPassword.length }}/8 karakter minimal.</p>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Konfirmasi Password Baru</label>
            <div class="relative">
              <input
                v-model="newPasswordConfirm"
                :type="showConfirmPassword ? 'text' : 'password'"
                autocomplete="new-password"
                placeholder="Ulangi password baru"
                class="w-full pl-4 pr-11 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-colors"
                :class="passwordsMatch === false ? 'border-danger/50 focus:ring-danger/20 focus:border-danger' : passwordsMatch === true ? 'border-success/50 focus:ring-success/20 focus:border-success' : 'border-slate-200 focus:ring-primary/20 focus:border-primary'"
              />
              <button type="button" tabindex="-1" @click="showConfirmPassword = !showConfirmPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                <LucideEyeOff v-if="showConfirmPassword" class="w-4 h-4" />
                <LucideEye v-else class="w-4 h-4" />
              </button>
            </div>
            <p v-if="passwordsMatch === true" class="text-xs font-semibold text-success mt-1 flex items-center gap-1">
              <LucideCheck class="w-3.5 h-3.5" /> Password cocok
            </p>
            <p v-else-if="passwordsMatch === false" class="text-xs font-semibold text-danger mt-1 flex items-center gap-1">
              <LucideX class="w-3.5 h-3.5" /> Password tidak cocok
            </p>
          </div>
        </div>
        <div class="flex justify-end">
          <button
            @click="submitChangePassword"
            :disabled="isSavingPassword"
            class="py-2.5 px-6 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <LucideLoader2 v-if="isSavingPassword" class="w-4 h-4 animate-spin" />
            {{ isSavingPassword ? 'Menyimpan...' : 'Ganti Password' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
