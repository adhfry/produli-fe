<script setup lang="ts">
import type { ApiSuccessEnvelope, Desa, Kecamatan, PatientFieldUpdates, VisitReportPemeriksaan, VisitAssignment } from '~/types/api'
import type { VisitReportDraft, VisitReportDraftPayload } from '~/composables/useOfflineQueue'

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

// Riwayat Kunjungan Pasien (revisi Bu Kadis) -- SEMUA kunjungan pasien ini SEPANJANG WAKTU, dari
// petugas manapun (kader ATAU nakes), BUKAN cuma milik kader/nakes yang sedang login. Kader/nakes
// perlu tahu kondisi kunjungan sebelumnya -- apakah dilakukan dirinya sendiri atau petugas lain --
// sebelum mengisi laporan baru. GET /patients/{id}/visit-history sudah discope PatientsCachePolicy
// ::view() (kader/nakes cuma boleh akses pasien yang PERNAH ditugaskan ke mereka, lihat
// ScopesByPuskesmas::canAccessPatientRecord) -- pasien di halaman ini otomatis lolos gerbang itu
// karena assignment SAAT INI membuktikan keterkaitannya.
const showHistoryModal = ref(false);
const patientHistory = ref<VisitAssignment[]>([]);
const isLoadingHistory = ref(false);
const historyError = ref("");
const historyLoadedFromCache = ref(false);
const expandedHistoryId = ref<number | null>(null);
let historyLoadedForPatientId: number | null = null;

async function openHistoryModal() {
  showHistoryModal.value = true;
  expandedHistoryId.value = null;

  const patientId = patient.value?.id;
  if (!patientId || historyLoadedForPatientId === patientId) return;

  isLoadingHistory.value = true;
  historyError.value = "";
  historyLoadedFromCache.value = false;
  const cacheKey = `visit_history_${patientId}`;
  const offlineCache = useOfflineCache();
  try {
    const api = useApi();
    const res = (await api(`/patients/${patientId}/visit-history`)) as ApiSuccessEnvelope<VisitAssignment[]>;
    patientHistory.value = res.data;
    historyLoadedForPatientId = patientId;
    await offlineCache.setCached(cacheKey, res.data);
  } catch (e) {
    // docs/planning/12: ApiError (401 dkk) = server menjawab, bukan alasan fallback ke cache
    // basi. Cuma exception jaringan murni yang layak pakai riwayat tersimpan terakhir.
    if (!(e instanceof ApiError)) {
      const cached = await offlineCache.getCached<VisitAssignment[]>(cacheKey);
      if (cached) {
        patientHistory.value = cached.value;
        historyLoadedForPatientId = patientId;
        historyLoadedFromCache.value = true;
        isLoadingHistory.value = false;
        return;
      }
    }
    historyError.value = e instanceof ApiError ? e.message : "Gagal memuat riwayat kunjungan pasien.";
  } finally {
    isLoadingHistory.value = false;
  }
}

function toggleHistoryEntry(id: number) {
  expandedHistoryId.value = expandedHistoryId.value === id ? null : id;
}

// Label SAMA PERSIS dashboard/pasien/[id].vue & dashboard/kunjungan/[id].vue -- konsisten di
// seluruh aplikasi (admin & mobile kader/nakes).
const HISTORY_TINDAKAN_LABELS: Record<string, string> = {
  diberi_obat: "Diberi Obat", dirujuk_puskesmas: "Dirujuk ke Puskesmas", tidak_ada: "Tidak Ada Tindakan"
};
const HISTORY_CARA_RUJUKAN_LABELS: Record<string, string> = {
  datang_sendiri: "Datang Sendiri", dijemput_ambulan: "Dijemput Ambulan",
  diantar_keluarga: "Diantar Keluarga", diantar_nakes_kader: "Diantar Nakes/Kader"
};
const HISTORY_KEPATUHAN_OBAT_LABELS: Record<string, string> = {
  patuh: "Patuh", kurang_patuh: "Kurang Patuh", tidak_patuh: "Tidak Patuh"
};
const HISTORY_SISA_OBAT_LABELS: Record<string, string> = {
  cukup: "Cukup", menipis: "Menipis", habis: "Habis"
};
const HISTORY_STATUS_LABELS: Record<string, string> = {
  pending: "Belum Dikunjungi", in_progress: "Sedang Proses", completed: "Selesai", cancelled: "Dibatalkan"
};
const HISTORY_STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  in_progress: "bg-info/10 text-info",
  completed: "bg-success/10 text-success",
  cancelled: "bg-danger/10 text-danger"
};

function formatHistoryTindakan(tindakan: string[] | null): string {
  return (tindakan ?? []).map((t) => HISTORY_TINDAKAN_LABELS[t] ?? t).join(", ");
}

// Ringkasan "Obat A (500mg, 2x/hari), Obat B" -- dosis/frekuensi ikut disertakan HANYA kalau
// diisi (kader kadang cuma sempat catat nama obatnya saja, lihat SubmitVisitReportRequest).
function formatHistoryObatDetail(obatDetail: { nama: string, dosis: string | null, frekuensi: string | null }[] | null): string {
  return (obatDetail ?? [])
    .map((o) => {
      const rincian = [o.dosis, o.frekuensi].filter((v) => v && v.trim() !== "").join(", ");
      return rincian ? `${o.nama} (${rincian})` : o.nama;
    })
    .join("; ");
}

// 'primary'/'companion' = viewer (kader/nakes yang sedang login) BERPERAN di kunjungan itu --
// "Anda", null = petugas lain sama sekali. Dihitung backend (VisitAssignmentResource::
// role_in_assignment), bukan ditebak dari nama (lebih akurat, tidak salah kalau ada nama kembar).
function historyPetugasLabel(entry: VisitAssignment): string {
  if (entry.role_in_assignment === "primary") return "Anda (Petugas Utama)";
  if (entry.role_in_assignment === "companion") return "Anda (Pendamping)";
  const nama = entry.tenaga_kesehatan?.name ?? entry.kader?.name ?? "Petugas tidak diketahui";
  const tipe = entry.tenaga_kesehatan ? "Tenaga Kesehatan" : "Kader";
  return `${nama} (${tipe})`;
}

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

// Typeahead Kel/Desa & Kecamatan (bukan input teks bebas) -- nilai yang diajukan HARUS persis
// sama (huruf besar/kecil) dengan tabel kecamatan/desa kanonik, supaya WilayahResolver di
// backend tidak perlu fuzzy-match teks bebas untuk usulan dari kader/nakes lewat laporan ini.
const kecamatanList = ref<Kecamatan[]>([]);
const desaList = ref<Desa[]>([]);
const selectedKecamatanId = ref<number | null>(null);
const isLoadingDesa = ref(false);

async function loadKecamatanList() {
  try {
    const api = useApi();
    const res = (await api("/kecamatan")) as ApiSuccessEnvelope<Kecamatan[]>;
    kecamatanList.value = res.data;
  } catch {
    // Non-fatal -- dropdown kecamatan cuma kosong, field lain tetap bisa diisi.
  }
}
onMounted(loadKecamatanList);

async function loadDesaList(kecamatanId: number) {
  isLoadingDesa.value = true;
  try {
    const api = useApi();
    const res = (await api("/desa", { query: { kecamatan_id: kecamatanId } })) as ApiSuccessEnvelope<Desa[]>;
    desaList.value = res.data;
  } catch {
    desaList.value = [];
  } finally {
    isLoadingDesa.value = false;
  }
}

// Dipicu HANYA saat user benar-benar mengganti kecamatan lewat dropdown (bukan pre-select
// terprogram di openUpdateModal) -- kel_desa lama dikosongkan karena sudah tidak relevan
// dengan kecamatan baru.
function onKecamatanChange(event: Event) {
  const kecamatanId = Number((event.target as HTMLSelectElement).value) || null;
  selectedKecamatanId.value = kecamatanId;
  const kecamatan = kecamatanList.value.find((k) => k.id === kecamatanId);
  updateForm.value.kecamatan = kecamatan?.nama ?? "";
  updateForm.value.kel_desa = "";
  desaList.value = [];
  if (kecamatanId !== null) loadDesaList(kecamatanId);
}

