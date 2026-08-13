import type { Component } from 'vue'
import { Building2, ClipboardCheck, Stethoscope, HandHeart } from '@lucide/vue'
import type { PanduanColor } from './panduan-colors'

// Satu-satunya sumber metadata 4 halaman /panduan/* -- dipakai kartu index (pages/panduan/
// index.vue), hero tiap sub-halaman, dan nav "peran lain" di bagian bawah tiap sub-halaman.
// Urutan array = urutan hierarki alur kerja: Admin Puskesmas -> PJ Prolanis -> Tenaga Kesehatan
// -> Kader (docs/planning root, 12-brief-halaman-panduan-pengguna.md).
//
// `icon` WAJIB komponen ter-import langsung dari '@lucide/vue' (bukan string nama "LucideXxx")
// -- <component :is="'LucideXxx'"> TIDAK bisa resolve nama itu di runtime, cuma `<LucideXxx />`
// literal di template yang otomatis di-resolve Nuxt (nuxt-lucide-icons daftarkan tiap ikon lewat
// addComponent() TANPA global:true, jadi cuma kepakai untuk tag statis, bukan lookup dinamis).
export interface PanduanRoleMeta {
  key: string
  to: string
  icon: Component
  color: PanduanColor
  title: string
  eyebrow: string
  description: string
}

export const PANDUAN_ROLES: PanduanRoleMeta[] = [
  {
    key: 'admin-puskesmas',
    to: '/panduan/admin-puskesmas',
    icon: Building2,
    color: 'accent',
    title: 'Admin Puskesmas',
    eyebrow: 'Panduan Pengguna',
    description:
      'Memantau wilayah kerja puskesmas lewat dashboard, dan mendaftarkan staf serta tenaga lapangan.'
  },
  {
    key: 'pj-prolanis',
    to: '/panduan/pj-prolanis',
    icon: ClipboardCheck,
    color: 'primary',
    title: 'PJ Prolanis',
    eyebrow: 'Panduan Pengguna',
    description:
      'Menugaskan kunjungan, meninjau laporan lapangan, dan mengawasi kader serta tenaga kesehatan.'
  },
  {
    key: 'tenaga-kesehatan',
    to: '/panduan/tenaga-kesehatan',
    icon: Stethoscope,
    color: 'secondary',
    title: 'Tenaga Kesehatan',
    eyebrow: 'Panduan Pengguna',
    description:
      'Melakukan kunjungan pemeriksaan lanjutan ke rumah pasien sesuai penugasan PJ Prolanis.'
  },
  {
    key: 'kader',
    to: '/panduan/kader',
    icon: HandHeart,
    color: 'info',
    title: 'Kader (PMO)',
    eyebrow: 'Panduan Pengguna',
    description:
      'Mendampingi kepatuhan minum obat pasien lewat kunjungan rutin mingguan di wilayahnya.'
  }
]
