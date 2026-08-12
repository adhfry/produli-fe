<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { motion } from 'motion-v'

// Privat/no-SEO meski belum login (docs/planning/03 §5 mengelompokkan login bersama
// dashboard & app kader). Pintu masuk semua role termasuk kader — senior-friendly
// (docs/planning/03 §1): tombol besar, feedback jelas.
// middleware: 'guest' -- user yang sudah login & buka halaman ini lagi ditendang ke homeRoute,
// bukan disuruh login ulang (lihat app/middleware/guest.ts).
definePageMeta({ layout: 'private', middleware: 'guest' })
useSeoMeta({ title: 'Masuk — PRODULI' })

const authStore = useAuthStore()
const config = useRuntimeConfig()
const route = useRoute()

// Dari middleware/auth.ts (?redirect=...) — cuma dipakai kalau path relatif & aman
// (cegah open redirect ke domain lain lewat query string).
function safeRedirectTarget() {
  const target = route.query.redirect
  if (typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')) {
    return target
  }
  return authStore.homeRoute
}

const schema = z.object({
  email: z.string().min(1, 'Email wajib diisi').email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi')
})
type Schema = z.output<typeof schema>

const state = reactive({ email: '', password: '' })
const isSubmitting = ref(false)
const errorMessage = ref('')

async function onSubmit(event: FormSubmitEvent<Schema>) {
  errorMessage.value = ''
  isSubmitting.value = true
  try {
    await authStore.login({ email: event.data.email, password: event.data.password })
    await navigateTo(safeRedirectTarget())
  } catch (e) {
    errorMessage.value = e instanceof ApiError ? e.message : 'Gagal masuk, periksa kembali email dan sandi Anda.'
  } finally {
    isSubmitting.value = false
  }
}

function loginWithGoogle() {
  const backendOrigin = new URL(config.public.apiBase).origin
  window.location.href = `${backendOrigin}/auth/google/redirect`
}
</script>

