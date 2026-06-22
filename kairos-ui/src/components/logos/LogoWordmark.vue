<template>
  <div style="display:inline-flex;align-items:center" :style="{ gap: (fs * 0.18) + 'px' }">
    <span :style="{ fontFamily: 'var(--f-sans)', fontWeight: 600, fontSize: fs + 'px', letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1 }">
      kairos
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg'
  primary?: string
  accent?: string
}>(), { size: 'md', primary: '#a78bfa', accent: '#fbbf24' })

const fs = computed(() => ({ sm: 18, md: 28, lg: 56 }[props.size]))
const tag = computed(() => ({ sm: 9, md: 12, lg: 22 }[props.size]))
</script>
