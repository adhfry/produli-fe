// Kontrak API backend KOPIPU — sumber kebenaran: Controller/Request/Resource di repo backend
// (D:\Project_Web\kopipu-smart-backend), bukan docs/planning/05 (itu cuma peta endpoint).
// Tambahkan tipe domain lain di sini begitu composable/store baru mulai dibangun.

export interface ApiSuccessEnvelope<T> {
  status: 'success'
  message: string
  data: T
}

export interface ApiErrorEnvelope {
  status: 'error'
  message: string
  data?: unknown
  errors?: Record<string, string[]>
}

export interface PaginatedData<T> {
  items: T[]
  pagination: {
    current_page: number
    per_page: number
    total: number
    last_page: number
  }
}

// --- Auth (app/Http/Controllers/Api/V1/Auth/AuthController.php) ---

export interface User {
  id: number
  name: string
  email: string
  email_verified_at: string | null
  google_id: string | null
  puskesmas_id: number | null
  no_hp: string | null
  // Profil staf non-kader (admin_puskesmas/pj_prolanis) -- diisi step 3 onboarding "Lengkapi
  // Profil", field SAMA dengan Kader (no_wa/alamat/gender/tgl_lahir) tapi tersimpan di sini
  // karena staf tidak punya baris kader (AuthController::completeOnboarding). Kader TETAP
  // simpan field ini di app/types/api.ts Kader interface, bukan di sini.
  no_wa: string | null
  alamat: string | null
  gender: 'L' | 'P' | null
  tgl_lahir: string | null
  must_change_password: boolean
  // Key S3/MinIO mentah (mis. 'profile/5/uuid.jpg') -- BUKAN untuk dipakai langsung di <img>,
  // pakai avatar_url di bawah (signed URL sementara, User::avatarUrl() backend).
  avatar_path: string | null
  // Signed URL sementara (30 menit) ke avatar_path, dihitung ulang tiap User ke-serialize --
  // null kalau belum ada avatar. Boleh dipakai langsung di <img :src>.
  avatar_url: string | null
  email_notifications_enabled: boolean
  // null = belum selesai onboarding (docs/planning/02 §14) -- EnsureOnboardingCompleted
  // middleware menggerbangi hampir semua endpoint di belakang ini, kode error
  // 'ONBOARDING_REQUIRED' (lihat useApi.ts) dipakai redirect otomatis ke /onboarding.
  onboarding_completed_at: string | null
  created_at: string
  updated_at: string
}

// POST /auth/onboarding/complete (CompleteOnboardingRequest) -- SEMUA opsional. Field
// no_wa/alamat/gender/tgl_lahir diabaikan backend kalau user yang login bukan kader
// (AuthController::completeOnboarding).
export interface CompleteOnboardingPayload {
  no_wa?: string
  alamat?: string
  gender?: 'L' | 'P'
  tgl_lahir?: string
}

export interface AuthTokenResponse {
  access_token: string
  token_type: 'Bearer'
  expires_at: string
  // POST /auth/refresh sengaja tidak mengirim ulang user/roles (null) — lihat AuthController::refresh.
  user: User | null
  roles: Role[] | null
}

// GET /auth/me — data = {user, roles}, BUKAN objek user langsung (lihat AuthController::me()).
export interface MeResponse {
  user: User
  roles: Role[]
}

export type Role = 'super_admin' | 'admin_puskesmas' | 'pj_prolanis' | 'kader' | 'tenaga_kesehatan'

export interface LoginPayload {
  email: string
  password: string
  device_id: string
  device_name?: string
}

// PATCH /auth/profile (UpdateProfileRequest) -- 'sometimes', bukan 'required' (PATCH parsial).
// Field umum semua role, BUKAN pengganti PATCH /kader/profile (itu tetap khusus field kader).
// email/roles/puskesmas_id SENGAJA tidak di sini -- identitas resmi & penugasan, dikunci dari
// self-service (lihat UpdateProfileRequest backend).
export interface UpdateProfilePayload {
  email_notifications_enabled?: boolean
  name?: string
  no_hp?: string | null
}

