<script setup lang="ts">
import { motion } from "motion-v";

const activities = [
  {
    img: "/images/kopipu-gapura.png",
    credit: "@puskesmas_gapura",
    title: "KOPIPU (Konseling Dari Pintu ke Pintu)",
  },
  {
    img: "/images/kunjungan-rumah-lansia-pragaan.png",
    credit: "@pkm_pragaan",
    title: "Kunjungan ke Rumah Lansia",
  },
  {
    img: "/images/sempol-lenteng.png",
    credit: "@puskesmaslenteng",
    title: "Kegiatan SEMPOL SEHAT",
  },
  {
    img: "/images/kopipu-gapura-2.png",
    credit: "@puskesmas_gapura",
    title: "KOPIPU (Konseling Dari Pintu ke Pintu)",
  },
  {
    img: "/images/kopipu-gapura-3.png",
    credit: "@puskesmas_gapura",
    title: "KOPIPU (Konseling Dari Pintu ke Pintu)",
  },
  {
    img: "/images/kunjungan-rumah-pragaan.png",
    credit: "@pkm_pragaan",
    title: "Kunjungan ke Rumah",
  },
];

// Menduplikasi array agar animasi infinite scroll terlihat mulus tanpa patah
const duplicatedActivities = [...activities, ...activities];
</script>

<template>
  <section id="dampak" class="overflow-hidden bg-white py-24">
    <div class="mx-auto max-w-7xl px-6 md:px-12 lg:px-24">
      <motion.div
        class="mx-auto mb-12 max-w-3xl text-center"
        :initial="{ opacity: 0, y: 30 }"
        :while-in-view="{ opacity: 1, y: 0 }"
        :in-view-options="{ once: true, amount: 0.15 }"
        :transition="{ duration: 0.8, ease: 'easeOut' }"
      >
        <h2
          class="mb-3 text-sm font-semibold tracking-wide text-primary uppercase"
        >
          Dampak Publik
        </h2>
        <h3 class="mb-4 text-3xl font-bold text-accent md:text-4xl">
          Mewujudkan Pelayanan Kesehatan yang Proaktif
        </h3>
        <p class="text-neutral-500">
          Dedikasi tenaga kesehatan dan kader lapangan dalam meningkatkan
          kualitas hidup masyarakat melalui penanganan yang tepat sasaran dan
          berkesinambungan.
        </p>
      </motion.div>
    </div>

    <!-- Infinite Auto Scroll Slider -->
    <div
      class="marquee-container relative mt-8 flex w-full overflow-hidden pb-8"
    >
      <div class="marquee-content flex gap-4 md:gap-6 px-4">
        <div
          v-for="(item, index) in duplicatedActivities"
          :key="index"
          class="group relative h-[320px] w-[240px] shrink-0 overflow-hidden rounded-2xl shadow-sm sm:h-[420px] sm:w-[320px]"
        >
          <!-- Placeholder background berwarna abu-abu apabila gambar belum diisi -->
          <div
            class="absolute inset-0 bg-neutral-200 flex items-center justify-center"
          >
            <LucideImage class="h-12 w-12 text-neutral-400 opacity-50" />
          </div>

          <img
            :src="item.img"
            :alt="item.title"
            class="relative z-10 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            onerror="this.style.opacity = '0'"
          />

          <!-- Gradient Overlay agar teks dapat terbaca jelas -->
          <div
            class="absolute inset-0 z-20 bg-linear-to-t from-neutral-900/90 via-neutral-900/30 to-transparent"
          ></div>

          <!-- Text Overlay -->
          <div
            class="absolute inset-x-0 bottom-0 z-30 flex flex-col justify-end p-5 md:p-6 text-white"
          >
            <h4 class="mb-1 text-lg font-bold sm:text-xl">{{ item.title }}</h4>
            <div
              class="flex items-center gap-1.5 text-xs font-medium text-white/80"
            >
              <LucideCamera class="h-3.5 w-3.5" />
              {{ item.credit }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.marquee-container {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.marquee-container::-webkit-scrollbar {
  display: none;
}

.marquee-content {
  /* Lebar menyesuaikan isi agar bisa di-transform sebesar 50% */
  width: max-content;
  animation: scroll-x 40s linear infinite;
}

.marquee-container:hover .marquee-content {
  animation-play-state: paused;
}

@keyframes scroll-x {
  from {
    transform: translateX(0);
  }
  to {
    /* Menggeser persis sebesar setengah panjang container (satu set foto) */
    transform: translateX(
      calc(-50% - 0.5rem)
    ); /* 0.5rem kompensasi setengah gap */
  }
}
</style>
