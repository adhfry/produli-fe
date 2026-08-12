// Service worker KHUSUS Firebase Cloud Messaging (background push, app di-minimize/ditutup).
// SENGAJA file terpisah dari service worker PWA utama (dihasilkan @vite-pwa/nuxt, strategi
// generateSW — tidak mudah disisipi logic custom seperti ini tanpa pindah ke strategi
// injectManifest). Didaftarkan di scope terpisah ('/firebase-cloud-messaging-push-scope', lihat
// app/composables/useFcm.ts) supaya TIDAK berebut kendali root scope '/' dengan service worker
// PWA yang sudah ada -- pola resmi yang direkomendasikan Firebase untuk app yang sudah punya SW:
// https://firebase.google.com/docs/cloud-messaging/js/receive#access_the_registration_token
//
// Nilai config di bawah SENGAJA hardcoded (bukan baca env) -- file ini disajikan Nuxt apa
// adanya dari public/, tidak lewat build step Vite yang bisa inject env. Semua nilai berikut
// memang client-side config publik Firebase (aman diekspos, BUKAN rahasia -- kredensial
// rahasia ada di service account JSON backend, bukan di sini).
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDCiszCDoKB07GH-S8oj0FhjWiHqdUQ-CQ",
  authDomain: "produli-abd5b.firebaseapp.com",
  projectId: "produli-abd5b",
  storageBucket: "produli-abd5b.firebasestorage.app",
  messagingSenderId: "396491256666",
  appId: "1:396491256666:web:eba8cb70d1b921ad2f3963",
});

const messaging = firebase.messaging();

// Dipanggil browser saat push masuk TAPI app tidak sedang dibuka/fokus (kalau app terbuka,
// foreground handler di useFcm.ts yang jalan, bukan ini) -- FCM SDK sendiri sudah otomatis
// tampilkan notifikasi dari payload `notification`, ini cuma dipakai untuk logging/kustomisasi
// tambahan kalau perlu nanti (mis. custom icon per jenis notifikasi).
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Pesan background diterima:", payload);
});
