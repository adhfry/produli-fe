<script setup lang="ts">
import { motion } from 'motion-v'

// Path ini WAJIB persis /auth/google/callback — dicek langsung ke GoogleAuthController::callback()
// di backend (redirect()->away("{$frontend_url}/auth/google/callback?code={$code}")).
// Exchange dijalankan client-side saja (onMounted, bukan top-level await/SSR) supaya cookie
// refresh token dari respons diterima langsung oleh browser, bukan oleh server Nuxt.
definePageMeta({ layout: 'private' })
useSeoMeta({ title: 'Otentikasi Sistem — KOPIPU Smart' })

const route = useRoute()
const authStore = useAuthStore()
const errorMessage = ref('')

onMounted(async () => {
  // GoogleAuthController::callback() SENGAJA tidak pernah auto-create User (docs/planning/02 §6)
  // -- kalau email Google tidak ditemukan, backend redirect ke sini dengan ?error=account_not_found
  // (BUKAN ?code=, tidak ada exchange code sekali-pakai yang dibuat). Jangan arahkan ke /activate --
  // itu butuh activation token yang memang tidak pernah dibuat untuk kasus ini.
  if (route.query.error === 'account_not_found') {
    errorMessage.value = 'Akun tidak ditemukan dengan email ini. Hubungi PJ/Admin Puskesmas Anda untuk didaftarkan.'
    return
  }

  const code = route.query.code
  if (typeof code !== 'string' || !code) {
    errorMessage.value = 'Kode otorisasi Google tidak ditemukan. Sesi mungkin telah kedaluwarsa, silakan coba masuk kembali.'
    return
  }
  try {
    await authStore.loginWithGoogleCode(code)
    await navigateTo(authStore.homeRoute)
  } catch (e) {
    errorMessage.value = e instanceof ApiError ? e.message : 'Proses otentikasi gagal. Akun Google Anda mungkin belum terdaftar di sistem kami.'
  }
})
</script>

<template>
  <main class="min-h-screen bg-surface flex items-center justify-center p-6 selection:bg-primary selection:text-white relative overflow-hidden">
    <!-- Decorative background -->
    <div class="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]"></div>
    <div class="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-secondary/10 blur-[100px]"></div>
    
    <motion.div 
      class="relative z-10 w-full max-w-sm rounded-3xl border border-neutral-100 bg-white p-8 shadow-xl shadow-primary/5 text-center"
      :initial="{ opacity: 0, scale: 0.95 }"
      :animate="{ opacity: 1, scale: 1 }"
      :transition="{ duration: 0.5, ease: 'easeOut' }"
    >
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md border border-neutral-100 p-2 mb-8">
         <img src="/pwa-192x192.png" alt="KOPIPU Smart" class="h-full w-full object-contain" />
      </div>

      <template v-if="errorMessage">
        <motion.div 
          :initial="{ opacity: 0, y: 10 }" 
          :animate="{ opacity: 1, y: 0 }" 
          class="flex flex-col items-center"
        >
          <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500 shadow-sm border border-rose-100">
             <LucideXCircle class="h-8 w-8" />
          </div>
          <h2 class="text-2xl font-bold text-accent mb-2">Otentikasi Gagal</h2>
          <p class="text-sm text-neutral-500 mb-8 leading-relaxed">{{ errorMessage }}</p>
          
          <UButton to="/auth/login" size="xl" block class="rounded-xl shadow-md transition hover:-translate-y-0.5 hover:shadow-lg">
            Kembali ke Halaman Masuk
          </UButton>
        </motion.div>
      </template>

      <template v-else>
        <motion.div 
          :initial="{ opacity: 0 }" 
          :animate="{ opacity: 1 }" 
          class="flex flex-col items-center"
        >
          <!-- Custom pulsing/spinning loader -->
          <div class="relative mx-auto mb-8 flex h-20 w-20 items-center justify-center">
             <!-- Ping effect -->
             <div class="absolute inset-0 animate-ping rounded-full bg-primary/20"></div>
             <!-- Spinner ring -->
             <div class="absolute inset-2 animate-spin rounded-full border-4 border-neutral-100 border-t-primary"></div>
             <!-- Center icon -->
             <LucideFingerprint class="h-6 w-6 text-primary animate-pulse" />
          </div>
          
          <h2 class="text-xl font-bold text-accent mb-2 animate-pulse">Memverifikasi Akses...</h2>
          <p class="text-sm text-neutral-500 leading-relaxed">
            Mohon tunggu sebentar, kami sedang mengamankan sesi dan mencocokkan kredensial Google Anda.
          </p>
        </motion.div>
      </template>
    </motion.div>
  </main>
</template>
