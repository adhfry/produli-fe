<template>
  <UApp>
    <NuxtLoadingIndicator color="#00A59A" :height="4" />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: translateY(10px);
  filter: blur(2px);
}
</style>
