<template>
  <div :style="{
    fontFamily: 'var(--f-mono)',
    fontSize: (fs / 16) + 'rem',
    background: 'var(--bg-3)',
    border: `0.125rem solid ${primary}`,
    padding: `${fs * 0.4 / 16}rem ${fs * 0.7 / 16}rem`,
    display: 'inline-flex',
    alignItems: 'center',
    gap: (fs * 0.4 / 16) + 'rem',
    boxShadow: `0.25rem 0.25rem 0 ${primary}33`,
  }">
    <span :style="{ color: accent }">$</span>
    <span style="color:var(--text);font-weight:600">kairos</span>
    <span :style="{
      width: (fs * 0.5 / 16) + 'rem',
      height: (fs * 0.9 / 16) + 'rem',
      background: accent,
      marginLeft: (fs * 0.1 / 16) + 'rem',
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