// POST /auth/change-password (ChangePasswordRequest) -- tidak ada field konfirmasi di backend,
// itu murni validasi client-side sebelum kirim.
export interface ChangePasswordPayload {
  current_password: string
  new_password: string
}

// --- Patient (app/Http/Controllers/Api/V1/PatientController.php) ---

export type RiskLevel = 'ringan' | 'sedang' | 'berat'
// Level klasifikasi risiko pasien (beda dari RiskLevel biasa) -- 'tidak_berisiko' cuma valid
// di sini, BUKAN di assignment 'priority' (backend: risk_thresholds/risk_classifications.level
// enum sudah termasuk tidak_berisiko, tapi visit_assignments.priority enum TIDAK diubah).
export type PatientRiskLevel = RiskLevel | 'tidak_berisiko'
export type WilayahStatus = 'resolved' | 'unresolved' | 'unknown' | 'out_of_scope'

export interface Kecamatan {
  id: number
  nama: string
  kode_kemendagri: string | null
}

export interface Patient {
  id: number
  external_patient_id: number
  no_reg: string | null
  nama: string
  gender: 'L' | 'P' | null
  tgl_lahir: string | null
  phone: string | null
  alamat: string | null
  rt_rw: string | null
  kel_desa_raw: string | null
  kecamatan_raw: string | null
  is_prolanis: boolean
  jenis_prolanis: string | null
  is_perokok: boolean
  jenis_perokok: string | null
  wilayah_status: WilayahStatus
  puskesmas_resolution_method: 'desa' | 'kecamatan_fallback' | 'pengirim_matched' | 'pengirim_individual' | 'manual' | 'kader_verified' | 'unresolvable' | null
  // Teks asli `pengirim` (surat_hasil_labs SiLAKES) yang dipakai WilayahResolver (revisi Bu
  // Kadis, Fase 5) -- terisi utk method='pengirim_individual' ("Rujukan: dr. X") ATAU
  // 'unresolvable' (audit: kenapa ini tidak teridentifikasi -- teks aslinya apa).
  pengirim_raw: string | null
  desa?: { id: number, nama: string }
  kecamatan?: { id: number, nama: string } | null
  puskesmas?: { id: number, nama: string }
  geo_status: 'unknown' | 'approximate' | 'verified'
  geo_source: 'desa_centroid' | 'patient_reported' | 'kader_verified' | null
  latitude: number | null
  longitude: number | null
  risk_level?: PatientRiskLevel | null
  risk_computed_at?: string | null
  // Smart Early Detection (revisi Bu Kadis) -- cuma relevan saat risk_level='sedang', lihat
  // RiskClassificationService::evaluateEarlyDetection() di backend.
  early_detection_flag?: boolean
  early_detection_reason?: EarlyDetectionReason[] | null
  last_synced_at: string | null
}

// early_detection_reason -- array heterogen, field selain type/message spesifik per tipe.
export interface EarlyDetectionReason {
  type: 'proximity' | 'combo_breadth' | 'worsening_trend'
  message: string
  parameter?: string
  value?: number
  next_tier_threshold?: number
  proximity_percent?: number
  exceeded_count?: number
  total_count?: number
  missing_parameters?: string[]
  average_margin_percent?: number
  parameter_margins_percent?: Record<string, number>
  values_terbaru_ke_lama?: number[]
}

// Satu parameter dalam criteria_snapshot -- lihat RiskClassificationService::classify() di
// backend, disimpan APA ADANYA saat klasifikasi dihitung (bukan dihitung ulang di frontend).
export interface RiskCriteriaSnapshotItem {
  parameter: string
  value: number
  tanggal_periksa: string | null
  operator: '>' | '>=' | '<' | '<=' | 'between'
  threshold_min: number | null
  threshold_max: number | null
  level: PatientRiskLevel
  is_direct_classifier: boolean
}

