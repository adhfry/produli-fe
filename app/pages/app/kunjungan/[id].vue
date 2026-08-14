<script setup lang="ts">
import type { ApiSuccessEnvelope, PatientFieldUpdates, VisitReportPemeriksaan } from '~/types/api'
import type { VisitReportDraftPayload } from '~/composables/useOfflineQueue'

definePageMeta({
  layout: "pwa",
  middleware: "auth",
});
useHead({
  title: "Input Kunjungan - PRODULI",
  link: [
    {
      rel: "stylesheet",
      href: "https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css",
      crossorigin: "anonymous",
    },
  ],
  script: [
    {
      src: "https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js",
      type: "text/javascript",
      crossorigin: "anonymous",
    },
  ],
});

const route = useRoute();
const router = useRouter();
const assignmentId = computed(() => Number(route.params.id));

// GET /visit-assignments TIDAK punya endpoint per-id (VisitAssignmentController cuma
// index/store/bulkStore) -- assignment diambil dari cache yang sudah di-fetch /app/tugas
// (useAssignmentStore), refetch cuma kalau cache kosong (mis. direct deep-link/refresh halaman ini).
const assignmentStore = useAssignmentStore();
const isLoadingAssignment = ref(false);

onMounted(async () => {
  if (assignmentStore.assignments.length === 0) {
    isLoadingAssignment.value = true;
    await assignmentStore.fetchAll();
    isLoadingAssignment.value = false;
  }
});

const assignment = computed(() => assignmentStore.getById(assignmentId.value));
const patient = computed(() => assignment.value?.patient ?? null);

// Kebijakan submitReport (VisitAssignmentPolicy) -- HANYA kader primer boleh submit laporan,
// pendamping (companion) tidak diotorisasi backend meski ikut hadir secara fisik. Dicek juga di
// sini (bukan cuma disembunyikan di /app/tugas) supaya deep-link langsung ke halaman ini tidak
// menampilkan form yang ujungnya cuma akan ditolak 403.
const canSubmit = computed(() => {
  const a = assignment.value;
  if (!a) return false;
  return a.role_in_assignment !== "companion" && ["pending", "in_progress"].includes(a.status);
});

// Form kunjungan ditentukan MURNI oleh siapa pemilik assignment (kader_id vs tenaga_kesehatan_id
// -- keduanya saling eksklusif, lihat VisitAssignment backend) -- BUKAN kolom "jenis kunjungan"
// terpisah. Nakes isi pemeriksaan klinis lengkap (tensi/GDA/GDP/dst, kunjungan pertama +
// bulanan); kader isi form PMO ringkas (kepatuhan obat/sisa obat, kunjungan mingguan).
const isNakesAssignment = computed(() => !!assignment.value?.tenaga_kesehatan);
const isKaderAssignment = computed(() => !!assignment.value?.kader);

const patientAge = computed(() => null); // Tidak tersedia dari VisitAssignmentResource.patient (id/nama/alamat/phone/lat/lng/geo_status saja).

// Kunjungan berombongan (docs/planning/02 §16) -- kader pendamping RENCANA saat assignment ini
// dibuat (VisitAssignmentResource.companions). Kader primer TINGGAL konfirmasi/koreksi
// kehadiran aktual sebelum submit, bukan input dari nol. Dikirim sebagai attendee_kader_ids --
// backend pakai PERSIS array yang dikirim (termasuk kosong) sebagai koreksi eksplisit.
const plannedCompanions = computed(() => assignment.value?.companions ?? []);
const attendeeKaderIds = ref<number[]>([]);
watch(
  plannedCompanions,
  (companions) => {
    attendeeKaderIds.value = companions.map((c) => c.kader_id);
  },
  { immediate: true }
);

const isAttendeeChecked = (kaderId: number) => attendeeKaderIds.value.includes(kaderId);
const toggleAttendee = (kaderId: number) => {
  const idx = attendeeKaderIds.value.indexOf(kaderId);
  if (idx === -1) attendeeKaderIds.value.push(kaderId);
  else attendeeKaderIds.value.splice(idx, 1);
};

// Modal Verifikasi & Update Data Pasien -- usulan pelengkapan/koreksi data pasien
// (docs/planning/01 §9). BUKAN endpoint terpisah -- "Simpan Update" di sini cuma MENYIMPAN
// (staging) field yang diisi kader ke patientUpdate, dikirim betulan sebagai bagian payload
// POST /visit-reports yang sama saat kader menekan "Kirim Laporan Kunjungan" di bawah
// (SubmitVisitReportRequest::patientFieldUpdates()).
const showPatientModal = ref(false);
const showUpdateModal = ref(false);

const updateForm = ref<PatientFieldUpdates>({});
// true kalau kader sudah pernah menekan "Simpan Update" di modal ini -- dipakai finalisasi
// untuk kasih tahu field ini akan ikut disertakan saat laporan dikirim.
const hasPatientUpdate = ref(false);

const openUpdateModal = () => {
  updateForm.value = {
    alamat: patient.value?.alamat ?? "",
    phone: patient.value?.phone ?? "",
  };
  showUpdateModal.value = true;
};

const submitUpdate = () => {
  hasPatientUpdate.value = true;
  showUpdateModal.value = false;
};

// Form State Laporan -- nama field pemeriksaan (gda/gdp/gd2jpp/uric_acid/cholesterol/systolic/
// diastolic/keluhan/tindakan) SAMA PERSIS dengan SubmitVisitReportRequest::pemeriksaan() di
// backend (types/api.ts: VisitReportPemeriksaan).
const form = ref({
  kondisi: "",
  systolic: "",
  diastolic: "",
  gda: "",
  gdp: "",
  gd2jpp: "",
  uric_acid: "",
  cholesterol: "",
  keluhan: "",
  tindakan: "" as "" | "diberi_obat" | "dirujuk_puskesmas" | "tidak_ada",
  kepatuhan_obat: "" as "" | "patuh" | "kurang_patuh" | "tidak_patuh",
  sisa_obat: "" as "" | "cukup" | "menipis" | "habis",
  notes: "",
  photoUrl: null as string | null,
  lat: null as number | null,
  lng: null as number | null,
  accuracy: null as number | null,
  gpsCapturedAt: null as string | null,
  fullAddress: "Mencari detail alamat...",
});

