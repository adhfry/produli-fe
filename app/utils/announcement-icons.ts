import type { Component } from 'vue'
import {
  Megaphone, Info, AlertTriangle, Siren, Bell,
  Calendar, CalendarClock, Wrench, PartyPopper, Gift,
  Heart, Star, Rocket, Shield, ShieldCheck,
  CircleCheck, CircleX, Clock, Zap, TrendingUp,
  Users, FileText, Stethoscope, Syringe, Pill,
  Hospital, Sparkles, Award, Flag, Lightbulb,
  Sun, CloudRain, MapPin, Phone, Mail,
  Lock, Trophy, Target, Rss, BookOpen
} from '@lucide/vue'

// Satu-satunya sumber kebenaran ikon Pengumuman -- dipakai grid pemilihan (dashboard/pengumuman/
// index.vue) DAN resolusi tampil (AnnouncementInboxModal.vue). SEBELUMNYA masing-masing file
// punya `import * as icons from '#components'` sendiri lalu index dinamis `icons[name]` --
// bekerja di dev tapi menghasilkan 500 "icons is not defined" di build produksi, KARENA
// nuxt-lucide-icons mendaftarkan tiap ikon via addComponent() TANPA global:true (cuma
// dikenali sebagai tag statis `<LucideXxx />` di template, bukan lookup objek dinamis -- lihat
// panduan-roles.ts, pola yang sama pernah ditemukan di sana). Fix: import EKSPLISIT langsung
// dari '@lucide/vue' (paket asli, bukan modul virtual Nuxt), lalu map manual ke key string yang
// SAMA PERSIS dengan yang sudah tersimpan di kolom announcements.icon ('LucideXxx', dengan
// prefix) -- supaya data lama tidak perlu migrasi.
export const ANNOUNCEMENT_ICON_MAP: Record<string, Component> = {
  LucideMegaphone: Megaphone,
  LucideInfo: Info,
  LucideAlertTriangle: AlertTriangle,
  LucideSiren: Siren,
  LucideBell: Bell,
  LucideCalendar: Calendar,
  LucideCalendarClock: CalendarClock,
  LucideWrench: Wrench,
  LucidePartyPopper: PartyPopper,
  LucideGift: Gift,
  LucideHeart: Heart,
  LucideStar: Star,
  LucideRocket: Rocket,
  LucideShield: Shield,
  LucideShieldCheck: ShieldCheck,
  LucideCircleCheck: CircleCheck,
  LucideCircleX: CircleX,
  LucideClock: Clock,
  LucideZap: Zap,
  LucideTrendingUp: TrendingUp,
  LucideUsers: Users,
  LucideFileText: FileText,
  LucideStethoscope: Stethoscope,
  LucideSyringe: Syringe,
  LucidePill: Pill,
  LucideHospital: Hospital,
  LucideSparkles: Sparkles,
  LucideAward: Award,
  LucideFlag: Flag,
  LucideLightbulb: Lightbulb,
  LucideSun: Sun,
  LucideCloudRain: CloudRain,
  LucideMapPin: MapPin,
  LucidePhone: Phone,
  LucideMail: Mail,
  LucideLock: Lock,
  LucideTrophy: Trophy,
  LucideTarget: Target,
  LucideRss: Rss,
  LucideBookOpen: BookOpen
}

// Urutan grid kurasi (dashboard/pengumuman/index.vue) -- key Object.keys() JS menjaga urutan
// insersi untuk string key non-numerik, jadi ini otomatis sinkron dengan urutan di atas.
export const ANNOUNCEMENT_ICON_CHOICES = Object.keys(ANNOUNCEMENT_ICON_MAP)

export function resolveAnnouncementIcon(name: string | null | undefined): Component {
  return (name && ANNOUNCEMENT_ICON_MAP[name]) ?? Megaphone
}
