<script setup lang="ts">
import type { ApiSuccessEnvelope } from '~/types/api'

// Path WAJIB persis /activate?token=... — dicek langsung ke
// AccountActivationService::sendInviteEmail() di backend.
definePageMeta({ layout: 'private' })
useSeoMeta({ title: 'Aktivasi Akun' })

interface ActivateResponse {
  email: string
  password: string
  must_change_password: boolean
}

const route = useRoute()
const { copy, copied } = useClipboard()

const state = ref<'loading' | 'success' | 'error'>('loading')
const errorMessage = ref('')
const result = ref<ActivateResponse | null>(null)

onMounted(async () => {
  const token = route.query.token
  if (typeof token !== 'string' || !token) {
    state.value = 'error'
    errorMessage.value = 'Link aktivasi tidak lengkap. Minta admin kirim ulang email aktivasi.'
    return
  }
  try {
    const api = useApi()
    const res = await api<ApiSuccessEnvelope<ActivateResponse>>('/auth/activate', {
      method: 'POST',
      body: { token }
    })
    result.value = res.data
    state.value = 'success'
  } catch (e) {
    errorMessage.value = e instanceof ApiError
      ? e.message
      : 'Aktivasi gagal, coba lagi atau minta admin kirim ulang email aktivasi.'
    state.value = 'error'
  }
})
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6 text-center">
    <template v-if="state === 'loading'">
      <p class="text-lg">Mengaktifkan akun...</p>
    </template>

    <template v-else-if="state === 'success' && result">
      <h1 class="text-2xl font-bold">Akun berhasil diaktifkan</h1>
      <UAlert
        color="warning"
        variant="soft"
        title="Simpan password ini sekarang"
        description="Password ini hanya ditampilkan sekali dan tidak dikirim ulang lewat email."
      />

      <div class="space-y-3 text-left">
        <div>
          <p class="text-muted text-sm">Email</p>
          <p class="text-lg font-medium">{{ result.email }}</p>
        </div>
        <div>
          <p class="text-muted text-sm">Password</p>
          <div class="flex items-center gap-2">
            <p class="flex-1 rounded-lg bg-elevated px-3 py-2 font-mono text-xl">{{ result.password }}</p>
            <UButton
              size="xl"
              :color="copied ? 'success' : 'neutral'"
              variant="outline"
              :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              @click="copy(result.password)"
            />
          </div>
        </div>
      </div>

      <UButton to="/auth/login" size="xl" block>Lanjut ke Halaman Masuk</UButton>
    </template>

    <template v-else>
      <UAlert color="error" variant="soft" title="Tidak bisa mengaktifkan akun" :description="errorMessage" />
      <UButton to="/auth/login" size="xl" block>Kembali ke Halaman Masuk</UButton>
    </template>
  </main>
</template>