const locationName = ref("Mencari lokasi...");
const countryFlag = ref("");
const weather = ref<{ temp: number | null; wind: number | null }>({ temp: null, wind: null });

const getFlagEmoji = (countryCode: string) => {
  if (!countryCode) return "";
  return String.fromCodePoint(
    ...[...countryCode.toUpperCase()].map((c) => c.charCodeAt(0) + 127397),
  );
};

const gpsStatus = ref("Menyesuaikan Titik Lokasi...");
const isGpsValid = ref(false);
const timeNow = ref("");
const dateNow = ref("");
let timer: ReturnType<typeof setInterval>;

const updateTime = () => {
  const now = new Date();
  timeNow.value = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  dateNow.value = now.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

// Kamera WebRTC -- capturedLive (SubmitVisitReportRequest) SELALU true di jalur ini, tidak ada
// opsi upload dari galeri sama sekali (Layer 3, LiveCameraCheck).
const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const isCameraActive = ref(false);
const countdown = ref(0);
let stream: MediaStream | null = null;

const nativeVideoWidth = ref(0);
const nativeVideoHeight = ref(0);

const captureAreaRatio = computed(() =>
  nativeVideoWidth.value && nativeVideoHeight.value
    ? `${nativeVideoWidth.value} / ${nativeVideoHeight.value}`
    : "9 / 16",
);

const onVideoMetadataLoaded = () => {
  const video = videoRef.value;
  if (!video || !video.videoWidth || !video.videoHeight) return;
  nativeVideoWidth.value = video.videoWidth;
  nativeVideoHeight.value = video.videoHeight;
};

const startCamera = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1920 } },
      audio: false,
    });
    if (videoRef.value) {
      videoRef.value.srcObject = stream;
      isCameraActive.value = true;
    }
  } catch (e) {
    console.error(e);
  }
};

const stopCamera = () => {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  isCameraActive.value = false;
};

const takePicture = () => {
  if (countdown.value > 0) return;
  countdown.value = 3;
  const interval = setInterval(() => {
    countdown.value--;
    if (countdown.value === 0) {
      clearInterval(interval);
      captureFrame();
    }
  }, 1000);
};

// Foto YANG DISUBMIT adalah frame mentah dari kamera, BUKAN hasil komposit html2canvas
// (kartu lokasi/cuaca/peta di layar cuma overlay CSS, tidak pernah dibakar ke pixel foto) --
// backend sudah punya watermark resminya sendiri (WatermarkGenerator, Layer 4: nama kader +
// timestamp + koordinat dibakar server-side sebelum foto disimpan ke S3/MinIO). Kalau overlay
// di sini ikut dibakar juga, hasilnya watermark dobel.
const captureFrame = () => {
  const video = videoRef.value;
  const canvas = canvasRef.value;
  if (!video || !canvas) return;
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  canvas.width = vw;
  canvas.height = vh;
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(video, 0, 0, vw, vh);

  form.value.photoUrl = canvas.toDataURL("image/jpeg", 0.9);
  stopCamera();
};

const retakePhoto = () => {
  form.value.photoUrl = null;
  startCamera();
};

const initMapLibre = (containerId: string, lat: number, lng: number, isMini = false) => {
  const w = window as any;
  if (!w.maplibregl) return null;

  // Tile server sendiri (self-hosted, NUXT_PUBLIC_TILE_SERVER_URL) -- BUKAN raw Google tiles
  // lagi (itu pelanggaran ToS Google Maps Platform, mengakses tile server mereka di luar SDK
  // resmi, docs/planning/10 §5). Style penuh (sources+sprite+glyphs) sudah lengkap di
  // style.json itu sendiri -- cukup kasih URL-nya langsung.
  const config = useRuntimeConfig();
  const map = new w.maplibregl.Map({
    container: containerId,
    preserveDrawingBuffer: true,
    style: `${config.public.tileServerUrl}/styles/basemap/style.json`,
    center: [lng, lat],
    zoom: isMini ? 14 : 16,
    // Tileset sumenep.mbtiles minzoom=9 -- di bawah itu tidak ada tile sama sekali, peta jadi
    // blank. Zoom awal (14/16) sudah jauh di atasnya, tapi minZoom mengunci batas ini juga untuk
    // interactive zoom-out (scroll/pinch), sama seperti dashboard/index.vue.
    minZoom: 9,
    interactive: !isMini,
  });

  const el = document.createElement("div");
  el.className = "custom-map-pin";
  el.innerHTML = `<div class="pulse-ring"></div><div class="pin-core"></div>`;

  new w.maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);

  return map;
};

let orientationTimeout: ReturnType<typeof setTimeout>;
const handleOrientationChange = () => {
  clearTimeout(orientationTimeout);
  orientationTimeout = setTimeout(onVideoMetadataLoaded, 300);
};

