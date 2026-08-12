<script setup lang="ts">
// Landing publik (docs/planning/06 §3, desain revisi §6 + docs/planning/07) — SEO aktif,
// layout public.vue (titleTemplate + og:image sudah di-set di sana).
definePageMeta({ layout: "public" });

const { origin } = useRequestURL();

const heroHeadline = "Mewujudkan Pelayanan Kesehatan yang Proaktif";

const heroSubtitle =
  "PRODULI merupakan platform digital yang mengintegrasikan data laboratorium, analisis risiko, dan koordinasi kunjungan kesehatan dalam satu ekosistem terintegrasi. Dengan pendekatan berbasis data dan pemantauan secara real-time, PRODULI membantu tenaga kesehatan memberikan layanan yang lebih cepat, tepat sasaran, dan berkelanjutan.";

useSeoMeta({
  title: "PRODULI — " + heroHeadline,
  description: heroSubtitle,
  ogTitle: `PRODULI — ${heroHeadline}`,
  ogDescription: heroSubtitle,
  twitterTitle: `PRODULI — ${heroHeadline}`,
  twitterDescription: heroSubtitle,
  author:
    "Pengolah Data dan Informasi UPTD Laboratorium Kesehatan Daerah, Dinas Kesehatan P2KB Kabupaten Sumenep",
});

// Structured data (docs/planning/06 §7) — belum ada modul schema.org terpasang, jadi
// JSON-LD ditulis manual lewat useHead (tidak perlu dependency baru untuk ini).
useHead({
  script: [
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "GovernmentOrganization",
        name: "PRODULI",
        url: origin,
        logo: `${origin}/logo/produli-logo-remove-bg.png`,
        description: heroSubtitle,
      }),
    },
  ],
});
</script>

<template>
  <div
    class="bg-surface text-neutral-800 selection:bg-primary selection:text-white"
  >
    <PublicHeader />

    <main>
      <LandingHero />
      <LandingStats />
      <LandingFeatures />
      <LandingTransformation />
      <LandingEarlyDetection />
      <LandingSecurity />
      <LandingRoles />
      <LandingImpact />
      <LandingRoadmap />
      <LandingAbout />
    </main>

    <PublicFooter />
  </div>
</template>
