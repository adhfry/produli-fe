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
          useNotificationSound().playFcm();
          const actionUrl = payload.data?.action_url;
          const isDanger = payload.data?.severity === "danger";
          toast.add({
            title: payload.notification?.title ?? "Notifikasi Baru",
            description: payload.notification?.body,
            icon: isDanger ? "i-lucide-alert-triangle" : "i-lucide-bell",
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

      return token;
    } catch (e) {
      console.warn("[useFcm] Gagal registrasi token FCM:", e);
      return null;
    }
  }

  return { isConfigured, registerAndSendToken };
}
