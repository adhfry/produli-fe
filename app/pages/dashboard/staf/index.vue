<script setup lang="ts">
import type {
  ApiSuccessEnvelope,
  CreateStaffPayload,
  Puskesmas,
  Staff,
  UpdateStaffPayload,
} from "~/types/api";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});
useHead({
  title: "Manajemen Staf",
});

// Role-visibility -- reuse pola dari dashboard/index.vue (isSuperAdmin computed dari
// authStore.roles), bukan mock toggle currentUserRole seperti di dashboard/kunjungan/index.vue.
const authStore = useAuthStore();
const isSuperAdmin = computed(() =>
  (authStore.roles ?? []).includes("super_admin"),
);
const isAdminPuskesmas = computed(() =>
  (authStore.roles ?? []).includes("admin_puskesmas"),
);
const isPjProlanis = computed(() =>
  (authStore.roles ?? []).includes("pj_prolanis"),
);
// StaffController::store gerbang: HANYA super_admin atau admin_puskesmas boleh MENDAFTARKAN
// staf (pj_prolanis/kader/role lain tidak pernah bisa). Beda dari canViewStaff di bawah --
// pj_prolanis SEKARANG boleh LIHAT daftar staf puskesmasnya sendiri, tapi tetap tidak bisa
// mendaftarkan staf baru.
const canManageStaff = computed(
  () => isSuperAdmin.value || isAdminPuskesmas.value,
);
// StaffController::index gerbang -- super_admin/admin_puskesmas/pj_prolanis (docs/planning §7
// lanjutan, sebelumnya pj_prolanis 403 total, sekarang boleh lihat staf puskesmasnya sendiri).
const canViewStaff = computed(
  () => isSuperAdmin.value || isAdminPuskesmas.value || isPjProlanis.value,
);

// role yang boleh dipilih beda per role login -- BUKAN cuma sembunyi/tampil opsi, backend
// (RegisterStaffRequest + StaffService) menegakkan pembatasan yang sama: admin_puskesmas
// TIDAK BISA daftarkan sesama admin_puskesmas ATAU super_admin, cuma pj_prolanis untuk
// puskesmasnya sendiri. super_admin boleh daftarkan super_admin BARU juga (StaffService::
// ensureRoleAllowed) -- akun tanpa puskesmas_id, field itu disembunyikan utk pilihan ini
// (lihat template, mirip pola admin_puskesmas yg dipaksa ke puskesmas sendiri).
const roleOptions = computed(() => {
  if (isSuperAdmin.value) {
    return [
      { value: "super_admin", label: "Super Admin" },
      { value: "admin_puskesmas", label: "Admin Puskesmas" },
      { value: "pj_prolanis", label: "PJ Prolanis" },
    ];
  }
  if (isAdminPuskesmas.value) {
    return [{ value: "pj_prolanis", label: "PJ Prolanis" }];
  }
  return [];
});

// GET /api/v1/staff -- StaffController::index gerbang sekarang termasuk pj_prolanis (canViewStaff),
// jangan panggil kalau false, sudah pasti gagal.
const staffList = ref<Staff[]>([]);
const isLoadingStaff = ref(false);
const loadError = ref("");

async function loadStaffList() {
  if (!canViewStaff.value) return;
  isLoadingStaff.value = true;
  loadError.value = "";
  try {
    const api = useApi();
    staffList.value = await fetchAllPages((page) =>
      api("/staff", { query: { per_page: 100, page } }),
    );
  } catch (e) {
    loadError.value =
      e instanceof ApiError ? e.message : "Gagal memuat daftar staf.";
  } finally {
    isLoadingStaff.value = false;
  }
}

onMounted(loadStaffList);

const searchQuery = ref("");
const filterRole = ref("") as any;
const filterActivation = ref("");

const filteredStaff = computed(() => {
  return staffList.value.filter((s) => {
    const q = searchQuery.value.toLowerCase();
    const matchSearch = q
      ? s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
      : true;
    const matchRole = filterRole.value
      ? s.roles.includes(filterRole.value)
      : true;
    const matchActivation = filterActivation.value
      ? String(s.is_activated) === filterActivation.value
      : true;
    return matchSearch && matchRole && matchActivation;
  });
});

