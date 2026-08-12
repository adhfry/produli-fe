<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import flatpickr from 'flatpickr'
import 'flatpickr/dist/flatpickr.css'
import { Indonesian } from 'flatpickr/dist/l10n/id.js'
import type { ApiSuccessEnvelope, CompleteOnboardingPayload, Kader, Puskesmas, User } from '~/types/api'

definePageMeta({ layout: 'private', middleware: ['auth', 'redirect-if-onboarded'] })
useSeoMeta({ title: 'Onboarding — PRODULI' })

const step = ref(1)

// Step 1
const agreed = ref(false)
const hasReadToS = ref(false)
const tosScrollContainer = ref<HTMLElement | null>(null)

const onToSScroll = (e: Event) => {
  if (hasReadToS.value) return
  const el = e.target as HTMLElement
  // Tolerance 15px for zoom/rounding inconsistencies
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 15) {
    hasReadToS.value = true
  }
}

// Initial check in case screen is large enough that no scroll is needed
onMounted(() => {
  setTimeout(() => {
    if (tosScrollContainer.value) {
      if (tosScrollContainer.value.scrollHeight <= tosScrollContainer.value.clientHeight) {
         hasReadToS.value = true
      }
    }
  }, 500)
})

// TTS Logic
const ttsPlaying = ref(false)
const ttsSupported = ref(false)
let synth: SpeechSynthesis | null = null
let utterance: SpeechSynthesisUtterance | null = null

onMounted(() => {
  if (import.meta.client && 'speechSynthesis' in window) {
    ttsSupported.value = true
    synth = window.speechSynthesis
  }
})

onUnmounted(() => {
  if (synth) synth.cancel()
})

const toggleTTS = () => {
  if (!synth) return
  if (ttsPlaying.value) {
    synth.cancel()
    ttsPlaying.value = false
    return
  }

  const textToRead = `Selamat datang di aplikasi PRODULI. Aplikasi ini merupakan wujud digitalisasi program unggulan Pemerintah Provinsi Jawa Timur yang digagas oleh Gubernur Khofifah Indar Parawansa, yakni Program KOPIPU atau Kunjungan Rumah dari Pintu ke Pintu pada Keluarga Rawan. Aplikasi ini diinisiasi langsung oleh Kepala Dinas Kesehatan Pengendalian Penduduk dan Keluarga Berencana Kabupaten Sumenep, bersama U P T D Laboratorium Kesehatan Daerah Kabupaten Sumenep, serta dikembangkan dan dikelola oleh Pengolah Data dan Informasi U P T D Laboratorium Kesehatan Daerah Kabupaten Sumenep. Berikut adalah beberapa pasal Syarat dan Ketentuan Penggunaan. Pasal 1, Ketentuan Umum. Dengan menggunakan aplikasi ini, Anda menyatakan tunduk pada syarat dan standar prosedur yang berlaku. Pasal 2, Privasi dan Pelindungan Data. Sesuai Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi, dan Permenkes Nomor 24 Tahun 2022, seluruh data identitas pasien berstatus sangat rahasia. Membocorkan data dapat diancam pidana. Pasal 3, Validitas Kunjungan. Laporan yang Anda masukkan adalah dokumen elektronik sah secara hukum. Sistem akan merekam titik koordinat atau Jii Pii Es. Pemalsuan data adalah pelanggaran berat. Pasal 4, Mode Luring. Pastikan selalu melakukan sinkronisasi data selambat-lambatnya satu kali dua puluh empat jam jika berada di area sulit sinyal. Pasal 5, Keamanan Akses. Jangan pernah meminjamkan akun atau kata sandi kepada orang lain demi kerahasiaan rekam medis. Demikian ketentuan ini dibuat untuk ditaati dengan penuh rasa tanggung jawab. Terima kasih.`

  utterance = new SpeechSynthesisUtterance(textToRead)
  utterance.lang = 'id-ID'
  utterance.rate = 0.9 // sedikit lebih pelan agar santun
  utterance.pitch = 1.0

  const voices = synth.getVoices()
  // Cari suara wanita jika memungkinkan, atau default ID
  const idVoice = voices.find(v => (v.lang === 'id-ID' || v.lang.includes('id')) && v.name.toLowerCase().includes('female')) 
                 || voices.find(v => v.lang === 'id-ID' || v.lang.includes('id'))
                 
  if (idVoice) utterance.voice = idVoice

  utterance.onend = () => {
    ttsPlaying.value = false
  }
  utterance.onerror = () => {
    ttsPlaying.value = false
  }
  
  synth.speak(utterance)
  ttsPlaying.value = true
}

