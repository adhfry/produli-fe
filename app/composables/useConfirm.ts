// Dialog konfirmasi terpusat -- pengganti window.confirm() bawaan browser (tidak bisa diberi
// gaya, memblokir seluruh thread render, dan sempat membuat sesi tab macet total saat dipicu
// dari automasi). Satu <ConfirmDialog /> dipasang sekali di layouts/dashboard.vue dan
// layouts/pwa.vue, state dibagi lewat useState() (pola sama dengan useNotifications()/
// useAnnouncements()) supaya halaman mana pun bisa memanggil confirm() tanpa mendaftarkan
// modal sendiri-sendiri. API berbasis Promise supaya pemanggilnya tetap terbaca sekuensial:
//   if (!(await useConfirm().confirm({ title: '...', description: '...' }))) return
export interface ConfirmOptions {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  /** Merah (danger) untuk aksi merusak/tidak bisa dibatalkan; kuning (warning) untuk aksi berisiko sedang. Default 'danger'. */
  tone?: 'danger' | 'warning'
}

interface ConfirmState extends Required<ConfirmOptions> {
  isOpen: boolean
  resolve: ((value: boolean) => void) | null
}

const DEFAULT_STATE: ConfirmState = {
  isOpen: false,
  title: '',
  description: '',
  confirmLabel: 'Ya, Lanjutkan',
  cancelLabel: 'Batal',
  tone: 'danger',
  resolve: null
}

export function useConfirm() {
  const state = useState<ConfirmState>('confirm-dialog-state', () => ({ ...DEFAULT_STATE }))

  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      state.value = {
        ...DEFAULT_STATE,
        ...options,
        isOpen: true,
        resolve
      }
    })
  }

  function respond(value: boolean) {
    state.value.resolve?.(value)
    state.value = { ...DEFAULT_STATE }
  }

  return { state, confirm, respond }
}
