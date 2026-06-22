<template>
  <div style="display:inline-flex;align-items:center;gap:12px">
    <div :style="{
      width: s + 'px', height: s + 'px',
      background: 'var(--bg-3)',
      border: `2px solid ${primary}`,
      display: 'grid',
      placeItems: 'center',
      boxShadow: `4px 4px 0 ${primary}33`,
      flexShrink: 0,
    }">
      <PixelK :scale="s / 12" :color="primary" :accent="accent" />
    </div>
    <div style="display:flex;flex-direction:column;line-height:1">
      <span :style="{ fontFamily: 'var(--f-sans)', fontWeight: 700, fontSize: fs + 'px', letterSpacing: '-0.03em', color: 'var(--text)' }">
        Kairos
      </span>
      <span :style="{ fontSize: (fs * 0.32) + 'px', color: 'var(--text-3)', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: '4px' }">
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
