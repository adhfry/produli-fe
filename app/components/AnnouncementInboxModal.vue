<script setup lang="ts">
import * as icons from '#components'
import { LucideMegaphone, LucideX } from '#components'
import type { Announcement } from '~/types/api'

// Modal LEBAR (bukan dialog kecil) untuk pengumuman yang belum dibaca user, ditarget ke role-nya
// -- dipasang di layouts/dashboard.vue DAN layouts/pwa.vue (mount sekali per sesi login, lihat
// hasCheckedUnread di useAnnouncements()). Setiap kartu dibongkar (dismiss) SATU-SATU, bukan
// tombol "tutup semua" tunggal -- 'darurat' WAJIB diklik "Saya Mengerti" per-item (tidak ada X,
// tidak ada klik-backdrop) supaya benar-benar dibaca, level lain boleh ditutup lebih ringan.
const { unread, hasCheckedUnread, loadUnread, markRead } = useAnnouncements()

onMounted(loadUnread)

const isOpen = computed(() => hasCheckedUnread.value && unread.value.length > 0)
// Backdrop/ESC HANYA aktif kalau TIDAK ADA kartu darurat yang masih tersisa -- begitu semua
// darurat sudah diklik "Saya Mengerti" satu-satu, sisa kartu info/penting boleh ditutup sekaligus
// lewat backdrop (dismissAllNonDarurat), bukan wajib satu-satu juga.
const hasUnackedDarurat = computed(() => unread.value.some((a) => a.urgency === 'darurat'))

async function dismiss(announcement: Announcement) {
  await markRead(announcement)
}

async function dismissBackdrop() {
  if (hasUnackedDarurat.value) return
  await Promise.all(unread.value.map((a) => markRead(a)))
}

function iconComponent(name: string) {
  return (icons as Record<string, unknown>)[name] ?? LucideMegaphone
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4"
      @click.self="dismissBackdrop"
    >
      <div class="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div class="flex items-center gap-3 px-6 py-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div class="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <LucideMegaphone class="w-5 h-5" />
          </div>
          <div>
            <h2 class="font-bold text-accent dark:text-white text-lg">Pengumuman</h2>
            <p class="text-xs text-slate-400">{{ unread.length }} pengumuman belum dibaca</p>
          </div>
        </div>

        <div class="overflow-y-auto px-6 py-5 space-y-4 flex-1">
          <div
            v-for="a in unread"
            :key="a.id"
            class="rounded-2xl border p-5"
            :class="[
              ANNOUNCEMENT_COLOR_CLASSES[announcementColorOf(a)].border,
              a.urgency === 'darurat' ? ANNOUNCEMENT_COLOR_CLASSES[announcementColorOf(a)].bg : 'bg-white dark:bg-slate-800/50'
            ]"
          >
            <div class="flex items-start gap-3">
              <div
                class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                :class="[ANNOUNCEMENT_COLOR_CLASSES[announcementColorOf(a)].bg, ANNOUNCEMENT_COLOR_CLASSES[announcementColorOf(a)].text]"
              >
                <component :is="iconComponent(announcementIconOf(a))" class="w-5 h-5" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span
                    class="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                    :class="[ANNOUNCEMENT_COLOR_CLASSES[announcementColorOf(a)].bg, ANNOUNCEMENT_COLOR_CLASSES[announcementColorOf(a)].text]"
                  >
                    {{ URGENCY_META[a.urgency].label }}
                  </span>
                  <span class="text-[11px] text-slate-400">{{ a.posted_by?.name ?? 'Sistem' }}</span>
                </div>
                <h3 class="font-bold text-accent dark:text-white mb-1.5">{{ a.title }}</h3>
                <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed" v-html="formatAnnouncementBody(a.description)" />
                <img v-if="a.image_url" :src="a.image_url" alt="" class="mt-3 rounded-xl max-h-56 w-full object-cover border border-slate-100 dark:border-slate-700">
                <a
                  v-if="a.button_label && a.button_url"
                  :href="a.button_url" target="_blank" rel="noopener noreferrer"
                  class="mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
                  :class="ANNOUNCEMENT_COLOR_CLASSES[announcementColorOf(a)].solidBg"
                >
                  {{ a.button_label }}
                </a>
              </div>
            </div>

            <div class="flex justify-end mt-4">
              <button
                v-if="a.urgency === 'darurat'"
                type="button"
                class="rounded-xl px-5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
                :class="ANNOUNCEMENT_COLOR_CLASSES[announcementColorOf(a)].solidBg"
                @click="dismiss(a)"
              >
                Saya Mengerti
              </button>
              <button
                v-else
                type="button"
                class="inline-flex items-center gap-1 rounded-xl px-4 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                @click="dismiss(a)"
              >
                <LucideX class="w-3.5 h-3.5" /> Tutup
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
