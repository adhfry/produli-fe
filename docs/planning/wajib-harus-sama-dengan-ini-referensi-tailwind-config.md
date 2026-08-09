/** @type {import('tailwindcss').Config} \*/
module.exports = {
content: [
"./resources/**/_.blade.php", // Untuk Laravel
"./resources/\*\*/_.js",
"./resources/**/\*.vue",
"./components/**/_.{js,vue,ts}", // Untuk Nuxt/Vue
"./layouts/\*\*/_.vue",
"./pages/**/\*.vue",
"./plugins/**/\*.{js,ts}",
"./app.vue",
"./index.html", // Untuk HTML statis
],

darkMode: 'class', // Mendukung implementasi dark mode manual jika diperlukan nanti

theme: {
fontFamily: {
sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
heading: ['Geist', 'Inter', 'sans-serif'], // Font khusus untuk Heading jika ingin dipisah
mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
},

    extend: {
      colors: {
        // 1. PRIMARY: SATUSEHAT Teal (#00A59A)
        // Digunakan untuk tombol utama, badge, highlight teks
        primary: {
          DEFAULT: '#00A59A', // Warna asli
          50: '#F0FCFB',      // Background sangat tipis (misal: hover dropdown)
          100: '#CCF7F3',     // Background tipis (misal: bg alert sukses/info)
          200: '#99EFE9',
          300: '#5CE3DA',
          400: '#2BD3C8',
          500: '#00A59A',     // Base color
          600: '#00857D',     // Hover state untuk tombol primary
          700: '#006B65',     // Active state
          800: '#00544F',
          900: '#004541',     // Border tebal atau teks kontras di bg terang
          950: '#002927',
        },

        // 2. SECONDARY: Light Green Logo (#65B32E)
        // Digunakan untuk status 'Selesai', 'Sehat', validasi GPS, icon keberhasilan
        secondary: {
          DEFAULT: '#65B32E', // Warna asli
          50: '#F6FCF1',
          100: '#EAF8DF',
          200: '#D0F0BA',
          300: '#AEE48D',
          400: '#8CD35F',
          500: '#65B32E',     // Base color
          600: '#4F8F23',     // Hover state
          700: '#3B6D19',
          800: '#2A4F12',
          900: '#234211',
          950: '#112306',
        },

        // 3. ACCENT: Dark Navy Hand Logo (#003B5C)
        // Digunakan untuk Heading utama, Navbar, Footer, Sidebar, Text dominan
        accent: {
          DEFAULT: '#003B5C', // Warna asli (ini setara dengan shade 900 secara visual)
          50: '#F0F6FA',
          100: '#DAEAF3',
          200: '#BADAE8',
          300: '#8BC3DA',
          400: '#57A4C6',
          500: '#3385AA',     // Versi pudar untuk teks sekunder
          600: '#23698B',
          700: '#1D5471',
          800: '#19465E',
          900: '#003B5C',     // Base color (Navy)
          950: '#051D2E',     // Sangat gelap (untuk footer bg)
        },

        // 4. SURFACE: Minty/Teal Background (#F4FBF9)
        // Digunakan untuk warna latar (body) agar tidak pure white, memberi kesan medis bersih
        surface: {
          DEFAULT: '#F4FBF9', // Warna asli
          50: '#F4FBF9',
          100: '#E1F5F0',
          200: '#C2EBE0',
          300: '#9DDBCB',
          400: '#73C4B2',
          500: '#4EA693',
          600: '#388574',
          700: '#2E6B5E',
          800: '#26554B',
          900: '#21473F',
          950: '#102722',
        },

        // 5. DANGER: Red (#EF4444)
        // Untuk error, notifikasi penting, risiko tinggi, hapus data
        danger: {
          DEFAULT: '#EF4444',
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',     // Base color
          600: '#DC2626',     // Hover state
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
          950: '#450A0A',
        },

        // 6. WARNING: Amber (#F59E0B)
        // Untuk peringatan, status pending, risiko sedang
        warning: {
          DEFAULT: '#F59E0B',
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',     // Base color
          600: '#D97706',     // Hover state
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
          950: '#451A03',
        },

        // 7. NEUTRAL: Slate (Abu-abu kebiruan)
        // Menggantikan warna abu-abu default (gray) karena slate lebih cocok dengan tema Navy/Teal
        neutral: {
          DEFAULT: '#64748B',
          50: '#F8FAFC',
          100: '#F1F5F9', // Border sangat halus
          200: '#E2E8F0', // Border card
          300: '#CBD5E1', // Disabled state
          400: '#94A3B8', // Placeholder teks
          500: '#64748B', // Teks keterangan (body)
          600: '#475569',
          700: '#334155', // Teks sub-heading
          800: '#1E293B',
          900: '#0F172A', // Teks utama (hitamnya UI kita)
          950: '#020617',
        },

        // 8. INFO: Clinical Blue
        // Untuk tooltips, panduan, atau link teks
        info: {
          DEFAULT: '#0284C7',
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0284C7', // Base
          600: '#0369A1',
          700: '#075985',
          800: '#0C4A6E',
          900: '#082F49',
          950: '#041F33',
        },

        // 9. SUCCESS: Emerald
        // Alternatif hijau standar untuk notifikasi berhasil selain warna sekunder logo
        success: {
          DEFAULT: '#10B981',
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981', // Base
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
          950: '#022C22',
        },

        // =====================================================================
        // OVERRIDE DEFAULT TAILWIND COLORS (Adjusted for Medical/Enterprise Theme)
        // Warna-warna dasar Tailwind kita timpa agar tidak terlalu "neon" (vibrant).
        // Kita gunakan tone yang lebih sejuk (cool-toned) & elegan agar selaras dengan Navy & Teal.
        // =====================================================================

        red: {
          DEFAULT: '#E11D48', // Agak ke-rose (darah/klinis) bukan merah terang murni
          50: '#FFF1F2',
          100: '#FFE4E6',
          200: '#FECDD3',
          300: '#FDA4AF',
          400: '#FB7185',
          500: '#E11D48',
          600: '#BE123C',
          700: '#9F1239',
          800: '#881337',
          900: '#4C0519',
          950: '#2A030D',
        },

        orange: {
          DEFAULT: '#EA580C', // Lebih ke terracotta/earthy
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#EA580C',
          600: '#C2410C',
          700: '#9A3412',
          800: '#7C2D12',
          900: '#431407',
          950: '#230902',
        },

        yellow: {
          DEFAULT: '#CA8A04', // Muted gold/mustard untuk keterbacaan (bukan kuning stabilo)
          50: '#FEFCE8',
          100: '#FEF9C3',
          200: '#FEF08A',
          300: '#FDE047',
          400: '#FACC15',
          500: '#CA8A04',
          600: '#A16207',
          700: '#854D0E',
          800: '#713F12',
          900: '#3F2206',
          950: '#201001',
        },

        green: {
          DEFAULT: '#16A34A', // Clinical leafy green (lebih tenang dari default)
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#16A34A',
          600: '#15803D',
          700: '#166534',
          800: '#14532D',
          900: '#052E16',
          950: '#02180A',
        },

        cyan: {
          DEFAULT: '#0891B2', // Pelengkap warna Primary (Tosca) jika butuh biru yang lebih terang
          50: '#ECFEFF',
          100: '#CFFAFE',
          200: '#A5F3FC',
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#0891B2',
          600: '#0E7490',
          700: '#155E75',
          800: '#164E63',
          900: '#083344',
          950: '#041B26',
        },

        blue: {
          DEFAULT: '#2563EB', // Microsoft/Healthcare Corporate Blue
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#2563EB',
          600: '#1D4ED8',
          700: '#1E40AF',
          800: '#1E3A8A',
          900: '#172554',
          950: '#0B122E',
        },

        indigo: {
          DEFAULT: '#4F46E5', // Lebih dalam dari blue, cocok untuk elemen grafik/chart
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#4F46E5',
          600: '#4338CA',
          700: '#3730A3',
          800: '#312E81',
          900: '#1E1B4B',
          950: '#0E0D26',
        },

        purple: {
          DEFAULT: '#7C3AED', // Muted lavender/violet (sering dipakai untuk label spesialisasi)
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#7C3AED',
          600: '#6D28D9',
          700: '#5B21B6',
          800: '#4C1D95',
          900: '#2E1065',
          950: '#160736',
        },

        pink: {
          DEFAULT: '#DB2777', // Soft blush / tissue tone (Sering dipakai untuk kategori anatomi/perempuan)
          50: '#FDF2F8',
          100: '#FCE7F3',
          200: '#FBCFE8',
          300: '#F9A8D4',
          400: '#F472B6',
          500: '#DB2777',
          600: '#BE185D',
          700: '#9D174D',
          800: '#831843',
          900: '#500724',
          950: '#280211',
        }
      },

      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 59, 92, 0.07)', // Soft shadow untuk card glass
        'glass-hover': '0 12px 40px 0 rgba(0, 165, 154, 0.12)',
        'glow': '0 0 20px rgba(0, 165, 154, 0.5)',     // Glow efek primary
        'neon': '0 0 10px rgba(101, 179, 46, 0.7)',    // Neon efek secondary
        'card': '0 2px 10px rgba(15, 23, 42, 0.04)',   // Shadow card standar
      },

      animation: {
        'blob': 'blob 7s infinite',
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },

      keyframes: {
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },

},

plugins: [
// Jika Anda memakai Laravel/Nuxt, aktifkan plugin ini nantinya:
// require('@tailwindcss/forms'),
// require('@tailwindcss/typography'),
// require('@tailwindcss/aspect-ratio'),
],
}