const openUpdateModal = async () => {
  updateForm.value = {
    alamat: patient.value?.alamat ?? "",
    phone: patient.value?.phone ?? "",
  };
  // Coba pre-select kecamatan & kel/desa kalau nilai existing (teks bebas dari SiLAKES)
  // kebetulan cocok dengan nama kanonik -- kalau tidak cocok, biarkan kosong (kader pilih
  // ulang lewat dropdown, otomatis jadi kanonik).
  const matchedKecamatan = kecamatanList.value.find(
    (k) => k.nama.toLowerCase() === (patient.value?.kecamatan_raw ?? "").trim().toLowerCase()
  );
  selectedKecamatanId.value = matchedKecamatan?.id ?? null;
  updateForm.value.kecamatan = matchedKecamatan?.nama ?? "";
  desaList.value = [];
  if (matchedKecamatan) {
    await loadDesaList(matchedKecamatan.id);
    const matchedDesa = desaList.value.find(
      (d) => d.nama.toLowerCase() === (patient.value?.kel_desa_raw ?? "").trim().toLowerCase()
    );
    updateForm.value.kel_desa = matchedDesa?.nama ?? "";
  }
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
  // Permintaan user (revisi): kembali jadi radio EKSKLUSIF (BUKAN lagi multi-select Fase 2) --
  // array 0-1 elemen dipertahankan cuma supaya wire format (tindakan[]) & kolom JSON backend
  // tidak perlu migrasi ulang, tapi UI/perilakunya sekarang "harus pilih salah satu", lihat
  // selectTindakan() di bawah.
  tindakan: [] as ("diberi_obat" | "dirujuk_puskesmas" | "tidak_ada")[],
  cara_rujukan: "" as "" | "datang_sendiri" | "dijemput_ambulan" | "diantar_keluarga" | "diantar_nakes_kader",
  // Detail obat (permintaan user) -- HANYA relevan kalau tindakan='diberi_obat', bisa >1 obat.
  // Diisi siapa pun yang submit laporan ini (kader ATAU nakes kalau kunjungan bareng -- lihat
  // komentar kartu Tindakan di bawah, sengaja TIDAK digerbang role).
  obatDetail: [] as { nama: string; dosis: string; frekuensi: string }[],
  kepatuhan_obat: "" as "" | "patuh" | "kurang_patuh" | "tidak_patuh",
  sisa_obat: "" as "" | "cukup" | "menipis" | "habis",
  notes: "",
  photoUrl: null as string | null,
  lat: null as number | null,
  lng: null as number | null,
  accuracy: null as number | null,
  gpsCapturedAt: null as string | null,
  fullAddress: "Mencari detail alamat...",
  // Permintaan user: kader/nakes yang BENAR-BENAR berdiri di rumah pasien saat submit --
  // dikirim sbg confirmed_patient_location, dipakai backend (VisitReportService::submit())
  // utk (1) menandai geo_status pasien 'verified' dari titik ini, DAN (2) resolusi otomatis
  // desa/kecamatan lewat titik-dalam-polygon (WilayahResolver::resolveByCoordinates(), berguna
  // khususnya utk ~93% pasien yang wilayah_status='unknown' krn SiLAKES tidak pernah kirim
  // alamat mereka sama sekali). Default TRUE -- kunjungan rumah SECARA DEFINISI berarti kader
  // ada di lokasi pasien; opsi uncheck disediakan utk kasus jarang (mis. submit telat/dari
  // tempat lain karena sinyal). Sebelumnya field ini TIDAK PERNAH dikirim sama sekali dari
  // sini -- backend sudah siap tapi tidak pernah terpicu, lihat commit backend terkait.
  confirmedPatientLocation: true,
});

// Tindakan REVISI KEDUA (permintaan user) -- 'diberi_obat' & 'dirujuk_puskesmas' sekarang bisa
// di-combo ATAU pilih salah satu (checkbox independen antar keduanya), tapi 'tidak_ada' TETAP
// eksklusif: memilihnya membuang pilihan lain, dan memilih diberi_obat/dirujuk_puskesmas
// otomatis membuang 'tidak_ada' kalau sedang aktif (lihat SubmitVisitReportRequest sisi backend
// utk aturan validasi yang sama persis). Kader JUGA bisa mencatat tindakan (termasuk rujukan) --
// BUKAN cuma nakes, jadi kartu ini (lihat template) sengaja tidak digerbang isNakesAssignment.
const isTindakanChecked = (value: "diberi_obat" | "dirujuk_puskesmas" | "tidak_ada") => form.value.tindakan.includes(value);
const toggleTindakan = (value: "diberi_obat" | "dirujuk_puskesmas" | "tidak_ada") => {
  if (isTindakanChecked(value)) {
    form.value.tindakan = form.value.tindakan.filter((t) => t !== value);
  } else if (value === "tidak_ada") {
    form.value.tindakan = ["tidak_ada"];
  } else {
    form.value.tindakan = [...form.value.tindakan.filter((t) => t !== "tidak_ada"), value];
  }
  if (!form.value.tindakan.includes("dirujuk_puskesmas")) form.value.cara_rujukan = "";
  if (!form.value.tindakan.includes("diberi_obat")) form.value.obatDetail = [];
  else if (form.value.obatDetail.length === 0) addObatDetail();
};
const isRujukan = computed(() => form.value.tindakan.includes("dirujuk_puskesmas"));
const isDiberiObat = computed(() => form.value.tindakan.includes("diberi_obat"));

// Detail obat -- minimal 1 baris begitu "Diberi Obat" dipilih (lihat selectTindakan()), kader/
// nakes bisa tambah lagi kalau >1 obat. Baris kosong (nama belum diisi) DIBUANG saat submit
// (buildObatDetailPayload()), bukan divalidasi wajib di sini -- biar tidak menghalangi submit
// kalau sekadar lupa isi salah satu baris tambahan.
function addObatDetail() {
  form.value.obatDetail.push({ nama: "", dosis: "", frekuensi: "" });
}
function removeObatDetail(index: number) {
  form.value.obatDetail.splice(index, 1);
}

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

// Preload logo sekali di awal (bukan per-jepret) -- canvas drawImage butuh <img> yang statusnya
// SUDAH loaded, kalau baru mulai load saat jepret pertama, resiko race (gambar belum siap) atau
// harus bikin downloadCapturedPhoto() jadi async penuh. Nama pasien awalan sudah dikonfirmasi
// petugas login lewat authStore, jadi tidak perlu fetch tambahan.
const authStore = useAuthStore();
const logoImg = ref<HTMLImageElement | null>(null);
onMounted(() => {
  const img = new Image();
  img.onload = () => { logoImg.value = img; };
  img.src = "/logo/logo-no-text.png";
});

// Gambar statis hasil komposit watermark, ditampilkan di kartu review sesudah capture --
// menggantikan overlay HTML/CSS live (jam berdetik, map interaktif) yang sebelumnya dipasang
// di atas <img> foto polos (temuan lapangan: "bukan UI lagi tapi gambar"). null selama kamera
// masih live (modal fullscreen yang tampil, bukan kartu review).
const reviewImageUrl = ref<string | null>(null);

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
    // width+aspectRatio (BUKAN width+height sama-sama ideal 1920) -- constraint lama memaksa
    // browser memilih resolusi sensor mendekati PERSEGI (1920x1920), padahal tampilan di layar
    // (object-cover, container fixed inset-0) terlihat potret proporsional cuma karena di-crop
    // CSS. aspectRatio ideal 3/4 (BUKAN 9/16 lagi -- temuan lapangan "ngezoom banget": 9/16
    // terlalu ekstrem dibanding rasio native sensor kebanyakan HP, walau ideal cuma hint/tidak
    // selalu dihormati device, hint yang lebih dekat rasio wajar tetap membantu). captureFrame()
    // TETAP jujur -- tidak resize sembarangan, cuma crop WYSIWYG mengikuti kotak video 3:4 yang
    // benar-benar dirender (lihat komentar di template modal kamera).
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1080 }, aspectRatio: { ideal: 3 / 4 } },
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

