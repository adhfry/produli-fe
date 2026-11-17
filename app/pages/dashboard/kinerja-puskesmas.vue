<script setup lang="ts">
import type { ApiSuccessEnvelope } from '~/types/api'

// Halaman "Selengkapnya" dari widget "Top 5 Puskesmas Kinerja Terbaik" di /dashboard, sekaligus menu
// Kinerja Puskesmas. Diperbarui Fase 5 blueprint docs/planning/16 (2026-11-17): aturan poin v2 dengan
// rincian poin, daftar pasien membaik/memburuk (puskesmas sendiri; super_admin semua, sama dengan
// KinerjaPuskesmasController), periode = tanggal pemeriksaan lab. Kolom skor komponen, kunjungan
// tervalidasi, breadcrumb, dan deep link periode dari dashboard dipertahankan dari versi sebelumnya.
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Kinerja Puskesmas' })

interface BarisPeringkat {
  rank: number
  puskesmas_id: number
  puskesmas_nama: string
  final_score: number
  improvement_rate: number
  risk_reduction_score: number
  stability_rate: number
  eligible_patients: number
  improved_patients: number
  level_membaik_patients: number
  worsened_patients: number
  validated_visits: number
  poin_perbaikan: number
  poin_perburukan: number
  poin_retensi: number
  bonus_kunjungan: number
  total_poin: number
}
interface BarisPasien {
  patient_id: number
  nama: string | null
  no_reg: string | null
  dari_label: string
  ke_label: string
  tanggal_pemeriksaan: string | null
  poin: number
  bonus_kunjungan: number
  total: number
}

const authStore = useAuthStore()
const isSuperAdmin = computed(() => (authStore.roles ?? []).includes('super_admin'))
const puskesmasSaya = computed(() => authStore.user?.puskesmas_id ?? null)

