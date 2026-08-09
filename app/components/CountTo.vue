<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useTransition } from '@vueuse/core'

const props = defineProps<{
  value: number
  duration?: number
}>()

const source = ref(0)
const animated = useTransition(source, { duration: props.duration || 1500 })

onMounted(() => {
  source.value = props.value
})

watch(() => props.value, (newVal) => {
  source.value = newVal
})
</script>

<template>
  <span>{{ Math.round(animated).toLocaleString('id-ID') }}</span>
</template>
