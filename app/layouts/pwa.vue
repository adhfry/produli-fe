<script setup>
useHead({
  titleTemplate: (titleChunk) => titleChunk ? `${titleChunk} - Kader Prolanis` : 'PRODULI Kader',
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'theme-color', content: '#ffffff' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0' }
  ]
})
</script>

<template>
  <div class="min-h-screen bg-slate-100 dark:bg-slate-950 flex justify-center font-sans transition-colors duration-300">
    <!-- App Container (Fluid Full Width) -->
    <div class="w-full bg-slate-50 dark:bg-slate-900 min-h-screen flex flex-col relative transition-colors duration-300">
      
      <NetworkStatus />

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
