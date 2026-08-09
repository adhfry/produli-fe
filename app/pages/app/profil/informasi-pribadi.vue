<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
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

const user = ref({
  name: 'Siti Aminah',
  email: 'sitiaminah@gmail.com',
  phone: '081234567890',
  gender: 'P',
  birthDate: '1985-04-12',
  address: 'Jl. Merdeka No. 10, Sumenep',
  photoUrl: null
})

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

const fileInput = ref(null)
const previewImage = ref(null)

const triggerUpload = () => {
  fileInput.value?.click()
}

const onFileChange = (e) => {
  const file = e.target.files[0]
  if (file) {
    // In a real app, you would upload to server here.
    // We just create a local object URL for preview.
    previewImage.value = URL.createObjectURL(file)
  }
}

const isSaving = ref(false)
const saveProfile = () => {
  isSaving.value = true
  setTimeout(() => {
    isSaving.value = false
    alert("Profil berhasil diperbarui!")
  }, 1000)
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

    <div class="p-5">
      <!-- Photo Upload -->
      <div class="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 mb-6 flex flex-col items-center text-center transition-colors duration-300">
        <div class="relative mb-4">
          <div class="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center border-4 border-primary/20 shadow-sm overflow-hidden transition-colors">
            <img v-if="previewImage || user.photoUrl" :src="previewImage || user.photoUrl" class="w-full h-full object-cover" />
            <span v-else class="text-primary font-black text-3xl">SA</span>
          </div>
          
          <button @click="triggerUpload" class="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center active:scale-95 transition-all shadow-sm">
             <LucideCamera class="w-4 h-4 text-white" />
          </button>
          
          <input type="file" accept="image/*" class="hidden" ref="fileInput" @change="onFileChange" />
        </div>
        <h3 class="text-sm font-bold text-slate-800 dark:text-white mb-1 transition-colors">Foto Profil</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 font-medium transition-colors">Format JPG/PNG, maks. 2MB</p>
      </div>

      <!-- Form Fields -->
      <div class="space-y-4 mb-8">
        <div>
          <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Nama Lengkap</label>
          <input type="text" v-model="user.name" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder="Masukkan nama lengkap" />
        </div>
        
        <div>
          <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Email</label>
          <input type="email" v-model="user.email" disabled class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-500 dark:text-slate-400 font-medium outline-none cursor-not-allowed" />
          <p class="text-[10px] text-slate-400 mt-1.5">*Email tidak dapat diubah</p>
        </div>
        
        <div>
          <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">No. WhatsApp</label>
          <div class="flex">
            <span class="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 border-r-0 rounded-l-xl px-4 py-3 text-slate-500 dark:text-slate-300 font-bold flex items-center justify-center">+62</span>
            <input type="tel" v-model="user.phone" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-r-xl px-4 py-3 text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder="81234..." />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
           <div>
             <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Jenis Kelamin</label>
             <select v-model="user.gender" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none">
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
             </select>
           </div>
           <div>
             <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Tanggal Lahir</label>
             <input type="text" ref="datepickerRef" v-model="user.birthDate" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" />
           </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Alamat Domisili</label>
          <textarea v-model="user.address" rows="3" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none" placeholder="Masukkan alamat lengkap"></textarea>
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
