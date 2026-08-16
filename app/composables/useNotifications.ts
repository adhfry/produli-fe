import {
  LucideCalendarClock,
  LucideFileWarning,
  LucideRefreshCw,
  LucidePencil,
  LucideStethoscope,
  LucideClipboardList,
  LucideSiren
} from '#components'
import type { ApiSuccessEnvelope, AppNotification, PaginatedData } from '~/types/api'

// Diekstrak dari layouts/dashboard.vue supaya bisa dipakai BERSAMA oleh layouts/pwa.vue (kader/
// nakes) -- sebelumnya PWA sama sekali tidak punya bel notifikasi maupun registrasi FCM. State
// dibagi lewat useState() (SSR-safe, per-sesi) supaya kedua layout melihat data yang sama kalau
// keduanya sempat aktif di sesi yang sama (mis. dual-role user).
export function useNotifications() {
  const headerNotifications = useState<AppNotification[]>('notifications-list', () => [])
  const unreadCount = useState<number>('notifications-unread-count', () => 0)
  const isLoadingNotif = useState<boolean>('notifications-loading', () => false)
  const notifError = useState<string>('notifications-error', () => '')
  // ID notifikasi TERBARU yang sudah "diketahui" -- dipakai mendeteksi kedatangan notifikasi
  // baru antar-load (bukan cuma count berubah, supaya tidak salah bunyi pas markRead menurunkan
  // unreadCount). null di load pertama = belum ada baseline, jangan bunyi (bukan "semua baru").
  const lastSeenLatestId = useState<string | null>('notifications-last-seen-id', () => null)

  async function loadNotifications() {
    isLoadingNotif.value = true
    notifError.value = ''
    try {
      const api = useApi()
      const res = await api('/notifications', { query: { per_page: 20 } }) as ApiSuccessEnvelope<PaginatedData<AppNotification> & { unread_count: number }>
      const items = res.data.items
      const latestId = items[0]?.id ?? null
      const isFirstLoad = lastSeenLatestId.value === null && headerNotifications.value.length === 0

      headerNotifications.value = items
      unreadCount.value = res.data.unread_count

      if (!isFirstLoad && latestId !== null && latestId !== lastSeenLatestId.value) {
        useNotificationSound().playNormal()
      }
      lastSeenLatestId.value = latestId
    } catch (e) {
      notifError.value = e instanceof ApiError ? e.message : 'Gagal memuat notifikasi.'
    } finally {
      isLoadingNotif.value = false
    }
  }

  // Format per type -- backend TIDAK kirim title/desc siap-pakai, cuma payload mentah per type
  // (lihat komentar AppNotification di types/api.ts). Type yang tidak dikenal ditampilkan apa
  // adanya (type mentah sebagai judul), bukan dikarang isinya.
  function formatNotification(n: AppNotification) {
    if (n.type === 'visit_reminder') {
      return {
        title: 'Pengingat Kunjungan',
        desc: `Kunjungan untuk pasien ${n.data.patient_nama ?? '-'} dijadwalkan ${n.data.scheduled_date ?? '-'} (prioritas ${n.data.priority ?? '-'}).`
      }
    }
    if (n.type === 'visit_report_invalidated') {
      return {
        title: 'Laporan Kunjungan Tidak Valid',
        desc: `Laporan untuk pasien ${n.data.patient_nama ?? '-'} dinyatakan tidak valid.${n.data.validation_note ? ' Catatan: ' + n.data.validation_note : ''}`
      }
    }
    if (n.type === 'silakes_sync_completed') {
      return {
        title: 'Sinkronisasi SiLAKES Selesai',
        desc: `${n.data.patients_synced ?? 0} pasien, ${n.data.lab_results_synced ?? 0} hasil lab tersinkron.`
      }
    }
    if (n.type === 'patient_updated') {
      return {
        title: 'Data Pasien Diperbarui',
        desc: `${n.data.updated_by ?? 'Seseorang'} mengajukan perubahan data pasien ${n.data.patient_nama ?? '-'}.`
      }
    }
    if (n.type === 'care_visit_adhoc') {
      return {
        title: 'Kunjungan Tambahan Mendesak',
        desc: `Kunjungan intensif tambahan untuk ${n.data.patient_nama ?? '-'} dijadwalkan ${n.data.scheduled_date ?? '-'}.`
      }
    }
    if (n.type === 'visit_report_submitted') {
      return {
        title: 'Laporan Kunjungan Baru',
        desc: 'Ada laporan kunjungan baru yang masuk dari kader/tenaga kesehatan.'
      }
    }
    if (n.type === 'pasien_dirujuk') {
      return {
        title: 'Pasien Dirujuk ke Puskesmas',
        desc: 'Ada pasien yang dirujuk kader/tenaga kesehatan, menunggu konfirmasi kedatangan.'
      }
    }
    return { title: n.type ?? 'Notifikasi', desc: '' }
  }

  // Tanda "alert danger" untuk laporan kunjungan baru (admin_puskesmas/pj_prolanis) -- severity
  // dikirim backend di data payload (VisitReportService::notifyReportSubmitted), bukan diterka
  // dari type saja supaya konsisten kalau tipe lain nanti juga butuh severity serupa.
  function isDangerNotif(n: AppNotification): boolean {
    return n.data?.severity === 'danger'
  }

  function notifIcon(type: string | null) {
    if (type === 'visit_report_invalidated') return LucideFileWarning
    if (type === 'silakes_sync_completed') return LucideRefreshCw
    if (type === 'patient_updated') return LucidePencil
    if (type === 'care_visit_adhoc') return LucideStethoscope
    if (type === 'visit_report_submitted') return LucideClipboardList
    if (type === 'pasien_dirujuk') return LucideSiren
    return LucideCalendarClock
  }

  async function markRead(notif: AppNotification) {
    if (notif.is_read) return
    notif.is_read = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
    try {
      const api = useApi()
      await api(`/notifications/${notif.id}/read`, { method: 'PATCH' })
    } catch (e) {
      console.error(e)
    }
  }

  // Klik notifikasi di bel -- selain tandai dibaca, kalau backend menyertakan action_url (lihat
  // 'visit_report_submitted' di types/api.ts) langsung arahkan ke halaman terkait, bukan cuma
  // menutup dropdown. Tipe tanpa action_url tetap cuma tandai dibaca (perilaku lama).
  async function openNotification(notif: AppNotification) {
    const actionUrl = notif.data?.action_url as string | undefined
    await markRead(notif)
    if (actionUrl) {
      await navigateTo(actionUrl)
    }
  }

  // Backend cuma punya PATCH /notifications/{id}/read (per-item), tidak ada endpoint bulk --
  // "tandai semua" jalan lewat beberapa panggilan individual sungguhan, bukan cuma ubah state lokal.
  async function markAllRead() {
    const unread = headerNotifications.value.filter((n) => !n.is_read)
    await Promise.all(unread.map((n) => markRead(n)))
  }

  return {
    headerNotifications,
    unreadCount,
    isLoadingNotif,
    notifError,
    loadNotifications,
    formatNotification,
    notifIcon,
    markRead,
    markAllRead,
    openNotification,
    isDangerNotif
  }
}
