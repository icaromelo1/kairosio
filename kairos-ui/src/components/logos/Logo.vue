<template>
  <component
    :is="logoComponent" :size="size" :primary="primary" :accent="accent"
    class="k-logo-clickable" @click="onClick"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import LogoMonogram from './LogoMonogram.vue'
import LogoWordmark from './LogoWordmark.vue'
import LogoTerminal from './LogoTerminal.vue'
import { useAuthStore } from '@/stores/useAuthStore'

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

const router = useRouter()
const auth = useAuthStore()

function onClick() {
  if (!auth.isAuthenticated) router.push('/login')
}
</script>

<style scoped>
.k-logo-clickable {
  cursor: pointer;
}
</style>
