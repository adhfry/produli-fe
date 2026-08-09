<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'private' })
useSeoMeta({ title: 'Lupa Password' })

const schema = z.object({
  email: z.string().min(1, 'Email wajib diisi').email('Format email tidak valid')
})
type Schema = z.output<typeof schema>

const state = reactive({ email: '' })
const isSubmitting = ref(false)
const errorMessage = ref('')
const submitted = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  errorMessage.value = ''
  isSubmitting.value = true
  try {
    const api = useApi()
    await api('/auth/forgot-password', {
      method: 'POST',
      body: { email: event.data.email }
    })
    // Backend selalu balas pesan generik yang sama, terdaftar atau tidak (cegah user enumeration).
    submitted.value = true
  } catch (e) {
    errorMessage.value = e instanceof ApiError ? e.message : 'Gagal mengirim link reset, coba lagi.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
    <div class="text-center">
      <h1 class="text-2xl font-bold">Lupa Password</h1>
      <p class="text-muted mt-1">Masukkan email akun Anda, kami kirim link reset password.</p>
    </div>

    <UAlert
      v-if="submitted"
      color="success"
      variant="soft"
      title="Kalau email terdaftar, link reset password sudah dikirim"
      description="Cek kotak masuk (dan folder spam) email Anda."
    />

    <template v-else>
      <UAlert
        v-if="errorMessage"
        color="error"
        variant="soft"
        title="Tidak bisa mengirim link reset"
        :description="errorMessage"
      />

      <UForm :schema="schema" :state="state" class="flex flex-col gap-4" @submit="onSubmit">
        <UFormField label="Email" name="email" size="xl">
          <UInput v-model="state.email" type="email" size="xl" class="w-full" autocomplete="email" />
        </UFormField>

        <UButton type="submit" size="xl" block :loading="isSubmitting">Kirim Link Reset</UButton>
      </UForm>
    </template>

    <NuxtLink to="/auth/login" class="text-primary text-center text-sm">Kembali ke halaman masuk</NuxtLink>
  </main>
</template>