// Kamera & GPS BUKAN onMounted polos lagi -- keduanya menyentuh elemen (#videoRef, #maplibre-main)
// yang cuma ada di cabang v-else (canSubmit) template, sementara assignment (dari
// assignmentStore.fetchAll(), fetch async terpisah) belum tentu selesai di mount pertama.
// setTimeout tetap dari mount kalau assignment SUDAH ada di cache (kasus normal, datang dari
// /app/tugas) -- watch(canSubmit) + nextTick() memastikan DOM sungguh sudah ter-render sebelum
// startCamera()/initMapLibre() menyentuhnya, ketahuan lewat race yang benar-benar terjadi saat
// verifikasi (kadang "Container 'maplibre-main' not found" kalau fetch assignment kebetulan
// lambat), bukan cuma teori.
let hasStartedMediaFlow = false;
watch(canSubmit, async (value) => {
  if (!value || hasStartedMediaFlow) return;
  hasStartedMediaFlow = true;
  await nextTick();

  window.addEventListener("resize", handleOrientationChange);
  updateTime();
  timer = setInterval(updateTime, 1000);

  setTimeout(() => {
    startCamera();
  }, 1000);

  setTimeout(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          form.value.lat = lat;
          form.value.lng = lng;
          form.value.accuracy = Math.round(pos.coords.accuracy);
          // pos.timestamp = waktu FIX GPS sesungguhnya (bukan Date.now() saat kode ini jalan) --
          // GpsActiveCheck (Layer 1) menolak titik yang sudah "basi" (docs/planning/02 §3),
          // jadi timestamp ini harus jujur mencerminkan kapan device dapat fix, bukan kapan
          // form ini dirender.
          form.value.gpsCapturedAt = new Date(pos.timestamp).toISOString();
          isGpsValid.value = true;
          gpsStatus.value = "Lokasi Terkunci (Radius Akurat)";

          setTimeout(() => {
            initMapLibre("maplibre-main", lat, lng);
            initMapLibre("maplibre-mini", lat, lng, true);
          }, 300);

          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
            );
            const data = await res.json();
            form.value.fullAddress = data.display_name || "Gagal memuat nama jalan";

            const addr = data.address || {};
            countryFlag.value = getFlagEmoji(addr.country_code);
            locationName.value =
              [addr.village || addr.suburb || addr.city_district || addr.town, addr.city || addr.county]
                .filter(Boolean)
                .join(", ") || (data.display_name?.split(",")[0] ?? "-");
          } catch (e) {
            form.value.fullAddress = "Alamat tidak dapat diurai";
          }

          try {
            const wRes = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`,
            );
            const wData = await wRes.json();
            weather.value.temp = Math.round(wData.current_weather.temperature);
            weather.value.wind = Math.round(wData.current_weather.windspeed);
          } catch (e) {
            // Diamkan saja -- kartu tetap tampil, cuma baris cuaca jadi "-".
          }
        },
        () => {
          gpsStatus.value = "Akses Lokasi Ditolak";
          form.value.fullAddress = "Harap izinkan akses lokasi (GPS).";
        },
        { enableHighAccuracy: true },
      );
    }
  }, 500);
}, { immediate: true });

onUnmounted(() => {
  window.removeEventListener("resize", handleOrientationChange);
  if (timer) clearInterval(timer);
  stopCamera();
});

function dataUrlToBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(",");
  const header = dataUrl.slice(0, commaIdx);
  const base64 = dataUrl.slice(commaIdx + 1);
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

const isSubmitting = ref(false);
const submitError = ref("");

function buildPatientFieldUpdates(): Record<string, string | boolean> | null {
  if (!hasPatientUpdate.value) return null;
  const out: Record<string, string | boolean> = {};
  const stringFields: (keyof PatientFieldUpdates)[] = [
    "alamat", "kel_desa", "kecamatan", "rt_rw", "phone", "pekerjaan",
    "status_perkawinan", "golongan_darah", "agama", "no_bpjs", "jenis_prolanis", "jenis_perokok",
  ];
  for (const key of stringFields) {
    const value = updateForm.value[key];
    if (typeof value === "string" && value.trim() !== "") out[key] = value.trim();
  }
  if (updateForm.value.is_bpjs !== undefined) out.is_bpjs = updateForm.value.is_bpjs;
  return out;
}

function buildDraftPayload(): VisitReportDraftPayload {
  return {
    assignment_id: assignment.value!.id,
    latitude: form.value.lat!,
    longitude: form.value.lng!,
    gps_accuracy_meters: form.value.accuracy,
    gps_captured_at: form.value.gpsCapturedAt!,
    kondisi: form.value.kondisi.trim(),
    catatan: form.value.notes.trim() || null,
    systolic: form.value.systolic || null,
    diastolic: form.value.diastolic || null,
    gda: form.value.gda || null,
    gdp: form.value.gdp || null,
    gd2jpp: form.value.gd2jpp || null,
    uric_acid: form.value.uric_acid || null,
    cholesterol: form.value.cholesterol || null,
    keluhan: form.value.keluhan.trim() || null,
    tindakan: form.value.tindakan || null,
    kepatuhan_obat: form.value.kepatuhan_obat || null,
    sisa_obat: form.value.sisa_obat || null,
    attendeeKaderIds: [...attendeeKaderIds.value],
    patientFieldUpdates: buildPatientFieldUpdates(),
  };
}

// FormData jalur ONLINE langsung -- TIDAK menyertakan is_offline/client_submission_id (itu cuma
// relevan utk draft dari IndexedDB, lihat draftToFormData() di useOfflineQueue.ts).
function buildOnlineFormData(payload: VisitReportDraftPayload, photo: Blob): FormData {
  const fd = new FormData();
  fd.append("assignment_id", String(payload.assignment_id));
  fd.append("photo", photo, "kunjungan.jpg");
  fd.append("latitude", String(payload.latitude));
  fd.append("longitude", String(payload.longitude));
  if (payload.gps_accuracy_meters !== null) fd.append("gps_accuracy_meters", String(payload.gps_accuracy_meters));
  fd.append("gps_captured_at", payload.gps_captured_at);
  fd.append("captured_live", "1");
  fd.append("kondisi", payload.kondisi);
  if (payload.catatan) fd.append("catatan", payload.catatan);

  const pemeriksaanKeys = ["systolic", "diastolic", "gda", "gdp", "gd2jpp", "uric_acid", "cholesterol"] as const;
  for (const key of pemeriksaanKeys) {
    const value = payload[key];
    if (value !== null) fd.append(key, value);
  }
  if (payload.keluhan) fd.append("keluhan", payload.keluhan);
  if (payload.tindakan) fd.append("tindakan", payload.tindakan);
  if (payload.kepatuhan_obat) fd.append("kepatuhan_obat", payload.kepatuhan_obat);
  if (payload.sisa_obat) fd.append("sisa_obat", payload.sisa_obat);

  // Dikirim eksplisit (termasuk kalau kosong) -- ini koreksi kehadiran AKTUAL kader primer,
  // bukan "tidak diisi" (yang akan membuat backend pre-fill ulang dari rencana companion).
  payload.attendeeKaderIds.forEach((id) => fd.append("attendee_kader_ids[]", String(id)));

  if (payload.patientFieldUpdates) {
    for (const [key, value] of Object.entries(payload.patientFieldUpdates)) {
      fd.append(key, typeof value === "boolean" ? (value ? "1" : "0") : value);
    }
  }

  return fd;
}

const offlineQueue = useOfflineQueue();

// POST /visit-reports (SubmitVisitReportRequest) -- 7-layer validation (VisitValidationService)
// jalan SEPENUHNYA di backend begitu request ini diterima; frontend cuma bertanggung jawab
// mengirim data mentah yang jujur (GPS titik+akurasi+waktu fix, foto kamera langsung, dst),
// BUKAN mensimulasikan hasil validasinya sendiri. Kalau offline (navigator.onLine false, ATAU
// fetch gagal di level jaringan -- bukan error validasi/HTTP dari server), simpan ke IndexedDB
// sebagai draft alih-alih gagal (docs/planning/10 §3): submit tetap "terasa berhasil" seketika,
// kader tidak perlu menunggu koneksi baru bisa lanjut kerja (prinsip 1-aksi-besar).
async function submitData() {
  submitError.value = "";

  if (!assignment.value) return;
  if (!form.value.photoUrl) {
    submitError.value = "Ambil foto dokumentasi kunjungan terlebih dahulu.";
    return;
  }
  if (!isGpsValid.value || form.value.lat === null || form.value.lng === null || !form.value.gpsCapturedAt) {
    submitError.value = "Titik GPS belum tertangkap. Pastikan akses lokasi diizinkan.";
    return;
  }
  if (!form.value.kondisi.trim()) {
    submitError.value = "Isi kondisi pasien saat kunjungan terlebih dahulu.";
    return;
  }

  isSubmitting.value = true;
  const payload = buildDraftPayload();
  const photoBlob = dataUrlToBlob(form.value.photoUrl!);

  if (!navigator.onLine) {
    await offlineQueue.addDraft(payload, photoBlob, patient.value?.nama ?? "Pasien");
    isSubmitting.value = false;
    alert("Anda sedang offline -- laporan disimpan sebagai draft, akan terkirim otomatis saat online kembali.");
    router.push("/app/draft");
    return;
  }

  try {
    const api = useApi();
    const fd = buildOnlineFormData(payload, photoBlob);
    await api("/visit-reports", { method: "POST", body: fd });

    assignmentStore.markCompleted(assignment.value.id);
    alert("Laporan berhasil dikirim dan tersimpan dengan aman!");
    router.push("/app/tugas");
  } catch (err) {
    if (err instanceof ApiError) {
      // Error HTTP asli dari server (validasi/auth/7-layer) -- resubmit data yang SAMA tidak
      // akan membantu, jangan disimpan sebagai draft, tampilkan apa adanya supaya diperbaiki.
      const firstFieldError = err.errors ? Object.values(err.errors)[0]?.[0] : null;
      submitError.value = firstFieldError ?? err.message;
    } else {
      // Bukan ApiError = gagal di level jaringan (offline sungguhan, timeout, dst) -- simpan
      // sebagai draft alih-alih menampilkan error yang bikin kader mengulang dari nol.
      await offlineQueue.addDraft(payload, photoBlob, patient.value?.nama ?? "Pasien");
      alert("Koneksi bermasalah -- laporan disimpan sebagai draft, akan terkirim otomatis saat online kembali.");
      router.push("/app/draft");
    }
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="pb-32 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-300">
    <!-- Header -->
    <div class="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl px-5 pt-8 pb-4 shadow-sm border-b border-slate-100 dark:border-slate-800 transition-colors">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <NuxtLink to="/app/tugas" class="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center active:scale-95 transition-transform">
            <LucideArrowLeft class="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </NuxtLink>
          <div>
            <h1 class="font-black text-slate-800 dark:text-white text-lg leading-tight transition-colors">Laporan Kunjungan</h1>
            <p class="text-base font-bold text-primary tracking-wide uppercase">Tugas Pemantauan Kader</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading assignment -->
    <div v-if="isLoadingAssignment" class="p-5">
      <div class="flex flex-col items-center justify-center py-16 text-slate-400">
        <LucideLoader2 class="w-8 h-8 animate-spin mb-3" />
        <p class="text-base font-medium">Memuat data tugas kunjungan...</p>
      </div>
    </div>

    <!-- Assignment tidak ditemukan (id salah, atau bukan tugas milik kader ini) -->
    <div v-else-if="!assignment" class="p-5">
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 text-center">
        <LucideFileWarning class="w-10 h-10 mx-auto mb-3 text-slate-300" />
        <p class="font-bold text-slate-700 dark:text-slate-200 mb-1">Tugas kunjungan tidak ditemukan.</p>
        <p class="text-base text-slate-500 dark:text-slate-400 mb-4">Mungkin ID salah atau tugas ini bukan milik Anda.</p>
        <NuxtLink to="/app/tugas" class="inline-flex items-center gap-2 py-3 px-5 bg-primary text-white rounded-xl font-bold">
          <LucideArrowLeft class="w-4 h-4" /> Kembali ke Tugas
        </NuxtLink>
      </div>
    </div>

    <!-- Sudah selesai / dibatalkan / bukan kader primer -->
    <div v-else-if="!canSubmit" class="p-5">
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 text-center">
        <LucideCheckCircle2 class="w-10 h-10 mx-auto mb-3 text-success" />
        <p class="font-bold text-slate-700 dark:text-slate-200 mb-1">{{ patient?.nama }}</p>
        <p class="text-base text-slate-500 dark:text-slate-400 mb-4">
          {{ assignment.role_in_assignment === 'companion'
            ? 'Anda mendampingi kunjungan ini — laporan diisi oleh kader utama.'
            : `Kunjungan ini sudah berstatus ${assignment.status}.` }}
        </p>
        <NuxtLink to="/app/tugas" class="inline-flex items-center gap-2 py-3 px-5 bg-primary text-white rounded-xl font-bold">
          <LucideArrowLeft class="w-4 h-4" /> Kembali ke Tugas
        </NuxtLink>
      </div>
    </div>

    <div v-else class="p-5 space-y-6">
      <!-- Diulang: laporan sebelumnya ditolak Super Admin (docs/planning/02 §11) -- kader perlu
           tahu persis apa yang mesti diperbaiki sebelum mengulang, bukan cuma "ditolak". -->
      <div v-if="assignment.report?.validation_status === 'invalid'" class="bg-warning/10 border border-warning/20 rounded-2xl px-4 py-3.5 flex items-start gap-3">
        <LucideRotateCcw class="w-5 h-5 text-warning-700 shrink-0 mt-0.5" />
        <div>
          <p class="text-base font-bold text-warning-700">Kunjungan ini diulang &mdash; laporan sebelumnya ditolak Super Admin</p>
          <p v-if="assignment.report.validation_note" class="text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed mt-1">{{ assignment.report.validation_note }}</p>
        </div>
      </div>

      <!-- Informasi Identitas Pasien -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <h2 class="font-bold text-slate-800 dark:text-slate-200 text-base mb-4">Informasi Pasien</h2>

        <div class="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 transition-colors mb-3">
          <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
            <LucideUser class="w-6 h-6 text-primary" />
          </div>
          <div class="flex-1">
            <h3 class="font-black text-slate-800 dark:text-white text-base mb-0.5">{{ patient?.nama }}</h3>
            <p class="text-base text-slate-500 dark:text-slate-400 font-medium line-clamp-1">Risiko: {{ assignment.priority }}</p>
          </div>
        </div>

        <button @click="showPatientModal = true" class="w-full py-2.5 bg-primary/10 text-primary rounded-xl font-bold text-base uppercase tracking-wider active:bg-primary/20 transition-colors flex items-center justify-center gap-2">
          <LucideClipboardList class="w-4 h-4" />
          Periksa Data Pasien
        </button>
      </div>

      <!-- Lokasi & Peta (MapLibre) -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors overflow-hidden">
        <div class="p-3 border-b border-slate-100 dark:border-slate-700">
          <h2 class="font-bold text-slate-800 dark:text-slate-200 text-base mb-1">Penetapan Lokasi Kunjungan</h2>
          <p class="text-base text-slate-500 dark:text-slate-400">Peta interaktif titik koordinat Anda saat ini (beserta radius akurasi).</p>
        </div>

        <div id="maplibre-main" class="relative w-full h-80 bg-slate-100 dark:bg-slate-800 overflow-hidden z-10">
          <div v-if="!isGpsValid" class="absolute inset-0 flex items-center justify-center text-base text-slate-400">
            Menunggu sinyal GPS...
          </div>
        </div>

        <div class="p-4 bg-slate-50 dark:bg-slate-800/30">
          <div class="flex items-start gap-3">
            <LucideMapPin class="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p class="text-base font-bold" :class="isGpsValid ? 'text-success' : 'text-warning-600'">{{ gpsStatus }}</p>
              <p class="text-base text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{{ form.fullAddress }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Kondisi Pasien -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <h2 class="font-bold text-slate-800 dark:text-slate-200 text-base mb-4">Kondisi Pasien Saat Kunjungan <span class="text-danger">*</span></h2>
        <input
          v-model="form.kondisi"
          type="text"
          maxlength="100"
          placeholder="Mis. Stabil, tekanan darah terkontrol"
          class="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none transition-colors"
        />
      </div>

      <!-- PMO Mingguan (kader) -- kepatuhan minum obat + sisa obat, terpisah dari pemeriksaan
           klinis nakes di bawah (revisi Bu Kadis PMO). -->
      <div v-if="isKaderAssignment" class="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <h2 class="font-bold text-slate-800 dark:text-slate-200 text-base mb-4">Pemantauan Minum Obat (PMO)</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Kepatuhan Minum Obat</label>
            <select v-model="form.kepatuhan_obat" class="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none transition-colors appearance-none">
              <option value="">Pilih...</option>
              <option value="patuh">Patuh</option>
              <option value="kurang_patuh">Kurang Patuh</option>
              <option value="tidak_patuh">Tidak Patuh</option>
            </select>
          </div>
          <div>
            <label class="block text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Sisa Obat</label>
            <select v-model="form.sisa_obat" class="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none transition-colors appearance-none">
              <option value="">Pilih...</option>
              <option value="cukup">Cukup</option>
              <option value="menipis">Menipis</option>
              <option value="habis">Habis</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Input Tanda Vital (nakes) -->
      <div v-if="isNakesAssignment" class="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <h2 class="font-bold text-slate-800 dark:text-slate-200 text-base mb-4">Pengukuran Tensi Darah</h2>

        <div class="flex items-center gap-3">
          <div class="flex-1 relative">
            <label class="absolute -top-2 left-3 bg-white dark:bg-slate-900 px-1 text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider transition-colors">Sistolik</label>
            <input v-model="form.systolic" type="number" placeholder="120" class="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-danger focus:ring-0 outline-none transition-colors" />
            <span class="absolute right-4 top-3.5 text-base font-bold text-slate-400">mmHg</span>
          </div>
          <span class="text-2xl font-light text-slate-300">/</span>
          <div class="flex-1 relative">
            <label class="absolute -top-2 left-3 bg-white dark:bg-slate-900 px-1 text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider transition-colors">Diastolik</label>
            <input v-model="form.diastolic" type="number" placeholder="80" class="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-danger focus:ring-0 outline-none transition-colors" />
            <span class="absolute right-4 top-3.5 text-base font-bold text-slate-400">mmHg</span>
          </div>
        </div>
      </div>

      <!-- Pemeriksaan Tambahan (nakes) -->
      <div v-if="isNakesAssignment" class="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <h2 class="font-bold text-slate-800 dark:text-slate-200 text-base mb-4">Pemeriksaan Mandiri</h2>

        <div class="space-y-4">
          <div class="flex flex-col gap-4">
            <div class="relative">
              <label class="absolute -top-2 left-3 bg-white dark:bg-slate-900 px-1 text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider transition-colors">Gula Darah Sewaktu (GDA)</label>
              <input v-model="form.gda" type="number" placeholder="Angka..." class="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-warning focus:ring-0 outline-none transition-colors" />
              <span class="absolute right-4 top-3.5 text-base font-bold text-slate-400">mg/dL</span>
            </div>
            <div class="relative">
              <label class="absolute -top-2 left-3 bg-white dark:bg-slate-900 px-1 text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider transition-colors">Gula Darah Puasa (GDP)</label>
              <input v-model="form.gdp" type="number" placeholder="Angka..." class="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-warning focus:ring-0 outline-none transition-colors" />
              <span class="absolute right-4 top-3.5 text-base font-bold text-slate-400">mg/dL</span>
            </div>
          </div>
          <div class="relative">
            <label class="absolute -top-2 left-3 bg-white dark:bg-slate-900 px-1 text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider transition-colors">Gula Darah 2 Jam PP</label>
            <input v-model="form.gd2jpp" type="number" placeholder="Angka..." class="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-warning focus:ring-0 outline-none transition-colors" />
            <span class="absolute right-4 top-3.5 text-base font-bold text-slate-400">mg/dL</span>
          </div>
          <div class="flex flex-col gap-4">
            <div class="relative">
              <label class="absolute -top-2 left-3 bg-white dark:bg-slate-900 px-1 text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider transition-colors">Kolesterol</label>
              <input v-model="form.cholesterol" type="number" placeholder="Angka..." class="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-warning focus:ring-0 outline-none transition-colors" />
              <span class="absolute right-4 top-3.5 text-base font-bold text-slate-400">mg/dL</span>
            </div>
            <div class="relative">
              <label class="absolute -top-2 left-3 bg-white dark:bg-slate-900 px-1 text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider transition-colors">Asam Urat</label>
              <input v-model="form.uric_acid" type="number" placeholder="Angka..." class="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-warning focus:ring-0 outline-none transition-colors" />
              <span class="absolute right-4 top-3.5 text-base font-bold text-slate-400">mg/dL</span>
            </div>
          </div>
          <div>
            <label class="block text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Keluhan Pasien</label>
            <textarea v-model="form.keluhan" rows="2" placeholder="Keluhan yang dirasakan pasien saat kunjungan..." class="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-warning focus:ring-0 outline-none transition-colors resize-none"></textarea>
          </div>
          <div>
            <label class="block text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tindakan</label>
            <select v-model="form.tindakan" class="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-warning focus:ring-0 outline-none transition-colors appearance-none">
              <option value="">Pilih tindakan...</option>
              <option value="diberi_obat">Diberi Obat</option>
              <option value="dirujuk_puskesmas">Dirujuk ke Puskesmas</option>
              <option value="tidak_ada">Tidak Ada Tindakan</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Kader Pendamping (Kunjungan Berombongan) -->
      <div v-if="plannedCompanions.length > 0" class="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <h2 class="font-bold text-slate-800 dark:text-slate-200 text-base mb-1">Kader Pendamping</h2>
        <p class="text-base text-slate-500 dark:text-slate-400 mb-4">
          Kunjungan ini direncanakan berombongan. Konfirmasi siapa yang benar-benar ikut hadir — hilangkan centang kalau ada yang batal ikut.
        </p>
        <div class="space-y-2.5">
          <label
            v-for="companion in plannedCompanions"
            :key="companion.kader_id"
            class="flex items-center gap-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 cursor-pointer transition-colors"
            :class="isAttendeeChecked(companion.kader_id) ? 'border-primary bg-primary/5 dark:bg-primary/10' : ''"
          >
            <input type="checkbox" :checked="isAttendeeChecked(companion.kader_id)" @change="toggleAttendee(companion.kader_id)" class="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary/30 shrink-0" />
            <span class="text-base font-bold text-slate-800 dark:text-white">{{ companion.nama }}</span>
          </label>
        </div>
      </div>

      <!-- Dokumentasi Kegiatan (Kamera Portrait) -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-2 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <div class="flex items-center justify-between mb-2 pl-2">
          <h2 class="font-bold text-slate-800 dark:text-slate-200 text-base">Dokumentasi Kunjungan</h2>
        </div>
        <p class="text-base text-slate-500 dark:text-slate-400 mb-4 pl-2">Kamera otomatis menyala. Ambil foto langsung bersama pasien.</p>

        <div id="capture-area" class="relative w-full rounded-2xl overflow-hidden shadow-inner bg-black flex flex-col items-center justify-center" :style="{ aspectRatio: captureAreaRatio }">
          <video v-if="!form.photoUrl" ref="videoRef" autoplay playsinline @loadedmetadata="onVideoMetadataLoaded" class="absolute inset-0 w-full h-full object-cover"></video>
          <canvas ref="canvasRef" class="hidden"></canvas>

          <div v-if="countdown > 0" class="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <span class="text-7xl font-black text-white drop-shadow-2xl animate-pulse">{{ countdown }}</span>
          </div>

          <img v-show="form.photoUrl" :src="form.photoUrl ?? ''" class="absolute inset-0 w-full h-full object-cover" />

          <!-- Overlay info -- murni tampilan referensi untuk kader saat memotret, TIDAK ikut
               dibakar ke file yang dikirim (lihat catatan captureFrame di atas). -->
          <div class="absolute inset-0 flex flex-col justify-between p-3 z-10 pointer-events-none">
            <div class="flex items-center gap-2 self-start bg-white rounded-md px-2 py-1 shadow-sm">
              <img src="/logo/logo-no-text.png" class="w-4 h-4" />
              <span class="text-[9px] font-black text-primary tracking-widest uppercase">PRODULI</span>
            </div>

            <div class="flex flex-col gap-1.5 w-full mt-auto">
              <div class="w-full bg-black/40 rounded-xl overflow-hidden">
                <div class="flex gap-3 p-2">
                  <div id="maplibre-mini" class="w-16 h-16 bg-slate-800 rounded-lg shrink-0 overflow-hidden border border-white/20 relative"></div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between gap-1">
                      <p class="text-[13px] font-black text-white uppercase leading-tight line-clamp-1">{{ locationName }}</p>
                      <span class="text-sm shrink-0">{{ countryFlag }}</span>
                    </div>
                    <p class="text-[11px] text-slate-200 leading-snug line-clamp-2 mt-0.5">{{ form.fullAddress }}</p>
                    <p class="text-[11px] font-mono text-slate-300 mt-1">
                      Lat {{ (form.lat || 0).toFixed(6) }}&nbsp;&nbsp;Long {{ (form.lng || 0).toFixed(6) }}
                    </p>
                  </div>
                </div>

                <div class="px-2 pb-1.5 pt-1 border-t border-white/20">
                  <p class="text-[11.5px] font-bold text-white">{{ dateNow }} &middot; {{ timeNow }} WIB</p>
                  <p class="text-[11px] text-slate-300 mt-0.5">Pasien: {{ patient?.nama }}</p>
                </div>

                <div class="flex items-center justify-between px-2 py-1.5 bg-black/30 border-t border-white/20">
                  <span class="text-[11px] font-bold text-slate-200 flex items-center gap-1">
                    <LucideThermometer class="w-3.5 h-3.5" />
                    {{ weather.temp !== null ? weather.temp + "°C" : "-" }}
                  </span>
                  <span class="text-[11px] font-bold text-slate-200 flex items-center gap-1">
                    <LucideWind class="w-3.5 h-3.5" />
                    {{ weather.wind !== null ? weather.wind + " km/j" : "-" }}
                  </span>
                  <span class="text-[11px] font-bold text-slate-200 flex items-center gap-1">
                    <LucideCrosshair class="w-3.5 h-3.5" /> &plusmn;{{ form.accuracy || "-" }} m
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-4 flex gap-3">
          <button
            v-if="!form.photoUrl"
            @click="takePicture"
            :disabled="!isCameraActive || countdown > 0"
            class="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-indigo-500/30"
          >
            <LucideCamera class="w-5 h-5" />
            Ambil Gambar
          </button>
          <button v-else @click="retakePhoto" class="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform">
            <LucideRefreshCw class="w-5 h-5" />
            Ulangi Foto
          </button>
        </div>
      </div>

      <!-- Catatan Edukasi -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <h2 class="font-bold text-slate-800 dark:text-slate-200 text-base mb-4">Catatan & Edukasi Khusus</h2>
        <div class="relative">
          <textarea v-model="form.notes" rows="3" placeholder="Tuliskan perkembangan atau edukasi gizi yang telah diberikan..." class="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-base font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none transition-colors resize-none"></textarea>
        </div>
      </div>

      <!-- Finalisasi -->
      <div class="pt-4 mb-8">
        <p v-if="submitError" class="text-base font-semibold text-danger text-center bg-danger/10 border border-danger/20 rounded-2xl px-4 py-3 mb-4">{{ submitError }}</p>
        <p v-if="hasPatientUpdate" class="text-base font-semibold text-success text-center bg-success/10 border border-success/20 rounded-2xl px-4 py-3 mb-4 flex items-center justify-center gap-2">
          <LucideCheckCircle2 class="w-4 h-4 shrink-0" />
          Usulan update data pasien akan ikut terkirim bersama laporan ini.
        </p>
        <p class="text-base text-center text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-4 px-2">
          Dengan mengirim formulir ini, Anda memastikan bahwa pengukuran dilakukan dengan benar dan bersedia mempertanggungjawabkan keabsahan kunjungan.
        </p>

        <button
          @click="submitData"
          :disabled="isSubmitting"
          class="w-full py-4 bg-primary text-white rounded-2xl font-black text-base uppercase tracking-widest shadow-lg shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
        >
          <LucideLoader2 v-if="isSubmitting" class="w-5 h-5 animate-spin" />
          <LucideSend v-else class="w-5 h-5" />
          {{ isSubmitting ? "Mengirim..." : "Kirim Laporan Kunjungan" }}
        </button>
      </div>
    </div>

    <!-- Modal Detail Data Pasien (z-[60]) -- field mengikuti apa adanya yang tersedia dari
         VisitAssignmentResource.patient (id/nama/alamat/phone/lat/lng/geo_status), TIDAK ada
         NIK/agama/status kawin/dst -- KOPIPU tidak menyimpan field itu sama sekali. -->
    <Transition name="fade">
      <div v-if="showPatientModal" class="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center" @click="showPatientModal = false">
        <div class="bg-white dark:bg-slate-900 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-6 shadow-2xl transition-colors duration-300 transform" @click.stop>
          <div class="flex items-center justify-between mb-6">
            <h3 class="font-bold text-slate-800 dark:text-white text-lg">Detail Data Pasien</h3>
            <button @click="showPatientModal = false" class="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 active:scale-95">
              <LucideX class="w-4 h-4" />
            </button>
          </div>

          <div class="max-h-[50vh] overflow-y-auto no-scrollbar space-y-4">
            <div class="border-b border-slate-100 dark:border-slate-800 pb-4">
              <p class="text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider">Nama</p>
              <p class="text-base font-medium text-slate-700 dark:text-slate-300">{{ patient?.nama }}</p>
            </div>
            <div class="border-b border-slate-100 dark:border-slate-800 pb-4">
              <p class="text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider">Alamat</p>
              <p class="text-base font-medium text-slate-700 dark:text-slate-300">{{ patient?.alamat || '-' }}</p>
            </div>
            <div class="border-b border-slate-100 dark:border-slate-800 pb-4">
              <p class="text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider">Nomor Telepon</p>
              <p class="text-base font-medium text-slate-700 dark:text-slate-300">{{ patient?.phone || '-' }}</p>
            </div>
            <div class="pb-2">
              <p class="text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider">Status Lokasi</p>
              <p class="text-base font-medium text-slate-700 dark:text-slate-300">
                {{ patient?.geo_status === 'verified' ? 'Titik presisi terverifikasi' : patient?.geo_status === 'approximate' ? 'Perkiraan area (centroid desa)' : 'Belum diketahui' }}
              </p>
            </div>
          </div>

          <div class="mt-6 flex flex-col gap-3">
            <button @click="showPatientModal = false" class="w-full py-3 bg-primary text-white font-bold rounded-xl active:scale-[0.98] transition-transform">Tutup</button>
            <button @click="openUpdateModal" class="w-full py-3 bg-slate-100 dark:bg-slate-800 text-primary font-bold rounded-xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
              <LucideCheckCircle2 v-if="hasPatientUpdate" class="w-4 h-4 text-success" />
              <LucidePencil v-else class="w-4 h-4" />
              {{ hasPatientUpdate ? 'Update Tersimpan — Ubah Lagi' : 'Ajukan Update Data' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Modal Ajukan Update Data (z-[70]) -- disimpan lokal saat "Simpan Update" ditekan,
         BENAR-BENAR terkirim saat "Kirim Laporan Kunjungan" (field ini bagian dari payload
         POST /visit-reports yang sama, bukan endpoint terpisah -- lihat submitData() di script). -->
    <Transition name="fade">
      <div v-if="showUpdateModal" class="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center" @click="showUpdateModal = false">
        <div class="bg-white dark:bg-slate-900 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl p-6 shadow-2xl transition-colors duration-300 transform flex flex-col max-h-[85vh]" @click.stop>
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-slate-800 dark:text-white text-lg">Update Data Pasien</h3>
            <button @click="showUpdateModal = false" class="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 active:scale-95">
              <LucideX class="w-4 h-4" />
            </button>
          </div>

          <p class="text-base text-slate-500 dark:text-slate-400 mb-4">Isi apa yang sempat Anda gali saat kunjungan — boleh sebagian saja. Data ini dikirim bersama laporan kunjungan untuk divalidasi Puskesmas/SiLAKES, tidak langsung diterapkan.</p>

          <div class="flex-1 overflow-y-auto no-scrollbar space-y-4 pb-4">
            <div>
              <label class="block text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Alamat Lengkap</label>
              <textarea v-model="updateForm.alamat" rows="2" placeholder="Jl. ..." class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none resize-none"></textarea>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">RT/RW</label>
                <input type="text" v-model="updateForm.rt_rw" placeholder="002/003" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none" />
              </div>
              <div>
                <label class="block text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Kel/Desa</label>
                <input type="text" v-model="updateForm.kel_desa" placeholder="Pamolokan" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none" />
              </div>
              <div>
                <label class="block text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Kecamatan</label>
                <input type="text" v-model="updateForm.kecamatan" placeholder="Kota Sumenep" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none" />
              </div>
            </div>
            <div>
              <label class="block text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nomor Telepon</label>
              <input type="tel" v-model="updateForm.phone" placeholder="08..." class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none" />
            </div>
            <div>
              <label class="block text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pekerjaan</label>
              <input type="text" v-model="updateForm.pekerjaan" placeholder="Mis. Petani, Pensiunan..." class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Status Perkawinan</label>
                <select v-model="updateForm.status_perkawinan" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none appearance-none">
                  <option value="">Pilih...</option>
                  <option value="BELUM KAWIN">Belum Kawin</option>
                  <option value="KAWIN">Kawin</option>
                  <option value="CERAI HIDUP">Cerai Hidup</option>
                  <option value="CERAI MATI">Cerai Mati</option>
                </select>
              </div>
              <div>
                <label class="block text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Golongan Darah</label>
                <select v-model="updateForm.golongan_darah" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none appearance-none">
                  <option value="">Pilih...</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="AB">AB</option>
                  <option value="O">O</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Agama</label>
                <select v-model="updateForm.agama" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none appearance-none">
                  <option value="">Pilih...</option>
                  <option value="ISLAM">Islam</option>
                  <option value="KRISTEN">Kristen</option>
                  <option value="KATOLIK">Katolik</option>
                  <option value="HINDU">Hindu</option>
                  <option value="BUDHA">Budha</option>
                  <option value="KONGHUCU">Konghucu</option>
                </select>
              </div>
              <div>
                <label class="block text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Status Perokok</label>
                <select v-model="updateForm.jenis_perokok" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none appearance-none">
                  <option value="">Pilih...</option>
                  <option value="AKTIF">Aktif Merokok</option>
                  <option value="PASIF">Pasif / Tidak Merokok</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Jenis Prolanis</label>
              <select v-model="updateForm.jenis_prolanis" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none appearance-none">
                <option value="">Pilih...</option>
                <option value="DM">Diabetes Mellitus (DM)</option>
                <option value="HT">Hipertensi (HT)</option>
                <option value="DM_HT">DM & Hipertensi</option>
              </select>
            </div>
            <div class="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
              <input type="checkbox" id="is_bpjs" v-model="updateForm.is_bpjs" class="w-4 h-4 rounded text-primary border-slate-300 focus:ring-primary" />
              <label for="is_bpjs" class="text-sm font-bold text-slate-700 dark:text-slate-300">Peserta BPJS</label>
            </div>
            <div v-if="updateForm.is_bpjs">
              <label class="block text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nomor BPJS</label>
              <input type="text" v-model="updateForm.no_bpjs" placeholder="0001234567890" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none" />
            </div>
          </div>

          <div class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
            <button @click="showUpdateModal = false" class="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl active:scale-[0.98] transition-transform">Batal</button>
            <button @click="submitUpdate" class="flex-1 py-3 bg-primary text-white font-bold rounded-xl active:scale-[0.98] transition-transform">Simpan Update</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

:deep(.custom-map-pin) {
  position: relative;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
:deep(.pin-core) {
  width: 16px;
  height: 16px;
  background-color: #0ea5e9;
  border: 2px solid white;
  border-radius: 50%;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  z-index: 10;
}
:deep(.pulse-ring) {
  position: absolute;
  width: 60px;
  height: 60px;
  background-color: rgba(14, 165, 233, 0.3);
  border-radius: 50%;
  animation: pulse-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
  z-index: 0;
}
@keyframes pulse-ping {
  0% {
    transform: scale(0.5);
    opacity: 1;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

:deep(.maplibregl-ctrl-bottom-right) {
  display: none !important;
}
</style>
