<template>
  <svg class="pixelated" :width="8 * scale" :height="8 * scale" viewBox="0 0 8 8">
    <rect v-for="(cell, idx) in cells" :key="idx"
      :x="cell.x" :y="cell.y" width="1" height="1" :fill="color" />
    <rect v-if="showAccent" x="6" y="1" width="2" height="2" :fill="accent" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  scale?: number
  color?: string
  accent?: string
  showAccent?: boolean
}>(), { scale: 4, color: '#a78bfa', accent: '#fbbf24', showAccent: true })

const PATTERN = [
  "#......#",
  "#.....#.",
  "#....#..",
  "#...#...",
  "##.#....",
  "#.#.....",
  "##......",
  "#.......",
].reverse()

const cells = computed(() => {
  const result: { x: number; y: number }[] = []
  PATTERN.forEach((row, y) => {
    row.split('').forEach((c, x) => { if (c === '#') result.push({ x, y }) })
  })
  return result
})
</script>
