<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import flatpickr from 'flatpickr'
import 'flatpickr/dist/flatpickr.css'
import { Indonesian } from 'flatpickr/dist/l10n/id.js'

definePageMeta({
  layout: 'pwa',
  middleware: 'auth'
})
useHead({
  title: 'Informasi Pribadi'
})

const authStore = useAuthStore()
const toast = useToast()

// SEBELUMNYA form ini terisi data fiktif (user = ref({name: 'Siti Aminah', ...})) dan tombol
// simpan cuma setTimeout+alert(), tidak pernah memanggil API sama sekali. Sekarang: name/no_hp
// dari authStore.user (PATCH /auth/profile), no_wa/alamat/gender/tgl_lahir dari GET/PATCH
// /kader/profile ATAU /tenaga-kesehatan/profile tergantung role (revisi Bu Kadis PMO -- keduanya
// self-service field yang identik, no_hp SENGAJA read-only, itu wajib diisi PJ/admin saat
// registrasi bukan self-service).
const profileEndpoint = computed(() => (authStore.roles?.includes('tenaga_kesehatan') ? '/tenaga-kesehatan/profile' : '/kader/profile'))

const form = ref({ name: '', no_hp: '', email: '', no_wa: '', gender: '', birthDate: '', address: '' })
const isLoadingProfile = ref(true)
const loadError = ref('')

async function loadProfile() {
  isLoadingProfile.value = true
  loadError.value = ''
  try {
    const api = useApi()
    const res = await api(profileEndpoint.value)
    form.value = {
      name: authStore.user?.name ?? '',
      no_hp: authStore.user?.no_hp ?? '',
      email: authStore.user?.email ?? '',
      no_wa: res.data.no_wa ?? '',
      gender: res.data.gender ?? '',
      birthDate: res.data.tgl_lahir ?? '',
      address: res.data.alamat ?? ''
    }
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Gagal memuat data profil.'
  } finally {
    isLoadingProfile.value = false
  }
}
onMounted(loadProfile)

const datepickerRef = ref(null)
let fp = null

onMounted(() => {
  if (datepickerRef.value) {
    fp = flatpickr(datepickerRef.value, {
      locale: Indonesian,
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d F Y",
      disableMobile: false
    })
  }
})

onUnmounted(() => {
  if (fp) fp.destroy()
})

// --- Foto profil (POST /auth/profile/avatar) -- SEBELUMNYA cuma URL.createObjectURL() lokal,
// tidak pernah benar-benar terunggah ke server (hilang begitu halaman ditinggalkan).
const fileInput = ref(null)
const localAvatarPreview = ref('')
const isUploadingAvatar = ref(false)
const avatarError = ref('')

const triggerUpload = () => {
  fileInput.value?.click()
}