// Step 2 -- role gating pakai authStore.roles ASLI (bukan string dummyPlacement.role yang
// sebelumnya hardcode 'Kader Kesehatan' terus, jadi langkah 3/redirect tidak pernah bisa
// benar-benar dites utk role selain kader). Field tampilan lain (puskesmas, PJ Prolanis) TETAP
// placeholder -- belum ada endpoint utk resolve nama puskesmas dari puskesmas_id atau PJ
// supervisor kader dari sini, itu di luar cakupan perbaikan role-gating ini.
const authStore = useAuthStore()
const isKader = computed(() => (authStore.roles ?? []).includes('kader'))
// super_admin tidak terikat ke satu puskesmas (puskesmas_id selalu null utk role ini) -- kartu
// "Unit Kerja (Puskesmas)" di step 2 tidak relevan ditampilkan untuknya.
const isSuperAdmin = computed(() => (authStore.roles ?? []).includes('super_admin'))

const roleLabel = computed(() => resolveRolesLabel(authStore.roles))

// Unit kerja (puskesmas) & PJ Prolanis (supervisor kader) SUNGGUHAN -- sebelumnya placeholder
// statis ("Puskesmas Pamolokan"/"dr. Handoko") yang tampil sama untuk SEMUA orang berapa pun
// puskesmas_id-nya, ketahuan lewat laporan bug nyata (admin Puskesmas Ambunten yang login malah
// lihat "Pamolokan"). Puskesmas: GET /puskesmas/{id} (semua role staf boleh baca, PuskesmasPolicy
// ::view). PJ: GET /kader/profile (self-service, KADER SAJA -- endpoint ini 403 utk role lain).
const placementLoading = ref(false)
const placementError = ref('')
const placementPuskesmasName = ref('')
const placementPjName = ref('')

onMounted(async () => {
  if (isSuperAdmin.value || !authStore.user?.puskesmas_id) return
  placementLoading.value = true
  try {
    const api = useApi()
    const puskesmasRes = await api<ApiSuccessEnvelope<Puskesmas>>(`/puskesmas/${authStore.user.puskesmas_id}`)
    placementPuskesmasName.value = puskesmasRes.data.nama

    if (isKader.value) {
      const kaderRes = await api<ApiSuccessEnvelope<Kader>>('/kader/profile')
      placementPjName.value = kaderRes.data.pj?.name ?? ''
    }
  } catch (e) {
    placementError.value = e instanceof ApiError ? e.message : 'Gagal memuat data penempatan.'
  } finally {
    placementLoading.value = false
  }
})

// Step 3
const profileForm = ref({
  noWa: '',
  alamat: '',
  gender: '',
  tglLahir: ''
})

const dateInputRef = ref<HTMLInputElement | null>(null)

watch(step, async (newVal) => {
  if (newVal === 3) {
    await nextTick()
    if (dateInputRef.value) {
      flatpickr(dateInputRef.value, {
        locale: Indonesian,
        dateFormat: 'Y-m-d',
        onChange: (selectedDates, dateStr) => {
          profileForm.value.tglLahir = dateStr
        }
      })
    }
  }
})

const nextStep = () => {
  if (step.value === 1 && !agreed.value) return
  if (step.value < 3) step.value++
}