// --- Periode -------------------------------------------------------------------------------
type Preset = 'bulan_ini' | 'tiga_bulan' | 'tahun_ini' | 'semua' | 'pilih'
// Deep link dari /dashboard (?date_from=&date_to=, atau ?periode=semua saat dashboard menampilkan
// semua tanggal): konteks periode yang sedang dilihat ikut terbawa. Divalidasi, bukan dipakai mentah.
const route = useRoute()
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
function queryDate(key: string): string {
  const v = route.query[key]
  return typeof v === 'string' && ISO_DATE_RE.test(v) ? v : ''
}
const tanggalDari = ref(queryDate('date_from'))
const tanggalSampai = ref(queryDate('date_to'))
const preset = ref<Preset>(tanggalDari.value && tanggalSampai.value ? 'pilih' : route.query.periode === 'semua' ? 'semua' : 'bulan_ini')
const dariInputRef = ref<HTMLInputElement | null>(null)
const sampaiInputRef = ref<HTMLInputElement | null>(null)

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const periode = computed<{ dari: string | null, sampai: string | null }>(() => {
  const kini = new Date()
  if (preset.value === 'bulan_ini') return { dari: ymd(new Date(kini.getFullYear(), kini.getMonth(), 1)), sampai: ymd(kini) }
  if (preset.value === 'tiga_bulan') return { dari: ymd(new Date(kini.getFullYear(), kini.getMonth() - 2, 1)), sampai: ymd(kini) }
  if (preset.value === 'tahun_ini') return { dari: ymd(new Date(kini.getFullYear(), 0, 1)), sampai: ymd(kini) }
  if (preset.value === 'semua') return { dari: null, sampai: null }
  return { dari: tanggalDari.value || null, sampai: tanggalSampai.value || null }
})
const PRESET_LABEL: Record<Exclude<Preset, 'pilih'>, string> = {
  bulan_ini: 'Bulan ini', tiga_bulan: '3 bulan terakhir', tahun_ini: 'Tahun ini', semua: 'Semua waktu'
}
function tanggalTampil(v: string | null): string {
  if (!v) return '-'
  return new Date(`${v.slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
const periodeTeks = computed(() => {
  const { dari, sampai } = periode.value
  if (!dari && !sampai) return 'semua waktu'
  return `${tanggalTampil(dari)} sampai ${tanggalTampil(sampai ?? ymd(new Date()))}`
})

// --- Peringkat -----------------------------------------------------------------------------
const peringkat = ref<BarisPeringkat[]>([])
const isLoading = ref(false)
const loadError = ref('')

async function muatPeringkat() {
  if (preset.value === 'pilih' && tanggalDari.value && tanggalSampai.value && tanggalDari.value > tanggalSampai.value) {
    loadError.value = 'Tanggal awal harus sebelum tanggal akhir.'
    return
  }
  isLoading.value = true
  loadError.value = ''
  try {
    const { dari, sampai } = periode.value
    const res = await useApi()('/kinerja-puskesmas', { query: { ...(dari ? { date_from: dari } : {}), ...(sampai ? { date_to: sampai } : {}) } }) as ApiSuccessEnvelope<{ peringkat: BarisPeringkat[] }>
    peringkat.value = res.data.peringkat
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Gagal memuat kinerja puskesmas.'
  } finally {
    isLoading.value = false
  }
}
watch(periode, muatPeringkat)
onMounted(() => {
  muatPeringkat()
  initDatePicker(dariInputRef.value, tanggalDari, { maxDate: 'today', defaultDate: tanggalDari.value || undefined })
  initDatePicker(sampaiInputRef.value, tanggalSampai, { maxDate: 'today', defaultDate: tanggalSampai.value || undefined })
})

function bolehLihatPasien(row: BarisPeringkat): boolean {
  return isSuperAdmin.value || row.puskesmas_id === puskesmasSaya.value
}
function angka(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

// --- Rincian pasien ------------------------------------------------------------------------
const rincian = ref<BarisPeringkat | null>(null)
const arahRincian = ref<'membaik' | 'memburuk'>('membaik')
const pasienRincian = ref<BarisPasien[]>([])
const isLoadingRincian = ref(false)
const rincianError = ref('')

async function bukaRincian(row: BarisPeringkat, arah: 'membaik' | 'memburuk' = 'membaik') {
  rincian.value = row
  arahRincian.value = arah
  await muatRincian()
}
async function muatRincian() {
  if (!rincian.value) return
  isLoadingRincian.value = true
  rincianError.value = ''
  try {
    const { dari, sampai } = periode.value
    const res = await useApi()(`/kinerja-puskesmas/${rincian.value.puskesmas_id}/pasien`, {
      query: { arah: arahRincian.value, ...(dari ? { date_from: dari } : {}), ...(sampai ? { date_to: sampai } : {}) }
    }) as ApiSuccessEnvelope<{ items: BarisPasien[] }>
    pasienRincian.value = res.data.items
  } catch (e) {
    rincianError.value = e instanceof ApiError ? e.message : 'Gagal memuat daftar pasien.'
  } finally {
    isLoadingRincian.value = false
  }
}
watch(arahRincian, muatRincian)
function tutupRincian() {
  rincian.value = null
  pasienRincian.value = []
}
onKeyStroke('Escape', () => {
  if (rincian.value) tutupRincian()
})
</script>

<template>
  <div class="space-y-6">
    <nav class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500" aria-label="Breadcrumb">
      <NuxtLink to="/dashboard" class="hover:text-primary">Dashboard</NuxtLink>
      <LucideChevronRight class="h-3 w-3" aria-hidden="true" />
      <span class="text-slate-700">Kinerja Puskesmas</span>
    </nav>

    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-accent">Kinerja Puskesmas</h1>
        <p class="mt-1 max-w-3xl text-sm text-slate-600">
          Peringkat dari perubahan kondisi pasien karena pemeriksaan lab baru. Pemeriksaan ulang atas hasil lab yang sama tidak dihitung.
        </p>
      </div>
      <NuxtLink to="/dashboard" class="flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline">
        <LucideArrowLeft class="h-4 w-4" aria-hidden="true" /> Kembali ke Dashboard
      </NuxtLink>
    </div>

    <section class="rounded-2xl border border-slate-100 bg-white p-5 shadow-card" aria-label="Periode dan aturan poin">
      <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Periode">
        <button
          v-for="(label, key) in PRESET_LABEL"
          :key="key"
          type="button"
          class="min-h-11 rounded-xl px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          :class="preset === key ? 'bg-accent text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'"
          :aria-pressed="preset === key"
          @click="preset = key"
        >
          {{ label }}
        </button>
        <div
          class="flex min-h-11 flex-wrap items-center gap-2 rounded-xl border px-3 text-sm"
          :class="preset === 'pilih' ? 'border-accent bg-accent/5' : 'border-slate-200'"
        >
          <span class="font-semibold text-slate-700">Pilih tanggal</span>
          <input ref="dariInputRef" type="text" readonly placeholder="Dari" aria-label="Tanggal awal" class="w-28 cursor-pointer bg-transparent outline-none placeholder:text-slate-600" @focus="preset = 'pilih'" />
          <span class="text-slate-500" aria-hidden="true">s/d</span>
          <input ref="sampaiInputRef" type="text" readonly placeholder="Sampai" aria-label="Tanggal akhir" class="w-28 cursor-pointer bg-transparent outline-none placeholder:text-slate-600" @focus="preset = 'pilih'" />
        </div>
      </div>
      <p class="mt-4 text-xs text-slate-600">
        Poin: <strong class="text-slate-800">+10</strong> per level membaik, <strong class="text-slate-800">-10</strong> per level memburuk,
        <strong class="text-slate-800">+2</strong> bila tetap Terkendali, <strong class="text-slate-800">+5</strong> bonus bila membaik dan ada kunjungan tervalidasi di antara dua pemeriksaan.
        Poin masuk ke puskesmas pemilik pasien pada tanggal pemeriksaan.
      </p>
    </section>

    <section class="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card" aria-labelledby="judul-peringkat">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/50 px-5 py-4">
        <h2 id="judul-peringkat" class="font-bold text-accent">Peringkat se-Kabupaten Sumenep</h2>
        <p class="text-xs text-slate-600" aria-live="polite">Periode pemeriksaan: {{ periodeTeks }}</p>
      </div>

      <p v-if="loadError" role="alert" class="m-5 rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-sm font-semibold text-danger-700">
        {{ loadError }}
        <button type="button" class="ml-2 underline underline-offset-2" @click="muatPeringkat">Coba lagi</button>
      </p>

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[1240px] border-collapse text-left">
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600">
              <th class="px-4 py-3 font-semibold">#</th>
              <th class="px-4 py-3 font-semibold">Puskesmas</th>
              <th class="px-4 py-3 text-right font-semibold" title="Skor 0-100: improvement 50%, risk reduction 30%, stability 20%">Skor</th>
              <th class="px-4 py-3 text-right font-semibold">Improvement</th>
              <th class="px-4 py-3 text-right font-semibold">Risk reduction</th>
              <th class="px-4 py-3 text-right font-semibold">Stability</th>
              <th class="px-4 py-3 text-right font-semibold">Pasien dinilai</th>
              <th class="px-4 py-3 text-right font-semibold">Membaik</th>
              <th class="px-4 py-3 text-right font-semibold">Memburuk</th>
              <th class="px-4 py-3 text-right font-semibold">Poin perbaikan</th>
              <th class="px-4 py-3 text-right font-semibold">Perburukan</th>
              <th class="px-4 py-3 text-right font-semibold">Retensi</th>
              <th class="px-4 py-3 text-right font-semibold">Kunjungan tervalidasi</th>
              <th class="px-4 py-3 text-right font-semibold">Bonus kunjungan</th>
              <th class="px-4 py-3 text-right font-semibold">Total poin</th>
              <th class="px-4 py-3 text-right font-semibold"><span class="sr-only">Aksi</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="isLoading">
              <td colspan="16" class="py-12 text-center text-slate-500">
                <LucideLoader2 class="mx-auto mb-2 h-6 w-6 animate-spin" aria-hidden="true" />
                Memuat peringkat...
              </td>
            </tr>
            <tr v-else-if="peringkat.length === 0">
              <td colspan="16" class="px-5 py-12 text-center text-sm text-slate-600">
                Belum ada perubahan kondisi karena pemeriksaan lab baru pada periode ini.
              </td>
            </tr>
            <tr
              v-for="row in isLoading ? [] : peringkat"
              :key="row.puskesmas_id"
              :class="row.puskesmas_id === puskesmasSaya ? 'bg-primary/5' : 'hover:bg-slate-50/80'"
            >
              <td class="px-4 py-3 text-sm font-bold text-slate-800 tabular-nums">{{ row.rank }}</td>
              <td class="px-4 py-3 text-sm font-semibold text-slate-800">
                {{ row.puskesmas_nama }}
                <span v-if="row.puskesmas_id === puskesmasSaya" class="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">Puskesmas Anda</span>
              </td>
              <td class="px-4 py-3 text-right text-sm font-bold text-slate-800 tabular-nums">{{ row.final_score.toFixed(1) }}</td>
              <td class="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">{{ row.improvement_rate }}%</td>
              <td class="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">{{ row.risk_reduction_score }}%</td>
              <td class="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">{{ row.stability_rate }}%</td>
              <td class="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">{{ row.eligible_patients }}</td>
              <td class="px-4 py-3 text-right text-sm font-semibold text-success-800 tabular-nums">{{ row.level_membaik_patients }}</td>
              <td class="px-4 py-3 text-right text-sm font-semibold text-danger-700 tabular-nums">{{ row.worsened_patients }}</td>
              <td class="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">{{ angka(row.poin_perbaikan) }}</td>
              <td class="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">{{ angka(row.poin_perburukan) }}</td>
              <td class="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">{{ angka(row.poin_retensi) }}</td>
              <td class="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">{{ row.validated_visits }}</td>
              <td class="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">{{ angka(row.bonus_kunjungan) }}</td>
              <td class="px-4 py-3 text-right text-sm font-bold text-accent tabular-nums">{{ angka(row.total_poin) }}</td>
              <td class="px-4 py-3 text-right">
                <button
                  v-if="bolehLihatPasien(row)"
                  type="button"
                  class="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-primary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  @click="bukaRincian(row)"
                >
                  Lihat pasien
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Rincian pasien membaik/memburuk -->
    <div v-if="rincian" class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" @click.self="tutupRincian">
      <div role="dialog" aria-modal="true" aria-labelledby="judul-rincian" class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <div class="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 id="judul-rincian" class="text-lg font-bold text-accent">{{ rincian.puskesmas_nama }}</h3>
            <p class="text-xs text-slate-600">Periode pemeriksaan: {{ periodeTeks }}</p>
          </div>
          <button type="button" class="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Tutup" @click="tutupRincian">
            <LucideX class="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div class="flex gap-2 px-5 pt-4" role="group" aria-label="Arah perubahan">
          <button
            v-for="a in (['membaik', 'memburuk'] as const)"
            :key="a"
            type="button"
            class="min-h-11 rounded-xl px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            :class="arahRincian === a ? 'bg-accent text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'"
            :aria-pressed="arahRincian === a"
            @click="arahRincian = a"
          >
            {{ a === 'membaik' ? `Membaik (${rincian.level_membaik_patients})` : `Memburuk (${rincian.worsened_patients})` }}
          </button>
        </div>
        <div class="overflow-y-auto px-5 py-4">
          <p v-if="isLoadingRincian" class="py-8 text-center text-slate-500">
            <LucideLoader2 class="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden="true" />
            Memuat pasien...
          </p>
          <p v-else-if="rincianError" role="alert" class="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-sm font-semibold text-danger-700">{{ rincianError }}</p>
          <p v-else-if="pasienRincian.length === 0" class="py-8 text-center text-sm text-slate-600">Tidak ada pasien {{ arahRincian }} pada periode ini.</p>
          <ul v-else class="divide-y divide-slate-100">
            <li v-for="p in pasienRincian" :key="`${p.patient_id}-${p.tanggal_pemeriksaan}`" class="flex items-center gap-3 py-3">
              <div class="min-w-0 flex-1">
                <NuxtLink :to="`/dashboard/pasien/${p.patient_id}`" class="font-semibold text-slate-800 hover:text-primary hover:underline">{{ p.nama ?? '-' }}</NuxtLink>
                <p class="text-xs text-slate-600">{{ p.dari_label }} ke {{ p.ke_label }} &middot; pemeriksaan {{ tanggalTampil(p.tanggal_pemeriksaan) }}<template v-if="p.no_reg"> &middot; No. reg {{ p.no_reg }}</template></p>
              </div>
              <span class="text-sm font-bold tabular-nums" :class="p.total > 0 ? 'text-success-800' : 'text-danger-700'">
                {{ angka(p.total) }}<span v-if="p.bonus_kunjungan" class="ml-1 text-xs font-semibold text-slate-600">(termasuk bonus {{ p.bonus_kunjungan }})</span>
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
