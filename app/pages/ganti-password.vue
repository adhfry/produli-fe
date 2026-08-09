<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

// Target redirect wajib saat backend membalas 403 {data.code: 'MUST_CHANGE_PASSWORD'}
// (lihat plugin auth-refresh & middleware auth) — juga dipakai self-service biasa dari menu akun.
definePageMeta({ layout: 'private', middleware: 'auth' })
useSeoMeta({ title: 'Ganti Password' })

const authStore = useAuthStore()

const schema = z.object({
  current_password: z.string().min(1, 'Password lama wajib diisi'),
  new_password: z.string().min(8, 'Password baru minimal 8 karakter'),
  new_password_confirmation: z.string().min(1, 'Konfirmasi password baru wajib diisi')
}).refine((data) => data.new_password === data.new_password_confirmation, {
  message: 'Konfirmasi password baru tidak cocok',
  path: ['new_password_confirmation']
}).refine((data) => data.new_password !== data.current_password, {
  message: 'Password baru harus berbeda dari password lama',
  path: ['new_password']
})
type Schema = z.output<typeof schema>

const state = reactive({ current_password: '', new_password: '', new_password_confirmation: '' })
const isSubmitting = ref(false)
const errorMessage = ref('')
const success = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  errorMessage.value = ''
  isSubmitting.value = true
  try {
    const api = useApi()
    await api('/auth/change-password', {
      method: 'POST',
      body: {
        current_password: event.data.current_password,
        new_password: event.data.new_password
      }
    })
    // Ambil ulang dari sumber kebenaran (bukan patch manual) — must_change_password
    // sudah false di server sekarang.
    await authStore.fetchMe()
    success.value = true
    await navigateTo(authStore.homeRoute)
  } catch (e) {
    errorMessage.value = e instanceof ApiError ? e.message : 'Gagal mengganti password, coba lagi.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
    <div class="text-center">
      <h1 class="text-2xl font-bold">Ganti Password</h1>
      <p v-if="authStore.user?.must_change_password" class="text-muted mt-1">
        Anda wajib mengganti password sebelum melanjutkan.
      </p>
    </div>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="soft"
      title="Tidak bisa mengganti password"
      :description="errorMessage"
    />
    <UAlert
      v-if="success"
      color="success"
      variant="soft"
      title="Password berhasil diganti"
    />

    <UForm :schema="schema" :state="state" class="flex flex-col gap-4" @submit="onSubmit">
      <UFormField label="Password Lama" name="current_password" size="xl">
        <UInput v-model="state.current_password" type="password" size="xl" class="w-full" autocomplete="current-password" />
      </UFormField>

      <UFormField label="Password Baru" name="new_password" size="xl">
        <UInput v-model="state.new_password" type="password" size="xl" class="w-full" autocomplete="new-password" />
      </UFormField>

      <UFormField label="Konfirmasi Password Baru" name="new_password_confirmation" size="xl">
        <UInput v-model="state.new_password_confirmation" type="password" size="xl" class="w-full" autocomplete="new-password" />
      </UFormField>

      <UButton type="submit" size="xl" block :loading="isSubmitting">Simpan Password Baru</UButton>
    </UForm>
  </main>
</template>
