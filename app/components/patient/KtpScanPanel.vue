<script setup lang="ts">
import type { KtpScanResult } from '~/types/api'

// Scan KTP pasien: ambil foto dengan kamera HP (atribut capture) atau pilih berkas foto. Foto
// diperkecil di browser, diunggah ke PRODULI (POST /ktp-scans), lalu dibaca OCR SiLAKES. Induk
// komponen yang mengisi form dari hasil `scanned` -- komponen ini tidak tahu bentuk form.
const emit = defineEmits<{
  scanned: [result: KtpScanResult]
  removed: []
}>()

const { scan } = useKtpScan()

const kameraInput = ref<HTMLInputElement | null>(null)
const berkasInput = ref<HTMLInputElement | null>(null)
const pratinjau = ref<string | null>(null)
const status = ref<'kosong' | 'membaca' | 'selesai' | 'gagal'>('kosong')
const hasil = ref<KtpScanResult | null>(null)
const pesanGagal = ref('')

function bersihkanPratinjau() {
  if (pratinjau.value) URL.revokeObjectURL(pratinjau.value)
  pratinjau.value = null
}
onBeforeUnmount(bersihkanPratinjau)

async function onPilihFoto(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  bersihkanPratinjau()
  pratinjau.value = URL.createObjectURL(file)
  status.value = 'membaca'
  hasil.value = null
  pesanGagal.value = ''

  try {
    hasil.value = await scan(file)
    status.value = 'selesai'
    emit('scanned', hasil.value)
  } catch (e) {
    status.value = 'gagal'
    pesanGagal.value = e instanceof ApiError
      ? (e.errors?.image?.[0] ?? e.message)
      : 'Foto KTP gagal diunggah. Periksa koneksi lalu coba lagi.'
  }
}

function hapusFoto() {
  bersihkanPratinjau()
  status.value = 'kosong'
  hasil.value = null
  pesanGagal.value = ''
  emit('removed')
}

const jumlahTerisi = computed(() => Object.values(hasil.value?.fields ?? {}).filter((v) => v !== null && v !== '').length)
const cekError = computed(() => (hasil.value?.checks ?? []).filter((c) => c.level === 'error'))
const cekWarn = computed(() => (hasil.value?.checks ?? []).filter((c) => c.level === 'warn'))
</script>

<template>
  <section class="rounded-xl border border-primary-200 bg-primary-50/60 p-3" aria-labelledby="ktp-scan-judul">
    <div class="flex items-start gap-3">
      <div class="min-w-0 flex-1">
        <h4 id="ktp-scan-judul" class="text-sm font-bold text-accent">Scan KTP pasien</h4>
        <p v-if="status === 'kosong'" class="mt-0.5 text-xs text-slate-600">
          Foto KTP mengisi form secara otomatis. Foto ikut dikirim ke Labkesda sebagai bukti.
        </p>
      </div>
    </div>

    <input ref="kameraInput" type="file" accept="image/*" capture="environment" class="hidden" @change="onPilihFoto" />
    <input ref="berkasInput" type="file" accept="image/jpeg,image/png" class="hidden" @change="onPilihFoto" />

    <div v-if="status === 'kosong' || status === 'gagal'" class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <button
        type="button"
        class="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
        @click="kameraInput?.click()"
      >
        <LucideCamera class="h-4 w-4" aria-hidden="true" />
        Foto dengan kamera
      </button>
      <button
        type="button"
        class="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
        @click="berkasInput?.click()"
      >
        <LucideImage class="h-4 w-4" aria-hidden="true" />
        Pilih foto dari berkas
      </button>
    </div>

    <p v-if="status === 'gagal'" role="alert" class="mt-2 text-xs font-semibold text-danger-700">{{ pesanGagal }}</p>

    <div v-if="status === 'membaca' || status === 'selesai'" class="mt-3 flex flex-col gap-3 sm:flex-row">
      <a
        v-if="pratinjau"
        :href="pratinjau"
        target="_blank"
        rel="noopener"
        class="block shrink-0 self-start overflow-hidden rounded-lg border border-slate-200 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label="Buka foto KTP ukuran penuh"
      >
        <img :src="pratinjau" alt="Foto KTP pasien" class="h-24 w-auto max-w-[180px] object-contain" />
      </a>

      <div class="min-w-0 flex-1 text-sm" aria-live="polite">
        <p v-if="status === 'membaca'" class="flex items-center gap-2 font-semibold text-slate-700">
          <LucideLoader2 class="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
          Membaca KTP, biasanya 5 sampai 15 detik...
        </p>

        <template v-else-if="hasil">
          <p v-if="hasil.ocr_error" class="flex items-start gap-2 font-semibold text-warning-800">
            <LucideAlertTriangle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{{ hasil.ocr_error }}</span>
          </p>
          <p v-else class="flex items-start gap-2 font-semibold text-secondary-700">
            <LucideCheckCircle2 class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{{ jumlahTerisi }} isian terbaca dari KTP. Cocokkan lagi dengan KTP asli sebelum mengirim.</span>
          </p>

          <ul v-if="cekError.length || cekWarn.length" class="mt-2 space-y-1 text-xs">
            <li v-for="cek in cekError" :key="'e-' + cek.field + cek.message" class="text-danger-700">{{ cek.message }}</li>
            <li v-for="cek in cekWarn" :key="'w-' + cek.field + cek.message" class="text-warning-800">{{ cek.message }}</li>
          </ul>

          <slot name="setelah-hasil" :hasil="hasil" />
        </template>

        <div v-if="status === 'selesai'" class="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            class="min-h-9 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            @click="kameraInput?.click()"
          >
            Foto ulang
          </button>
          <button
            type="button"
            class="min-h-9 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            @click="berkasInput?.click()"
          >
            Ganti dari berkas
          </button>
          <button
            type="button"
            class="min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold text-danger-700 hover:bg-danger-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
            @click="hapusFoto"
          >
            Hapus foto
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
