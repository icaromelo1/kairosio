<template>
  <component :is="logoComponent" :size="size" :primary="primary" :accent="accent" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LogoMonogram from './LogoMonogram.vue'
import LogoWordmark from './LogoWordmark.vue'
import LogoTerminal from './LogoTerminal.vue'

const props = withDefaults(defineProps<{
  id?: string
  size?: 'sm' | 'md' | 'lg'
  primary?: string
  accent?: string
}>(), { id: 'monogram', size: 'md', primary: '#a78bfa', accent: '#fbbf24' })

const LOGOS: Record<string, any> = {
  monogram: LogoMonogram,
  wordmark: LogoWordmark,
  terminal: LogoTerminal,
}

const logoComponent = computed(() => LOGOS[props.id] || LogoMonogram)
</script>
