// KHUSUS branch `dev`/lingkungan simulasi -- tinggi ribbon SimulationBanner.vue dalam
// piksel, dipakai BERSAMA oleh komponen itu sendiri dan tiap layout yang punya elemen
// fixed/sticky di posisi top (PublicHeader.vue, layouts/dashboard.vue) supaya elemen
// itu digeser turun PERSIS setinggi banner -- BUKAN cuma ganti `top` (itu saja tidak
// cukup untuk elemen `position: sticky`, posisi awal sebelum scroll tetap ditentukan
// alur dokumen normal, harus digeser lewat margin/padding juga, lihat pemakaian di
// layouts/dashboard.vue).
export const SIMULATION_BANNER_HEIGHT_PX = 36

export function useSimulationBannerActive() {
  const config = useRuntimeConfig()

  return computed(() => Boolean(config.public.appEnvLabel))
}
