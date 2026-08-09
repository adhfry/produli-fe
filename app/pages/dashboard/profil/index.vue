<script setup lang="ts">
import type { ApiSuccessEnvelope, Puskesmas, UpdateProfilePayload, User } from '~/types/api'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
useHead({
  title: 'Profil Saya'
})

const authStore = useAuthStore()
const toast = useToast()

const roleLabel = computed(() => resolveRolesLabel(authStore.roles))
const initials = computed(() => {
  const name = authStore.user?.name ?? ''
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?'
})

// Nama puskesmas cuma untuk TAMPILAN (read-only) -- User.puskesmas_id cuma angka, /auth/me
// tidak eager-load relasi puskesmas. null untuk super_admin (tidak terikat satu puskesmas).
const puskesmasName = ref('')
onMounted(async () => {
  const puskesmasId = authStore.user?.puskesmas_id
  if (!puskesmasId) return
  try {
    const api = useApi()
    const res = await api(`/puskesmas/${puskesmasId}`) as ApiSuccessEnvelope<Puskesmas>
    puskesmasName.value = res.data.nama
  } catch {
    // Diamkan -- cuma info tambahan read-only, kegagalan di sini tidak boleh mengganggu halaman.
  }
})

// --- Edit data diri (PATCH /auth/profile: name/no_hp) ---
// email/roles/puskesmas_id SENGAJA tidak masuk form ini -- identitas resmi & penugasan, dikunci
// dari self-service (UpdateProfileRequest backend juga menolak field itu).
const isEditingProfile = ref(false)
const profileEditForm = ref({ name: '', no_hp: '' })
const isSavingProfile = ref(false)
const profileError = ref('')

function startEditProfile() {
  profileEditForm.value = {
    name: authStore.user?.name ?? '',
    no_hp: authStore.user?.no_hp ?? ''
  }
  profileError.value = ''
  isEditingProfile.value = true
}

function cancelEditProfile() {
  isEditingProfile.value = false
  profileError.value = ''
}

async function saveProfile() {
  if (!profileEditForm.value.name.trim()) {
    profileError.value = 'Nama tidak boleh kosong.'
    return
  }
  isSavingProfile.value = true
  profileError.value = ''
  try {
    const api = useApi()
    const payload: UpdateProfilePayload = {
      name: profileEditForm.value.name.trim(),
      no_hp: profileEditForm.value.no_hp.trim() || undefined
    }
    const res = await api('/auth/profile', {
      method: 'PATCH',
      body: payload
    }) as ApiSuccessEnvelope<{ user: User }>
    authStore.user = res.data.user
    isEditingProfile.value = false
    toast.add({ title: 'Data diri berhasil diperbarui', color: 'success' })
  } catch (err) {
    profileError.value = err instanceof ApiError ? err.message : 'Gagal menyimpan data diri.'
  } finally {
    isSavingProfile.value = false
  }
}

// --- Avatar (POST /auth/profile/avatar) ---
// avatar_path yang dibalas backend cuma key S3/MinIO mentah (bukan URL bisa dibuka -- lihat
// catatan di types/api.ts), jadi preview cuma bisa dari object URL lokal hasil pilih file,
// tidak bisa "tarik ulang" foto tersimpan setelah reload halaman.
const avatarInput = ref<HTMLInputElement | null>(null)
const localAvatarPreview = ref('')
const isUploadingAvatar = ref(false)
const avatarError = ref('')

function pickAvatar() {
  avatarInput.value?.click()
}