// GET /patients/{id}/risk-history (revisi Bu Kadis, Fase 5) -- satu baris riwayat klasifikasi,
// dipakai seksi "Dasar Klasifikasi" (baris terbaru) dan "Riwayat & Tren Kondisi" (semua baris).
export interface RiskClassificationHistory {
  id: number
  level: PatientRiskLevel
  criteria_snapshot: RiskCriteriaSnapshotItem[]
  computed_at: string | null
  is_latest: boolean
  early_detection_flag: boolean
  early_detection_reason: EarlyDetectionReason[] | null
}

// POST /patients/search-nik (SearchPatientByNikRequest) -- KOPIPU TIDAK PERNAH menyimpan NIK
// asli (patients_cache cuma punya nik_hash HMAC dari SiLAKES, docs/planning/04) -- endpoint ini
// cuma cocokkan hash-vs-hash, TIDAK PERNAH bisa menampilkan digit NIK asli di mana pun. POST
// (bukan GET) supaya password re-autentikasi tidak nyangkut di query string/log akses.
// 'password' = password user yang SEDANG LOGIN sendiri (step-up auth), BUKAN milik pasien.
export interface SearchPatientByNikPayload {
  nik: string
  password: string
}

// --- Kader (app/Http/Controllers/Api/V1/KaderController.php) ---

export interface Kader {
  id: number
  status_aktif: boolean
  no_hp: string
  no_wa: string | null
  alamat: string | null
  gender: 'L' | 'P' | null
  tgl_lahir: string | null
  user?: { id: number, name: string, email: string }
  puskesmas?: { id: number, nama: string }
  pj?: { id: number, name: string } | null
  created_at: string
}

// POST /kader (RegisterKaderRequest) -- name/email/no_hp wajib, sisanya opsional. puskesmas_id
// WAJIB utk super_admin (dipaksa ke puskesmas sendiri utk admin_puskesmas/pj_prolanis di
// KaderService::resolvePuskesmasId, input diabaikan utk mereka). pj_id opsional, cuma relevan
// admin_puskesmas/super_admin (pj_prolanis: pj_id-nya otomatis dirinya sendiri, resolvePjId()).
export interface CreateKaderPayload {
  name: string
  email: string
  no_hp: string
  no_wa?: string | null
  alamat?: string | null
  gender?: 'L' | 'P' | null
  tgl_lahir?: string | null
  puskesmas_id?: number | null
  pj_id?: number | null
}

// --- Tenaga Kesehatan (revisi Bu Kadis, app/Http/Controllers/Api/V1/TenagaKesehatanController.php) ---
// Peran baru: pemeriksaan lanjutan di rumah pasien (beda dari kader yang fokus pendampingan
// minum obat). Struktur mirror persis Kader.

export interface TenagaKesehatan {
  id: number
  status_aktif: boolean
  no_hp: string
  no_wa: string | null
  alamat: string | null
  gender: 'L' | 'P' | null
  tgl_lahir: string | null
  user?: { id: number, name: string, email: string }
  puskesmas?: { id: number, nama: string }
  created_at: string
}

export interface CreateTenagaKesehatanPayload {
  name: string
  email: string
  no_hp: string
  no_wa?: string | null
  alamat?: string | null
  gender?: 'L' | 'P' | null
  tgl_lahir?: string | null
  puskesmas_id?: number | null
}

// GET /kader/pj-options?puskesmas_id= -- dropdown pilihan PJ Prolanis saat registrasi kader
// (KaderController::pjOptions). BUKAN paginated, respons data langsung array (ApiResponse::
// success($options) tanpa items/pagination). Ter-scope otomatis di backend: super_admin boleh
// filter via puskesmas_id, admin_puskesmas selalu dipaksa ke puskesmas sendiri.
export interface PjOption {
  id: number
  name: string
}

// --- Puskesmas (app/Http/Controllers/Api/V1/PuskesmasController.php) ---
// GET semua role login, tanpa scope (PuskesmasPolicy::viewAny). PATCH /puskesmas/{id}:
// super_admin bebas, admin_puskesmas cuma puskesmasnya sendiri (PuskesmasPolicy::update). Tidak
// ada store()/destroy() -- penambahan/penutupan puskesmas lewat seeder terkontrol, bukan UI.

