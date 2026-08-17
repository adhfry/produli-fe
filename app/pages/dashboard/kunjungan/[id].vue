<script setup lang="ts">
import type { ApiSuccessEnvelope, VisitAssignment, Patient } from '~/types/api'

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth'
})

// Halaman detail TERPISAH (revisi Bu Kadis) -- extends dashboard/kunjungan/index.vue: bukti
// foto, data pasien lengkap, data kader/nakes, SEMUA input form kunjungan dimunculkan. Modal
// "Detail Laporan Kunjungan" di index.vue TETAP ADA (fokus alur kerja terima/validasi laporan),
// halaman ini murni tampilan lengkap read-only + link balik.
const route = useRoute()
const assignmentId = computed(() => Number(route.params.id))

const assignment = ref<VisitAssignment | null>(null)
const patient = ref<Patient | null>(null)
const isLoading = ref(true)
const loadError = ref('')

async function loadDetail() {
  isLoading.value = true
  loadError.value = ''
  try {
    const api = useApi()
    const res = await api(`/visit-assignments/${assignmentId.value}`) as ApiSuccessEnvelope<VisitAssignment>
    assignment.value = res.data

    // Data pasien di VisitAssignmentResource SENGAJA minimal (alamat/phone/lat-lng/geo_status
    // saja, dipakai peta kader) -- fetch penuh terpisah (NIK/gender/usia/kecamatan-desa/risiko/
    // No BPJS dst, PatientResource yang sudah lengkap) supaya tidak menduplikasi shaping data
    // pasien di 2 resource berbeda.
    if (res.data.patient?.id) {
      const patientRes = await api(`/patients/${res.data.patient.id}`) as ApiSuccessEnvelope<Patient>
      patient.value = patientRes.data
    }
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Gagal memuat detail kunjungan.'
  } finally {
    isLoading.value = false
  }
}
onMounted(loadDetail)

useHead(() => ({ title: assignment.value?.patient?.nama ? `Kunjungan ${assignment.value.patient.nama}` : 'Detail Kunjungan' }))

// Label SAMA PERSIS dashboard/pasien/[id].vue -- konsistensi tampilan di seluruh dashboard.
const TINDAKAN_LABELS: Record<string, string> = {
  diberi_obat: 'Diberi Obat', dirujuk_puskesmas: 'Dirujuk ke Puskesmas', tidak_ada: 'Tidak Ada Tindakan'
}
const CARA_RUJUKAN_LABELS: Record<string, string> = {
  datang_sendiri: 'Datang Sendiri', dijemput_ambulan: 'Dijemput Ambulan',
  diantar_keluarga: 'Diantar Keluarga', diantar_nakes_kader: 'Diantar Nakes/Kader'
}
const KEPATUHAN_OBAT_LABELS: Record<string, string> = {
  patuh: 'Patuh', kurang_patuh: 'Kurang Patuh', tidak_patuh: 'Tidak Patuh'
}
const SISA_OBAT_LABELS: Record<string, string> = {
  cukup: 'Cukup', menipis: 'Menipis', habis: 'Habis'
}
const STATUS_LABELS: Record<string, string> = {
  pending: 'Belum Dikunjungi', in_progress: 'Sedang Proses', completed: 'Selesai', cancelled: 'Dibatalkan'
}
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600 border border-slate-200',
  in_progress: 'bg-info/10 text-info border border-info/20',
  completed: 'bg-success/10 text-success border border-success/20',
  cancelled: 'bg-danger/10 text-danger border border-danger/20'
}
const PRIORITY_LABELS: Record<string, string> = { ringan: 'Ringan', sedang: 'Sedang', berat: 'Berat' }
const PRIORITY_COLORS: Record<string, string> = {
  ringan: 'bg-success/10 text-success border border-success/20',
  sedang: 'bg-warning/10 text-warning border border-warning/20',
  berat: 'bg-danger/10 text-danger border border-danger/20'
}
const VALIDATION_STATUS_LABELS: Record<string, string> = {
  pending: 'Menunggu Validasi', valid: 'Tervalidasi', invalid: 'Ditolak'
}
const VALIDATION_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-warning/10 text-warning border border-warning/20',
  valid: 'bg-success/10 text-success border border-success/20',
  invalid: 'bg-danger/10 text-danger border border-danger/20'
}