async function onFileChange(e) {
  const file = e.target.files?.[0]
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
    const formData = new FormData()
    formData.append('avatar', file)
    const res = await api('/auth/profile/avatar', { method: 'POST', body: formData })
    authStore.user = res.data.user
    localAvatarPreview.value = ''
    toast.add({ title: 'Foto profil diperbarui', color: 'success' })
  } catch (err) {
    avatarError.value = err instanceof ApiError ? err.message : 'Gagal mengunggah foto profil.'
  } finally {
    isUploadingAvatar.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

// --- Simpan (PATCH /auth/profile: name/no_hp -- TIDAK dipakai di sini karena no_hp read-only,
// jadi cuma name -- + PATCH /kader/profile: no_wa/alamat/gender/tgl_lahir) ---
const isSaving = ref(false)
const saveError = ref('')

async function saveProfile() {
  if (!form.value.name.trim()) {
    saveError.value = 'Nama tidak boleh kosong.'
    return
  }
  isSaving.value = true
  saveError.value = ''
  try {
    const api = useApi()
    const [profileRes] = await Promise.all([
      api('/auth/profile', { method: 'PATCH', body: { name: form.value.name.trim() } }),
      api(profileEndpoint.value, {
        method: 'PATCH',
        body: {
          no_wa: form.value.no_wa.trim() || null,
          alamat: form.value.address.trim() || null,
          gender: form.value.gender || null,
          tgl_lahir: form.value.birthDate || null
        }
      })
    ])
    authStore.user = profileRes.data.user
    toast.add({ title: 'Profil berhasil diperbarui', color: 'success' })
  } catch (err) {
    saveError.value = err instanceof ApiError ? err.message : 'Gagal menyimpan profil.'
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
        <h1 class="text-xl font-extrabold text-accent dark:text-white transition-colors">Informasi Pribadi</h1>
      </div>
    </div>

    <div v-if="isLoadingProfile" class="p-5 py-16 text-center text-slate-400 dark:text-slate-500">
      <LucideLoader2 class="w-8 h-8 mx-auto mb-3 animate-spin" />
      <p class="font-medium">Memuat profil...</p>
    </div>
    <div v-else-if="loadError" class="p-5">
      <div class="bg-danger/10 border border-danger/20 rounded-2xl p-5 text-center">
        <LucideAlertTriangle class="w-8 h-8 mx-auto mb-2 text-danger" />
        <p class="text-sm font-semibold text-danger">{{ loadError }}</p>
      </div>
    </div>

    <div v-else class="p-5">
      <!-- Photo Upload -->
      <div class="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 mb-6 flex flex-col items-center text-center transition-colors duration-300">
        <div class="relative mb-4">
          <div class="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center border-4 border-primary/20 shadow-sm overflow-hidden transition-colors">
            <img v-if="localAvatarPreview || authStore.user?.avatar_url" :src="localAvatarPreview || authStore.user?.avatar_url" class="w-full h-full object-cover" />
            <span v-else class="text-primary font-black text-3xl">{{ (form.name || '?').split(/\s+/).filter(Boolean).slice(0,2).map(w => w[0]?.toUpperCase()).join('') }}</span>
          </div>

          <button @click="triggerUpload" :disabled="isUploadingAvatar" class="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center active:scale-95 transition-all shadow-sm disabled:opacity-50">
             <LucideLoader2 v-if="isUploadingAvatar" class="w-4 h-4 text-white animate-spin" />
             <LucideCamera v-else class="w-4 h-4 text-white" />
          </button>

          <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" ref="fileInput" @change="onFileChange" />
        </div>
        <h3 class="text-sm font-bold text-slate-800 dark:text-white mb-1 transition-colors">Foto Profil</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 font-medium transition-colors">Format JPG/PNG/WEBP, maks. 5MB</p>
        <p v-if="avatarError" class="text-xs font-semibold text-danger mt-2">{{ avatarError }}</p>
      </div>

      <!-- Form Fields -->
      <div class="space-y-4 mb-8">
        <p v-if="saveError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-4 py-3">{{ saveError }}</p>

        <div>
          <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Nama Lengkap</label>
          <input type="text" v-model="form.name" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder="Masukkan nama lengkap" />
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Email</label>
          <input type="email" v-model="form.email" disabled class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-500 dark:text-slate-400 font-medium outline-none cursor-not-allowed" />
          <p class="text-[10px] text-slate-400 mt-1.5">*Email tidak dapat diubah</p>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">No. HP (Terdaftar)</label>
          <input type="tel" :value="form.no_hp || '-'" disabled class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-500 dark:text-slate-400 font-medium outline-none cursor-not-allowed" />
          <p class="text-[10px] text-slate-400 mt-1.5">*Didaftarkan oleh PJ Prolanis, hubungi PJ untuk mengubahnya.</p>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">No. WhatsApp</label>
          <div class="flex">
            <span class="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 border-r-0 rounded-l-xl px-4 py-3 text-slate-500 dark:text-slate-300 font-bold flex items-center justify-center">+62</span>
            <input type="tel" v-model="form.no_wa" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-r-xl px-4 py-3 text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder="81234..." />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
           <div>
             <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Jenis Kelamin</label>
             <select v-model="form.gender" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none">
                <option value="">Pilih...</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
             </select>
           </div>
           <div>
             <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Tanggal Lahir</label>
             <input type="text" ref="datepickerRef" v-model="form.birthDate" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" />
           </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Alamat Domisili</label>
          <textarea v-model="form.address" rows="3" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none" placeholder="Masukkan alamat lengkap"></textarea>
        </div>
      </div>

      <button @click="saveProfile" :disabled="isSaving" class="w-full py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed">
        <LucideLoader2 v-if="isSaving" class="w-5 h-5 animate-spin" />
        <LucideSave v-else class="w-5 h-5" />
        {{ isSaving ? 'Menyimpan...' : 'Simpan Perubahan' }}
      </button>
    </div>
  </div>
</template>
