// Firebase Cloud Messaging (push notification web PWA). Composable ini yang dipanggil dari
// layout untuk: minta izin notifikasi browser, daftarkan service worker KHUSUS FCM di scope
// terpisah (lihat public/firebase-messaging-sw.js), ambil token, kirim ke backend
// (POST /fcm-tokens), dan tampilkan toast untuk pesan yang masuk saat app SEDANG dibuka
// (foreground -- pesan saat app tertutup ditangani service worker, bukan di sini).
//
// SENGAJA graceful no-op kalau config Firebase belum lengkap (project belum dibuat/env belum
// diisi) atau browser tidak dukung push (Safari lama, non-HTTPS di luar localhost) -- fitur ini
// tidak boleh bikin seluruh app crash cuma karena push belum siap.
import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  type Messaging,
} from "firebase/messaging";

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;
let activeToken: string | null = null;

export function useFcm() {
  const config = useRuntimeConfig();
  const api = useApi();
  const toast = useToast();

  const isConfigured = computed(() => {
    const fb = config.public.firebase;
    return Boolean(fb?.apiKey && fb?.projectId && fb?.appId && fb?.vapidKey);
  });

  async function registerAndSendToken(): Promise<string | null> {
    if (!import.meta.client) return null;
    if (!isConfigured.value) {
      console.warn("[useFcm] Config Firebase belum lengkap, push notification dilewati.");
      return null;
    }
    if (!(await isSupported())) {
      console.warn("[useFcm] Browser ini tidak mendukung Firebase Cloud Messaging.");
      return null;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return null;
      }

      if (!app) {
        app = initializeApp({
          apiKey: config.public.firebase.apiKey,
          authDomain: config.public.firebase.authDomain,
          projectId: config.public.firebase.projectId,
          storageBucket: config.public.firebase.storageBucket,
          messagingSenderId: config.public.firebase.messagingSenderId,
          appId: config.public.firebase.appId,
        });
      }
      if (!messaging) {
        messaging = getMessaging(app);
        // Foreground: app sedang dibuka & fokus -- tampilkan toast, JANGAN andalkan browser
        // notification bawaan (itu cuma muncul kalau tab tidak fokus/background).
        onMessage(messaging, (payload) => {
          const actionUrl = payload.data?.action_url;
          const isDanger = payload.data?.severity === "danger";
          const image = payload.notification?.image;

          // Rujukan pasien BARU (backend: NotifyService target admin_puskesmas/pj_prolanis DI
          // PUSKESMAS terkait saja -- super_admin TIDAK PERNAH menerima tipe ini sama sekali,
          // jadi tidak perlu cek role lagi di sini) -- alarm darurat sekarang bunyi lewat FCM
          // ini, TIDAK PEDULI halaman mana pun admin/PJ sedang buka, selama app terbuka
          // (foreground). SEBELUMNYA alarm cuma bunyi dari polling 15dtk di /dashboard/rujukan
          // -- kelewatan total kalau admin/PJ tidak sedang standby di halaman itu (temuan
          // lapangan). Polling di halaman rujukan TETAP jalan sebagai jaring pengaman (kalau
          // notifikasi push gagal terkirim/izin belum diberikan), sengaja tidak dihapus.
          if (payload.data?.type === "pasien_dirujuk") {
            useNotificationSound().playAlarm();
          } else {
            useNotificationSound().playFcm();
          }
          toast.add({
            title: payload.notification?.title ?? "Notifikasi Baru",
            description: payload.notification?.body,
            // Preview foto bukti lapangan (permintaan eksplisit user) -- cuma ada kalau backend
            // mengisi NotificationPayload::imageUrl (lihat VisitReportService::notifyReportSubmitted).
            // `icon` dan `avatar` di UToast saling eksklusif secara visual, jadi icon di-skip
            // begitu ada foto supaya tidak tabrakan.
            icon: !image ? (isDanger ? "i-lucide-alert-triangle" : "i-lucide-bell") : undefined,
            avatar: image ? { src: image } : undefined,
            color: isDanger ? "error" : undefined,
            actions: actionUrl
              ? [
                  {
                    label: payload.data?.action_label || "Lihat",
                    onClick: () => navigateTo(actionUrl),
                  },
                ]
              : undefined,
          });
        });
      }

      const swRegistration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/firebase-cloud-messaging-push-scope" },
      );

      const token = await getToken(messaging, {
        vapidKey: config.public.firebase.vapidKey,
        serviceWorkerRegistration: swRegistration,
      });

      if (!token) return null;

      await api("/fcm-tokens", {
        method: "POST",
        body: { token, device_label: navigator.userAgent.slice(0, 100) },
      });

      activeToken = token;
      return token;
    } catch (e) {
      console.warn("[useFcm] Gagal registrasi token FCM:", e);
      return null;
    }
  }

  // Dipanggil saat logout supaya device ini berhenti menerima push utk sesi yang sudah
  // berakhir -- tanpa ini token lama tetap valid di server sampai kebetulan dirotasi.
  async function unregisterToken(): Promise<void> {
    if (!import.meta.client || !activeToken) return;
    try {
      await api("/fcm-tokens", { method: "DELETE", body: { token: activeToken } });
    } catch (e) {
      console.warn("[useFcm] Gagal hapus token FCM saat logout:", e);
    } finally {
      activeToken = null;
    }
  }

  return { isConfigured, registerAndSendToken, unregisterToken };
}