<template>
  <div class="min-h-screen bg-surface flex selection:bg-primary selection:text-white">
    <!-- Left: Branding & Visuals (Hidden on Mobile) -->
    <div class="hidden w-1/2 flex-col justify-between bg-accent p-12 text-white lg:flex relative overflow-hidden">
      <!-- Decorative Background -->
      <div class="absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px]"></div>
      <div class="absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full bg-secondary/20 blur-[120px]"></div>
      
      <!-- Top Branding -->
      <NuxtLink to="/" class="relative z-10 flex items-center gap-3 w-fit transition hover:opacity-90">
        <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1 shadow-lg">
          <img src="/logo/logo-no-text.png" alt="PRODULI Logo" class="h-full w-full object-contain" />
        </div>
        <span class="text-2xl font-bold tracking-tight text-white">PRO<span class="font-light text-primary">DULI</span></span>
      </NuxtLink>

      <!-- Main Copy -->
      <motion.div 
         class="relative z-10 max-w-md"
         :initial="{ opacity: 0, x: -30 }" 
         :animate="{ opacity: 1, x: 0 }" 
         :transition="{ duration: 0.8, ease: 'easeOut' }"
      >
        <h1 class="text-4xl font-extrabold leading-tight tracking-tight mb-6">
          Mewujudkan Pelayanan Kesehatan <br/> <span class="text-primary">yang Proaktif.</span>
        </h1>
        <p class="text-lg text-neutral-300 leading-relaxed">
          Platform transformasi digital untuk mendukung tenaga kesehatan memberikan tindakan preventif berbasis data langsung ke lapangan.
        </p>
      </motion.div>

      <!-- Footer Branding -->
      <div class="relative z-10 flex items-center gap-4 text-sm text-neutral-400">
        <LucideShieldCheck class="h-5 w-5 text-primary" />
        Sistem Terenkripsi & Aman Terpadu
      </div>
    </div>

    <!-- Right: Login Form -->
    <div class="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 xl:px-24 relative bg-white">
       <motion.div 
         class="mx-auto w-full max-w-sm lg:max-w-md"
         :initial="{ opacity: 0, y: 20 }" 
         :animate="{ opacity: 1, y: 0 }" 
         :transition="{ duration: 0.6, ease: 'easeOut' }"
       >
          <!-- Mobile Branding (Visible only on mobile) -->
          <div class="flex flex-col items-center mb-10 text-center lg:hidden">
            <NuxtLink to="/">
              <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-xl shadow-primary/10 border border-neutral-100 p-2 mb-4">
                <img src="/logo/logo-no-text.png" alt="PRODULI Logo" class="h-full w-full object-contain" />
              </div>
            </NuxtLink>
            <h1 class="text-2xl font-extrabold tracking-tight text-accent">PRO<span class="font-light text-primary">DULI</span></h1>
            <p class="text-sm text-neutral-500 mt-2">Masuk untuk melanjutkan aktivitas</p>
          </div>

          <div class="hidden lg:block mb-8">
            <h2 class="text-3xl font-bold text-accent mb-2">Selamat Datang</h2>
            <p class="text-neutral-500">Silakan masuk menggunakan akun resmi Anda.</p>
          </div>

          <!-- Error Alert with animation -->
          <motion.div 
             v-if="errorMessage" 
             :initial="{ opacity: 0, height: 0, scale: 0.95 }" 
             :animate="{ opacity: 1, height: 'auto', scale: 1 }" 
             class="mb-6 overflow-hidden"
          >
             <div class="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
                <LucideAlertCircle class="h-5 w-5 shrink-0" />
                <span class="font-medium">{{ errorMessage }}</span>
             </div>
          </motion.div>

          <UForm :schema="schema" :state="state" class="flex flex-col gap-5" @submit="onSubmit">
            <UFormField label="Alamat Email" name="email" size="xl">
              <UInput 
                 v-model="state.email" 
                 type="email" 
                 size="xl" 
                 class="w-full cursor-pointer" 
                 placeholder="nama@puskesmas.go.id" 
                 autocomplete="email" 
                 :disabled="isSubmitting"
              >
                 <template #leading>
                    <LucideMail class="h-5 w-5 text-neutral-400" />
                 </template>
              </UInput>
            </UFormField>

            <UFormField label="Kata Sandi" name="password" size="xl">
              <UInput 
                 v-model="state.password" 
                 type="password" 
                 size="xl" 
                 class="w-full cursor-pointer" 
                 placeholder="••••••••" 
                 autocomplete="current-password" 
                 :disabled="isSubmitting"
              >
                 <template #leading>
                    <LucideLock class="h-5 w-5 text-neutral-400" />
                 </template>
              </UInput>
            </UFormField>

            <div class="flex items-center justify-between mt-1 mb-2">
               <label class="flex items-center gap-2 text-sm text-neutral-600 cursor-pointer group">
                  <input type="checkbox" class="rounded border-neutral-300 text-primary focus:ring-primary h-4 w-4 transition group-hover:border-primary cursor-pointer" />
                  <span class="transition group-hover:text-neutral-900">Ingat saya</span>
               </label>
               <NuxtLink to="/forgot-password" class="text-sm font-semibold text-primary transition hover:text-accent cursor-pointer">Lupa sandi?</NuxtLink>
            </div>

            <UButton 
               type="submit" 
               size="xl" 
               block 
               :loading="isSubmitting"
               class="rounded-xl shadow-md shadow-primary/20 transition hover:shadow-lg hover:-translate-y-0.5 mt-2 cursor-pointer"
            >
              <span v-if="!isSubmitting">Masuk ke Sistem</span>
              <span v-else>Memproses...</span>
            </UButton>
          </UForm>

          <div class="relative my-8 flex items-center">
            <div class="flex-grow border-t border-neutral-200"></div>
            <span class="shrink-0 bg-white px-4 text-xs font-medium text-neutral-400 uppercase tracking-wider">Metode Lain</span>
            <div class="flex-grow border-t border-neutral-200"></div>
          </div>

          <button 
             type="button"
             @click="loginWithGoogle"
             :disabled="isSubmitting"
             class="flex w-full items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3.5 text-sm font-semibold text-neutral-700 shadow-xs transition hover:bg-neutral-50 hover:shadow-sm focus:outline-hidden disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Masuk dengan Google
          </button>
       </motion.div>
    </div>
  </div>
</template>
