<template>
  <div style="display:inline-flex;align-items:center;gap:0.75rem">
    <div :style="{
      width: (s / 16) + 'rem', height: (s / 16) + 'rem',
      background: 'var(--bg-3)',
      border: `0.125rem solid ${primary}`,
      display: 'grid',
      placeItems: 'center',
      boxShadow: `0.25rem 0.25rem 0 ${primary}33`,
      flexShrink: 0,
    }">
      <PixelK :scale="s / 12" :color="primary" :accent="accent" />
    </div>
    <div style="display:flex;flex-direction:column;line-height:1">
      <span :style="{ fontFamily: 'var(--f-sans)', fontWeight: 700, fontSize: (fs / 16) + 'rem', letterSpacing: '-0.03em', color: 'var(--text)' }">
        Kairos
      </span>
      <span :style="{ fontSize: (fs * 0.32 / 16) + 'rem', color: 'var(--text-3)', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: '0.25rem' }">
        your productive world
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PixelK from '@/components/pixel/PixelK.vue'

const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg'
  primary?: string
  accent?: string
}>(), { size: 'md', primary: '#a78bfa', accent: '#fbbf24' })

const s = computed(() => ({ sm: 28, md: 44, lg: 72 }[props.size]))
const fs = computed(() => ({ sm: 16, md: 26, lg: 40 }[props.size]))
</script>
