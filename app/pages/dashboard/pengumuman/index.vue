<script setup lang="ts">
import * as icons from '#components'
import {
  LucideMegaphone, LucideSend, LucideTrash2, LucideLoader2, LucideImage,
  LucideLink, LucideSquareMousePointer, LucideUsers, LucideEye, LucideSearch,
  LucideCheck
} from '#components'
import type { Announcement, AnnouncementColor, AnnouncementUrgency, ApiSuccessEnvelope, CreateAnnouncementPayload, PaginatedData, Role } from '~/types/api'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Buat Pengumuman' })

// Gerbang halaman: SystemAnnouncementPolicy::create() backend cuma super_admin -- redirect
// sopan (bukan 403 mentah) kalau role lain nyasar ke sini lewat URL langsung.
const authStore = useAuthStore()
const isSuperAdmin = computed(() => (authStore.roles ?? []).includes('super_admin'))
onMounted(() => {
  if (!isSuperAdmin.value) navigateTo('/dashboard')
})

// --- Daftar ikon kurasi -- "daftar icon" yang diminta user, BUKAN pencarian atas SELURUH
// ikon Lucide yang ter-auto-import (~1500 ikon, tidak praktis dienumerasi runtime) -- kurasi
// yang relevan konteks pengumuman Dinkes/Puskesmas (info umum, kesehatan, acara, teknis). ---
const ICON_CHOICES = [
  'LucideMegaphone', 'LucideInfo', 'LucideAlertTriangle', 'LucideSiren', 'LucideBell',
  'LucideCalendar', 'LucideCalendarClock', 'LucideWrench', 'LucidePartyPopper', 'LucideGift',
  'LucideHeart', 'LucideStar', 'LucideRocket', 'LucideShield', 'LucideShieldCheck',
  'LucideCircleCheck', 'LucideCircleX', 'LucideClock', 'LucideZap', 'LucideTrendingUp',
  'LucideUsers', 'LucideFileText', 'LucideStethoscope', 'LucideSyringe', 'LucidePill',
  'LucideHospital', 'LucideSparkles', 'LucideAward', 'LucideFlag', 'LucideLightbulb',
  'LucideSun', 'LucideCloudRain', 'LucideMapPin', 'LucidePhone', 'LucideMail',
  'LucideLock', 'LucideTrophy', 'LucideTarget', 'LucideRss', 'LucideBookOpen'
]
const iconSearch = ref('')
const filteredIcons = computed(() => {
  if (!iconSearch.value.trim()) return ICON_CHOICES
  const q = iconSearch.value.trim().toLowerCase()
  return ICON_CHOICES.filter((i) => i.replace('Lucide', '').toLowerCase().includes(q))
})
function iconComponent(name: string) {
  return (icons as Record<string, unknown>)[name] ?? LucideMegaphone
}

