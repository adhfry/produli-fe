import type { Role } from '~/types/api'

// Satu-satunya sumber label role di seluruh app -- SEBELUMNYA duplikat/tidak konsisten di
// beberapa tempat (layouts/dashboard.vue, onboarding.vue, dashboard/staf/index.vue masing-masing
// punya map sendiri, ada yang lupa nambah role baru). Auto-imported (app/utils/*).
export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin_puskesmas: 'Admin Puskesmas',
  pj_prolanis: 'PJ Prolanis',
  tenaga_kesehatan: 'Tenaga Kesehatan',
  kader: 'Kader'
}

export function resolveRoleLabel(role: string): string {
  return ROLE_LABELS[role as Role] ?? role
}

// Dual-role (docs/planning §7, mis. pj_prolanis + kader) -- gabung semua label user, bukan cuma
// role pertama. '-' kalau roles kosong (belum ter-load / logout).
export function resolveRolesLabel(roles: string[] | null | undefined): string {
  if (!roles || roles.length === 0) return '-'
  return roles.map(resolveRoleLabel).join(' & ')
}
