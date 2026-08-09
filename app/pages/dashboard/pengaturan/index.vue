<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})
useHead({
  title: 'Pengaturan'
})

// Placeholder disengaja (docs/planning/02 §17) — risk_thresholds dkk belum ada endpoint
// backend-nya sama sekali (backlog terpisah), jangan janji isi menu sebelum kontennya ada.
</script>

<template>
  <div class="space-y-6">
    <!-- Breadcrumb & Header -->
    <div>
      <div class="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wider">
        <NuxtLink to="/dashboard" class="hover:text-primary transition-colors">Dashboard</NuxtLink>
        <LucideChevronRight class="w-3 h-3" />
        <span class="text-slate-600">Pengaturan</span>
      </div>
      <h1 class="text-2xl font-extrabold text-accent">Pengaturan</h1>
      <p class="text-sm text-slate-500 mt-1">Pengaturan tingkat sistem untuk super_admin.</p>
    </div>

    <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-12 text-center text-slate-400">
      <LucideSettings class="w-10 h-10 mx-auto mb-3 text-slate-300" />
      <p class="font-medium text-slate-500">Halaman ini belum memiliki konten.</p>
      <p class="text-xs text-slate-400 mt-1">Menunggu endpoint backend terkait (mis. ambang batas risiko) — backlog terpisah.</p>
    </div>
  </div>
</template>
