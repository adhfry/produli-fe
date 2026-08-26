import flatpickr from 'flatpickr'
import 'flatpickr/dist/flatpickr.css'
import { Indonesian } from 'flatpickr/dist/l10n/id.js'
import type { Options as FlatpickrOptions } from 'flatpickr/dist/types/options'

// Konfigurasi dasar SATU tempat (permintaan user: "flatpickr untuk seluruh input tanggal agar
// konsisten dan konfigurasinya juga konsisten") -- sebelumnya tiap halaman yang sudah pakai
// flatpickr (dashboard/index.vue, dashboard/kunjungan/index.vue) menyalin config yang sama persis
// berulang, dan sisanya masih native <input type="date"> (beda tampilan & UX lintas
// browser/OS). dateFormat 'Y-m-d' WAJIB sama persis di semua pemanggil -- itu yang dikirim ke
// Laravel ('date' validation rule), altInput cuma tampilan manusiawi terpisah (altFormat),
// v-model TIDAK PERNAH bergantung parsing balik dari string flatpickr.
function baseOptions(): Partial<FlatpickrOptions> {
  return {
    locale: Indonesian,
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'j F Y'
  }
}

// Y-m-d lokal (BUKAN toISOString -- itu UTC, bisa mundur 1 hari utk zona WIB dekat tengah malam).
function toYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Dipanggil dari onMounted/nextTick setelah elemen <input> ada di DOM (pola sama dgn
// initScheduledDatePicker() yang sudah ada) -- elRef biasanya template ref ke <input type="text"
// readonly>, target v-model biasanya Ref<string> yang diisi format 'Y-m-d' lewat onChange di
// bawah (bukan v-model langsung ke flatpickr, supaya tidak circular dgn setDate()).
export function initDatePicker(
  el: HTMLElement | null,
  target: { value: string },
  options: Partial<FlatpickrOptions> = {}
) {
  if (!el) return null
  return flatpickr(el, {
    ...baseOptions(),
    ...options,
    onChange: (selectedDates) => {
      const d = selectedDates[0]
      target.value = d ? toYmd(d) : ''
    }
  })
}
