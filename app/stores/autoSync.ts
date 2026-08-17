// docs/planning/13: pengaturan sinkronisasi otomatis latar belakang -- OPT-IN (enabled default
// false), diatur dari /app/profil/sinkronisasi-otomatis. Semua field di sini murni preferensi
// non-rahasia (bukan kredensial), aman dipersist penuh ke localStorage.
export const useAutoSyncStore = defineStore(
  'autoSync',
  () => {
    const enabled = ref(false)
    // Preset menit (bukan input bebas) -- lihat useAutoSync.ts kenapa 1/5/15/30, bukan angka
    // sembarangan.
    const intervalMinutes = ref(5)
    const lastSyncAt = ref<string | null>(null)

    return { enabled, intervalMinutes, lastSyncAt }
  },
  {
    persist: {
      storage: piniaPluginPersistedstate.localStorage()
    }
  }
)