async function onAvatarSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  avatarError.value = ''

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    avatarError.value = 'Format foto harus JPG, PNG, atau WEBP.'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    avatarError.value = 'Ukuran foto maksimal 5 MB.'
    return
  }

  localAvatarPreview.value = URL.createObjectURL(file)
  isUploadingAvatar.value = true
  try {
    const api = useApi()
    const form = new FormData()
    form.append('avatar', file)
    const res = await api('/auth/profile/avatar', {
      method: 'POST',
      body: form
    }) as ApiSuccessEnvelope<{ user: User }>
    authStore.user = res.data.user
    // Lepas preview lokal -- avatar_url (signed URL asli dari backend) sudah ada di authStore.user
    // sekarang, tidak perlu lagi blob sementara (yang mati begitu halaman ditinggalkan).
    localAvatarPreview.value = ''
    toast.add({ title: 'Foto profil diperbarui', color: 'success' })
  } catch (err) {
    avatarError.value = err instanceof ApiError ? err.message : 'Gagal mengunggah foto profil.'
  } finally {
    isUploadingAvatar.value = false
    if (avatarInput.value) avatarInput.value.value = ''
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
        <span class="text-slate-600">Profil Saya</span>
      </div>
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 class="text-2xl font-extrabold text-accent">Profil Saya</h1>
          <p class="text-sm text-slate-500 mt-1">Data diri Anda sebagai pengguna KOPIPU Smart.</p>
        </div>
        <NuxtLink
          to="/dashboard/profil/pengaturan"
          class="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl font-bold text-sm text-primary bg-primary/10 hover:bg-primary/20 transition-colors border border-primary/20 shrink-0"
        >
          <LucideSettings class="w-4 h-4" />
          Pengaturan Akun
        </NuxtLink>
      </div>
    </div>

    <!-- Profile Header Card -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5">
      <div class="relative shrink-0">
        <div class="w-24 h-24 rounded-full bg-primary/10 border-4 border-white shadow-sm overflow-hidden flex items-center justify-center">
          <img v-if="localAvatarPreview || authStore.user?.avatar_url" :src="localAvatarPreview || authStore.user?.avatar_url" alt="Foto profil" class="w-full h-full object-cover" />
          <span v-else class="text-primary font-black text-2xl">{{ initials }}</span>
        </div>
        <button
          @click="pickAvatar"
          :disabled="isUploadingAvatar"
          class="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-md hover:bg-primary-600 transition-colors disabled:opacity-50"
        >
          <LucideLoader2 v-if="isUploadingAvatar" class="w-4 h-4 animate-spin" />
          <LucideCamera v-else class="w-4 h-4" />
        </button>
        <input ref="avatarInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onAvatarSelected" />
      </div>
      <div class="flex-1 text-center sm:text-left">
        <h2 class="text-lg font-bold text-accent">{{ authStore.user?.name ?? '...' }}</h2>
        <p class="text-sm text-slate-500">{{ authStore.user?.email ?? '...' }}</p>
        <span class="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
          {{ roleLabel }}
        </span>
        <p v-if="avatarError" class="text-xs font-semibold text-danger mt-2">{{ avatarError }}</p>
        <p class="text-[11px] text-slate-400 mt-2">JPG/PNG/WEBP, maksimal 5 MB.</p>
      </div>
    </div>

    <!-- Info Kontak -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-accent flex items-center gap-2">
          <LucideIdCard class="w-4 h-4 text-primary" />
          Informasi Akun
        </h3>
        <button
          v-if="!isEditingProfile"
          @click="startEditProfile"
          class="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
        >
          <LucidePencil class="w-3.5 h-3.5" />
          Edit
        </button>
      </div>

      <p v-if="profileError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2 mb-4">{{ profileError }}</p>

      <!-- Mode tampil -->
      <dl v-if="!isEditingProfile" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
          <dt class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Nama Lengkap</dt>
          <dd class="text-sm font-bold text-slate-700 mt-0.5">{{ authStore.user?.name ?? '-' }}</dd>
        </div>
        <div class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
          <dt class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">No. Telepon</dt>
          <dd class="text-sm font-bold text-slate-700 mt-0.5">{{ authStore.user?.no_hp || '-' }}</dd>
        </div>
        <div class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 relative">
          <dt class="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">Email <LucideLock class="w-2.5 h-2.5" /></dt>
          <dd class="text-sm font-bold text-slate-500 mt-0.5">{{ authStore.user?.email ?? '-' }}</dd>
        </div>
        <div class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 relative">
          <dt class="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">Peran <LucideLock class="w-2.5 h-2.5" /></dt>
          <dd class="text-sm font-bold text-slate-500 mt-0.5">{{ roleLabel }}</dd>
        </div>
        <div v-if="puskesmasName" class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 sm:col-span-2 relative">
          <dt class="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">Unit Kerja (Puskesmas) <LucideLock class="w-2.5 h-2.5" /></dt>
          <dd class="text-sm font-bold text-slate-500 mt-0.5">{{ puskesmasName }}</dd>
        </div>
      </dl>

      <!-- Mode edit -->
      <div v-else class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Nama Lengkap</label>
          <input
            v-model="profileEditForm.name"
            type="text"
            placeholder="Nama lengkap Anda"
            maxlength="150"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">No. Telepon</label>
          <input
            v-model="profileEditForm.no_hp"
            type="tel"
            placeholder="Mis. 081234567890"
            maxlength="20"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div class="px-1 pt-3">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1"><LucideLock class="w-2.5 h-2.5" /> Email (tidak bisa diubah)</p>
            <p class="text-sm font-semibold text-slate-500 mt-0.5">{{ authStore.user?.email }}</p>
          </div>
          <div class="px-1 pt-3">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1"><LucideLock class="w-2.5 h-2.5" /> Peran (tidak bisa diubah)</p>
            <p class="text-sm font-semibold text-slate-500 mt-0.5">{{ roleLabel }}</p>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button @click="cancelEditProfile" :disabled="isSavingProfile" class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">Batal</button>
          <button
            @click="saveProfile"
            :disabled="isSavingProfile"
            class="py-2.5 px-6 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <LucideLoader2 v-if="isSavingProfile" class="w-4 h-4 animate-spin" />
            {{ isSavingProfile ? 'Menyimpan...' : 'Simpan Perubahan' }}
          </button>
        </div>
      </div>

      <p class="text-xs text-slate-400 mt-4">Untuk notifikasi, akun Google, dan password, buka <NuxtLink to="/dashboard/profil/pengaturan" class="text-primary font-semibold hover:underline">Pengaturan Akun</NuxtLink>.</p>
    </div>
  </div>
</template>
