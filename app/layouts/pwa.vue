<script setup>
useHead({
  titleTemplate: (titleChunk) => titleChunk ? `${titleChunk} - Kader Prolanis` : 'PRODULI Kader',
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'theme-color', content: '#ffffff' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0' }
  ]
})

// Notifikasi + FCM di PWA kader/nakes -- SEBELUMNYA sama sekali tidak ada (gap kritis, admin
// puskesmas tidak pernah bisa menotif kader/nakes lewat push). Reuse composable yang sama
// dengan layouts/dashboard.vue (useNotifications.ts) supaya logic tidak dobel.
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
  isDangerNotif,
  startPolling
} = useNotifications()

onMounted(loadNotifications)
onMounted(startPolling)
onMounted(() => {
  useFcm().registerAndSendToken()
})
</script>

<template>
  <div class="min-h-screen bg-slate-100 dark:bg-slate-950 flex justify-center font-sans transition-colors duration-300">
    <!-- App Container (Fluid Full Width) -->
    <div class="w-full bg-slate-50 dark:bg-slate-900 min-h-screen flex flex-col relative transition-colors duration-300">

      <NetworkStatus />
      <AnnouncementInboxModal />
      <ConfirmDialog />

      <!-- Top bar: cuma bel notifikasi (layout ini mobile-first, tidak ada header lengkap
           seperti dashboard desktop) -->
      <header class="sticky top-0 z-[45] flex items-center justify-end px-4 py-2.5 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-100 dark:border-slate-800">
        <div class="relative">
          <div v-if="isNotifOpen" @click="isNotifOpen = false" class="fixed inset-0 z-40 cursor-default"></div>

          <button @click="isNotifOpen = !isNotifOpen" class="relative z-50 text-slate-500 hover:text-primary transition-colors w-9 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center">
            <LucideBell class="w-5 h-5" />
            <template v-if="unreadCount > 0">
              <span class="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full animate-ping opacity-75"></span>
              <span class="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full border border-white dark:border-slate-900"></span>
            </template>
          </button>

          <Transition
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="transform scale-95 opacity-0 -translate-y-2"
            enter-to-class="transform scale-100 opacity-100 translate-y-0"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="transform scale-100 opacity-100 translate-y-0"
            leave-to-class="transform scale-95 opacity-0 -translate-y-2"
          >
            <div v-if="isNotifOpen" class="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 dark:border-slate-800 z-50 overflow-hidden">
              <div class="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                <h3 class="font-extrabold text-accent">Notifikasi</h3>
                <button v-if="unreadCount > 0" @click="markAllRead" class="text-[11px] font-bold text-primary hover:underline px-2 py-1 hover:bg-primary/10 rounded-md transition-colors">Tandai dibaca semua</button>
              </div>
              <div class="max-h-[60vh] overflow-y-auto no-scrollbar bg-white dark:bg-slate-900">
                <div v-if="isLoadingNotif" class="p-8 text-center text-slate-400 text-sm">Memuat notifikasi...</div>
                <div v-else-if="notifError" class="p-8 text-center text-danger text-xs font-semibold">{{ notifError }}</div>
                <div v-else-if="headerNotifications.length === 0" class="p-8 text-center text-slate-400 text-sm">Tidak ada notifikasi.</div>
                <div v-for="n in headerNotifications" :key="n.id" @click="openNotification(n)"
                     class="p-4 border-b border-slate-50 dark:border-slate-800 last:border-0 cursor-pointer transition-all duration-300"
                     :class="n.is_read ? 'bg-white dark:bg-slate-900' : (isDangerNotif(n) ? 'bg-danger/5 dark:bg-danger/10 border-l-[3px] border-l-danger' : 'bg-primary/5 dark:bg-primary/10 border-l-[3px] border-l-primary')">
                  <div class="flex items-start gap-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center shadow-sm border shrink-0"
                         :class="isDangerNotif(n) ? 'bg-danger/10 text-danger border-danger/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'">
                      <component :is="notifIcon(n.type)" class="w-4 h-4" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-bold text-slate-800 dark:text-slate-100">{{ formatNotification(n).title }}</p>
                      <p v-if="formatNotification(n).desc" class="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{{ formatNotification(n).desc }}</p>
                      <div class="flex items-center justify-between mt-2">
                        <p class="text-[10px] font-bold text-slate-400">{{ new Date(n.created_at).toLocaleString('id-ID') }}</p>
                        <span v-if="!n.is_read" class="text-[10px] font-bold" :class="isDangerNotif(n) ? 'text-danger' : 'text-primary'">{{ isDangerNotif(n) ? 'Perlu Tindakan' : 'Baru' }}</span>
                      </div>
                      <button
                        v-if="n.data?.action_url"
                        @click.stop="openNotification(n)"
                        class="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                      >
                        {{ n.data?.action_label || 'Lihat Detail' }} ->
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </header>

      <!-- Main Content Area -->
      <main class="flex-1 pb-24 relative">
        <slot />
      </main>
      
      <!-- Bottom Navigation -->
      <nav class="fixed bottom-0 w-full bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-8 py-3 flex justify-between md:justify-around md:px-32 lg:px-64 items-center pb-safe z-50 transition-colors duration-300 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
        <NuxtLink to="/app" class="flex flex-col items-center gap-1.5 transition-colors group" exact-active-class="text-primary">
          <LucideHome class="w-6 h-6 text-slate-400 dark:text-slate-500 group-[.text-primary]:text-primary dark:group-[.text-primary]:text-primary group-[.text-primary]:fill-primary/10 transition-colors" />
          <span class="text-base font-bold text-slate-400 dark:text-slate-500 group-[.text-primary]:text-primary dark:group-[.text-primary]:text-primary transition-colors">Beranda</span>
        </NuxtLink>
        <NuxtLink to="/app/tugas" class="flex flex-col items-center gap-1.5 transition-colors group relative" active-class="text-primary">
          <div class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-danger rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse transition-colors"></div>
          <LucideClipboardList class="w-6 h-6 text-slate-400 dark:text-slate-500 group-[.text-primary]:text-primary dark:group-[.text-primary]:text-primary group-[.text-primary]:fill-primary/10 transition-colors" />
          <span class="text-base font-bold text-slate-400 dark:text-slate-500 group-[.text-primary]:text-primary dark:group-[.text-primary]:text-primary transition-colors">Tugas</span>
        </NuxtLink>
        <NuxtLink to="/app/profil" class="flex flex-col items-center gap-1.5 transition-colors group" active-class="text-primary">
          <LucideUser class="w-6 h-6 text-slate-400 dark:text-slate-500 group-[.text-primary]:text-primary dark:group-[.text-primary]:text-primary group-[.text-primary]:fill-primary/10 transition-colors" />
          <span class="text-base font-bold text-slate-400 dark:text-slate-500 group-[.text-primary]:text-primary dark:group-[.text-primary]:text-primary transition-colors">Profil</span>
        </NuxtLink>
      </nav>
      
    </div>
  </div>
</template>

<style>
/* Safe area padding for modern phones (e.g. iPhone Notch/Home indicator) */
.pb-safe {
  padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
}
/* Hide scrollbar for PWA feel */
::-webkit-scrollbar {
  display: none;
}
* {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
