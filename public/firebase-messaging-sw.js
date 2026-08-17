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
// foreground handler di useFcm.ts yang jalan, bukan ini). Menampilkan notifikasi SENDIRI lewat
// showNotification (bukan andalkan auto-display SDK) -- satu-satunya cara nambah tombol aksi
// "Lihat Laporan"/"Lihat Kunjungan" (action_url/action_label dikirim backend, lihat
// VisitReportService::notifyReportSubmitted) dan requireInteraction untuk notifikasi danger
// (severity dari data payload) supaya tidak otomatis hilang sebelum admin/PJ sempat lihat.
//
// `image` (permintaan eksplisit user, preview foto bukti lapangan laporan kunjungan) --
// FcmNotification::create() backend sudah mengisi notification.image dari VisitReport::photoUrl()
// kalau laporannya punya foto; null/undefined kalau tidak (mis. notifikasi jenis lain yang
// memang tidak pernah punya foto) -- Notification API mengabaikan opsi `image` begitu saja kalau
// undefined, jadi aman diteruskan apa adanya tanpa fallback.
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Pesan background diterima:", payload);

  const title = payload.notification?.title ?? "Notifikasi Baru";
  const actionUrl = payload.data?.action_url ?? "/";
  const actionLabel = payload.data?.action_label ?? "Lihat";
  const isDanger = payload.data?.severity === "danger";

  self.registration.showNotification(title, {
    body: payload.notification?.body,
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    image: payload.notification?.image,
    requireInteraction: isDanger,
    data: { url: actionUrl },
    actions: actionUrl !== "/" ? [{ action: "open_action_url", title: actionLabel }] : [],
  });
});

// Klik notifikasi (background/app tertutup) -- fokuskan tab yang sudah terbuka kalau ada
// (dinavigasikan ke halaman detail), atau buka tab baru kalau belum ada satu pun.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && "focus" in client) {
          if ("navigate" in client) client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