function getRoleLabel(role: any) {
  return resolveRoleLabel(role);
}

// Baris mana yang boleh diedit/dihapus admin_puskesmas -- backend (StaffService::
// ensureCanManage) cuma izinkan pj_prolanis puskesmas sendiri (list sudah ter-scope puskesmas,
// jadi tinggal cek rolenya di sini). super_admin bebas kelola siapa pun.
function canManageRow(staff: Staff) {
  if (isSuperAdmin.value) return true;
  if (isAdminPuskesmas.value) {
    return (
      staff.roles.includes("pj_prolanis") &&
      !staff.roles.some((r) => r === "admin_puskesmas" || r === "super_admin")
    );
  }
  return false;
}

function getRoleColor(role: any) {
  if (role === "super_admin")
    return "bg-accent/10 text-accent border border-accent/20";
  if (role === "admin_puskesmas")
    return "bg-primary/10 text-primary border border-primary/20";
  if (role === "pj_prolanis")
    return "bg-warning/10 text-warning border border-warning/20";
  return "bg-slate-100 text-slate-600 border border-slate-200";
}

// --- Tambah Staf — POST /api/v1/staff ---
const showAddModal = ref(false);
const isSaving = ref(false);
const saveError = ref("");
const successMessage = ref("");
const fieldErrors = ref<Record<string, string[]>>({});

function emptyForm(): CreateStaffPayload {
  return {
    name: "",
    email: "",
    no_hp: "",
    role: roleOptions.value[0]?.value ?? "pj_prolanis",
    puskesmas_id: null,
  } as any;
}
const staffForm = ref<CreateStaffPayload>(emptyForm());

// puskesmas_id WAJIB dipilih manual utk super_admin (bisa daftarkan staf puskesmas mana pun);
// admin_puskesmas dipaksa ke puskesmasnya sendiri di backend (StaffService::resolvePuskesmasId),
// field ini disembunyikan sama sekali untuknya, bukan cuma dikosongkan.
const puskesmasList = ref<Puskesmas[]>([]);
const isLoadingPuskesmas = ref(false);

async function loadPuskesmasList() {
  if (puskesmasList.value.length) return;
  isLoadingPuskesmas.value = true;
  try {
    const api = useApi();
    puskesmasList.value = await fetchAllPages((page) =>
      api("/puskesmas", { query: { per_page: 100, page } }),
    );
  } catch (e) {
    console.error(e);
  } finally {
    isLoadingPuskesmas.value = false;
  }
}

function openAddModal() {
  staffForm.value = emptyForm();
  saveError.value = "";
  fieldErrors.value = {};
  successMessage.value = "";
  showAddModal.value = true;
  if (isSuperAdmin.value) loadPuskesmasList();
}

const canSubmit = computed(() => {
  if (
    !staffForm.value.name ||
    !staffForm.value.email ||
    !staffForm.value.no_hp ||
    !staffForm.value.role
  )
    return false;
  // puskesmas_id WAJIB kalau registrant super_admin mendaftarkan admin_puskesmas/pj_prolanis --
  // TIDAK relevan kalau role yang didaftarkan 'super_admin' sendiri (tidak py puskesmas).
  if (
    isSuperAdmin.value &&
    staffForm.value.role !== "super_admin" &&
    !staffForm.value.puskesmas_id
  )
    return false;
  return true;
});

async function saveStaff() {
  if (!canSubmit.value) return;
  isSaving.value = true;
  saveError.value = "";
  fieldErrors.value = {};
  try {
    const api = useApi();
    const payload = { ...staffForm.value };
    if (!isSuperAdmin.value) delete payload.puskesmas_id;
    const res = (await api("/staff", {
      method: "POST",
      body: payload,
    })) as ApiSuccessEnvelope<Staff>;
    showAddModal.value = false;
    successMessage.value = `Staf "${res.data.name}" berhasil didaftarkan sebagai ${res.data.roles.join(", ")}. Email aktivasi otomatis terkirim ke ${res.data.email}.`;
    await loadStaffList();
  } catch (e) {
    if (e instanceof ApiError) {
      saveError.value = e.message;
      fieldErrors.value = e.errors ?? {};
    } else {
      saveError.value = "Gagal mendaftarkan staf.";
    }
  } finally {
    isSaving.value = false;
  }
}

