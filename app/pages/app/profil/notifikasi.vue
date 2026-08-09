<script setup>
import { ref } from 'vue'

definePageMeta({
  layout: 'pwa',
  middleware: 'auth'
})
useHead({
  title: 'Pengaturan Notifikasi'
})

const pushNotif = ref(true)
const waNotif = ref(true)
const dailyReminder = ref(true)
const quietHours = ref(false)

const isSaving = ref(false)
const saveSettings = () => {
  isSaving.value = true
  setTimeout(() => {
    isSaving.value = false
    alert("Pengaturan notifikasi disimpan!")
  }, 800)
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
        <h1 class="text-xl font-extrabold text-accent dark:text-white transition-colors">Pengaturan Notifikasi</h1>
      </div>
    </div>

    <div class="p-5">
      <div class="bg-white dark:bg-slate-800 rounded-3xl p-2 shadow-sm border border-slate-100 dark:border-slate-700 mb-6 transition-colors duration-300">
        <!-- Push Notif -->
        <div class="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700 transition-colors">
          <div class="flex-1 pr-4">
             <h3 class="font-bold text-slate-800 dark:text-white mb-0.5">Notifikasi Push (Aplikasi)</h3>
             <p class="text-xs text-slate-500 dark:text-slate-400">Pemberitahuan langsung di layar HP saat ada tugas baru.</p>
          </div>
          <button @click="pushNotif = !pushNotif" class="w-12 h-6 rounded-full transition-colors relative shrink-0 border-2" :class="pushNotif ? 'bg-primary border-primary' : 'bg-slate-200 dark:bg-slate-700 border-slate-200 dark:border-slate-700'">
             <div class="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm" :class="pushNotif ? 'left-[calc(100%-1.125rem)]' : 'left-0.5'"></div>
          </button>
        </div>

        <!-- WA Notif -->
        <div class="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700 transition-colors">
          <div class="flex-1 pr-4">
             <h3 class="font-bold text-slate-800 dark:text-white mb-0.5">Notifikasi WhatsApp</h3>
             <p class="text-xs text-slate-500 dark:text-slate-400">Terima pesan WA untuk laporan kunjungan atau info penting.</p>
          </div>
          <button @click="waNotif = !waNotif" class="w-12 h-6 rounded-full transition-colors relative shrink-0 border-2" :class="waNotif ? 'bg-primary border-primary' : 'bg-slate-200 dark:bg-slate-700 border-slate-200 dark:border-slate-700'">
             <div class="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm" :class="waNotif ? 'left-[calc(100%-1.125rem)]' : 'left-0.5'"></div>
          </button>
        </div>

        <!-- Daily Reminder -->
        <div class="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700 transition-colors">
          <div class="flex-1 pr-4">
             <h3 class="font-bold text-slate-800 dark:text-white mb-0.5">Pengingat Harian</h3>
             <p class="text-xs text-slate-500 dark:text-slate-400">Rekap tugas kunjungan yang belum diselesaikan tiap pagi.</p>
          </div>
          <button @click="dailyReminder = !dailyReminder" class="w-12 h-6 rounded-full transition-colors relative shrink-0 border-2" :class="dailyReminder ? 'bg-primary border-primary' : 'bg-slate-200 dark:bg-slate-700 border-slate-200 dark:border-slate-700'">
             <div class="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm" :class="dailyReminder ? 'left-[calc(100%-1.125rem)]' : 'left-0.5'"></div>
          </button>
        </div>

        <!-- Quiet Hours -->
        <div class="flex items-center justify-between p-4 transition-colors">
          <div class="flex-1 pr-4">
             <h3 class="font-bold text-slate-800 dark:text-white mb-0.5">Mode Tenang (Jam Malam)</h3>
             <p class="text-xs text-slate-500 dark:text-slate-400">Senyapkan semua notifikasi dari jam 20:00 hingga 06:00.</p>
          </div>
          <button @click="quietHours = !quietHours" class="w-12 h-6 rounded-full transition-colors relative shrink-0 border-2" :class="quietHours ? 'bg-primary border-primary' : 'bg-slate-200 dark:bg-slate-700 border-slate-200 dark:border-slate-700'">
             <div class="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm" :class="quietHours ? 'left-[calc(100%-1.125rem)]' : 'left-0.5'"></div>
          </button>
        </div>
      </div>
      
      <div class="bg-primary/10 border border-primary/20 rounded-3xl p-5 mb-8 flex flex-col gap-2 shadow-sm transition-colors duration-300">
         <div class="flex items-center gap-2 text-primary font-bold">
            <LucideInfo class="w-5 h-5" />
            <p>Info Sistem</p>
         </div>
         <p class="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
           Bahkan jika notifikasi dimatikan, peringatan penting dari admin puskesmas akan tetap masuk ke kotak masuk aplikasi Anda.
         </p>
      </div>

      <button @click="saveSettings" :disabled="isSaving" class="w-full py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed">
        <LucideLoader2 v-if="isSaving" class="w-5 h-5 animate-spin" />
        <LucideSave v-else class="w-5 h-5" />
        {{ isSaving ? 'Menyimpan...' : 'Simpan Pengaturan' }}
      </button>
    </div>
  </div>
</template>
