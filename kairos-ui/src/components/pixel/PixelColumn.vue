<template>
  <svg class="pixelated" :width="8 * scale" :height="H * scale" :viewBox="`0 0 8 ${H}`">
    <!-- capital -->
    <rect x="0" y="0" width="8" height="1" :fill="color" />
    <rect x="1" y="1" width="6" height="1" :fill="shaded(-0.15)" />
    <rect x="0" y="2" width="8" height="1" :fill="color" />
    <rect x="0" y="1" width="1" height="1" :fill="color" />
    <rect x="7" y="1" width="1" height="1" :fill="color" />
    <!-- shaft -->
    <g v-for="i in shaftRows" :key="i">
      <rect x="1" :y="3 + i" width="6" height="1" :fill="shaded(-0.05)" />
      <rect x="2" :y="3 + i" width="1" height="1" :fill="shaded(-0.25)" />
      <rect x="5" :y="3 + i" width="1" height="1" :fill="shaded(-0.25)" />
    </g>
    <!-- base -->
    <rect x="0" :y="H - 2" width="8" height="1" :fill="color" />
    <rect x="1" :y="H - 1" width="6" height="1" :fill="shaded(-0.2)" />
    <rect x="0" :y="H - 1" width="1" height="1" :fill="shaded(-0.3)" />
    <rect x="7" :y="H - 1" width="1" height="1" :fill="shaded(-0.3)" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { shade } from '@/game/shadeHelper'

const props = withDefaults(defineProps<{
  scale?: number
  color?: string
  height?: number
}>(), { scale: 4, color: '#241c15', height: 20 })

const H = computed(() => props.height)
const shaftRows = computed(() => Array.from({ length: props.height - 5 }, (_, i) => i))
const shaded = (amt: number) => shade(props.color, amt)
</script>
