// Kelas Tailwind LENGKAP per warna (bukan dirakit lewat template string, mis. `bg-${c}/10`) --
// Tailwind v4 men-scan teks kelas apa adanya di source, kelas yang dirakit dinamis saat runtime
// tidak akan pernah ke-scan lalu hilang dari CSS akhir. Cuma 4 token brand non-status yang dipakai
// untuk identitas peran (docs/planning/07): primary, secondary, accent, info -- danger/warning/
// success sengaja tidak dipakai di sini, itu reserved untuk makna status/risiko.
export type PanduanColor = 'primary' | 'secondary' | 'accent' | 'info'

interface PanduanColorClasses {
  badgeBg: string
  icon: string
  text: string
  border: string
  solidBg: string
  ring: string
}

export const PANDUAN_COLOR_CLASSES: Record<PanduanColor, PanduanColorClasses> = {
  primary: {
    badgeBg: 'bg-primary/10',
    icon: 'text-primary',
    text: 'text-primary',
    border: 'border-primary',
    solidBg: 'bg-primary',
    ring: 'ring-primary/20'
  },
  secondary: {
    badgeBg: 'bg-secondary/10',
    icon: 'text-secondary',
    text: 'text-secondary',
    border: 'border-secondary',
    solidBg: 'bg-secondary',
    ring: 'ring-secondary/20'
  },
  accent: {
    badgeBg: 'bg-accent/10',
    icon: 'text-accent',
    text: 'text-accent',
    border: 'border-accent',
    solidBg: 'bg-accent',
    ring: 'ring-accent/20'
  },
  info: {
    badgeBg: 'bg-info/10',
    icon: 'text-info',
    text: 'text-info',
    border: 'border-info',
    solidBg: 'bg-info',
    ring: 'ring-info/20'
  }
}

export function panduanColor(color: PanduanColor): PanduanColorClasses {
  return PANDUAN_COLOR_CLASSES[color]
}