export interface Puskesmas {
  id: number
  kode_internal: string
  nama: string
  // Baru -- puskesmas.kecamatan_id (docs/planning §7 lanjutan, wilayah kerja staf). null kalau
  // relasi belum ter-load (whenLoaded backend) ATAU puskesmas ini memang belum di-assign
  // kecamatan (seharusnya tidak terjadi utk 31 puskesmas Sumenep, tapi jaga-jaga data baru).
  kecamatan: { id: number, nama: string } | null
  alamat: string | null
  no_telp: string | null
  no_wa: string | null
  latitude: number | null
  longitude: number | null
  deskripsi: string | null
  status_aktif: boolean
}

// nama/kode_internal SENGAJA tidak ada di sini -- identitas resmi, dikunci (UpdatePuskesmasRequest
// tidak punya rule utk itu, terkirim pun tidak pernah masuk validated()).
export interface UpdatePuskesmasPayload {
  alamat?: string | null
  no_telp?: string | null
  no_wa?: string | null
  latitude?: number | null
  longitude?: number | null
  deskripsi?: string | null
}

// --- Staff (app/Http/Controllers/Api/V1/StaffController.php) ---
// POST /staff SAJA -- backend belum punya GET /staff (tidak ada endpoint listing), jangan
// mengasumsikan ada cara menarik daftar staf yang sudah terdaftar.

export interface Staff {
  id: number
  name: string
  email: string
  no_hp: string
  roles: Role[]
  puskesmas: { id: number, nama: string } | null
  is_activated: boolean
  must_change_password: boolean
  created_at: string
}

// role cuma admin_puskesmas|pj_prolanis (RegisterStaffRequest) -- kader officially lewat
// /kader, BUKAN endpoint ini. puskesmas_id nullable: wajib utk super_admin, diabaikan (dipaksa
// ke puskesmas sendiri) utk admin_puskesmas (StaffService::resolvePuskesmasId()).
export interface CreateStaffPayload {
  name: string
  email: string
  no_hp: string
  // 'super_admin' HANYA bisa dikirim oleh registrant super_admin (StaffService::ensureRoleAllowed
  // menolak admin_puskesmas yang coba kirim ini) -- validasi bentuk di sini cuma nilai umum yang
  // diterima backend, gerbang sebenarnya tetap di service.
  role: 'super_admin' | 'admin_puskesmas' | 'pj_prolanis'
  puskesmas_id?: number | null
}

// --- Visit Report (app/Http/Resources/VisitReportResource.php) ---
// Nested di VisitAssignment.report (latestReport, HasOne::latestOfMany) -- BUKAN endpoint
// tersendiri (tidak ada GET /visit-reports/{id}), cuma muncul lewat GET /visit-assignments
// kalau backend eager-load relasi itu (whenLoaded).

export type ValidationStatus = 'pending' | 'valid' | 'invalid'

export interface VisitReport {
  id: number
  assignment_id: number
  kondisi: string
  catatan: string | null
  geo_status: string
  geo_source: string | null
  latitude: number | null
  longitude: number | null
  face_detected: boolean | null
  sync_status: string
  gda: number | null
  gdp: number | null
  gd2jpp: number | null
  uric_acid: number | null
  cholesterol: number | null
  systolic: number | null
  diastolic: number | null
  keluhan: string | null
  tindakan: TindakanKunjungan | null
  attendees?: { id: number, nama: string | null }[]
  // Tahap 1 -- PJ Prolanis menerima laporan dari kadernya sendiri (idempotent, TIDAK
  // bergantung/menunggu tahap 2). null = belum diterima.
  pj_reviewed_at: string | null
  pj_reviewed_by?: { id: number, name: string } | null
  // Tahap 2 -- keputusan FINAL super_admin, independen dari tahap 1, boleh kapan pun & diubah
  // ulang. 'invalid' -> VisitReportReviewService otomatis buka lagi assignment.status='pending'
  // (laporan lama TIDAK dihapus, tetap jejak audit) + kirim notifikasi 'visit_report_invalidated'.
  validation_status: ValidationStatus
  validated_at: string | null
  validated_by?: { id: number, name: string } | null
  validation_note: string | null
  created_at: string
}

