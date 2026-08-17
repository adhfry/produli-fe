import type { Announcement, AnnouncementColor, AnnouncementUrgency, ApiSuccessEnvelope } from '~/types/api'

// Warna & ikon default per tingkat urgensi -- dipakai kalau pembuat pengumuman (halaman
// /dashboard/pengumuman) tidak pilih eksplisit, DAN dipakai modal inbox/kartu feed untuk
// styling konsisten (badge, border, ikon) berdasar urgency, terlepas dari color/icon custom.
export const URGENCY_META: Record<AnnouncementUrgency, { label: string, color: AnnouncementColor, icon: string, description: string }> = {
  info: { label: 'Info', color: 'info', icon: 'LucideInfo', description: 'Pengumuman rutin yang dapat ditutup kapan saja.' },
  penting: { label: 'Penting', color: 'warning', icon: 'LucideAlertTriangle', description: 'Memerlukan perhatian, namun tidak bersifat darurat.' },
  darurat: { label: 'Darurat', color: 'danger', icon: 'LucideSiren', description: 'Bersifat kritis. Pengguna wajib mengklik "Saya Mengerti", dan jendela tidak dapat ditutup dengan mengklik di luar area.' }
}

export const ANNOUNCEMENT_COLOR_CLASSES: Record<AnnouncementColor, { bg: string, text: string, border: string, solidBg: string }> = {
  primary: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30', solidBg: 'bg-primary' },
  secondary: { bg: 'bg-secondary/10', text: 'text-secondary', border: 'border-secondary/30', solidBg: 'bg-secondary' },
  success: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/30', solidBg: 'bg-success' },
  warning: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30', solidBg: 'bg-warning' },
  danger: { bg: 'bg-danger/10', text: 'text-danger', border: 'border-danger/30', solidBg: 'bg-danger' },
  info: { bg: 'bg-info/10', text: 'text-info', border: 'border-info/30', solidBg: 'bg-info' },
  accent: { bg: 'bg-accent/10', text: 'text-accent', border: 'border-accent/30', solidBg: 'bg-accent' }
}

export function announcementColorOf(a: Pick<Announcement, 'color' | 'urgency'>): AnnouncementColor {
  return a.color ?? URGENCY_META[a.urgency].color
}

export function announcementIconOf(a: Pick<Announcement, 'icon' | 'urgency'>): string {
  return a.icon ?? URGENCY_META[a.urgency].icon
}

// Formatter "editor ringan" AMAN -- description disimpan sebagai TEKS POLOS di backend (bukan
// HTML mentah dari editor WYSIWYG), sintaks minimal ala markdown diterjemahkan di SINI supaya
// pembuat pengumuman (halaman /dashboard/pengumuman) bisa sisipkan **tebal** dan [label](url)
// tanpa risiko XSS -- escapeHtml() dulu SEBELUM substitusi apa pun, jadi input mentah user
// (termasuk kalau dia sengaja ketik tag HTML) tidak pernah lolos sebagai markup sungguhan, cuma
// pola persis **.../[..](..)  yang di-substitusi balik jadi tag. URL non-http(s) (mis.
// javascript:) SENGAJA tidak dikonversi jadi <a> -- tetap tampil sebagai teks apa adanya.
export function formatAnnouncementBody(raw: string): string {
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline font-semibold hover:opacity-80">$1</a>')
    .replace(/\n/g, '<br>')
}

// State dibagi lewat useState() (SSR-safe, per-sesi) -- pola SAMA dengan useNotifications(),
// supaya layouts/dashboard.vue dan layouts/pwa.vue melihat data yang sama.
export function useAnnouncements() {
  const unread = useState<Announcement[]>('announcements-unread', () => [])
  const isLoadingUnread = useState<boolean>('announcements-unread-loading', () => false)
  const hasCheckedUnread = useState<boolean>('announcements-unread-checked', () => false)

  async function loadUnread() {
    isLoadingUnread.value = true
    try {
      const api = useApi()
      const res = await api('/announcements/unread') as ApiSuccessEnvelope<{ items: Announcement[] }>
      unread.value = res.data.items
    } catch (e) {
      console.error(e)
    } finally {
      isLoadingUnread.value = false
      hasCheckedUnread.value = true
    }
  }

  // Ditandai SETELAH user benar-benar melihat/menutup pengumuman di modal (AnnouncementInboxModal)
  // -- bukan otomatis saat loadUnread() dipanggil, supaya modal punya kesempatan tampil dulu.
  async function markRead(announcement: Announcement) {
    unread.value = unread.value.filter((a) => a.id !== announcement.id)
    try {
      const api = useApi()
      await api(`/announcements/${announcement.id}/read`, { method: 'POST' })
    } catch (e) {
      console.error(e)
    }
  }

  return {
    unread,
    isLoadingUnread,
    hasCheckedUnread,
    loadUnread,
    markRead
  }
}
