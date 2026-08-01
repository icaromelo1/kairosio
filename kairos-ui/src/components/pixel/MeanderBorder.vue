<template>
  <div class="mb-root" :style="rootStyle" aria-hidden="true">
    <svg
      class="mb-svg"
      viewBox="0 0 32 14"
      preserveAspectRatio="xMinYMid slice"
      shape-rendering="crispEdges"
      fill="currentColor"
    >
      <defs>
        <pattern :id="patternId" width="32" height="14" patternUnits="userSpaceOnUse">
          <rect x="0" y="1" width="32" height="2" />
          <rect x="2" y="3" width="2" height="8" />
          <rect x="2" y="9" width="8" height="2" />
          <rect x="8" y="5" width="2" height="4" />
          <rect x="14" y="3" width="2" height="8" />
          <rect x="14" y="9" width="8" height="2" />
          <rect x="20" y="5" width="2" height="4" />
          <rect x="26" y="3" width="2" height="8" />
          <rect x="26" y="9" width="6" height="2" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" :fill="`url(#${patternId})`" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

let seq = 0
const patternId = `mb-tile-${++seq}-${Math.random().toString(36).slice(2, 7)}`

const props = withDefaults(defineProps<{
  color?: string
  height?: number
  opacity?: number
}>(), {
  color: 'var(--accent)',
  height: 14,
  opacity: 1,
})

const rootStyle = computed(() => ({
  height: props.height + 'px',
  opacity: props.opacity,
  color: props.color,
}))
</script>

<style scoped>
.mb-root {
  width: 100%;
  overflow: hidden;
  line-height: 0;
}

.mb-svg {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}
</style>
