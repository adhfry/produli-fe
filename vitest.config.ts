import { defineConfig } from 'vitest/config'

// Scaffold minimal (docs/planning/15, temuan audit: nol test coverage frontend) -- Node
// environment biasa (BUKAN @nuxt/test-utils yang jauh lebih berat), karena composable yang
// diuji sekarang (useOfflineCache/useOfflineQueue bagian IndexedDB) murni Web API standar, tidak
// perlu konteks Nuxt penuh. Kalau nanti perlu uji composable yang bergantung auto-import Nuxt
// (useApi dkk), pindah test itu ke setup @nuxt/test-utils terpisah -- jangan paksa semuanya lewat
// config ringan ini.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.spec.ts']
  }
})