// PATCH /validasi-laporan/{visitReport} (ValidateVisitReportRequest) -- super_admin saja.
export interface ValidateVisitReportPayload {
  is_valid: boolean
  note?: string | null
}

// --- Visit Assignment (app/Http/Controllers/Api/V1/VisitAssignmentController.php) ---

export type AssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export interface VisitAssignment {
  id: number
  scheduled_date: string
  status: AssignmentStatus
  priority: RiskLevel
  // 'wilayah_resolved' (jalur biasa) | 'phone_contact' (pasien Berat, wilayah belum resolved
  // tapi ada no. telepon — kader diarahkan hubungi lewat telepon, bukan peta).
  assignment_method: 'wilayah_resolved' | 'phone_contact'
  patient?: { id: number, nama: string, alamat: string | null, phone: string | null, latitude: number | null, longitude: number | null, geo_status: string }
  kader?: { id: number, name: string | null } | null
  // Petugas tenaga_kesehatan (revisi Bu Kadis, Fase 2/5) -- kader/tenaga_kesehatan saling
  // eksklusif per assignment (lihat visit_origin di backend), null kalau assignment ini kader.
  tenaga_kesehatan?: { id: number, name: string | null } | null
  assigned_by?: { id: number, name: string } | null
  // Snapshot puskesmas saat assignment dibuat -- relevan terutama super_admin (lintas
  // puskesmas), admin_puskesmas/pj_prolanis selalu cuma lihat puskesmasnya sendiri.
  puskesmas?: { id: number, nama: string } | null
  // Kunjungan berombongan (docs/planning/02 §16) — kader pendamping RENCANA saat assignment
  // dibuat. Cuma terisi kalau relasi companions di-eager-load backend (whenLoaded).
  companions?: { kader_id: number, nama: string | null }[]
  // Peran kader yang SEDANG LOGIN di assignment ini ('primary'|'companion'), null kalau viewer
  // bukan kader atau tidak berperan di assignment ini. Dipakai /app/tugas beri label
  // "Anda mendampingi [nama primer]" utk assignment yang didampingi (bukan miliknya sendiri).
  role_in_assignment?: 'primary' | 'companion' | null
  // Laporan TERBARU (null = belum pernah disubmit). Kalau status assignment 'pending' TAPI
  // report ada DAN report.validation_status==='invalid', ini kunjungan ULANGAN (ditolak
  // super_admin), bukan assignment baru -- lihat /app/tugas & dashboard/kunjungan.
  report?: VisitReport | null
  created_at: string
}

// POST /visit-assignments/bulk — docs/planning/02 §12/§16 (backend).
export interface BulkAssignmentPayload {
  kader_id: number
  // Kunjungan berombongan (§16), opsional — divalidasi sekali utk seluruh batch (aktif +
  // sepuskesmas dgn kader_id primer), beda dari patient_ids yang partial-success per item.
  companion_kader_ids?: number[]
  patient_ids: number[]
  scheduled_date: string
  priority: RiskLevel
}

export interface BulkAssignmentResult {
  created: VisitAssignment[]
  failed: { patient_id: number, reason: string }[]
}

// --- Dashboard (app/Http/Controllers/Api/V1/DashboardController.php + DashboardService) ---
// GET /dashboard/summary — sudah ter-scope per role di backend (super_admin: semua data,
// admin_puskesmas/pj_prolanis: puskesmas sendiri, kader: miliknya sendiri).

export interface DashboardKaderActivity {
  kader_id: number
  nama: string | null
  target_hari_ini: number
  selesai_hari_ini: number
  last_update_at: string | null
}

export interface DashboardKecamatanRisk {
  kecamatan_id: number
  kecamatan_nama: string
  kecamatan_kode: string | null
  ringan: number
  sedang: number
  berat: number
}