// Langkah 3 (Lengkapi Profil) SEMUA role lanjut ke sini -- SEBELUMNYA staf non-kader langsung
// menyelesaikan onboarding begitu klik "Lanjut" di step 2, tidak pernah melihat step 3 sama
// sekali (bug nyata: user melaporkan onboarding "selesai" padahal tahap profil belum diisi).
// no_wa/alamat/gender/tgl_lahir sekarang tersimpan di users utk staf (ProfileService::
// updateStaffProfile), bukan cuma kader (tabel kader) -- lihat completeOnboarding() di bawah.
const handleStep2Continue = () => {
  nextStep()
}

const isCompleting = ref(false)
const onboardingError = ref('')

// POST /auth/onboarding/complete (docs/planning/02 §14) -- SATU-SATUNYA cara onboarding_completed_at
// terisi; tanpa ini user manapun akan macet permanen di gerbang EnsureOnboardingCompleted (semua
// endpoint /dashboard & /app digerbangi middleware itu). Field profil (no_wa/alamat/gender/
// tgl_lahir) SEKARANG dipakai backend utk SEMUA role (kader -> tabel kader, staf -> tabel users,
// AuthController::completeOnboarding) -- tidak lagi diabaikan utk non-kader.
const completeOnboarding = async (skip = false) => {
  isCompleting.value = true
  onboardingError.value = ''
  try {
    const api = useApi()
    const payload: CompleteOnboardingPayload = skip
      ? {}
      : {
          no_wa: profileForm.value.noWa || undefined,
          alamat: profileForm.value.alamat || undefined,
          gender: (profileForm.value.gender || undefined) as 'L' | 'P' | undefined,
          tgl_lahir: profileForm.value.tglLahir || undefined
        }
    const res = await api<ApiSuccessEnvelope<{ user: User }>>('/auth/onboarding/complete', { method: 'POST', body: payload })
    authStore.user = res.data.user

    // Target diketik `: string` (bukan literal langsung ke navigateTo) -- TS di file ini sudah
    // rawan "excessive stack depth" saat mencocokkan literal rute ke union typed-pages yang
    // besar begitu ada lebih dari satu pemanggilan navigateTo(literal) berdekatan.
    const homePath: string = isKader.value ? '/app' : '/dashboard'
    await navigateTo(homePath)
  } catch (err) {
    onboardingError.value = err instanceof ApiError ? err.message : 'Gagal menyelesaikan onboarding. Coba lagi.'
  } finally {
    isCompleting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-surface flex flex-col items-center justify-center selection:bg-primary selection:text-white md:p-6 lg:p-8">
     <!-- Card container: full height/width on mobile, rounded card on md+ -->
     <div class="w-full h-full min-h-screen md:min-h-0 md:h-auto md:max-h-[95vh] md:max-w-4xl bg-white md:rounded-[2rem] shadow-none md:shadow-2xl md:shadow-primary/10 overflow-hidden border-0 md:border md:border-neutral-100 flex flex-col relative mx-auto my-auto transition-all">
        
        <!-- Header -->
        <div class="bg-accent text-white p-6 md:p-8 text-center relative overflow-hidden shrink-0">
           <!-- decorative bg -->
           <div class="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl pointer-events-none"></div>
           <div class="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-secondary/20 blur-3xl pointer-events-none"></div>
           
           <div class="relative z-10 flex flex-col items-center">
              <div class="bg-white p-2 rounded-2xl shadow-lg mb-4 h-16 w-16 flex items-center justify-center">
                 <img src="/logo/logo-no-text.png" alt="Logo PRODULI" class="w-full h-full object-contain" />
              </div>
              <h1 class="text-2xl md:text-3xl font-extrabold tracking-tight">Selamat Datang di PRODULI</h1>
              <p class="text-accent-200 mt-2 text-sm md:text-base max-w-sm mx-auto">Selesaikan langkah berikut untuk memulai tugas Anda dengan lancar.</p>
           </div>
           
           <!-- Progress bar with Steps -->
           <div class="mt-8 flex justify-between items-start relative z-10 max-w-xs mx-auto">
              <!-- Background line -->
              <div class="absolute top-5 md:top-7 left-0 w-full h-1 bg-accent-700 -translate-y-1/2 -z-10 rounded-full"></div>
              
              <!-- Step 1 -->
              <div class="flex flex-col items-center z-10">
                 <div class="w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center font-black text-lg transition-all duration-500 relative overflow-hidden" :class="step >= 1 ? 'bg-primary text-white shadow-[0_0_15px_rgba(0,165,154,0.5)] scale-110' : 'bg-accent-800 text-accent-400'">
                    <LucideCheck class="absolute w-6 h-6 transition-all duration-300 ease-out" :class="step > 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'" />
                    <span class="absolute transition-all duration-300 ease-out" :class="step > 1 ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-100 scale-100'">1</span>
                 </div>
                 <span class="text-[10px] md:text-xs uppercase font-bold mt-2 tracking-wide text-center" :class="step >= 1 ? 'text-primary-100' : 'text-accent-400'">Syarat</span>
              </div>
              
              <!-- Active Line 1-2 -->
              <div class="absolute top-5 md:top-7 left-[10%] h-1 bg-primary -translate-y-1/2 -z-10 transition-all duration-700 ease-in-out" :style="{ width: step >= 2 ? '40%' : '0%' }"></div>
              
              <!-- Step 2 -->
              <div class="flex flex-col items-center z-10">
                 <div class="w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center font-black text-lg transition-all duration-500 relative overflow-hidden" :class="step >= 2 ? 'bg-primary text-white shadow-[0_0_15px_rgba(0,165,154,0.5)] scale-110' : 'bg-accent-800 text-accent-400'">
                    <LucideCheck class="absolute w-6 h-6 transition-all duration-300 ease-out" :class="step > 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'" />
                    <span class="absolute transition-all duration-300 ease-out" :class="step > 2 ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-100 scale-100'">2</span>
                 </div>
                 <span class="text-[10px] md:text-xs uppercase font-bold mt-2 tracking-wide text-center" :class="step >= 2 ? 'text-primary-100' : 'text-accent-400'">Tugas</span>
              </div>

              <!-- Active Line 2-3 -->
              <div class="absolute top-5 md:top-7 left-[50%] h-1 bg-primary -translate-y-1/2 -z-10 transition-all duration-700 ease-in-out delay-150" :style="{ width: step >= 3 ? '40%' : '0%' }"></div>

              <!-- Step 3 -->
              <div class="flex flex-col items-center z-10">
                 <div class="w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center font-black text-lg transition-all duration-500 relative overflow-hidden" :class="step >= 3 ? 'bg-primary text-white shadow-[0_0_15px_rgba(0,165,154,0.5)] scale-110' : 'bg-accent-800 text-accent-400'">
                    <LucideCheck class="absolute w-6 h-6 transition-all duration-300 ease-out" :class="step > 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'" />
                    <span class="absolute transition-all duration-300 ease-out" :class="step > 3 ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-100 scale-100'">3</span>
                 </div>
                 <span class="text-[10px] md:text-xs uppercase font-bold mt-2 tracking-wide text-center" :class="step >= 3 ? 'text-primary-100' : 'text-accent-400'">Profil</span>
              </div>
           </div>
        </div>

        <!-- Content Area -->
        <div class="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
           
           <!-- Step 1 -->
           <div v-if="step === 1" class="flex flex-col flex-1 p-6 md:p-8 lg:p-10 h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div class="flex items-center justify-between mb-4">
                 <h2 class="text-xl md:text-2xl font-bold text-accent">Syarat & Ketentuan</h2>
                 
                 <!-- TTS Button -->
                 <button v-if="ttsSupported" @click="toggleTTS" class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border" :class="ttsPlaying ? 'bg-primary/10 text-primary border-primary/20' : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'">
                    <LucideVolume2 v-if="!ttsPlaying" class="w-4 h-4" />
                    <LucideVolumeX v-else class="w-4 h-4" />
                    {{ ttsPlaying ? 'Hentikan Suara' : 'Bacakan Teks' }}
                 </button>
              </div>

              <!-- Scrollable ToS Area -->
              <div 
                 ref="tosScrollContainer"
                 @scroll="onToSScroll"
                 class="bg-surface rounded-xl border border-neutral-200 p-5 h-64 md:h-[35vh] overflow-y-auto mb-6 shadow-inner relative"
              >
                 <OnboardingTermsOfService />
              </div>

              <div class="mt-auto">
                 <label class="flex items-start gap-3 p-4 border rounded-xl transition group mb-6 shrink-0" 
                    :class="hasReadToS ? 'cursor-pointer border-neutral-200 hover:bg-neutral-50' : 'cursor-not-allowed border-neutral-100 bg-neutral-50/50 opacity-80'">
                    <input 
                       type="checkbox" 
                       v-model="agreed" 
                       :disabled="!hasReadToS"
                       class="mt-1 h-5 w-5 rounded border-neutral-300 text-primary focus:ring-primary transition" 
                       :class="hasReadToS ? 'cursor-pointer group-hover:border-primary' : 'cursor-not-allowed'"
                    />
                    <div>
                       <span class="text-sm font-medium leading-relaxed block transition" :class="hasReadToS ? 'text-neutral-700 group-hover:text-neutral-900' : 'text-neutral-500'">
                          Saya telah membaca, memahami, dan menyetujui seluruh Syarat & Ketentuan penggunaan aplikasi PRODULI.
                       </span>
                       <span v-if="!hasReadToS" class="text-xs text-danger font-semibold mt-1 block">
                          * Gulir (scroll) teks persyaratan hingga ke bawah untuk menyetujui.
                       </span>
                    </div>
                 </label>
                 
                 <div class="flex justify-center w-full shrink-0 pb-2 mt-2">
                    <UButton 
                       size="xl" 
                       @click="agreed ? nextStep() : null" 
                       class="w-full sm:w-auto px-12 py-4 rounded-2xl shadow-lg transition-all flex justify-center text-center text-lg md:text-xl font-extrabold uppercase tracking-wide" 
                       :class="agreed ? 'bg-primary hover:bg-primary-600 shadow-primary/30 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer' : '!bg-neutral-300 !text-neutral-500 hover:!bg-neutral-300 cursor-not-allowed !shadow-none'"
                    >
                       Setuju & Lanjut
                    </UButton>
                 </div>
              </div>
           </div>

           <!-- Step 2 -->
           <div v-else-if="step === 2" class="flex flex-col flex-1 p-6 md:p-8 lg:p-10 h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 class="text-xl md:text-2xl font-bold text-accent mb-2">Konfirmasi Penempatan</h2>
              <p class="text-neutral-600 mb-6 text-sm md:text-base">Berikut adalah data penempatan tugas Anda saat ini.</p>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
                 <div class="bg-surface p-4 rounded-xl border border-neutral-100 flex items-center gap-4 transition hover:border-primary/30 shadow-xs">
                    <div class="h-12 w-12 md:h-14 md:w-14 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 border border-primary/20 shadow-sm">
                       <LucideUser class="h-6 w-6 md:h-7 md:w-7 text-primary" />
                    </div>
                    <div class="overflow-hidden">
                       <p class="text-[11px] md:text-xs text-neutral-500 font-bold uppercase tracking-wider mb-0.5">Nama Pengguna</p>
                       <p class="font-extrabold text-accent text-lg md:text-xl truncate">{{ authStore.user?.name ?? '...' }}</p>
                       <p class="text-sm text-neutral-500 truncate">{{ authStore.user?.email ?? '...' }}</p>
                    </div>
                 </div>

                 <div class="bg-surface p-4 rounded-xl border border-neutral-100 flex items-center gap-4 transition hover:border-warning/30 shadow-xs">
                    <div class="h-12 w-12 md:h-14 md:w-14 bg-warning/10 rounded-xl flex items-center justify-center shrink-0 border border-warning/20 shadow-sm">
                       <LucideBriefcase class="h-6 w-6 md:h-7 md:w-7 text-warning-600" />
                    </div>
                    <div>
                       <p class="text-[11px] md:text-xs text-neutral-500 font-bold uppercase tracking-wider mb-0.5">Posisi Pengguna</p>
                       <p class="font-extrabold text-accent text-lg md:text-xl">{{ roleLabel }}</p>
                    </div>
                 </div>

                 <div v-if="!isSuperAdmin" class="bg-surface p-4 rounded-xl border border-neutral-100 flex items-center gap-4 transition hover:border-secondary/30 shadow-xs">
                    <div class="h-12 w-12 md:h-14 md:w-14 bg-secondary/10 rounded-xl flex items-center justify-center shrink-0 border border-secondary/20 shadow-sm">
                       <LucideMapPin class="h-6 w-6 md:h-7 md:w-7 text-secondary-600" />
                    </div>
                    <div>
                       <p class="text-[11px] md:text-xs text-neutral-500 font-bold uppercase tracking-wider mb-0.5">Unit Kerja (Puskesmas)</p>
                       <p class="font-extrabold text-accent text-lg md:text-xl">{{ placementLoading ? 'Memuat...' : (placementPuskesmasName || '-') }}</p>
                    </div>
                 </div>

                 <div v-if="isKader" class="bg-surface p-4 rounded-xl border border-neutral-100 flex items-center gap-4 transition hover:border-info/30 shadow-xs">
                    <div class="h-12 w-12 md:h-14 md:w-14 bg-info/10 rounded-xl flex items-center justify-center shrink-0 border border-info/20 shadow-sm">
                       <LucideStethoscope class="h-6 w-6 md:h-7 md:w-7 text-info-600" />
                    </div>
                    <div>
                       <p class="text-[11px] md:text-xs text-neutral-500 font-bold uppercase tracking-wider mb-0.5">PJ Prolanis (Supervisor)</p>
                       <p class="font-extrabold text-accent text-lg md:text-xl">{{ placementLoading ? 'Memuat...' : (placementPjName || '-') }}</p>
                    </div>
                 </div>
              </div>
              <p v-if="placementError" class="text-sm font-semibold text-danger text-center mb-4">{{ placementError }}</p>

              <div class="mt-auto">
                 <div class="bg-warning/10 p-5 rounded-2xl flex items-start gap-4 border border-warning/20 mb-8 shadow-sm">
                    <LucideAlertCircle class="h-6 w-6 text-warning-600 shrink-0 mt-0.5" />
                    <div class="text-sm md:text-base text-warning-800 font-medium leading-relaxed">
                       <template v-if="isKader">
                          Kalau data ini keliru, segera hubungi <strong>PJ Prolanis</strong> atau <strong>Admin Puskesmas</strong> Anda. Anda tidak dapat mengubah data penugasan ini secara mandiri.
                       </template>
                       <template v-else>
                          Kalau data ini keliru, segera hubungi <strong>Administrator Kabupaten</strong>. Anda tidak dapat mengubah data penugasan ini secara mandiri.
                          <div class="mt-3 flex flex-wrap gap-3">
                             <a href="mailto:labkesmassumenep@gmail.com?subject=Revisi%20Data%20Penugasan%20PRODULI" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-warning/30 rounded-lg text-sm text-warning-700 hover:bg-warning/5 transition-colors shadow-xs font-bold">
                                <LucideMail class="w-4 h-4" /> Email Admin
                             </a>
                             <a href="https://wa.me/6281234567890?text=Halo%20Admin%20PRODULI,%20saya%20menemukan%20kekeliruan%20pada%20data%20penugasan%20saya%20di%20aplikasi." target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-warning/30 rounded-lg text-sm text-warning-700 hover:bg-warning/5 transition-colors shadow-xs font-bold">
                                <LucideMessageCircle class="w-4 h-4" /> WhatsApp
                             </a>
                          </div>
                       </template>
                    </div>
                 </div>

                 <p v-if="onboardingError" class="text-sm font-semibold text-danger text-center mb-4">{{ onboardingError }}</p>
                 <div class="flex justify-center w-full pb-2">
                    <UButton
                       size="xl"
                       @click="handleStep2Continue"
                       class="w-full sm:w-auto px-12 py-4 cursor-pointer rounded-2xl shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:-translate-y-0.5 flex justify-center text-center text-lg md:text-xl font-extrabold uppercase tracking-wide bg-primary hover:bg-primary-600"
                    >
                       Data Sesuai, Lanjut
                    </UButton>
                 </div>
              </div>
           </div>

           <!-- Step 3 -->
           <div v-else-if="step === 3" class="flex flex-col flex-1 p-6 md:p-8 lg:p-10 h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 class="text-xl md:text-2xl font-bold text-accent mb-2">Lengkapi Profil</h2>
              <p class="text-neutral-600 mb-6 text-sm md:text-base">Lengkapi data diri Anda untuk memudahkan komunikasi dan administrasi. Anda dapat melengkapinya nanti.</p>
              
              <div class="space-y-6 mb-8 pr-2">
                 <UFormField label="Nomor WhatsApp" name="noWa" size="xl" class="text-base font-medium">
                    <UInput v-model="profileForm.noWa" placeholder="Contoh: 08123456789" type="tel" size="xl" class="w-full cursor-pointer text-base md:text-lg h-12">
                       <template #leading>
                          <LucidePhone class="h-6 w-6 text-neutral-400" />
                       </template>
                    </UInput>
                 </UFormField>
                 
                 <UFormField label="Alamat Lengkap" name="alamat" size="xl" class="text-base font-medium">
                    <UTextarea v-model="profileForm.alamat" placeholder="Masukkan alamat domisili..." :rows="3" size="xl" class="w-full cursor-pointer text-base md:text-lg" />
                 </UFormField>

                 <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <UFormField label="Jenis Kelamin" name="gender" size="xl" class="text-base font-medium">
                       <select v-model="profileForm.gender" class="w-full h-12 px-3 py-2 bg-white border border-neutral-300 rounded-lg shadow-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-base md:text-lg text-neutral-700 cursor-pointer font-medium">
                          <option value="" disabled>Pilih...</option>
                          <option value="L">Laki-laki</option>
                          <option value="P">Perempuan</option>
                       </select>
                    </UFormField>
                    
                    <UFormField label="Tanggal Lahir" name="tglLahir" size="xl" class="text-base font-medium">
                       <div class="relative w-full">
                          <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10">
                             <LucideCalendar class="h-5 w-5 text-neutral-400" />
                          </div>
                          <input 
                             ref="dateInputRef" 
                             v-model="profileForm.tglLahir" 
                             type="text" 
                             placeholder="Pilih tanggal lahir" 
                             class="w-full h-12 pl-10 pr-3 py-2 bg-white border border-neutral-300 rounded-lg shadow-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-base md:text-lg text-neutral-700 cursor-pointer font-medium"
                          />
                       </div>
                    </UFormField>
                 </div>
              </div>

              <p v-if="onboardingError" class="text-sm font-semibold text-danger text-center mb-2">{{ onboardingError }}</p>
              <div class="mt-auto flex flex-col sm:flex-row justify-center items-center gap-4 shrink-0 w-full pb-2 pt-4">
                 <UButton variant="ghost" color="neutral" size="xl" :disabled="isCompleting" @click="completeOnboarding(true)" class="w-full sm:w-auto px-8 py-4 cursor-pointer hover:bg-neutral-100 text-neutral-600 font-bold transition-colors rounded-2xl text-center flex justify-center text-base md:text-lg">Lengkapi Nanti</UButton>
                 <UButton size="xl" :loading="isCompleting" :disabled="isCompleting" @click="completeOnboarding(false)" class="w-full sm:w-auto px-12 py-4 cursor-pointer rounded-2xl shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:-translate-y-0.5 flex justify-center text-center text-lg md:text-xl font-extrabold uppercase tracking-wide bg-primary hover:bg-primary-600">Simpan & Selesai</UButton>
              </div>
           </div>
        </div>
     </div>
  </div>
</template>
