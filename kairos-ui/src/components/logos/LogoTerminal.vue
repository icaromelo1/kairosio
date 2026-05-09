<template>
  <div :style="{
    fontFamily: 'var(--f-mono)',
    fontSize: fs + 'px',
    background: 'var(--bg-3)',
    border: `2px solid ${primary}`,
    padding: `${fs * 0.4}px ${fs * 0.7}px`,
    display: 'inline-flex',
    alignItems: 'center',
    gap: (fs * 0.4) + 'px',
    boxShadow: `4px 4px 0 ${primary}33`,
  }">
    <span :style="{ color: accent }">$</span>
    <span style="color:var(--text);font-weight:600">kairos</span>
    <span style="color:var(--text-3)">--</span>
    <span :style="{ color: primary, fontWeight: 600 }">io</span>
    <span :style="{
      width: (fs * 0.5) + 'px',
      height: (fs * 0.9) + 'px',
      background: accent,
      marginLeft: (fs * 0.1) + 'px',
      animation: 'logoBlink 1s steps(2) infinite',
    }" />
  </div>
</template>

<style>
@keyframes logoBlink { 50% { opacity: 0; } }
</style>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg'
  primary?: string
  accent?: string
}>(), { size: 'md', primary: '#a78bfa', accent: '#fbbf24' })

const fs = computed(() => ({ sm: 14, md: 22, lg: 38 }[props.size]))
</script>