function formatTindakan(tindakan: string[] | null): string {
  return (tindakan ?? []).map((t) => TINDAKAN_LABELS[t] ?? t).join(', ')
}

function calculateAge(dob: string | null): number | null {
  if (!dob) return null
  const diffMs = Date.now() - new Date(dob).getTime()
  return Math.abs(new Date(diffMs).getUTCFullYear() - 1970)
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

// No BPJS sama persis No. Registrasi -- kemungkinan staf labkesda copas (bukan No BPJS asli),
// SAMA logic dgn dashboard/pasien/index.vue::isNoBpjsSuspicious().
const isNoBpjsSuspicious = computed(() => !!patient.value?.no_bpjs && patient.value.no_bpjs === patient.value.no_reg)

const petugasLabel = computed(() => (assignment.value?.tenaga_kesehatan ? 'Tenaga Kesehatan' : 'Kader'))
const petugasName = computed(() => assignment.value?.tenaga_kesehatan?.name ?? assignment.value?.kader?.name ?? '-')
const petugasPhone = computed(() => assignment.value?.tenaga_kesehatan?.no_hp ?? assignment.value?.kader?.no_hp ?? null)
</script>

<template>
  <div class="space-y-6">
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
      <NuxtLink to="/dashboard" class="hover:text-primary transition-colors">Dashboard</NuxtLink>
      <LucideChevronRight class="w-3 h-3" />
      <NuxtLink to="/dashboard/kunjungan" class="hover:text-primary transition-colors">Data Kunjungan</NuxtLink>
      <LucideChevronRight class="w-3 h-3" />
      <span class="text-slate-600">Detail</span>
    </div>

    <div v-if="isLoading" class="bg-white rounded-2xl border border-slate-100 shadow-card py-16 text-center text-slate-400">
      <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
      Memuat detail kunjungan...
    </div>

    <div v-else-if="loadError" class="bg-white rounded-2xl border border-slate-100 shadow-card py-16 text-center">
      <LucideAlertTriangle class="w-8 h-8 mx-auto mb-3 text-danger" />
      <p class="text-sm font-semibold text-danger">{{ loadError }}</p>
      <NuxtLink to="/dashboard/kunjungan" class="inline-block mt-4 text-sm font-bold text-primary hover:underline">← Kembali ke Data Kunjungan</NuxtLink>
    </div>

    <template v-else-if="assignment">
      <!-- Header -->
      <div class="bg-white rounded-2xl border border-slate-100 shadow-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-extrabold text-accent">{{ assignment.patient?.nama ?? 'Pasien Tidak Diketahui' }}</h1>
          <p class="text-sm text-slate-500 mt-1">Kunjungan dijadwalkan {{ assignment.scheduled_date }} &bull; {{ petugasLabel }}: {{ petugasName }}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider" :class="STATUS_COLORS[assignment.status]">
            {{ STATUS_LABELS[assignment.status] ?? assignment.status }}
          </span>
          <span class="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider" :class="PRIORITY_COLORS[assignment.priority]">
            Risiko {{ PRIORITY_LABELS[assignment.priority] ?? assignment.priority }}
          </span>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Data Pasien -->
        <div class="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <div class="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <LucideHeartPulse class="w-4 h-4 text-primary" />
            <h2 class="font-bold text-accent text-sm">Data Pasien</h2>
          </div>
          <div v-if="patient" class="p-5 space-y-3 text-sm">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">NIK</p>
                <p class="font-semibold text-slate-700">{{ patient.nik }}</p>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">No. Registrasi</p>
                <p class="font-semibold text-slate-700">{{ patient.no_reg ?? '-' }}</p>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">No. BPJS</p>
                <p class="font-semibold flex items-center gap-1" :class="isNoBpjsSuspicious ? 'text-danger' : 'text-slate-700'">
                  {{ patient.no_bpjs ?? '-' }}
                  <AppTooltip v-if="isNoBpjsSuspicious" text="Sama persis dengan No. Registrasi -- kemungkinan salah input, bukan No BPJS asli.">
                    <LucideAlertTriangle class="w-3.5 h-3.5 text-danger" />
                  </AppTooltip>
                </p>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Usia / JK</p>
                <p class="font-semibold text-slate-700">
                  <template v-if="calculateAge(patient.tgl_lahir)">{{ calculateAge(patient.tgl_lahir) }} thn / </template>{{ patient.gender ?? '-' }}
                </p>
              </div>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Alamat</p>
              <p class="font-semibold text-slate-700">{{ patient.alamat ?? '-' }}</p>
              <p class="text-xs text-slate-500 mt-0.5">{{ patient.kecamatan_raw ?? '-' }} &middot; Desa {{ patient.kel_desa_raw ?? '-' }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Puskesmas</p>
              <p class="font-semibold text-slate-700">{{ patient.puskesmas?.nama ?? 'Belum Teridentifikasi' }}</p>
            </div>
            <NuxtLink :to="`/dashboard/pasien/${patient.id}`" class="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline pt-1">
              <LucideExternalLink class="w-3.5 h-3.5" /> Lihat Profil Pasien Lengkap
            </NuxtLink>
          </div>
          <div v-else class="p-5 text-sm text-slate-400 italic">Data pasien tidak tersedia.</div>
        </div>

        <!-- Data Petugas -->
        <div class="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <div class="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <LucideUserCog class="w-4 h-4 text-primary" />
            <h2 class="font-bold text-accent text-sm">Data {{ petugasLabel }}</h2>
          </div>
          <div class="p-5 space-y-3 text-sm">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Nama</p>
                <p class="font-semibold text-slate-700">{{ petugasName }}</p>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">No. HP</p>
                <p class="font-semibold text-slate-700">{{ petugasPhone ?? '-' }}</p>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Ditugaskan Oleh</p>
                <p class="font-semibold text-slate-700">{{ assignment.assigned_by?.name ?? '-' }}</p>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Puskesmas</p>
                <p class="font-semibold text-slate-700">{{ assignment.puskesmas?.nama ?? '-' }}</p>
              </div>
            </div>
            <div v-if="assignment.companions?.length">
              <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Kader Pendamping (Rencana)</p>
              <p class="font-semibold text-slate-700">{{ assignment.companions.map(c => c.nama).join(', ') }}</p>
            </div>
            <div v-if="assignment.report?.attendees?.length">
              <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Kader Hadir (Aktual)</p>
              <p class="font-semibold text-slate-700">{{ assignment.report.attendees.map(a => a.nama).join(', ') }}</p>
            </div>
          </div>
        </div>
      </div>

      <template v-if="assignment.report">
        <!-- Bukti Foto -->
        <div class="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <div class="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <LucideCamera class="w-4 h-4 text-primary" />
            <h2 class="font-bold text-accent text-sm">Bukti Foto Kunjungan</h2>
          </div>
          <div class="p-5">
            <img
              v-if="assignment.report.photo_url"
              :src="assignment.report.photo_url"
              alt="Bukti foto kunjungan"
              class="rounded-xl border border-slate-200 max-h-[420px] w-auto mx-auto shadow-sm"
            />
            <p v-else class="text-sm text-slate-400 italic text-center py-6">Foto tidak tersedia (belum diunggah, atau tautan sudah kedaluwarsa -- muat ulang halaman).</p>
          </div>
        </div>

        <!-- Hasil Pemeriksaan / Input Kunjungan -->
        <div class="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <div class="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <LucideClipboardList class="w-4 h-4 text-primary" />
            <h2 class="font-bold text-accent text-sm">Hasil Pemeriksaan &amp; Tindakan</h2>
          </div>
          <div class="p-5 space-y-4 text-sm">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Kondisi Pasien</p>
              <p class="font-semibold text-slate-700">{{ assignment.report.kondisi }}</p>
            </div>

            <!-- Pemeriksaan klinis (nakes) -- SEMUA opsional, tampilkan yang terisi saja -->
            <div v-if="assignment.report.gda || assignment.report.gdp || assignment.report.gd2jpp || assignment.report.uric_acid || assignment.report.cholesterol || assignment.report.systolic" class="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div v-if="assignment.report.gda" class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">GDA</p>
                <p class="font-extrabold text-accent">{{ assignment.report.gda }} <span class="text-xs font-normal text-slate-500">mg/dL</span></p>
              </div>
              <div v-if="assignment.report.gdp" class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">GDP</p>
                <p class="font-extrabold text-accent">{{ assignment.report.gdp }} <span class="text-xs font-normal text-slate-500">mg/dL</span></p>
              </div>
              <div v-if="assignment.report.gd2jpp" class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">GD2JPP</p>
                <p class="font-extrabold text-accent">{{ assignment.report.gd2jpp }} <span class="text-xs font-normal text-slate-500">mg/dL</span></p>
              </div>
              <div v-if="assignment.report.uric_acid" class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Asam Urat</p>
                <p class="font-extrabold text-accent">{{ assignment.report.uric_acid }} <span class="text-xs font-normal text-slate-500">mg/dL</span></p>
              </div>
              <div v-if="assignment.report.cholesterol" class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Kolesterol</p>
                <p class="font-extrabold text-accent">{{ assignment.report.cholesterol }} <span class="text-xs font-normal text-slate-500">mg/dL</span></p>
              </div>
              <div v-if="assignment.report.systolic || assignment.report.diastolic" class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Tensi</p>
                <p class="font-extrabold text-accent">{{ assignment.report.systolic ?? '-' }}/{{ assignment.report.diastolic ?? '-' }} <span class="text-xs font-normal text-slate-500">mmHg</span></p>
              </div>
            </div>

            <div v-if="assignment.report.keluhan">
              <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Keluhan Pasien</p>
              <p class="text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">"{{ assignment.report.keluhan }}"</p>
            </div>

            <div v-if="assignment.report.tindakan?.length">
              <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Tindakan</p>
              <p class="font-semibold text-slate-700">{{ formatTindakan(assignment.report.tindakan) }}</p>
            </div>
            <div v-if="assignment.report.cara_rujukan">
              <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Cara Rujukan</p>
              <p class="font-semibold text-slate-700">{{ CARA_RUJUKAN_LABELS[assignment.report.cara_rujukan] ?? assignment.report.cara_rujukan }}</p>
            </div>

            <!-- PMO mingguan (kader) -->
            <div v-if="assignment.report.kepatuhan_obat || assignment.report.sisa_obat" class="flex flex-wrap gap-4 pt-1 border-t border-slate-100">
              <div v-if="assignment.report.kepatuhan_obat">
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Kepatuhan Obat</p>
                <p class="font-semibold text-slate-700">{{ KEPATUHAN_OBAT_LABELS[assignment.report.kepatuhan_obat] ?? assignment.report.kepatuhan_obat }}</p>
              </div>
              <div v-if="assignment.report.sisa_obat">
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Sisa Obat</p>
                <p class="font-semibold text-slate-700">{{ SISA_OBAT_LABELS[assignment.report.sisa_obat] ?? assignment.report.sisa_obat }}</p>
              </div>
            </div>

            <div v-if="assignment.report.catatan">
              <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Catatan Petugas</p>
              <p class="text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">"{{ assignment.report.catatan }}"</p>
            </div>
          </div>
        </div>

        <!-- Status Validasi -->
        <div class="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <div class="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <LucideShieldCheck class="w-4 h-4 text-primary" />
            <h2 class="font-bold text-accent text-sm">Status Validasi Laporan</h2>
          </div>
          <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Diterima PJ Prolanis</p>
              <span v-if="assignment.report.pj_reviewed_at" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-success/10 text-success border border-success/20">
                <LucideCircleCheck class="w-3.5 h-3.5" /> {{ formatDateTime(assignment.report.pj_reviewed_at) }} oleh {{ assignment.report.pj_reviewed_by?.name ?? 'PJ Prolanis' }}
              </span>
              <span v-else class="px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-warning/10 text-warning border border-warning/20">Menunggu Diterima PJ</span>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Validasi Final Super Admin</p>
              <span class="px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider" :class="VALIDATION_STATUS_COLORS[assignment.report.validation_status]">
                {{ VALIDATION_STATUS_LABELS[assignment.report.validation_status] ?? assignment.report.validation_status }}
              </span>
              <p v-if="assignment.report.validated_at" class="text-xs text-slate-500 mt-1">{{ formatDateTime(assignment.report.validated_at) }} oleh {{ assignment.report.validated_by?.name ?? '-' }}</p>
              <p v-if="assignment.report.validation_note" class="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 mt-2 leading-relaxed">
                <span class="font-bold text-slate-700">Catatan:</span> "{{ assignment.report.validation_note }}"
              </p>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="bg-white rounded-2xl border border-slate-100 shadow-card py-12 text-center text-slate-400 text-sm italic">
        Belum ada laporan kunjungan untuk kunjungan ini.
      </div>
    </template>
  </div>
</template>