// Alamat lengkap ditampilkan APA ADANYA (bukan dipotong "…" lagi, temuan lapangan) -- bungkus
// per kata ke baris baru selama masih muat lebar kolom teks, canvas tidak punya word-wrap
// bawaan seperti CSS.
function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const word = words[i]!;
    const candidate = `${current} ${word}`;
    if (ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  lines.push(current);
  return lines;
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Komposit watermark dipakai BERSAMA untuk 2 tujuan (dibangun sekali per jepretan, bukan
// dobel): (1) kartu review di halaman (reviewImageUrl) -- gambar statis beku persis momen
// jepretan, BUKAN overlay HTML/CSS live yang jamnya terus berdetik seperti sebelumnya
// (temuan lapangan: "bukan UI lagi tapi gambar"); (2) auto-download (bonus verifikasi).
// TIDAK PERNAH dipakai untuk form.value.photoUrl (file yang disubmit ke backend) -- itu tetap
// frame mentah polos, watermark resmi dibakar server-side (WatermarkGenerator), supaya tidak
// dobel watermark.
function buildWatermarkComposite(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = sourceCanvas.width;
  out.height = sourceCanvas.height;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(sourceCanvas, 0, 0);

  const p = patient.value;
  const pad = Math.round(out.width * 0.035);
  const radius = Math.round(out.width * 0.025);

  // Badge logo+"PRODULI" pojok kiri atas -- sama seperti overlay live, sekarang pakai logo
  // ASLI (bukan cuma teks) yang di-preload onMounted.
  const badgeFont = Math.max(11, Math.round(out.width / 42));
  const badgeIconSize = badgeFont * 1.6;
  ctx.font = `bold ${badgeFont}px sans-serif`;
  const badgeText = "PRODULI";
  const badgeTextWidth = ctx.measureText(badgeText).width;
  const badgePadX = badgeFont * 0.7;
  const hasLogo = !!logoImg.value;
  const badgeW = badgePadX + (hasLogo ? badgeIconSize + badgePadX * 0.6 : 0) + badgeTextWidth + badgePadX;
  const badgeH = badgeFont * 2.2;
  ctx.fillStyle = "#ffffff";
  roundedRectPath(ctx, pad, pad, badgeW, badgeH, radius * 0.5);
  ctx.fill();
  let badgeCursorX = pad + badgePadX;
  if (hasLogo && logoImg.value) {
    ctx.drawImage(logoImg.value, badgeCursorX, pad + (badgeH - badgeIconSize) / 2, badgeIconSize, badgeIconSize);
    badgeCursorX += badgeIconSize + badgePadX * 0.6;
  }
  ctx.fillStyle = "#0d9488";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, badgeCursorX, pad + badgeH / 2);

  // Kumpulkan baris info dulu (jumlahnya variabel -- pendamping cuma muncul kalau ada yang
  // dicentang hadir di checklist, attendeeKaderIds) supaya tinggi kartu bisa dihitung pas.
  const namaPetugas = authStore.user?.name || "-";
  const namaPendamping = plannedCompanions.value
    .filter((c) => isAttendeeChecked(c.kader_id))
    .map((c) => c.nama)
    .join(", ");

  const bodyLines: { text: string; bold?: boolean; muted?: boolean }[] = [
    { text: `${dateNow.value} · ${timeNow.value} WIB`, bold: true },
    { text: `Petugas: ${namaPetugas}` },
  ];
  if (namaPendamping) bodyLines.push({ text: `Pendamping: ${namaPendamping}` });
  bodyLines.push({ text: `Pasien: ${p?.nama ?? "-"}` });
  if (weather.value.temp !== null || weather.value.wind !== null) {
    bodyLines.push({
      text: `${weather.value.temp !== null ? weather.value.temp + "°C" : "-"}   ${weather.value.wind !== null ? weather.value.wind + " km/j" : "-"}`,
      muted: true,
    });
  }

  const titleSize = Math.max(13, Math.round(out.width / 30));
  const bodySize = Math.round(titleSize * 0.78);
  const lineH = bodySize * 1.45;
  const thumbSize = Math.round(out.width * 0.18);
  const cardMargin = Math.round(out.width * 0.025);
  const innerPad = Math.round(out.width * 0.03);
  const gapAfterThumb = innerPad * 0.9; // gap antara peta & blok teks alamat -- temuan lapangan
  const gapBetweenSections = innerPad * 1.1; // gap antara baris peta & baris info bawah -- idem
  const cardW = out.width - cardMargin * 2;
  const cardX = cardMargin;

  // Alamat lengkap ditampilkan APA ADANYA (bukan dipotong "…" lagi, temuan lapangan) -- dibungkus
  // ke berapapun baris yang dibutuhkan. Tinggi baris peta (headRowHeight) jadi mengikuti YANG
  // LEBIH TINGGI antara thumbnail peta dan blok teks lokasi/alamat/koordinat (bisa saja alamat
  // panjang butuh 3-4 baris, lebih tinggi dari thumbnail 18% lebar itu sendiri).
  ctx.font = `${bodySize}px sans-serif`;
  const textX = cardX + innerPad + thumbSize + gapAfterThumb;
  const textAreaW = cardX + cardW - innerPad - textX;
  const addressLines = wrapCanvasText(ctx, form.value.fullAddress || "-", textAreaW);
  const headTextHeight = titleSize * 1.35 + addressLines.length * (bodySize * 1.4) + bodySize * 1.4;
  const headRowHeight = Math.max(thumbSize, headTextHeight);

  const cardH = Math.round(innerPad * 1.3 + headRowHeight + gapBetweenSections + lineH * bodyLines.length + innerPad * 0.5);
  const cardY = out.height - cardH - cardMargin;

  ctx.fillStyle = "rgba(15, 23, 42, 0.68)";
  roundedRectPath(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.fill();

  // Thumbnail peta, sudut membulat -- diambil langsung dari canvas WebGL MapLibre
  // (#maplibre-mini) yang MASIH hidup di modal kamera saat fungsi ini dipanggil (captureFrame()
  // manggil sebelum stopCamera()/unmount, Vue baru bongkar DOM-nya di microtask berikutnya).
  // Marker MapLibre TIDAK ikut ter-drawImage (itu elemen DOM overlay terpisah, bukan bagian
  // raster canvas) -- makanya titik lokasi digambar manual di tengah thumbnail (peta selalu
  // di-center ke koordinat user, jadi tengah = posisi user, persis).
  const thumbX = cardX + innerPad;
  const thumbY = cardY + innerPad * 0.7;
  const mapCanvas = document.querySelector<HTMLCanvasElement>("#maplibre-mini canvas");
  ctx.save();
  roundedRectPath(ctx, thumbX, thumbY, thumbSize, thumbSize, radius * 0.7);
  ctx.clip();
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize);
  if (mapCanvas && mapCanvas.width > 0 && mapCanvas.height > 0) {
    try {
      ctx.drawImage(mapCanvas, thumbX, thumbY, thumbSize, thumbSize);
    } catch {
      // biarkan fallback warna solid di atas -- jangan sampai seluruh watermark gagal
    }
  }
  ctx.restore();
  // Pin lokasi (biru, sama seperti .pin-core CSS marker live) -- selalu di tengah thumbnail.
  const pinX = thumbX + thumbSize / 2;
  const pinY = thumbY + thumbSize / 2;
  ctx.beginPath();
  ctx.arc(pinX, pinY, thumbSize * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(14, 165, 233, 0.3)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(pinX, pinY, thumbSize * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = "#0ea5e9";
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, thumbSize * 0.02);
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  let y = thumbY;
  ctx.textBaseline = "top";

  ctx.font = `bold ${titleSize}px sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(locationName.value || "-", textX, y);
  y += titleSize * 1.35;

  ctx.font = `${bodySize}px sans-serif`;
  ctx.fillStyle = "#e2e8f0";
  for (const line of addressLines) {
    ctx.fillText(line, textX, y);
    y += bodySize * 1.4;
  }

  ctx.fillText(`Lat ${(form.value.lat ?? 0).toFixed(6)}  Long ${(form.value.lng ?? 0).toFixed(6)}  ±${form.value.accuracy ?? "-"}m`, textX, y);

  // Baris info bawah (waktu/petugas/pendamping/pasien/cuaca) -- diberi jarak tegas dari baris
  // peta/alamat di atasnya (gapBetweenSections), sebelumnya terlalu mepet ke peta (temuan
  // lapangan). Pakai headRowHeight (bukan thumbSize polos) supaya tetap benar walau alamat
  // panjang butuh lebih banyak baris daripada tinggi thumbnail peta.
  y = thumbY + headRowHeight + gapBetweenSections;
  for (const line of bodyLines) {
    ctx.font = line.bold ? `bold ${bodySize}px sans-serif` : `${bodySize}px sans-serif`;
    ctx.fillStyle = line.muted ? "#cbd5e1" : "#ffffff";
    ctx.fillText(line.text, cardX + innerPad, y);
    y += lineH;
  }

  return out;
}

function triggerImageDownload(dataUrl: string, patientName: string) {
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = (patientName || "pasien").replace(/\s+/g, "_").toLowerCase();
  a.href = dataUrl;
  a.download = `produli-kunjungan-${safeName}-${stamp}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// BUG NYATA (laporan lapangan: foto auto-download sudah lengkap -- logo, peta mini, lokasi,
// teks -- tapi yang tersimpan di server "kering", tanpa apa pun) -- SEBELUMNYA foto yang
// disubmit sengaja frame mentah (backend yang membakar watermark resminya sendiri,
// WatermarkGenerator Layer 4), TAPI watermark server itu cuma teks polos (nama+waktu+
// koordinat), jauh lebih sederhana dari komposit di bawah (logo asli, thumbnail peta MapLibre
// live, alamat lengkap, cuaca) -- dan thumbnail peta MEMANG MUSTAHIL direkonstruksi ulang di
// server (cuma ada selagi kamera+peta live di browser). Sekarang foto YANG DISUBMIT adalah
// KOMPOSIT yang sama persis dengan auto-download/kartu review (satu sumber kebenaran, WYSIWYG
// dijamin identik) -- WatermarkGenerator server-side sudah dinonaktifkan (lihat
// app/Services/Visit/Validation/Layers/WatermarkGenerator.php) supaya tidak double-watermark.
const captureFrame = () => {
  const video = videoRef.value;
  const canvas = canvasRef.value;
  if (!video || !canvas) return;
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  // Crop WYSIWYG -- SEBELUMNYA canvas dipaksa ukuran vw x vh utuh (buffer mentah kamera) tanpa
  // crop, padahal tampilan live di layar sudah di-crop CSS object-cover ke rasio viewport.
  // Banyak device Android tidak menghormati constraint aspectRatio ideal di getUserMedia
  // (startCamera di atas), jadi vw/vh sering kali balik jadi landscape walau layar HP potret --
  // hasilnya foto tersimpan jadi persegi panjang landscape yang beda total dari yang terlihat
  // kader saat menjepret ("kepotong jadi landscape" -- temuan lapangan). Replikasi PERSIS
  // matematika object-cover di sini (crop tengah ke rasio kotak video yang benar-benar
  // dirender di layar) supaya file yang tersimpan selalu match dengan yang terlihat kader.
  const rect = video.getBoundingClientRect();
  const targetRatio = rect.width / rect.height;
  const sourceRatio = vw / vh;
  let sx = 0, sy = 0, sw = vw, sh = vh;
  if (sourceRatio > targetRatio) {
    sw = vh * targetRatio;
    sx = (vw - sw) / 2;
  } else {
    sh = vw / targetRatio;
    sy = (vh - sh) / 2;
  }

  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

  // captureAreaRatio (kartu review sesudah kamera ditutup) harus ikut rasio HASIL CROP, bukan
  // rasio buffer mentah lagi -- kalau tidak, kartu review jadi salah proporsi dibanding foto
  // yang sesungguhnya tersimpan di form.value.photoUrl.
  nativeVideoWidth.value = sw;
  nativeVideoHeight.value = sh;

  // Fallback dulu -- frame mentah polos, DIPERTAHANKAN cuma untuk kasus komposit gagal di bawah
  // (mis. canvas MapLibre tainted karena tile server tidak kirim header CORS). Kalau komposit
  // berhasil, INI DITIMPA di bawah supaya foto yang benar-benar tersubmit = yang terlihat di
  // kartu review & auto-download, bukan lagi 2 sumber yang berbeda.
  form.value.photoUrl = canvas.toDataURL("image/jpeg", 0.9);

  // Komposit watermark (peta #maplibre-mini HARUS diambil di sini, SEBELUM stopCamera()/unmount
  // modal live) -- dipakai untuk 3 tujuan sekaligus: kartu review (gambar statis beku, bukan
  // overlay live lagi), auto-download, DAN foto yang disubmit ke server (form.value.photoUrl) --
  // satu sumber kebenaran, WYSIWYG dijamin identik di ketiganya. Best-effort: kalau gagal, JANGAN
  // sampai menghentikan captureFrame() -- stopCamera() & kartu review tetap harus jalan, fallback
  // ke foto polos tanpa watermark (fallback di atas tetap berlaku).
  try {
    const composite = buildWatermarkComposite(canvas);
    const compositeUrl = composite.toDataURL("image/jpeg", 0.92);
    reviewImageUrl.value = compositeUrl;
    form.value.photoUrl = compositeUrl;
    triggerImageDownload(compositeUrl, patient.value?.nama ?? "pasien");
  } catch (e) {
    console.error("Gagal membuat komposit watermark (tidak fatal, lanjut submit seperti biasa):", e);
    reviewImageUrl.value = form.value.photoUrl;
  }
  stopCamera();
};

const retakePhoto = () => {
  form.value.photoUrl = null;
  reviewImageUrl.value = null;
  startCamera();

  // BUG SEBELUMNYA: initMapLibre('maplibre-mini', ...) di startGpsWatch() cuma jalan SEKALI
  // (guard hasResolvedLocationDetailOnce), jadi begitu retake membuka ulang modal live -- Vue
  // bikin container #maplibre-mini BARU -- tidak ada apapun yang menginisialisasi peta di
  // situ, tampil blank. Panggil langsung di sini pakai koordinat yang sudah ada (tidak perlu
  // tunggu fix GPS baru), setelah container barunya benar-benar ter-render (nextTick).
  nextTick(() => {
    if (form.value.lat !== null && form.value.lng !== null) {
      initMapLibre("maplibre-mini", form.value.lat, form.value.lng, true);
    }
  });
};

// Instance PERSISTEN per slot (mini/main) -- container #maplibre-mini dibongkar-pasang Vue
// v-if BERKALI-KALI (modal live <-> kartu review <-> modal live lagi saat retake), tiap kali
// container lama lenyap instance MapLibre lama JADI DANGLING (masih hidup di memori, WebGL
// context masih dipegang) kalau tidak di-remove() eksplisit -- browser punya batas jumlah
// WebGL context bersamaan, retake berkali-kali tanpa cleanup ini bisa bikin context baru gagal
// dibuat sama sekali (peta blank kosong, persis temuan lapangan).
let miniMapInstance: any = null;
let mainMapInstance: any = null;

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
    // Non-interaktif untuk KEDUA slot (main & mini) -- kader/nakes cuma perlu MELIHAT titik
    // penetapan lokasi, bukan menggeser/zoom peta (temuan lapangan: risiko tergeser tanpa
    // sadar, koordinat yang disubmit tetap dari GPS device, bukan dari interaksi peta).
    interactive: false,
  });

  const el = document.createElement("div");
  el.className = "custom-map-pin";
  el.innerHTML = `<div class="pulse-ring"></div><div class="pin-core"></div>`;

  new w.maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);

  if (isMini) {
    miniMapInstance?.remove();
    miniMapInstance = map;
  } else {
    mainMapInstance?.remove();
    mainMapInstance = map;
  }

  return map;
};