// Paralel DashboardKecamatanRisk, TAPI cuma pasien wilayah_status=resolved (bukan ikut
// kecamatan_fallback seperti kecamatan -- level desa butuh presisi lebih tinggi). Cakupan
// wajar kecil, banyak desa tetap kosong sampai kopipu:import-desa-puskesmas dijalankan penuh.
export interface DashboardDesaRisk {
  desa_id: number
  desa_nama: string
  desa_kode: string | null
  ringan: number
  sedang: number
  berat: number
}

// Fase 4 (revisi Bu Kadis) -- jumlah pasien yang levelnya MEMBAIK (turun keparahan) antar 2
// klasifikasi berurutan, dikelompokkan per puskesmas tempat pasien terdaftar SAAT INI. breakdown
// kunci dinamis berbentuk "{level_lama}_ke_{level_baru}" (mis. "berat_ke_sedang"), bukan daftar
// tetap -- backend menghasilkan kunci apa pun kombinasi transisi yang benar-benar terjadi.
export interface DashboardPuskesmasPerformance {
  puskesmas_id: number
  puskesmas_nama: string
  total_membaik: number
  breakdown: Record<string, number>
}

export interface DashboardSummary {
  total_patients: number
  // Revisi Bu Kadis -- "3.900 dari total 5.000 pasien Prolanis": SELALU >= total_patients
  // (superset -- semua pasien Prolanis ter-sync dalam scope, bukan cuma yang efektif
  // terklasifikasi risiko). Lihat DashboardService::summaryFor() backend.
  total_patients_prolanis: number
  // REVISI Bu Kadis: kunci 'tidak_berisiko' ikut muncul di sini sejak tier itu ditambahkan
  // (Fase 1) -- PatientRiskLevel (bukan RiskLevel biasa) supaya tipe ini akurat.
  patients_per_risk_level: Record<PatientRiskLevel, number>
  total_assignments: number
  visits_per_status: Record<AssignmentStatus, number>
  kader_aktif_count: number
  // Sudah dalam bentuk persen (0-100), dibulatkan 2 desimal di backend.
  tingkat_kepatuhan: number
  aktivitas_hari_ini: DashboardKaderActivity[]
  // BUKAN data poligon — cuma agregat untuk di-mapping ke peta yang sudah ada berdasarkan nama
  // kecamatan (lihat mergeRiskData di pages/dashboard/index.vue).
  risiko_per_kecamatan: DashboardKecamatanRisk[]
  risiko_per_desa: DashboardDesaRisk[]
  puskesmas_performance: DashboardPuskesmasPerformance[]
}

// --- Announcement (app/Http/Controllers/Api/V1/AnnouncementController.php) ---
// GET /announcements: semua role login berhak baca (global, tidak ter-scope puskesmas/kader).
// POST /announcements: super_admin saja (SystemAnnouncementPolicy::create).

export type AnnouncementType = 'info' | 'success' | 'warning'

export interface Announcement {
  id: number
  title: string
  description: string
  type: AnnouncementType
  posted_by: { id: number, name: string } | null
  created_at: string | null
}

export interface CreateAnnouncementPayload {
  title: string
  description: string
  type: AnnouncementType
}

// --- Notification (app/Http/Controllers/Api/V1/NotificationController.php) ---
// GET /notifications -- tabel `notifications` bawaan Laravel, SELALU ter-scope ke user login
// sendiri. `data` bentuknya beda per `type` (lihat app/Notifications/*.php di backend) -- BUKAN
// title/desc/sender generik seperti pola Announcement, harus di-format per type di frontend
// (lihat formatNotification() di layouts/dashboard.vue). 'visit_reminder'
// {assignment_id, patient_nama, scheduled_date, priority}, 'visit_report_invalidated'
// {visit_report_id, assignment_id, patient_nama, validation_note}. Revisi Bu Kadis (NotifyService)
// menambah 3 type baru: 'silakes_sync_completed' {patients_synced, lab_results_synced,
// patients_classified}, 'patient_updated' {patient_id, patient_nama, updated_by},
// 'care_visit_adhoc' {care_assignment_id, visit_assignment_id, patient_nama, scheduled_date}.
export type NotificationType =
  | 'visit_reminder'
  | 'visit_report_invalidated'
  | 'silakes_sync_completed'
  | 'patient_updated'
  | 'care_visit_adhoc'
  | string

