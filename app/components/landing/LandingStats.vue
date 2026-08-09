<script setup lang="ts">
import { ref, onMounted } from "vue";
import { motion } from "motion-v";

// Pisahkan angka murni, suffix (+/%), dan format desimal agar bisa dianimasikan
const stats = ref([
  {
    value: 15000,
    current: 0,
    suffix: "+",
    format: true,
    label: "Pasien Teridentifikasi",
    color: "text-primary",
  },
  {
    value: 326,
    current: 0,
    suffix: "",
    format: false,
    label: "Kader Aktif",
    color: "text-accent",
  },
  {
    value: 28,
    current: 0,
    suffix: "",
    format: false,
    label: "Puskesmas Terintegrasi",
    color: "text-accent",
  },
  {
    value: 99,
    current: 0,
    suffix: "%",
    format: false,
    label: "Akurasi Pemetaan",
    color: "text-secondary",
  },
]);

const sectionRef = ref(null);
let hasAnimated = false;

// Helper untuk format angka (contoh: 15000 jadi 15.000)
const formatNumber = (num: number, doFormat: boolean) => {
  const floored = Math.floor(num);
  return doFormat ? floored.toLocaleString("id-ID") : floored.toString();
};

// Logika Animasi Counter (Count up)
const startCounting = () => {
  if (hasAnimated) return;
  hasAnimated = true;

  stats.value.forEach((stat, index) => {
    const duration = 2000; // Durasi animasi 2 detik
    const delay = index * 200; // Jeda antar angka

    setTimeout(() => {
      let startTimestamp: number | null = null;
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);

        // easeOutExpo formula agar di akhir melambat (smooth deceleration)
        const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        stat.current = easeOut * stat.value;

        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          stat.current = stat.value;
        }
      };
      window.requestAnimationFrame(step);
    }, delay);
  });
};

onMounted(() => {
  // Trigger animasi saat elemen section ini masuk viewport (terlihat di layar)
  const observer = new IntersectionObserver(
    (entries: any) => {
      if (entries[0].isIntersecting) {
        startCounting();
        observer.disconnect(); // Hentikan observer setelah jalan sekali
      }
    },
    { threshold: 0.2 },
  );

  if (sectionRef.value) {
    observer.observe(sectionRef.value);
  }
});
</script>

<template>
  <section
    ref="sectionRef"
    class="border-y border-neutral-200 bg-white px-6 py-12 md:px-12 lg:px-24"
  >
    <div
      class="mx-auto grid max-w-7xl grid-cols-2 gap-8 divide-neutral-100 text-center md:grid-cols-4 md:divide-x md:text-left"
    >
      <motion.div
        v-for="(stat, index) in stats"
        :key="stat.label"
        class="md:pl-8"
        :initial="{ opacity: 0, y: 30 }"
        :while-in-view="{ opacity: 1, y: 0 }"
        :in-view-options="{ once: true, amount: 0.15 }"
        :transition="{ duration: 0.8, ease: 'easeOut', delay: index * 0.1 }"
      >
        <div class="mb-1 text-4xl font-bold" :class="stat.color">
          {{ formatNumber(stat.current, stat.format) }}{{ stat.suffix }}
        </div>
        <div class="text-sm font-medium text-neutral-500">{{ stat.label }}</div>
      </motion.div>
    </div>
  </section>
</template>