let orientationTimeout: ReturnType<typeof setTimeout>;
const handleOrientationChange = () => {
  clearTimeout(orientationTimeout);
  orientationTimeout = setTimeout(onVideoMetadataLoaded, 300);
};

// GPS kontinu (watchPosition), BUKAN one-shot getCurrentPosition -- root cause bug "Titik GPS
// Sudah Terlalu Lama": SEBELUMNYA GPS cuma di-fix SEKALI saat halaman dibuka lalu tidak pernah
// direfresh sampai submit, padahal kader butuh waktu (kadang bermenit-menit) mengisi form
// pemeriksaan klinis lengkap setelah foto diambil -- gpsCapturedAt jadi selalu basi di mata
// GpsActiveCheck backend. form.value.lat/lng/accuracy/gpsCapturedAt sekarang terus diperbarui
// tiap ada fix baru selama modal kamera aktif, jadi PERSIS SAAT captureFrame() dieksekusi
// (setelah countdown), nilai yang ikut tersimpan adalah fix GPS TERSEGAR yang tersedia --
// foto+lokasi+waktu jadi satu momen atomik (bukan lagi fix basi dari momen halaman dibuka).
// Draft/offline (buildDraftPayload() baca form.value yang sama) otomatis ikut benar tanpa kode
// tambahan.
let gpsWatchId: number | null = null;
let hasResolvedLocationDetailOnce = false;

function startGpsWatch() {
  if (!navigator.geolocation) return;

  gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      form.value.lat = lat;
      form.value.lng = lng;
      form.value.accuracy = Math.round(pos.coords.accuracy);
      // pos.timestamp = waktu FIX GPS sesungguhnya (bukan Date.now() saat callback ini jalan).
      form.value.gpsCapturedAt = new Date(pos.timestamp).toISOString();
      isGpsValid.value = true;
      gpsStatus.value = "Lokasi Terkunci (Radius Akurat)";

      // Peta mini/utama & reverse-geocode/cuaca (Nominatim/Open-Meteo, API pihak ketiga dgn
      // rate limit) SENGAJA cuma sekali di fix PERTAMA -- bukan tiap watchPosition tick (bisa
      // beberapa kali per menit), supaya tidak membombardir API eksternal maupun bikin instance
      // maplibre baru berulang kali.
      if (hasResolvedLocationDetailOnce) return;
      hasResolvedLocationDetailOnce = true;

      setTimeout(() => {
        initMapLibre("maplibre-main", lat, lng);
        initMapLibre("maplibre-mini", lat, lng, true);
      }, 300);

      resolveAddressAndWeather(lat, lng);
    },
    () => {
      gpsStatus.value = "Akses Lokasi Ditolak";
      form.value.fullAddress = "Harap izinkan akses lokasi (GPS).";
    },
    { enableHighAccuracy: true },
  );
}

function stopGpsWatch() {
  if (gpsWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }
}

async function resolveAddressAndWeather(lat: number, lng: number) {
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
}

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
    startGpsWatch();
  }, 500);
}, { immediate: true });