export interface AppNotification {
  id: string
  type: NotificationType | null
  data: Record<string, any>
  is_read: boolean
  read_at: string | null
  created_at: string
}

// --- Visit Report (app/Http/Controllers/Api/V1/VisitReportController.php) ---
// POST /visit-reports juga wajib assignment_id, photo, latitude/longitude, gps_captured_at,
// captured_live, kondisi, dst (SubmitVisitReportRequest) — belum ada tipe/UI untuk itu di sini,
// baru field "pemeriksaan saat kunjungan" (docs/planning/02 §3 tabel visit_reports) yang sudah
// dipakai form di pages/app/kunjungan/[id].vue. SEMUA opsional (lihat
// SubmitVisitReportRequest::pemeriksaan() — bukan pemeriksaan lab formal, bukan bagian dari
// 7-layer VisitValidationService anti-fraud).

export type TindakanKunjungan = 'diberi_obat' | 'dirujuk_puskesmas' | 'tidak_ada'

// SubmitVisitReportRequest::patientFieldUpdates() -- usulan pelengkapan/koreksi data pasien
// (docs/planning/01 §9), SEMUA opsional. Dikirim sebagai field individual dalam multipart yang
// SAMA dengan POST /visit-reports (bukan endpoint terpisah). Selalu masuk sebagai pending_review
// di SiLAKES, TIDAK PERNAH auto-apply ke data pasien KOPIPU sendiri.
export interface PatientFieldUpdates {
  alamat?: string
  kel_desa?: string
  kecamatan?: string
  rt_rw?: string
  phone?: string
  pekerjaan?: string
  status_perkawinan?: string
  golongan_darah?: string
  agama?: string
  is_bpjs?: boolean
  no_bpjs?: string
  jenis_prolanis?: string
  jenis_perokok?: string
}

// GET /kader/update-requests -- riwayat pengajuan pembaruan data pasien milik KADER SENDIRI
// (/app), terpisah dari PatientFieldUpdateHistoryItem (itu di-scope per pasien, dipakai staf
// via /dashboard/pasien/{id}). Dua lapis status: push_status (lokal, berhasil terkirim ke
// SiLAKES atau tidak) dan fields[].status (SiLAKES, disetujui/ditolak staf Labkesda).
export interface KaderUpdateRequestField {
  kategori: 'geo' | 'kontak' | 'identitas'
  field_name: string | null
  old_value: string | null
  new_value: string | null
  status: 'pending_review' | 'approved' | 'rejected'
  reviewed_at: string | null
  catatan_reviewer: string | null
}

export interface KaderUpdateRequest {
  visit_report_id: number
  patient_id: number
  patient_nama: string
  kunjungan_tanggal: string | null
  push_status: 'pending' | 'synced' | 'failed'
  push_error: string | null
  fields: KaderUpdateRequestField[]
}

// GET /patients/{id}/update-history -- dibaca LIVE dari SiLAKES (patient_field_updates,
// difilter sumber kopipu_*), bukan disimpan lokal di KOPIPU.
export interface PatientFieldUpdateHistoryItem {
  id: number
  kategori: 'geo' | 'kontak' | 'identitas'
  field_name: string | null
  old_value: string | null
  new_value: string | null
  sumber: string
  kopipu_visit_id: number | null
  kopipu_kader_nama: string | null
  status: 'pending_review' | 'approved' | 'rejected'
  reviewed_at: string | null
  catatan_reviewer: string | null
  created_at: string
}

export interface VisitReportPemeriksaan {
  gda?: number | null
  gdp?: number | null
  gd2jpp?: number | null
  uric_acid?: number | null
  cholesterol?: number | null
  systolic?: number | null
  diastolic?: number | null
  keluhan?: string | null
  tindakan?: TindakanKunjungan | null
}
