<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

// Path + query WAJIB persis /reset-password?token=...&email=... — dicek langsung ke
// ResetPassword::toMailUsing() (AppServiceProvider::boot()) di backend.
definePageMeta({ layout: 'private' })
useSeoMeta({ title: 'Reset Password' })

const route = useRoute()
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const email = computed(() => (typeof route.query.email === 'string' ? route.query.email : ''))

const schema = z.object({
  password: z.string().min(8, 'Password minimal 8 karakter'),
  password_confirmation: z.string().min(1, 'Konfirmasi password wajib diisi')
}).refine((data) => data.password === data.password_confirmation, {
  message: 'Konfirmasi password tidak cocok',
  path: ['password_confirmation']
})
type Schema = z.output<typeof schema>

const state = reactive({ password: '', password_confirmation: '' })
const isSubmitting = ref(false)
const errorMessage = ref('')
const linkIncomplete = !token.value || !email.value

async function onSubmit(event: FormSubmitEvent<Schema>) {
  errorMessage.value = ''
  isSubmitting.value = true
  try {
    const api = useApi()
    await api('/auth/reset-password', {
      method: 'POST',
      body: {
        token: token.value,
        email: email.value,
        password: event.data.password,
        password_confirmation: event.data.password_confirmation
      }
    })
    await navigateTo('/auth/login')
  } catch (e) {
    errorMessage.value = e instanceof ApiError ? e.message : 'Gagal mereset password, coba lagi.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
    <div class="text-center">
      <h1 class="text-2xl font-bold">Reset Password</h1>
      <p v-if="email" class="text-muted mt-1">Untuk akun {{ email }}</p>
    </div>

    <UAlert
      v-if="linkIncomplete"
      color="error"
      variant="soft"
      title="Link reset tidak lengkap"
      description="Buka lagi link dari email reset password Anda."
    />

    <template v-else>
      <UAlert
        v-if="errorMessage"
        color="error"
        variant="soft"
        title="Tidak bisa mereset password"
        :description="errorMessage"
      />

      <UForm :schema="schema" :state="state" class="flex flex-col gap-4" @submit="onSubmit">
        <UFormField label="Password Baru" name="password" size="xl">
          <UInput v-model="state.password" type="password" size="xl" class="w-full" autocomplete="new-password" />
        </UFormField>

        <UFormField label="Konfirmasi Password Baru" name="password_confirmation" size="xl">
          <UInput v-model="state.password_confirmation" type="password" size="xl" class="w-full" autocomplete="new-password" />
        </UFormField>

        <UButton type="submit" size="xl" block :loading="isSubmitting">Reset Password</UButton>
      </UForm>
    </template>

    <NuxtLink to="/auth/login" class="text-primary text-center text-sm">Kembali ke halaman masuk</NuxtLink>
  </main>
</template>