onUnmounted(() => {
  window.removeEventListener("resize", handleOrientationChange);
  if (timer) clearInterval(timer);
  stopCamera();
  stopGpsWatch();
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

// Baris kosong (nama belum diisi) dibuang -- kader/nakes bisa saja menambah baris "+ Tambah
// Obat Lain" lalu tidak jadi mengisinya, tidak perlu ikut terkirim sbg entri kosong.
function buildObatDetailPayload(): { nama: string; dosis: string; frekuensi: string }[] | null {
  if (!isDiberiObat.value) return null;
  const filled = form.value.obatDetail
    .filter((o) => o.nama.trim() !== "")
    .map((o) => ({ nama: o.nama.trim(), dosis: o.dosis.trim(), frekuensi: o.frekuensi.trim() }));
  return filled.length > 0 ? filled : null;
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
    tindakan: form.value.tindakan.length > 0 ? [...form.value.tindakan] : null,
    cara_rujukan: form.value.cara_rujukan || null,
    obat_detail: buildObatDetailPayload(),
    kepatuhan_obat: form.value.kepatuhan_obat || null,
    sisa_obat: form.value.sisa_obat || null,
    attendeeKaderIds: [...attendeeKaderIds.value],
    patientFieldUpdates: buildPatientFieldUpdates(),
    confirmedPatientLocation: form.value.confirmedPatientLocation,
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
  payload.tindakan?.forEach((t) => fd.append("tindakan[]", t));
  if (payload.cara_rujukan) fd.append("cara_rujukan", payload.cara_rujukan);
  payload.obat_detail?.forEach((o, i) => {
    fd.append(`obat_detail[${i}][nama]`, o.nama);
    fd.append(`obat_detail[${i}][dosis]`, o.dosis);
    fd.append(`obat_detail[${i}][frekuensi]`, o.frekuensi);
  });
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

  fd.append("confirmed_patient_location", payload.confirmedPatientLocation ? "1" : "0");

  return fd;
}

const offlineQueue = useOfflineQueue();

// docs/planning/14: draft-in-progress -- BEDA dari entri antrean sync (yang tercipta otomatis
// saat submit GAGAL). Ini SENGAJA disimpan user (manual ATAU auto-save berkala) SELAGI masih
// mengisi, supaya kerja yang sudah diketik/difoto tidak hilang kalau tab tertutup/HP restart
// sebelum sempat menekan "Kirim Laporan". Status 'draft' TIDAK PERNAH ikut disinkron otomatis
// (lihat useOfflineQueue.syncAllDrafts()) -- baru masuk antrean sync begitu user benar-benar
// menekan submit (lewat submitData() di atas, jalur normal).
//
// Revisi -- TIDAK LAGI menunggu konfirmasi user ("Pulihkan?" dua tombol) sebelum mengisi form:
// draft WIP yang ditemukan langsung diterapkan otomatis (lihat onMounted di bawah), showRestore
// Notice cuma strip kecil non-blocking yang bisa diabaikan/ditutup, BUKAN gerbang wajib --
// kerja lama tidak boleh butuh 1 klik ekstra cuma untuk terlihat lagi.
const showRestoreNotice = ref(false);
const restorableDraft = ref<VisitReportDraft | null>(null);
const draftSaveStatus = ref<"idle" | "saving" | "saved">("idle");
let draftSaveDebounce: ReturnType<typeof setTimeout> | null = null;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Cuma field "isi kerja" yang dipulihkan -- BUKAN lat/lng/gpsCapturedAt (biar tetap diisi ulang
// oleh capture GPS hidup yang sudah otomatis jalan di halaman ini, supaya validasi kesegaran GPS
// backend -- GpsActiveCheck, Layer 1 -- tidak menolak titik lama yang sudah basi begitu draft
// lama dipulihkan). Attendee & pengajuan perubahan data pasien belum ikut dipulihkan (di luar
// cakupan awal fitur ini).
function applyDraftPayloadToForm(payload: VisitReportDraftPayload) {
  form.value.kondisi = payload.kondisi;
  form.value.notes = payload.catatan ?? "";
  form.value.systolic = payload.systolic ?? "";
  form.value.diastolic = payload.diastolic ?? "";
  form.value.gda = payload.gda ?? "";
  form.value.gdp = payload.gdp ?? "";
  form.value.gd2jpp = payload.gd2jpp ?? "";
  form.value.uric_acid = payload.uric_acid ?? "";
  form.value.cholesterol = payload.cholesterol ?? "";
  form.value.keluhan = payload.keluhan ?? "";
  form.value.tindakan = [...(payload.tindakan ?? [])] as typeof form.value.tindakan;
  form.value.cara_rujukan = (payload.cara_rujukan ?? "") as typeof form.value.cara_rujukan;
  form.value.obatDetail = payload.obat_detail ? payload.obat_detail.map((o) => ({ ...o })) : [];
  form.value.kepatuhan_obat = (payload.kepatuhan_obat ?? "") as typeof form.value.kepatuhan_obat;
  form.value.sisa_obat = (payload.sisa_obat ?? "") as typeof form.value.sisa_obat;
  form.value.confirmedPatientLocation = payload.confirmedPatientLocation;
}

async function restoreDraft() {
  const draft = restorableDraft.value;
  if (!draft) return;
  applyDraftPayloadToForm(draft.payload);
  if (draft.photo) form.value.photoUrl = await blobToDataUrl(draft.photo);
}

// Aksi kecil non-blocking ("Mulai Kosong" di strip showRestoreNotice) -- user yang memang
// sengaja mau mulai dari nol, BUKAN gerbang wajib sebelum form bisa dipakai (form sudah terisi
// otomatis sejak mount). Foto ikut dibuang & kamera dinyalakan ulang (retakePhoto()) supaya
// benar-benar kosong, bukan cuma field teks yang di-reset sementara foto lama masih nempel.
async function discardRestorableDraft() {
  if (restorableDraft.value) await offlineQueue.deleteDraft(restorableDraft.value.id);
  restorableDraft.value = null;
  showRestoreNotice.value = false;
  form.value.kondisi = "";
  form.value.notes = "";
  form.value.systolic = "";
  form.value.diastolic = "";
  form.value.gda = "";
  form.value.gdp = "";
  form.value.gd2jpp = "";
  form.value.uric_acid = "";
  form.value.cholesterol = "";
  form.value.keluhan = "";
  form.value.tindakan = [];
  form.value.cara_rujukan = "";
  form.value.obatDetail = [];
  form.value.kepatuhan_obat = "";
  form.value.sisa_obat = "";
  retakePhoto();
}

async function persistDraft() {
  if (!assignment.value) return;
  draftSaveStatus.value = "saving";
  try {
    const photoBlob = form.value.photoUrl ? dataUrlToBlob(form.value.photoUrl) : null;
    await offlineQueue.saveDraft(buildDraftPayload(), photoBlob, patient.value?.nama ?? "Pasien");
    draftSaveStatus.value = "saved";
  } catch {
    draftSaveStatus.value = "idle";
  }
}

// Auto-save cuma mulai SETELAH foto diambil -- foto biasanya langkah pertama di alur ini
// (kamera jalan begitu halaman dibuka), jadi menunggu foto = menunggu ada progres berarti dulu,
// bukan menyimpan form kosong berkali-kali. Tombol manual "Simpan sebagai Draf" (di bawah) TIDAK
// menunggu ini -- user boleh simpan progres apa pun yang sudah ada, foto belakangan.
function autoSaveDraft() {
  if (!form.value.photoUrl) return;
  void persistDraft();
}

// Debounce 2.5 detik -- jangan tulis IndexedDB tiap ketukan huruf, cukup begitu user berhenti
// sejenak. deep:true karena field yang dipantau tersebar di banyak sub-properti objek form yang
// sama (kondisi, vitals, tindakan[], dst).
watch(
  form,
  () => {
    if (draftSaveDebounce) clearTimeout(draftSaveDebounce);
    draftSaveDebounce = setTimeout(autoSaveDraft, 2500);
  },
  { deep: true }
);

async function saveDraftManually() {
  await persistDraft();
}

// assignmentId berasal dari route param, tersedia sinkron -- TIDAK menunggu assignment/patient
// selesai dimuat (onMounted lain di atas yang urus itu, keduanya jalan independen). Draft WIP
// yang ditemukan LANGSUNG diterapkan (bukan menunggu klik "Pulihkan") -- lihat catatan di
// showRestoreNotice.
onMounted(async () => {
  const existing = await offlineQueue.getDraftForAssignment(assignmentId.value);
  if (existing) {
    restorableDraft.value = existing;
    await restoreDraft();
    showRestoreNotice.value = true;
  }
});

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
  if (isRujukan.value && !form.value.cara_rujukan) {
    submitError.value = "Pilih cara rujukan pasien ke puskesmas terlebih dahulu.";
    return;
  }

  isSubmitting.value = true;
  const payload = buildDraftPayload();
  const photoBlob = dataUrlToBlob(form.value.photoUrl!);

  if (!navigator.onLine) {
    await offlineQueue.enqueueForSync(payload, photoBlob, patient.value?.nama ?? "Pasien");
    isSubmitting.value = false;
    useToast().add({
      title: "Tersimpan sebagai draf",
      description: "Anda sedang offline. Laporan akan terkirim otomatis begitu koneksi kembali tersambung.",
      color: "warning"
    });
    router.push("/app/draft");
    return;
  }

  try {
    const api = useApi();
    const fd = buildOnlineFormData(payload, photoBlob);
    await api("/visit-reports", { method: "POST", body: fd });

    assignmentStore.markCompleted(assignment.value.id);
    useToast().add({ title: "Laporan berhasil dikirim dan tersimpan dengan aman", color: "success" });
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
      await offlineQueue.enqueueForSync(payload, photoBlob, patient.value?.nama ?? "Pasien");
      useToast().add({
        title: "Tersimpan sebagai draf",
        description: "Koneksi sedang bermasalah. Laporan akan terkirim otomatis begitu koneksi kembali tersambung.",
        color: "warning"
      });
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
            <p class="text-base font-bold text-primary tracking-wide uppercase">{{ isNakesAssignment ? "Tugas Kunjungan Nakes" : "Tugas Pemantauan Kader" }}</p>
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

    <!-- Sudah selesai / dibatalkan / bukan kader primer -- revisi Bu Kadis: SEBELUMNYA cuma
         pesan polos "sudah selesai" tanpa isi laporan sama sekali (kader tidak bisa lihat balik
         laporannya sendiri yang sudah disubmit) -- sekarang tampilkan detail LENGKAP kalau
         laporannya ada, bukan cuma status. -->
    <div v-else-if="!canSubmit && !assignment.report" class="p-5">
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

    <!-- Laporan SUDAH ADA (completed, atau invalid lama yang masih tersimpan) -- detail lengkap
         read-only: bukti foto, semua hasil pemeriksaan/tindakan, status validasi. Ditampilkan
         di halaman/URL YANG SAMA (bukan halaman terpisah) supaya "Lihat Detail" dari /app/tugas
         konsisten mengarah ke sini apa pun statusnya. -->
    <div v-else-if="!canSubmit" class="p-5 space-y-5 pb-10">
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800">
        <div class="flex items-center gap-3 mb-1">
          <div class="w-11 h-11 bg-success/10 rounded-full flex items-center justify-center shrink-0">
            <LucideCheckCircle2 class="w-6 h-6 text-success" />
          </div>
          <div class="min-w-0">
            <h2 class="font-black text-slate-800 dark:text-white text-lg leading-tight truncate">{{ patient?.nama }}</h2>
            <p class="text-base text-slate-500 dark:text-slate-400 font-medium">{{ assignment.scheduled_date }} &bull; {{ HISTORY_STATUS_LABELS[assignment.status] ?? assignment.status }}</p>
          </div>
        </div>
        <button @click="openHistoryModal" class="w-full py-2.5 mt-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-base uppercase tracking-wider active:bg-slate-200 dark:active:bg-slate-700 transition-colors flex items-center justify-center gap-2">
          <LucideRotateCcwClock class="w-4 h-4" />
          Riwayat Kunjungan Pasien
        </button>
      </div>

      <!-- Bukti Foto -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800">
        <h2 class="font-bold text-slate-800 dark:text-slate-200 text-base mb-3">Bukti Foto Kunjungan</h2>
        <img
          v-if="assignment.report.photo_url"
          :src="assignment.report.photo_url"
          alt="Bukti foto kunjungan"
          class="rounded-2xl border border-slate-200 dark:border-slate-700 w-full"
        />
        <p v-else class="text-base text-slate-400 italic">Foto tidak tersedia (tautan sementara sudah kedaluwarsa -- muat ulang halaman).</p>
      </div>

      <!-- Hasil Pemeriksaan & Tindakan -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
        <h2 class="font-bold text-slate-800 dark:text-slate-200 text-base">Hasil Pemeriksaan &amp; Tindakan</h2>

        <div>
          <p class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-0.5">Kondisi Pasien</p>
          <p class="text-base font-medium text-slate-700 dark:text-slate-300">{{ assignment.report.kondisi }}</p>
        </div>

        <div v-if="assignment.report.systolic || assignment.report.diastolic || assignment.report.gda || assignment.report.gdp || assignment.report.gd2jpp || assignment.report.uric_acid || assignment.report.cholesterol" class="flex flex-wrap gap-2">
          <span v-if="assignment.report.systolic || assignment.report.diastolic" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm">Tensi: {{ assignment.report.systolic ?? '-' }}/{{ assignment.report.diastolic ?? '-' }}</span>
          <span v-if="assignment.report.gda" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm">GDA: {{ assignment.report.gda }}</span>
          <span v-if="assignment.report.gdp" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm">GDP: {{ assignment.report.gdp }}</span>
          <span v-if="assignment.report.gd2jpp" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm">GD2JPP: {{ assignment.report.gd2jpp }}</span>
          <span v-if="assignment.report.uric_acid" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm">Asam Urat: {{ assignment.report.uric_acid }}</span>
          <span v-if="assignment.report.cholesterol" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm">Kolesterol: {{ assignment.report.cholesterol }}</span>
        </div>

        <p v-if="assignment.report.keluhan"><span class="font-bold text-slate-700 dark:text-slate-300">Keluhan:</span> <span class="text-slate-600 dark:text-slate-400">"{{ assignment.report.keluhan }}"</span></p>
        <p v-if="assignment.report.tindakan?.length"><span class="font-bold text-slate-700 dark:text-slate-300">Tindakan:</span> <span class="text-slate-600 dark:text-slate-400">{{ formatHistoryTindakan(assignment.report.tindakan) }}</span></p>
        <p v-if="assignment.report.obat_detail?.length"><span class="font-bold text-slate-700 dark:text-slate-300">Detail Obat:</span> <span class="text-slate-600 dark:text-slate-400">{{ formatHistoryObatDetail(assignment.report.obat_detail) }}</span></p>
        <p v-if="assignment.report.cara_rujukan"><span class="font-bold text-slate-700 dark:text-slate-300">Cara Rujukan:</span> <span class="text-slate-600 dark:text-slate-400">{{ HISTORY_CARA_RUJUKAN_LABELS[assignment.report.cara_rujukan] ?? assignment.report.cara_rujukan }}</span></p>

        <div v-if="assignment.report.kepatuhan_obat || assignment.report.sisa_obat" class="flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span v-if="assignment.report.kepatuhan_obat" class="text-slate-600 dark:text-slate-400">Kepatuhan Obat: <b class="text-slate-800 dark:text-slate-200">{{ HISTORY_KEPATUHAN_OBAT_LABELS[assignment.report.kepatuhan_obat] ?? assignment.report.kepatuhan_obat }}</b></span>
          <span v-if="assignment.report.sisa_obat" class="text-slate-600 dark:text-slate-400">Sisa Obat: <b class="text-slate-800 dark:text-slate-200">{{ HISTORY_SISA_OBAT_LABELS[assignment.report.sisa_obat] ?? assignment.report.sisa_obat }}</b></span>
        </div>

        <p v-if="assignment.report.catatan" class="text-slate-600 dark:text-slate-400">"{{ assignment.report.catatan }}"</p>
      </div>

      <!-- Status Validasi -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
        <h2 class="font-bold text-slate-800 dark:text-slate-200 text-base">Status Validasi Laporan</h2>
        <div>
          <p class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Diterima PJ Prolanis</p>
          <span v-if="assignment.report.pj_reviewed_at" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider bg-success/10 text-success">
            <LucideCircleCheck class="w-3.5 h-3.5" /> Diterima {{ assignment.report.pj_reviewed_by?.name ? `oleh ${assignment.report.pj_reviewed_by.name}` : '' }}
          </span>
          <span v-else class="px-2.5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider bg-warning/10 text-warning">Menunggu Diterima PJ</span>
        </div>
        <div>
          <p class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Validasi Final Super Admin</p>
          <span
            class="px-2.5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider"
            :class="assignment.report.validation_status === 'valid' ? 'bg-success/10 text-success' : assignment.report.validation_status === 'invalid' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'"
          >
            {{ assignment.report.validation_status === 'valid' ? 'Tervalidasi' : assignment.report.validation_status === 'invalid' ? 'Ditolak' : 'Menunggu Validasi' }}
          </span>
          <p v-if="assignment.report.validation_note" class="text-base text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 mt-2 leading-relaxed">
            <span class="font-bold text-slate-700 dark:text-slate-300">Catatan:</span> "{{ assignment.report.validation_note }}"
          </p>
        </div>
      </div>

      <NuxtLink to="/app/tugas" class="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-800 dark:bg-slate-700 text-white rounded-2xl font-bold active:scale-[0.98] transition-transform">
        <LucideArrowLeft class="w-4 h-4" /> Kembali ke Tugas
      </NuxtLink>
    </div>

    <div v-else class="p-5 space-y-6">
      <!-- docs/planning/14: draft-in-progress ditemukan (auto-save/manual sebelumnya) SUDAH
           diterapkan otomatis ke form (lihat onMounted) -- strip ini murni info + opsi "mulai
           kosong" non-blocking, BUKAN gerbang wajib yang menghalangi form terlihat/dipakai. -->
      <div v-if="showRestoreNotice" class="bg-info/10 border border-info/20 rounded-2xl px-4 py-2.5 flex items-center gap-3">
        <LucideDatabaseZap class="w-4 h-4 text-info shrink-0" />
        <p class="flex-1 text-sm text-slate-600 dark:text-slate-300 font-medium">Draf sebelumnya dipulihkan otomatis.</p>
        <button @click="discardRestorableDraft" class="text-sm font-bold text-info hover:underline shrink-0">Mulai Kosong</button>
        <button @click="showRestoreNotice = false" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0" aria-label="Tutup pemberitahuan">
          <LucideX class="w-4 h-4" />
        </button>
      </div>

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
        <button @click="openHistoryModal" class="w-full py-2.5 mt-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-base uppercase tracking-wider active:bg-slate-200 dark:active:bg-slate-700 transition-colors flex items-center justify-center gap-2">
          <LucideRotateCcwClock class="w-4 h-4" />
          Riwayat Kunjungan Pasien
        </button>
      </div>

      <!-- Lokasi & Peta (MapLibre) -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors overflow-hidden">
        <div class="p-3 border-b border-slate-100 dark:border-slate-700">
          <h2 class="font-bold text-slate-800 dark:text-slate-200 text-base mb-1">Penetapan Lokasi Kunjungan</h2>
          <p class="text-base text-slate-500 dark:text-slate-400">Titik koordinat Anda saat ini (beserta radius akurasi).</p>
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

        <!-- Konfirmasi lokasi (permintaan user) -- default TRUE (kunjungan rumah = kader ada di
             lokasi pasien), kader boleh uncheck utk kasus jarang (submit tidak persis di rumah
             pasien, mis. sinyal). Ditandai lebih menonjol saat data lokasi pasien belum pasti
             (geo_status bukan 'verified') krn di situ konfirmasi ini paling berguna -- titik
             GPS kader dipakai backend memperbaiki data desa/kecamatan pasien lewat resolusi
             titik-dalam-polygon, lihat VisitReportService::submit(). -->
        <button
          type="button"
          class="w-full p-4 border-t flex items-center gap-3 text-left transition-colors active:scale-[0.99]"
          :class="form.confirmedPatientLocation
            ? 'border-success/20 bg-success/5 dark:bg-success/10'
            : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900'"
          @click="form.confirmedPatientLocation = !form.confirmedPatientLocation"
        >
          <span
            class="w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors"
            :class="form.confirmedPatientLocation ? 'bg-success border-success' : 'border-slate-300 dark:border-slate-600'"
          >
            <LucideCheck v-if="form.confirmedPatientLocation" class="w-4 h-4 text-white" />
          </span>
          <span class="flex-1">
            <span class="block text-base font-bold text-slate-800 dark:text-slate-200">Saya benar-benar berada di lokasi rumah pasien</span>
            <span class="block text-sm text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Membantu memperbarui data lokasi pasien di sistem<template v-if="patient?.geo_status !== 'verified'"> -- data lokasi pasien ini <b>belum pasti</b>, konfirmasi Anda sangat membantu</template>.
            </span>
          </span>
        </button>
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
        </div>
      </div>

      <!-- Tindakan (Fase 2) -- multi-select, KADER JUGA bisa mencatat (bukan cuma nakes),
           makanya kartu ini TIDAK digerbang isNakesAssignment (beda dari "Pemeriksaan Mandiri"
           di atas yang memang nakes-only). -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <h2 class="font-bold text-slate-800 dark:text-slate-200 text-base mb-1">Tindakan</h2>
        <p class="text-base text-slate-500 dark:text-slate-400 mb-4">Diberi obat &amp; dirujuk bisa dipilih bersamaan. "Tidak Ada Tindakan" tidak bisa digabung dengan pilihan lain.</p>
        <div class="grid grid-cols-1 gap-2.5" role="group" aria-label="Tindakan">
          <label
            v-for="opt in [
              { value: 'diberi_obat', label: 'Diberi Obat' },
              { value: 'dirujuk_puskesmas', label: 'Dirujuk ke Puskesmas' },
              { value: 'tidak_ada', label: 'Tidak Ada Tindakan' },
            ]"
            :key="opt.value"
            class="flex items-center gap-3 border-2 rounded-xl px-4 py-3 cursor-pointer transition-colors"
            :class="isTindakanChecked(opt.value as any) ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-slate-200 dark:border-slate-700'"
          >
            <input type="checkbox" :checked="isTindakanChecked(opt.value as any)" @change="toggleTindakan(opt.value as any)" class="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary/30 shrink-0" />
            <span class="text-base font-bold text-slate-800 dark:text-white">{{ opt.label }}</span>
          </label>
        </div>

        <div v-if="isRujukan" class="mt-4">
          <label class="block text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cara Rujukan <span class="text-danger">*</span></label>
          <div class="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Cara Rujukan">
            <label
              v-for="opt in [
                { value: 'datang_sendiri', label: 'Datang Sendiri' },
                { value: 'dijemput_ambulan', label: 'Dijemput Ambulan' },
                { value: 'diantar_keluarga', label: 'Diantar Keluarga' },
                { value: 'diantar_nakes_kader', label: 'Diantar Nakes/Kader' },
              ]"
              :key="opt.value"
              class="flex items-center gap-3 border-2 rounded-xl px-4 py-2.5 cursor-pointer transition-colors"
              :class="form.cara_rujukan === opt.value ? 'border-danger bg-danger/5 dark:bg-danger/10' : 'border-slate-200 dark:border-slate-700'"
            >
              <input type="radio" name="cara_rujukan" :value="opt.value" v-model="form.cara_rujukan" class="w-5 h-5 border-slate-300 text-danger focus:ring-danger/30 shrink-0" />
              <span class="text-base font-bold text-slate-800 dark:text-white">{{ opt.label }}</span>
            </label>
          </div>
        </div>

        <!-- Detail Obat (permintaan user) -- muncul HANYA saat tindakan='diberi_obat'. Diisi
             siapa pun yang submit laporan ini (kader ATAU nakes saat kunjungan bareng), sama
             seperti kartu Tindakan sendiri, TIDAK digerbang isNakesAssignment. -->
        <div v-if="isDiberiObat" class="mt-4 space-y-3">
          <label class="block text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider">Detail Obat</label>
          <div
            v-for="(obat, idx) in form.obatDetail"
            :key="idx"
            class="border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2.5"
          >
            <div class="flex items-center justify-between">
              <span class="text-sm font-bold text-primary">Obat ke-{{ idx + 1 }}</span>
              <button
                v-if="form.obatDetail.length > 1"
                type="button"
                @click="removeObatDetail(idx)"
                class="text-xs font-bold text-danger px-2 py-1 active:scale-95 transition-transform"
              >
                Hapus
              </button>
            </div>
            <input
              v-model="obat.nama"
              type="text"
              placeholder="Nama obat"
              class="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none transition-colors"
            />
            <div class="grid grid-cols-2 gap-2.5">
              <input
                v-model="obat.dosis"
                type="text"
                placeholder="Dosis (mis. 500mg)"
                class="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none transition-colors"
              />
              <input
                v-model="obat.frekuensi"
                type="text"
                placeholder="Frekuensi (mis. 3x sehari)"
                class="w-full bg-transparent border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-base font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none transition-colors"
              />
            </div>
          </div>
          <button
            type="button"
            @click="addObatDetail"
            class="w-full py-2.5 border-2 border-dashed border-primary/40 text-primary rounded-xl font-bold text-sm active:scale-[0.98] transition-transform"
          >
            + Tambah Obat Lain
          </button>
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

      <!-- Dokumentasi Kegiatan -- live-view kamera sendiri sekarang modal layar penuh (Teleport
           di bawah, docs/planning/15: ukuran sebelumnya dikunci aspectRatio kartu kecil, tidak
           menyesuaikan ukuran layar HP nyata). Kartu ini murni tempat HASIL foto ditampilkan
           setelah diambil, bukan lagi tempat live-view. -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-2 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <div class="flex items-center justify-between mb-2 pl-2">
          <h2 class="font-bold text-slate-800 dark:text-slate-200 text-base">Dokumentasi Kunjungan</h2>
        </div>
        <p class="text-base text-slate-500 dark:text-slate-400 mb-4 pl-2">Kamera otomatis menyala. Ambil foto langsung bersama pasien.</p>

        <div v-if="!form.photoUrl" class="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-slate-900 flex flex-col items-center justify-center gap-3 text-slate-400">
          <LucideCamera class="w-10 h-10" />
          <p class="text-base font-semibold">Kamera terbuka di layar penuh</p>
        </div>

        <!-- SEBELUMNYA: <img> foto polos + overlay HTML/CSS "live" di atasnya (jam terus
             berdetik lewat dateNow/timeNow, #maplibre-mini map interaktif) -- terlihat seperti
             "UI", bukan hasil jepretan sungguhan, temuan lapangan. Sekarang: satu gambar statis
             hasil komposit (reviewImageUrl, dibakar sekali di captureFrame() lewat
             buildWatermarkComposite()) -- persis representasi visual dari yang sudah tersimpan/
             ter-download, benar-benar beku di momen jepretan, bukan re-render terus-menerus. -->
        <div v-else id="capture-area" class="relative w-full rounded-2xl overflow-hidden shadow-inner bg-black" :style="{ aspectRatio: captureAreaRatio }">
          <img :src="reviewImageUrl || form.photoUrl" class="absolute inset-0 w-full h-full object-cover" />
        </div>

        <div v-if="form.photoUrl" class="mt-4 flex gap-3">
          <button @click="retakePhoto" class="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform">
            <LucideRefreshCw class="w-5 h-5" />
            Ulangi Foto
          </button>
        </div>
      </div>

      <!-- Modal Kamera Layar Penuh -- Teleport ke <body> supaya position:fixed ini benar-benar
           relatif ke viewport, bukan ke ancestor manapun yang mungkin punya transform aktif
           (page transition out-in pageTransition di nuxt.config.ts pakai transform, itu bikin
           fixed descendant ikut ke-transform kalau tidak di-teleport). 100dvh (bukan 100vh) --
           menyesuaikan viewport nyata di browser mobile saat address bar menyusut/melebar,
           itulah "tidak dinamis" yang dikeluhkan sebelumnya (aspectRatio kartu kecil, terpotong
           address bar). -->
      <Teleport to="body">
        <div v-if="!form.photoUrl" class="fixed inset-0 z-[95] bg-black overflow-hidden" style="height: 100dvh">
          <button
            type="button"
            @click="router.back()"
            class="absolute left-4 z-30 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white active:scale-95 transition-transform"
            style="top: calc(1rem + env(safe-area-inset-top, 0px))"
          >
            <LucideX class="w-5 h-5" />
          </button>

          <!-- Video dibatasi rasio potret standar 3:4 (BUKAN lagi bleed penuh layar 9:19.5+ di
               HP modern) -- itu akar masalah "ngezoom banget": buffer kamera biasanya native
               4:3/16:9 (landscape-ish), memaksa object-cover meng-crop ke kotak SETINGGI layar
               penuh butuh crop ekstrem (cuma strip tengah sempit dari buffer), terasa seperti
               zoom tele. 3:4 jauh lebih dekat rasio native sensor, crop yang dibutuhkan jauh
               lebih ringan -- letterbox (bilah hitam) atas-bawah menggantikan crop berlebihan.
               captureFrame() otomatis ikut rasio kotak video yang SESUNGGUHNYA dirender
               (getBoundingClientRect()), jadi WYSIWYG tetap terjaga tanpa ubah logic crop. -->
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="relative w-full" style="aspect-ratio: 3 / 4">
              <video ref="videoRef" autoplay playsinline @loadedmetadata="onVideoMetadataLoaded" class="absolute inset-0 w-full h-full object-cover"></video>
            </div>
          </div>
          <canvas ref="canvasRef" class="hidden"></canvas>

          <div v-if="countdown > 0" class="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <span class="text-8xl font-black text-white drop-shadow-2xl animate-pulse">{{ countdown }}</span>
          </div>

          <!-- Overlay info -- sama isinya dengan kartu review, cuma ukuran & posisi disesuaikan
               layar penuh. TIDAK ikut dibakar ke file yang dikirim. -->
          <div
            class="absolute inset-0 flex flex-col justify-between p-4 z-10 pointer-events-none"
            style="padding-top: calc(4.5rem + env(safe-area-inset-top, 0px)); padding-bottom: calc(6.5rem + env(safe-area-inset-bottom, 0px))"
          >
            <div class="flex items-center gap-2 self-start bg-white rounded-md px-2.5 py-1.5 shadow-sm">
              <img src="/logo/logo-no-text.png" class="w-5 h-5" />
              <span class="text-[11px] font-black text-primary tracking-widest uppercase">PRODULI</span>
            </div>

            <div class="w-full bg-black/40 rounded-xl overflow-hidden">
              <div class="flex gap-3 p-3">
                <div id="maplibre-mini" class="w-20 h-20 bg-slate-800 rounded-lg shrink-0 overflow-hidden border border-white/20 relative"></div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-1">
                    <p class="text-sm font-black text-white uppercase leading-tight line-clamp-1">{{ locationName }}</p>
                    <span class="text-base shrink-0">{{ countryFlag }}</span>
                  </div>
                  <p class="text-xs text-slate-200 leading-snug line-clamp-2 mt-0.5">{{ form.fullAddress }}</p>
                  <p class="text-xs font-mono text-slate-300 mt-1">
                    Lat {{ (form.lat || 0).toFixed(6) }}&nbsp;&nbsp;Long {{ (form.lng || 0).toFixed(6) }}
                  </p>
                </div>
              </div>

              <div class="px-3 pb-2 pt-1.5 border-t border-white/20">
                <p class="text-sm font-bold text-white">{{ dateNow }} &middot; {{ timeNow }} WIB</p>
                <p class="text-xs text-slate-300 mt-0.5">Pasien: {{ patient?.nama }}</p>
              </div>

              <div class="flex items-center justify-between px-3 py-2 bg-black/30 border-t border-white/20">
                <span class="text-xs font-bold text-slate-200 flex items-center gap-1">
                  <LucideThermometer class="w-4 h-4" />
                  {{ weather.temp !== null ? weather.temp + "°C" : "-" }}
                </span>
                <span class="text-xs font-bold text-slate-200 flex items-center gap-1">
                  <LucideWind class="w-4 h-4" />
                  {{ weather.wind !== null ? weather.wind + " km/j" : "-" }}
                </span>
                <span class="text-xs font-bold text-slate-200 flex items-center gap-1">
                  <LucideCrosshair class="w-4 h-4" /> &plusmn;{{ form.accuracy || "-" }} m
                </span>
              </div>
            </div>
          </div>

          <div class="absolute inset-x-0 bottom-0 z-20 p-5 bg-gradient-to-t from-black/80 to-transparent" style="padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px))">
            <button
              @click="takePicture"
              :disabled="!isCameraActive || countdown > 0"
              class="w-full py-4 bg-indigo-500 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-indigo-500/30"
            >
              <LucideCamera class="w-5 h-5" />
              Ambil Gambar
            </button>
          </div>
        </div>
      </Teleport>

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

        <!-- docs/planning/14: simpan WIP tanpa mengirim -- bekerja online maupun offline (murni
             tulis IndexedDB lokal, tidak menyentuh jaringan sama sekali). Auto-save berkala
             (watch form, debounce 2.5dtk) sudah jalan sendiri di latar belakang begitu foto
             diambil -- tombol ini cuma pemicu manual + kepastian visual buat kader. -->
        <button
          @click="saveDraftManually"
          type="button"
          class="w-full py-3 mt-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <LucideSave class="w-4 h-4" />
          Simpan sebagai Draf
        </button>
        <p v-if="draftSaveStatus === 'saved'" class="text-sm text-center text-slate-400 font-medium mt-2 flex items-center justify-center gap-1.5">
          <LucideCheckCircle2 class="w-3.5 h-3.5 text-success" />
          Draf tersimpan di perangkat ini
        </p>
        <p v-else-if="draftSaveStatus === 'saving'" class="text-sm text-center text-slate-400 font-medium mt-2">Menyimpan draf...</p>
      </div>
    </div>

    <!-- Modal Detail Data Pasien (z-[60]) -- field mengikuti apa adanya yang tersedia dari
         VisitAssignmentResource.patient (id/nama/alamat/phone/lat/lng/geo_status), TIDAK ada
         NIK/agama/status kawin/dst -- PRODULI tidak menyimpan field itu sama sekali. -->
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

    <!-- Modal Riwayat Kunjungan Pasien (z-[65], revisi Bu Kadis) -- SEMUA kunjungan pasien ini
         dari petugas manapun, bukan cuma milik kader/nakes yang login. Setiap baris collapsed
         default (tap utk expand) -- daftar bisa panjang utk pasien lama, progressive disclosure
         supaya tidak membanjiri layar (prinsip UI lansia-friendly, lihat CLAUDE.md). -->
    <Transition name="fade">
      <div v-if="showHistoryModal" class="fixed inset-0 z-[65] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center" @click="showHistoryModal = false">
        <div class="bg-white dark:bg-slate-900 w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl p-6 shadow-2xl transition-colors duration-300 max-h-[85vh] flex flex-col" @click.stop>
          <div class="flex items-center justify-between mb-4 shrink-0">
            <div>
              <h3 class="font-bold text-slate-800 dark:text-white text-lg">Riwayat Kunjungan Pasien</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{{ patient?.nama }}</p>
            </div>
            <button @click="showHistoryModal = false" class="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 active:scale-95 shrink-0">
              <LucideX class="w-4 h-4" />
            </button>
          </div>

          <div class="overflow-y-auto no-scrollbar flex-1 -mx-1 px-1">
            <!-- docs/planning/12: hasil dari IndexedDB (useOfflineCache), bukan GET yang baru
                 saja sukses -- riwayat pasien ini mungkin ketinggalan kunjungan terbaru. Di luar
                 rantai v-if/v-else di bawah supaya tetap tampil berbarengan dengan daftarnya. -->
            <div v-if="historyLoadedFromCache && !isLoadingHistory && !historyError" class="flex items-center gap-2 text-sm font-semibold text-info bg-info/10 border border-info/20 rounded-2xl px-4 py-2.5 mb-3">
              <LucideDatabaseZap class="w-4 h-4 shrink-0" />
              <span>Data tersimpan (offline) — mungkin tidak terbaru.</span>
            </div>
            <div v-if="isLoadingHistory" class="py-10 text-center text-slate-400">
              <LucideLoader2 class="w-8 h-8 mx-auto mb-2 animate-spin" />
              <p class="text-base">Memuat riwayat...</p>
            </div>
            <div v-else-if="historyError" class="py-10 text-center">
              <LucideAlertCircle class="w-8 h-8 mx-auto mb-2 text-danger" />
              <p class="text-base font-semibold text-danger">{{ historyError }}</p>
            </div>
            <div v-else-if="patientHistory.length === 0" class="py-10 text-center text-slate-400 text-base">
              Belum ada riwayat kunjungan untuk pasien ini.
            </div>
            <div v-else class="space-y-2.5">
              <div
                v-for="entry in patientHistory"
                :key="entry.id"
                class="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden transition-colors"
                :class="entry.id === assignmentId ? 'ring-2 ring-primary/30' : ''"
              >
                <button type="button" @click="toggleHistoryEntry(entry.id)" class="w-full flex items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 text-left">
                  <div class="min-w-0">
                    <p class="font-bold text-slate-800 dark:text-white text-base flex items-center gap-1.5 flex-wrap">
                      {{ entry.scheduled_date }}
                      <span v-if="entry.id === assignmentId" class="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">Kunjungan Ini</span>
                    </p>
                    <p class="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate">{{ historyPetugasLabel(entry) }}</p>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider" :class="HISTORY_STATUS_COLORS[entry.status]">
                      {{ HISTORY_STATUS_LABELS[entry.status] ?? entry.status }}
                    </span>
                    <LucideChevronDown class="w-4 h-4 text-slate-400 transition-transform shrink-0" :class="{ 'rotate-180': expandedHistoryId === entry.id }" />
                  </div>
                </button>

                <div v-if="expandedHistoryId === entry.id" class="p-4 space-y-3 text-sm border-t border-slate-100 dark:border-slate-800">
                  <template v-if="entry.report">
                    <div>
                      <p class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-0.5">Kondisi Pasien</p>
                      <p class="text-slate-700 dark:text-slate-300 font-medium">{{ entry.report.kondisi }}</p>
                    </div>

                    <div v-if="entry.report.systolic || entry.report.diastolic || entry.report.gda || entry.report.gdp || entry.report.gd2jpp || entry.report.uric_acid || entry.report.cholesterol" class="flex flex-wrap gap-2">
                      <span v-if="entry.report.systolic || entry.report.diastolic" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs">Tensi: {{ entry.report.systolic ?? '-' }}/{{ entry.report.diastolic ?? '-' }}</span>
                      <span v-if="entry.report.gda" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs">GDA: {{ entry.report.gda }}</span>
                      <span v-if="entry.report.gdp" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs">GDP: {{ entry.report.gdp }}</span>
                      <span v-if="entry.report.gd2jpp" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs">GD2JPP: {{ entry.report.gd2jpp }}</span>
                      <span v-if="entry.report.uric_acid" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs">Asam Urat: {{ entry.report.uric_acid }}</span>
                      <span v-if="entry.report.cholesterol" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs">Kolesterol: {{ entry.report.cholesterol }}</span>
                    </div>

                    <p v-if="entry.report.keluhan"><span class="font-bold text-slate-700 dark:text-slate-300">Keluhan:</span> <span class="text-slate-600 dark:text-slate-400">"{{ entry.report.keluhan }}"</span></p>
                    <p v-if="entry.report.tindakan?.length"><span class="font-bold text-slate-700 dark:text-slate-300">Tindakan:</span> <span class="text-slate-600 dark:text-slate-400">{{ formatHistoryTindakan(entry.report.tindakan) }}</span></p>
                    <p v-if="entry.report.obat_detail?.length"><span class="font-bold text-slate-700 dark:text-slate-300">Detail Obat:</span> <span class="text-slate-600 dark:text-slate-400">{{ formatHistoryObatDetail(entry.report.obat_detail) }}</span></p>
                    <p v-if="entry.report.cara_rujukan"><span class="font-bold text-slate-700 dark:text-slate-300">Cara Rujukan:</span> <span class="text-slate-600 dark:text-slate-400">{{ HISTORY_CARA_RUJUKAN_LABELS[entry.report.cara_rujukan] ?? entry.report.cara_rujukan }}</span></p>

                    <div v-if="entry.report.kepatuhan_obat || entry.report.sisa_obat" class="flex flex-wrap gap-x-4 gap-y-1">
                      <span v-if="entry.report.kepatuhan_obat" class="text-slate-600 dark:text-slate-400">Kepatuhan Obat: <b class="text-slate-800 dark:text-slate-200">{{ HISTORY_KEPATUHAN_OBAT_LABELS[entry.report.kepatuhan_obat] ?? entry.report.kepatuhan_obat }}</b></span>
                      <span v-if="entry.report.sisa_obat" class="text-slate-600 dark:text-slate-400">Sisa Obat: <b class="text-slate-800 dark:text-slate-200">{{ HISTORY_SISA_OBAT_LABELS[entry.report.sisa_obat] ?? entry.report.sisa_obat }}</b></span>
                    </div>

                    <p v-if="entry.report.catatan" class="text-slate-600 dark:text-slate-400">"{{ entry.report.catatan }}"</p>

                    <div class="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span
                        class="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider"
                        :class="entry.report.validation_status === 'valid' ? 'bg-success/10 text-success' : entry.report.validation_status === 'invalid' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'"
                      >
                        {{ entry.report.validation_status === 'valid' ? 'Tervalidasi' : entry.report.validation_status === 'invalid' ? 'Ditolak Super Admin' : 'Menunggu Validasi' }}
                      </span>
                    </div>
                  </template>
                  <p v-else class="text-slate-400 italic">Belum ada laporan untuk kunjungan ini.</p>
                </div>
              </div>
            </div>
          </div>

          <button @click="showHistoryModal = false" class="w-full py-3 mt-4 bg-slate-800 dark:bg-slate-700 text-white font-bold rounded-xl active:scale-[0.98] transition-transform shrink-0">Tutup</button>
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
                <label class="block text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Kecamatan</label>
                <select :value="selectedKecamatanId ?? ''" @change="onKecamatanChange" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none appearance-none">
                  <option value="">Pilih kecamatan...</option>
                  <option v-for="k in kecamatanList" :key="k.id" :value="k.id">{{ k.nama }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Kel/Desa</label>
                <select v-model="updateForm.kel_desa" :disabled="!selectedKecamatanId" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 dark:text-white focus:border-primary focus:ring-0 outline-none appearance-none disabled:opacity-50">
                  <option value="">{{ selectedKecamatanId ? (isLoadingDesa ? 'Memuat...' : 'Pilih kel/desa...') : 'Pilih kecamatan dulu' }}</option>
                  <option v-for="d in desaList" :key="d.id" :value="d.nama">{{ d.nama }}</option>
                </select>
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