// --- Ubah Data Staf — PATCH /api/v1/staff/{id} (super_admin/admin_puskesmas, admin_puskesmas
// dibatasi ke pj_prolanis puskesmas sendiri di backend, lihat StaffService::ensureCanManage()) ---
const showEditModal = ref(false);
const isSavingEdit = ref(false);
const editError = ref("");
const editFieldErrors = ref<Record<string, string[]>>({});
const staffBeingEdited = ref<Staff | null>(null);
const editForm = ref<UpdateStaffPayload>({});

function openEditModal(staff: Staff) {
  staffBeingEdited.value = staff;
  editForm.value = {
    name: staff.name,
    email: staff.email,
    no_hp: staff.no_hp,
  };
  editError.value = "";
  editFieldErrors.value = {};
  showEditModal.value = true;
}

async function saveEditStaff() {
  if (!staffBeingEdited.value) return;
  isSavingEdit.value = true;
  editError.value = "";
  editFieldErrors.value = {};
  try {
    const api = useApi();
    const res = (await api(`/staff/${staffBeingEdited.value.id}`, {
      method: "PATCH",
      body: editForm.value,
    })) as ApiSuccessEnvelope<Staff>;
    const idx = staffList.value.findIndex(
      (s) => s.id === staffBeingEdited.value!.id,
    );
    if (idx !== -1) staffList.value[idx] = res.data;
    showEditModal.value = false;
  } catch (e) {
    if (e instanceof ApiError) {
      editError.value = e.message;
      editFieldErrors.value = e.errors ?? {};
    } else {
      editError.value = "Gagal memperbarui data staf.";
    }
  } finally {
    isSavingEdit.value = false;
  }
}

// --- Hapus Staf — DELETE /api/v1/staff/{id} (tidak bisa hapus diri sendiri atau satu-satunya
// super_admin, lihat StaffService::delete()) ---
const showDeleteConfirm = ref(false);
const staffToDelete = ref<Staff | null>(null);
const isDeleting = ref(false);
const deleteError = ref("");

function requestDelete(staff: Staff) {
  staffToDelete.value = staff;
  deleteError.value = "";
  showDeleteConfirm.value = true;
}

async function confirmDelete() {
  if (!staffToDelete.value) return;
  isDeleting.value = true;
  deleteError.value = "";
  try {
    const api = useApi();
    await api(`/staff/${staffToDelete.value.id}`, { method: "DELETE" });
    staffList.value = staffList.value.filter(
      (s) => s.id !== staffToDelete.value!.id,
    );
    showDeleteConfirm.value = false;
    staffToDelete.value = null;
  } catch (e) {
    deleteError.value =
      e instanceof ApiError ? e.message : "Gagal menghapus staf.";
  } finally {
    isDeleting.value = false;
  }
}

// --- Reset Password — POST /api/v1/staff/{id}/reset-password (super_admin saja) -- password
// baru otomatis di-generate sistem dan dikirim ke email staf, TIDAK pernah ditampilkan di UI. ---
const showResetPasswordConfirm = ref(false);
const staffToReset = ref<Staff | null>(null);
const isResettingPassword = ref(false);
const resetPasswordError = ref("");
const resetPasswordSuccessMsg = ref("");

function requestResetPassword(staff: Staff) {
  staffToReset.value = staff;
  resetPasswordError.value = "";
  showResetPasswordConfirm.value = true;
}

