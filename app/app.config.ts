export default defineAppConfig({
  // Design tokens resmi (docs/planning/07-design-tokens-dan-koreksi-referensi.md §1-2) —
  // family warna custom didefinisikan sebagai @theme di assets/css/main.css, di sini cuma
  // dipetakan ke slot semantik Nuxt UI (nama slot Nuxt UI di kiri, nama family kita di kanan).
  ui: {
    colors: {
      primary: 'primary',
      secondary: 'secondary',
      success: 'success',
      info: 'info',
      warning: 'warning',
      error: 'danger',
      neutral: 'neutral'
    }
  }
})