const COLOR_CHOICES: AnnouncementColor[] = ['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'accent']

const ROLE_CHOICES: { value: Role, label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin_puskesmas', label: 'Admin Puskesmas' },
  { value: 'pj_prolanis', label: 'PJ Prolanis' },
  { value: 'kader', label: 'Kader' },
  { value: 'tenaga_kesehatan', label: 'Tenaga Kesehatan' }
]

// --- Form ---
const form = ref({
  title: '',
  description: '',
  urgency: 'info' as AnnouncementUrgency,
  icon: null as string | null,
  color: null as AnnouncementColor | null,
  image_url: '',
  button_label: '',
  button_url: '',
  targetAll: true,
  target_roles: [] as Role[]
})

// Preview pakai default urgency kalau icon/color belum dipilih manual -- SAMA PERSIS logika
// announcementColorOf()/announcementIconOf() yang dipakai modal/feed sungguhan, supaya preview
// di sini benar-benar mewakili tampilan aslinya.
const previewAnnouncement = computed<Pick<Announcement, 'title' | 'description' | 'urgency' | 'icon' | 'color' | 'image_url' | 'button_label' | 'button_url' | 'posted_by'>>(() => ({
  title: form.value.title || 'Judul pengumuman...',
  description: form.value.description || 'Isi pengumuman akan tampil di sini...',
  urgency: form.value.urgency,
  icon: form.value.icon,
  color: form.value.color,
  image_url: form.value.image_url || null,
  button_label: form.value.button_label || null,
  button_url: form.value.button_url || null,
  posted_by: { id: authStore.user?.id ?? 0, name: authStore.user?.name ?? 'Anda' }
}))

function toggleRole(role: Role) {
  const idx = form.value.target_roles.indexOf(role)
  if (idx === -1) form.value.target_roles.push(role)
  else form.value.target_roles.splice(idx, 1)
}

const isSubmitting = ref(false)
const submitError = ref('')
const fieldErrors = ref<Record<string, string[]>>({})

function resetForm() {
  form.value = {
    title: '', description: '', urgency: 'info', icon: null, color: null,
    image_url: '', button_label: '', button_url: '', targetAll: true, target_roles: []
  }
}

async function submit() {
  isSubmitting.value = true
  submitError.value = ''
  fieldErrors.value = {}
  try {
    const api = useApi()
    const payload: CreateAnnouncementPayload = {
      title: form.value.title.trim(),
      description: form.value.description.trim(),
      urgency: form.value.urgency,
      icon: form.value.icon,
      color: form.value.color,
      image_url: form.value.image_url.trim() || null,
      button_label: form.value.button_label.trim() || null,
      button_url: form.value.button_url.trim() || null,
      target_roles: form.value.targetAll ? null : form.value.target_roles
    }
    await api('/announcements', { method: 'POST', body: payload })
    resetForm()
    await loadList()
  } catch (e) {
    if (e instanceof ApiError) {
      submitError.value = e.message
      fieldErrors.value = e.errors ?? {}
    } else {
      submitError.value = 'Gagal membuat pengumuman.'
    }
  } finally {
    isSubmitting.value = false
  }
}

// --- Daftar pengumuman (riwayat, format stack "|- [urgensi] Judul") ---
const list = ref<Announcement[]>([])
const isLoadingList = ref(false)
const listError = ref('')

async function loadList() {
  isLoadingList.value = true
  listError.value = ''
  try {
    const api = useApi()
    const res = await api('/announcements', { query: { per_page: 50 } }) as ApiSuccessEnvelope<PaginatedData<Announcement>>
    list.value = res.data.items
  } catch (e) {
    listError.value = e instanceof ApiError ? e.message : 'Gagal memuat daftar pengumuman.'
  } finally {
    isLoadingList.value = false
  }
}

const deletingId = ref<number | null>(null)
async function deleteAnnouncement(a: Announcement) {
  if (!confirm(`Hapus pengumuman "${a.title}"? Tindakan ini tidak bisa dibatalkan.`)) return
  deletingId.value = a.id
  try {
    const api = useApi()
    await api(`/announcements/${a.id}`, { method: 'DELETE' })
    list.value = list.value.filter((x) => x.id !== a.id)
  } catch (e) {
    alert(e instanceof ApiError ? e.message : 'Gagal menghapus pengumuman.')
  } finally {
    deletingId.value = null
  }
}

function targetLabel(a: Announcement): string {
  if (!a.target_roles || a.target_roles.length === 0) return 'Semua Role'
  return a.target_roles.map((r) => ROLE_CHOICES.find((rc) => rc.value === r)?.label ?? r).join(', ')
}

onMounted(loadList)
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 md:px-6 py-8">
    <div class="flex items-center gap-3 mb-8">
      <div class="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <LucideMegaphone class="w-5.5 h-5.5" />
      </div>
      <div>
        <h1 class="text-xl font-bold text-accent dark:text-white">Buat Pengumuman</h1>
        <p class="text-sm text-slate-500">Pengumuman tampil di dashboard penerima &amp; modal saat pertama login.</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <!-- ===== FORM (editor) ===== -->
      <div class="lg:col-span-3 space-y-5">
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 space-y-5">
          <p v-if="submitError" class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">{{ submitError }}</p>

          <div>
            <label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Judul</label>
            <input v-model="form.title" type="text" maxlength="150" placeholder="Judul pengumuman..."
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
            <p v-if="fieldErrors.title" class="text-xs text-danger mt-1">{{ fieldErrors.title[0] }}</p>
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              Isi Pengumuman
              <span class="normal-case font-medium text-slate-400">(dukung **tebal** dan [label](https://url) untuk tautan)</span>
            </label>
            <textarea v-model="form.description" rows="5" placeholder="Tulis isi pengumuman di sini..."
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" />
            <p v-if="fieldErrors.description" class="text-xs text-danger mt-1">{{ fieldErrors.description[0] }}</p>
          </div>

          <!-- Tingkat urgensi -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Tingkat Urgensi</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="(meta, key) in URGENCY_META" :key="key" type="button"
                @click="form.urgency = key as AnnouncementUrgency"
                class="rounded-2xl border-2 p-3 text-left transition-colors"
                :class="form.urgency === key
                  ? [ANNOUNCEMENT_COLOR_CLASSES[meta.color].border, ANNOUNCEMENT_COLOR_CLASSES[meta.color].bg]
                  : 'border-slate-100 dark:border-slate-700 hover:border-slate-200'"
              >
                <span class="text-sm font-bold" :class="form.urgency === key ? ANNOUNCEMENT_COLOR_CLASSES[meta.color].text : 'text-accent dark:text-white'">{{ meta.label }}</span>
                <p class="text-[11px] text-slate-400 mt-0.5 leading-snug">{{ meta.description }}</p>
              </button>
            </div>
            <p v-if="fieldErrors.urgency" class="text-xs text-danger mt-1">{{ fieldErrors.urgency[0] }}</p>
          </div>

          <!-- Ikon -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Ikon Notifikasi</label>
            <div class="relative mb-2">
              <LucideSearch class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input v-model="iconSearch" type="text" placeholder="Cari ikon..."
                class="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20">
            </div>
            <div class="grid grid-cols-8 sm:grid-cols-10 gap-1.5 max-h-36 overflow-y-auto p-1">
              <button
                v-for="name in filteredIcons" :key="name" type="button"
                @click="form.icon = name"
                class="aspect-square rounded-xl flex items-center justify-center border transition-colors"
                :class="form.icon === name ? 'border-primary bg-primary/10 text-primary' : 'border-slate-100 dark:border-slate-700 text-slate-400 hover:border-slate-300'"
                :title="name.replace('Lucide', '')"
              >
                <component :is="iconComponent(name)" class="w-4 h-4" />
              </button>
            </div>
            <p class="text-[11px] text-slate-400 mt-1">Kosongkan untuk pakai ikon default sesuai tingkat urgensi.</p>
          </div>

          <!-- Warna -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Warna</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="c in COLOR_CHOICES" :key="c" type="button"
                @click="form.color = c"
                class="w-9 h-9 rounded-full flex items-center justify-center ring-2 ring-offset-2 dark:ring-offset-slate-900 transition-all"
                :class="[ANNOUNCEMENT_COLOR_CLASSES[c].solidBg, form.color === c ? 'ring-slate-400' : 'ring-transparent']"
              >
                <LucideCheck v-if="form.color === c" class="w-4 h-4 text-white" />
              </button>
            </div>
            <p class="text-[11px] text-slate-400 mt-1.5">Kosongkan untuk pakai warna default sesuai tingkat urgensi.</p>
          </div>

          <!-- Gambar & tombol -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                <LucideImage class="w-3.5 h-3.5" /> URL Gambar (opsional)
              </label>
              <input v-model="form.image_url" type="url" placeholder="https://..."
                class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20">
              <p v-if="fieldErrors.image_url" class="text-xs text-danger mt-1">{{ fieldErrors.image_url[0] }}</p>
            </div>
            <div>
              <label class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                <LucideSquareMousePointer class="w-3.5 h-3.5" /> Label Tombol (opsional)
              </label>
              <input v-model="form.button_label" type="text" maxlength="60" placeholder="Mis. Lihat Detail"
                class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20">
              <p v-if="fieldErrors.button_label" class="text-xs text-danger mt-1">{{ fieldErrors.button_label[0] }}</p>
            </div>
            <div class="sm:col-span-2">
              <label class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                <LucideLink class="w-3.5 h-3.5" /> Tautan Tombol (opsional, wajib kalau label diisi)
              </label>
              <input v-model="form.button_url" type="url" placeholder="https://..."
                class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20">
              <p v-if="fieldErrors.button_url" class="text-xs text-danger mt-1">{{ fieldErrors.button_url[0] }}</p>
            </div>
          </div>

          <!-- Target role -->
          <div>
            <label class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
              <LucideUsers class="w-3.5 h-3.5" /> Tampilkan Untuk
            </label>
            <label class="flex items-center gap-2 mb-2 cursor-pointer">
              <input v-model="form.targetAll" type="checkbox" class="rounded border-slate-300 text-primary focus:ring-primary/30">
              <span class="text-sm font-semibold text-accent dark:text-white">Semua Role</span>
            </label>
            <div v-if="!form.targetAll" class="flex flex-wrap gap-2 pl-6">
              <button
                v-for="r in ROLE_CHOICES" :key="r.value" type="button"
                @click="toggleRole(r.value)"
                class="rounded-full px-3 py-1.5 text-xs font-bold border transition-colors"
                :class="form.target_roles.includes(r.value) ? 'bg-primary text-white border-primary' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'"
              >
                {{ r.label }}
              </button>
            </div>
            <p v-if="fieldErrors.target_roles" class="text-xs text-danger mt-1">{{ fieldErrors.target_roles[0] }}</p>
          </div>

          <button
            type="button" :disabled="isSubmitting || !form.title.trim() || !form.description.trim()"
            @click="submit"
            class="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LucideLoader2 v-if="isSubmitting" class="w-4 h-4 animate-spin" />
            <LucideSend v-else class="w-4 h-4" />
            {{ isSubmitting ? 'Menerbitkan...' : 'Terbitkan Pengumuman' }}
          </button>
        </div>
      </div>

      <!-- ===== PREVIEW LIVE ===== -->
      <div class="lg:col-span-2">
        <div class="sticky top-6">
          <div class="flex items-center gap-1.5 mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <LucideEye class="w-3.5 h-3.5" /> Pratinjau (tampilan di modal penerima)
          </div>
          <div
            class="rounded-2xl border p-5"
            :class="[ANNOUNCEMENT_COLOR_CLASSES[announcementColorOf(previewAnnouncement)].border, 'bg-white dark:bg-slate-900']"
          >
            <div class="flex items-start gap-3">
              <div
                class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                :class="[ANNOUNCEMENT_COLOR_CLASSES[announcementColorOf(previewAnnouncement)].bg, ANNOUNCEMENT_COLOR_CLASSES[announcementColorOf(previewAnnouncement)].text]"
              >
                <component :is="iconComponent(announcementIconOf(previewAnnouncement))" class="w-5 h-5" />
              </div>
              <div class="min-w-0 flex-1">
                <span
                  class="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full inline-block mb-1.5"
                  :class="[ANNOUNCEMENT_COLOR_CLASSES[announcementColorOf(previewAnnouncement)].bg, ANNOUNCEMENT_COLOR_CLASSES[announcementColorOf(previewAnnouncement)].text]"
                >
                  {{ URGENCY_META[previewAnnouncement.urgency].label }}
                </span>
                <h3 class="font-bold text-accent dark:text-white mb-1.5">{{ previewAnnouncement.title }}</h3>
                <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed" v-html="formatAnnouncementBody(previewAnnouncement.description)" />
                <img v-if="previewAnnouncement.image_url" :src="previewAnnouncement.image_url" alt="" class="mt-3 rounded-xl max-h-40 w-full object-cover border border-slate-100">
                <span
                  v-if="previewAnnouncement.button_label"
                  class="mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white"
                  :class="ANNOUNCEMENT_COLOR_CLASSES[announcementColorOf(previewAnnouncement)].solidBg"
                >
                  {{ previewAnnouncement.button_label }}
                </span>
              </div>
            </div>
          </div>
          <p class="text-[11px] text-slate-400 mt-2 px-1">
            Target: {{ form.targetAll ? 'Semua Role' : (form.target_roles.length ? form.target_roles.join(', ') : 'Belum dipilih') }}
          </p>
        </div>
      </div>
    </div>

    <!-- ===== Riwayat pengumuman (stack tree) ===== -->
    <div class="mt-10">
      <h2 class="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">Riwayat Pengumuman</h2>
      <p v-if="listError" class="text-xs font-semibold text-danger mb-3">{{ listError }}</p>
      <div v-if="isLoadingList" class="flex justify-center py-8">
        <LucideLoader2 class="w-5 h-5 animate-spin text-slate-300" />
      </div>
      <p v-else-if="!list.length" class="text-sm text-slate-400 text-center py-8">Belum ada pengumuman.</p>
      <div v-else class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
        <div v-for="a in list" :key="a.id" class="flex items-start gap-3 px-5 py-3.5">
          <span class="text-slate-300 dark:text-slate-600 font-mono text-sm mt-0.5 shrink-0">|-</span>
          <component :is="iconComponent(announcementIconOf(a))" class="w-4 h-4 mt-1 shrink-0" :class="ANNOUNCEMENT_COLOR_CLASSES[announcementColorOf(a)].text" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span
                class="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                :class="[ANNOUNCEMENT_COLOR_CLASSES[announcementColorOf(a)].bg, ANNOUNCEMENT_COLOR_CLASSES[announcementColorOf(a)].text]"
              >
                {{ URGENCY_META[a.urgency].label }}
              </span>
              <span class="font-bold text-sm text-accent dark:text-white truncate">{{ a.title }}</span>
              <span v-if="a.is_read === false" class="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-danger/10 text-danger">Baru</span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">
              {{ targetLabel(a) }} &middot; {{ a.posted_by?.name ?? 'Sistem' }} &middot; {{ a.created_at ? new Date(a.created_at).toLocaleString('id-ID') : '-' }}
            </p>
          </div>
          <button
            type="button" :disabled="deletingId === a.id"
            @click="deleteAnnouncement(a)"
            class="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
            title="Hapus pengumuman"
          >
            <LucideLoader2 v-if="deletingId === a.id" class="w-4 h-4 animate-spin" />
            <LucideTrash2 v-else class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