async function confirmResetPassword() {
  if (!staffToReset.value) return;
  isResettingPassword.value = true;
  resetPasswordError.value = "";
  try {
    const api = useApi();
    const res = (await api(`/staff/${staffToReset.value.id}/reset-password`, {
      method: "POST",
    })) as ApiSuccessEnvelope<null>;
    showResetPasswordConfirm.value = false;
    resetPasswordSuccessMsg.value = res.message;
    staffToReset.value = null;
  } catch (e) {
    resetPasswordError.value =
      e instanceof ApiError ? e.message : "Gagal mereset password.";
  } finally {
    isResettingPassword.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Breadcrumb & Header -->
    <div>
      <div
        class="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wider"
      >
        <NuxtLink to="/dashboard" class="hover:text-primary transition-colors"
          >Dashboard</NuxtLink
        >
        <LucideChevronRight class="w-3 h-3" />
        <span class="text-slate-600">Manajemen Staf</span>
      </div>
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-extrabold text-accent">Manajemen Staf</h1>
          <p class="text-sm text-slate-500 mt-1">
            Daftarkan Admin Puskesmas dan Penanggung Jawab Prolanis.
          </p>
          <p v-if="loadError" class="text-xs font-semibold text-danger mt-1">
            {{ loadError }}
          </p>
        </div>
        <div v-if="canManageStaff" class="flex items-center gap-3">
          <button
            @click="openAddModal"
            class="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-600 transition-colors shadow-sm"
          >
            <LucideUserPlus class="w-4 h-4" />
            <span>Tambah Staf</span>
          </button>
        </div>
      </div>
    </div>

    <p
      v-if="successMessage"
      class="text-sm font-semibold text-success bg-success/10 border border-success/20 rounded-xl px-4 py-3"
    >
      {{ successMessage }}
    </p>

    <p
      v-if="resetPasswordSuccessMsg"
      class="text-sm font-semibold text-success bg-success/10 border border-success/20 rounded-xl px-4 py-3"
    >
      {{ resetPasswordSuccessMsg }}
    </p>

    <div
      v-if="!canViewStaff"
      class="bg-white rounded-2xl border border-slate-100 shadow-card p-8 text-center text-slate-400"
    >
      <LucideShieldAlert class="w-8 h-8 mx-auto mb-3 text-slate-300" />
      <p class="font-medium">
        Anda tidak memiliki akses untuk melihat daftar staf.
      </p>
    </div>

    <!-- GET /api/v1/staff -- StaffController::index, ter-scope sama seperti store() -->
    <div
      v-else
      class="bg-white rounded-2xl border border-slate-100 shadow-card flex flex-col overflow-hidden"
    >
      <!-- Toolbar -->
      <div
        class="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50"
      >
        <div class="relative w-full md:w-80">
          <LucideSearch
            class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari nama atau email..."
            class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
          />
        </div>

        <div class="flex items-center gap-3 w-full md:w-auto">
          <select
            v-model="filterRole"
            class="flex-1 md:w-48 py-2.5 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
          >
            <option value="">Semua Peran</option>
            <option value="admin_puskesmas">Admin Puskesmas</option>
            <option value="pj_prolanis">PJ Prolanis</option>
          </select>
          <select
            v-model="filterActivation"
            class="flex-1 md:w-44 py-2.5 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
          >
            <option value="">Semua Status</option>
            <option value="true">Sudah Aktivasi</option>
            <option value="false">Menunggu Aktivasi</option>
          </select>
        </div>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr
              class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200"
            >
              <th class="py-4 px-5 font-semibold">Nama Staf</th>
              <th class="py-4 px-5 font-semibold">Peran (Role)</th>
              <th class="py-4 px-5 font-semibold">Puskesmas</th>
              <th class="py-4 px-5 font-semibold text-center">
                Status Aktivasi
              </th>
              <th
                v-if="canManageStaff"
                class="py-4 px-5 font-semibold text-right"
              >
                Aksi
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="isLoadingStaff">
              <td
                :colspan="canManageStaff ? 5 : 4"
                class="py-12 text-center text-slate-400"
              >
                <LucideLoader2 class="w-6 h-6 mx-auto mb-2 animate-spin" />
                Memuat daftar staf...
              </td>
            </tr>
            <tr
              v-for="staff in filteredStaff"
              :key="staff.id"
              class="hover:bg-slate-50/80 transition-colors group"
            >
              <td class="py-4 px-5">
                <div class="flex items-center gap-3">
                  <div
                    class="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm shadow-sm border border-slate-200 shrink-0"
                  >
                    {{
                      staff.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)
                        .toUpperCase()
                    }}
                  </div>
                  <div>
                    <span class="font-bold text-slate-800 block">{{
                      staff.name
                    }}</span>
                    <span class="text-[11px] text-slate-500 font-medium">{{
                      staff.email
                    }}</span>
                  </div>
                </div>
              </td>
              <td class="py-4 px-5">
                <span
                  v-for="role in staff.roles"
                  :key="role"
                  class="px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider mr-1.5"
                  :class="getRoleColor(role)"
                >
                  {{ getRoleLabel(role) }}
                </span>
              </td>
              <td class="py-4 px-5">
                <p class="text-sm font-bold text-slate-700">
                  {{ staff.puskesmas?.nama || "-" }}
                </p>
              </td>
              <td class="py-4 px-5 text-center">
                <span
                  v-if="staff.is_activated"
                  class="inline-flex items-center gap-1.5 text-xs font-bold text-success bg-success/10 px-2.5 py-1 rounded-full border border-success/20"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-success"></span>
                  Sudah Aktivasi
                </span>
                <span
                  v-else
                  class="inline-flex items-center gap-1.5 text-xs font-bold text-warning bg-warning/10 px-2.5 py-1 rounded-full border border-warning/20"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-warning"></span>
                  Menunggu Aktivasi
                </span>
              </td>
              <td v-if="canManageStaff" class="py-4 px-5">
                <div
                  v-if="canManageRow(staff)"
                  class="flex items-center justify-end gap-1.5 flex-wrap"
                >
                  <button
                    @click="openEditModal(staff)"
                    title="Ubah data staf"
                    class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-primary transition-colors"
                  >
                    <LucidePencil class="w-3.5 h-3.5" />
                  </button>
                  <button
                    v-if="isSuperAdmin"
                    @click="requestResetPassword(staff)"
                    title="Reset password"
                    class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-warning transition-colors"
                  >
                    <LucideKeyRound class="w-3.5 h-3.5" />
                  </button>
                  <button
                    v-if="staff.id !== authStore.user?.id"
                    @click="requestDelete(staff)"
                    title="Hapus staf"
                    class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-danger/5 hover:text-danger hover:border-danger/30 transition-colors"
                  >
                    <LucideTrash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!isLoadingStaff && filteredStaff.length === 0">
              <td :colspan="canManageStaff ? 5 : 4" class="py-12 text-center">
                <div
                  class="flex flex-col items-center justify-center text-slate-400"
                >
                  <LucideUsers class="w-10 h-10 mb-3 text-slate-300" />
                  <p class="font-medium">Tidak ada data staf yang ditemukan.</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Ringkasan -->
      <div
        class="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50"
      >
        <span class="text-sm text-slate-500"
          >Menampilkan
          <b class="text-slate-700">{{ filteredStaff.length }}</b> dari
          <b class="text-slate-700">{{ staffList.length }}</b> staf</span
        >
      </div>
    </div>

    <!-- Add Modal -->
    <div
      v-if="showAddModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
    >
      <div
        class="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col"
      >
        <div
          class="border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0"
        >
          <h3 class="font-bold text-accent text-lg flex items-center gap-2">
            <LucideUserPlus class="w-5 h-5 text-primary" />
            Tambah Staf Baru
          </h3>
          <button
            @click="showAddModal = false"
            class="text-slate-400 hover:text-slate-600 p-1"
          >
            <LucideX class="w-5 h-5" />
          </button>
        </div>

        <div class="p-6 space-y-4 overflow-y-auto">
          <p
            v-if="saveError"
            class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2"
          >
            {{ saveError }}
          </p>

          <div>
            <label
              class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide"
              >Nama Lengkap</label
            >
            <input
              v-model="staffForm.name"
              type="text"
              placeholder="Masukkan nama..."
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p v-if="fieldErrors.name" class="text-xs text-danger mt-1">
              {{ fieldErrors.name[0] }}
            </p>
          </div>

          <div>
            <label
              class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide"
              >Email</label
            >
            <input
              v-model="staffForm.email"
              type="email"
              placeholder="email@contoh.com"
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p v-if="fieldErrors.email" class="text-xs text-danger mt-1">
              {{ fieldErrors.email[0] }}
            </p>
          </div>

          <div>
            <label
              class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide"
              >No. Handphone</label
            >
            <input
              v-model="staffForm.no_hp"
              type="text"
              placeholder="08..."
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p v-if="fieldErrors.no_hp" class="text-xs text-danger mt-1">
              {{ fieldErrors.no_hp[0] }}
            </p>
          </div>

          <div>
            <label
              class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide"
              >Peran (Role)</label
            >
            <select
              v-model="staffForm.role"
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option
                v-for="opt in roleOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
            <p v-if="fieldErrors.role" class="text-xs text-danger mt-1">
              {{ fieldErrors.role[0] }}
            </p>
            <p v-if="isAdminPuskesmas" class="text-[11px] text-slate-400 mt-1">
              Admin Puskesmas cuma bisa mendaftarkan PJ Prolanis untuk puskesmas
              sendiri.
            </p>
          </div>

          <!-- Puskesmas: WAJIB dipilih manual utk super_admin YANG MENDAFTARKAN admin_puskesmas/
                  pj_prolanis, disembunyikan (otomatis puskesmas sendiri di backend) utk
                  admin_puskesmas, dan TIDAK RELEVAN kalau role yang didaftarkan 'super_admin'
                  sendiri (tidak py puskesmas). -->
          <div v-if="isSuperAdmin && staffForm.role !== 'super_admin'">
            <label
              class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide"
              >Puskesmas <span class="text-danger">*</span></label
            >
            <select
              v-model.number="staffForm.puskesmas_id"
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option :value="null">
                {{ isLoadingPuskesmas ? "Memuat..." : "Pilih puskesmas..." }}
              </option>
              <option
                v-for="pkm in puskesmasList"
                :key="pkm.id"
                :value="pkm.id"
              >
                {{ pkm.nama }}
              </option>
            </select>
            <p v-if="fieldErrors.puskesmas_id" class="text-xs text-danger mt-1">
              {{ fieldErrors.puskesmas_id[0] }}
            </p>
          </div>
        </div>

        <div
          class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0"
        >
          <button
            @click="showAddModal = false"
            class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Batal
          </button>
          <button
            @click="saveStaff"
            :disabled="isSaving || !canSubmit"
            class="py-2.5 px-6 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
          >
            <LucideLoader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
            {{ isSaving ? "Menyimpan..." : "Simpan Data" }}
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
    >
      <div
        class="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col"
      >
        <div
          class="border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0"
        >
          <h3 class="font-bold text-accent text-lg flex items-center gap-2">
            <LucidePencil class="w-5 h-5 text-primary" />
            Ubah Data Staf
          </h3>
          <button
            @click="showEditModal = false"
            class="text-slate-400 hover:text-slate-600 p-1"
          >
            <LucideX class="w-5 h-5" />
          </button>
        </div>

        <div class="p-6 space-y-4 overflow-y-auto">
          <p
            v-if="editError"
            class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2"
          >
            {{ editError }}
          </p>

          <div>
            <label
              class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide"
              >Nama Lengkap</label
            >
            <input
              v-model="editForm.name"
              type="text"
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p v-if="editFieldErrors.name" class="text-xs text-danger mt-1">
              {{ editFieldErrors.name[0] }}
            </p>
          </div>

          <div>
            <label
              class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide"
              >Email</label
            >
            <input
              v-model="editForm.email"
              type="email"
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p v-if="editFieldErrors.email" class="text-xs text-danger mt-1">
              {{ editFieldErrors.email[0] }}
            </p>
          </div>

          <div>
            <label
              class="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide"
              >No. Handphone</label
            >
            <input
              v-model="editForm.no_hp"
              type="text"
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p v-if="editFieldErrors.no_hp" class="text-xs text-danger mt-1">
              {{ editFieldErrors.no_hp[0] }}
            </p>
          </div>

          <p class="text-[11px] text-slate-400">
            Peran (role) dan puskesmas tidak bisa diubah di sini -- hapus staf
            ini lalu daftarkan ulang kalau perlu pindah peran/puskesmas.
          </p>
        </div>

        <div
          class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0"
        >
          <button
            @click="showEditModal = false"
            class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Batal
          </button>
          <button
            @click="saveEditStaff"
            :disabled="isSavingEdit"
            class="py-2.5 px-6 rounded-xl font-bold text-white bg-primary hover:bg-primary-600 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <LucideLoader2 v-if="isSavingEdit" class="w-4 h-4 animate-spin" />
            {{ isSavingEdit ? "Menyimpan..." : "Simpan Perubahan" }}
          </button>
        </div>
      </div>
    </div>

    <!-- Konfirmasi Hapus Staf -->
    <div
      v-if="showDeleteConfirm && staffToDelete"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
    >
      <div
        class="bg-white rounded-3xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200"
      >
        <div class="p-6 overflow-y-auto">
          <div
            class="w-14 h-14 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mb-4"
          >
            <LucideTrash2 class="w-7 h-7" />
          </div>
          <h3 class="font-bold text-accent text-lg mb-1">Hapus Staf?</h3>
          <p class="text-sm text-slate-500 leading-relaxed mb-1">
            <span class="font-bold text-slate-700">{{
              staffToDelete.name
            }}</span>
            akan kehilangan akses staf ini. Kalau tidak punya peran lain
            (mis. kader/tenaga kesehatan), akunnya ikut dihapus permanen.
            Tindakan ini tidak bisa dibatalkan.
          </p>
          <p
            v-if="deleteError"
            class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2 mt-4"
          >
            {{ deleteError }}
          </p>
        </div>
        <div
          class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0"
        >
          <button
            @click="
              showDeleteConfirm = false;
              staffToDelete = null;
            "
            class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Batal
          </button>
          <button
            @click="confirmDelete"
            :disabled="isDeleting"
            class="py-2.5 px-6 rounded-xl font-bold text-white bg-danger hover:bg-danger/90 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <LucideLoader2 v-if="isDeleting" class="w-4 h-4 animate-spin" />
            Ya, Hapus Staf
          </button>
        </div>
      </div>
    </div>

    <!-- Konfirmasi Reset Password -->
    <div
      v-if="showResetPasswordConfirm && staffToReset"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
    >
      <div
        class="bg-white rounded-3xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200"
      >
        <div class="p-6 overflow-y-auto">
          <div
            class="w-14 h-14 rounded-2xl bg-warning/10 text-warning flex items-center justify-center mb-4"
          >
            <LucideKeyRound class="w-7 h-7" />
          </div>
          <h3 class="font-bold text-accent text-lg mb-1">
            Reset Password Staf?
          </h3>
          <p class="text-sm text-slate-500 leading-relaxed mb-1">
            Password baru akan otomatis dibuat sistem dan dikirim lewat email
            ke
            <span class="font-bold text-slate-700">{{
              staffToReset.email
            }}</span
            >. Password lama tidak akan berlaku lagi dan semua sesi login
            aktif akan keluar otomatis.
          </p>
          <p
            v-if="resetPasswordError"
            class="text-sm font-semibold text-danger bg-danger/10 border border-danger/20 rounded-xl px-3 py-2 mt-4"
          >
            {{ resetPasswordError }}
          </p>
        </div>
        <div
          class="px-6 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0"
        >
          <button
            @click="
              showResetPasswordConfirm = false;
              staffToReset = null;
            "
            class="py-2.5 px-5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Batal
          </button>
          <button
            @click="confirmResetPassword"
            :disabled="isResettingPassword"
            class="py-2.5 px-6 rounded-xl font-bold text-white bg-warning hover:bg-warning/90 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <LucideLoader2
              v-if="isResettingPassword"
              class="w-4 h-4 animate-spin"
            />
            Ya, Reset Password
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
