// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  devServer: {
    port: 3033,
  },

  modules: [
    "@nuxt/fonts",
    "@nuxt/icon",
    "@nuxt/image",
    "@formkit/auto-animate",
    "@nuxt/ui",
    "@vueuse/nuxt",
    "@pinia/nuxt",
    "pinia-plugin-persistedstate/nuxt",
    "@vite-pwa/nuxt",
    "@nuxtjs/sitemap",
    "nuxt-lucide-icons",
  ],

  // @nuxt/ui sudah wire @tailwindcss/vite sendiri (lihat node_modules/@nuxt/ui/dist/module.mjs) —
  // tidak perlu tambah plugin vite manual, cukup css entry-nya.
  css: ["~/assets/css/main.css"],

  // docs/planning/06 §6: default TERANG, bukan ikut preferensi sistem — root cause pattern-grid/
  // animate-blob "hilang" di mode gelap (body dapat bg gelap dari Nuxt UI, mix-blend-mode:multiply
  // jadi hitam-di-atas-hitam). preference (bukan forced) supaya toggle manual di navbar tetap bisa.
  colorMode: {
    preference: "light",
    fallback: "light",
  },

  // NUXT_PUBLIC_API_BASE di .env — lihat docs/planning/05-kontrak-api-kopipu-backend.md
  // NUXT_PUBLIC_TILE_SERVER_URL — tile server sendiri (self-hosted, TileServer GL/OpenMapTiles),
  // BUKAN CARTO/Google lagi (raw tile Google melanggar ToS, CARTO free basemap tidak untuk
  // bulk/offline caching) — dipakai semua peta MapLibre GL di app ini (dashboard & /app/kunjungan).
  runtimeConfig: {
    public: {
      apiBase: "http://localhost:8033/api/v1",
      tileServerUrl: "https://tiles.labkesdasumenep.cloud",
    },
  },

  // Site URL wajib untuk @nuxtjs/sitemap (hanya relevan untuk halaman publik, lihat layouts/public.vue)
  // Dibaca otomatis dari env NUXT_PUBLIC_SITE_URL, fallback dev di bawah ini.
  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL || "http://localhost:3033",
  },

  // docs/planning/03 §7: routeRules per halaman, bukan full SPA. Dashboard & app kader di-render
  // client-only supaya middleware/auth.ts tidak race dengan pemulihan sesi (plugins/auth.client.ts)
  // — kalau SSR, halaman ini akan selalu terlihat "belum login" di server (cookie httpOnly belum
  // sempat dipulihkan) dan salah redirect walau sesi sebenarnya valid. /auth/login butuh alasan
  // yang sama tapi terbalik: middleware/guest.ts perlu authStore sudah terisi supaya user yang
  // sudah login ditendang ke homeRoute, bukan tetap melihat form login saat SSR.
  routeRules: {
    "/dashboard": { ssr: false },
    "/dashboard/**": { ssr: false },
    "/app": { ssr: false },
    "/app/**": { ssr: false },
    "/auth/login": { ssr: false },
    // /onboarding & /ganti-password DAPAT middleware:'auth' juga (bukan cuma /dashboard & /app) --
    // tanpa ssr:false, hard-navigation ke sini SSR duluan dengan authStore kosong (cookie belum
    // dipulihkan di server), auth.ts salah redirect ke /auth/login walau sesi valid -- lalu
    // middleware/guest.ts DI SANA langsung tendang ke homeRoute begitu client restore sesi,
    // menelan ?redirect=/onboarding tanpa sempat mendarat di halaman aslinya.
    "/onboarding": { ssr: false },
    "/ganti-password": { ssr: false },
  },

  // Sinkron dengan Disallow di public/robots.txt (docs/planning/06 §7 — sitemap cuma untuk
  // rute publik) — @nuxtjs/sitemap default-nya crawl semua rute pages/, termasuk yang privat.
  sitemap: {
    exclude: [
      "/dashboard/**",
      "/app/**",
      "/auth/**",
      "/activate",
      "/ganti-password",
      "/forgot-password",
      "/reset-password",
    ],
  },

  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      link: [
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: "/apple-touch-icon.png",
        },
      ],
    },
  },

  // Workbox asset caching (docs/planning/03 §4)
  pwa: {
    registerType: "autoUpdate",
    manifest: {
      name: "KOPIPU Smart",
      short_name: "KSmart",
      description: "Aplikasi kader & dashboard KOPIPU Smart",
      theme_color: "#2563EB",
      background_color: "#F8FAFC",
      icons: [
        { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
        {
          src: "maskable-icon-192x192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable",
        },
        {
          src: "maskable-icon-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    workbox: {
      navigateFallback: null,
      globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"],
      // docs/planning/10 §5 + docs/planning/11 -- tile server sendiri (bukan CARTO/Google lagi,
      // lihat NUXT_PUBLIC_TILE_SERVER_URL), StaleWhileRevalidate: tampilkan versi ter-cache dulu
      // kalau ada (peta tetap responsif di sinyal lemah), refresh diam-diam di background kalau
      // online. cacheName SAMA dengan yang dipakai tombol "Unduh Peta Wilayah Kerja"
      // (useMapTileDownload.ts) supaya kedua jalur caching (pasif lewat request biasa, aktif
      // lewat tombol unduh) berbagi satu cache store yang sama.
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/tiles\.labkesdasumenep\.cloud\/.*/i,
          handler: "StaleWhileRevalidate",
          options: {
            cacheName: "kopipu-map-tiles",
            expiration: {
              // Style/data/sprite/font jarang berubah + kuota wajar utk cakupan 1 kabupaten
              // zoom 9-16 (docs/planning/11 §4) -- bukan angka sembarangan, cukup longgar
              // supaya tile yang diunduh manual via tombol tidak gampang tergusur LRU.
              maxEntries: 6000,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
      ],
    },
    devOptions: {
      enabled: false,
    },
  },
});
