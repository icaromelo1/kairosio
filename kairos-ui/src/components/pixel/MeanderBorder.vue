<template>
  <div :style="borderStyle" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  color?: string
  height?: number
  opacity?: number
}>(), {
  color: '#fbbf24',
  height: 14,
  opacity: 1,
})

const svgUrl = computed(() => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 14' shape-rendering='crispEdges'><g fill='${props.color}'><rect x='0' y='1' width='32' height='2'/><rect x='2' y='3' width='2' height='8'/><rect x='2' y='9' width='8' height='2'/><rect x='8' y='5' width='2' height='4'/><rect x='14' y='3' width='2' height='8'/><rect x='14' y='9' width='8' height='2'/><rect x='20' y='5' width='2' height='4'/><rect x='26' y='3' width='2' height='8'/><rect x='26' y='9' width='6' height='2'/></g></svg>`
  return encodeURIComponent(svg)
})

const borderStyle = computed(() => ({
  height: props.height + 'px',
  width: '100%',
  opacity: props.opacity,
  backgroundImage: 'url("data:image/svg+xml;utf8,' + svgUrl.value + '")',
  backgroundSize: (32 * (props.height / 14)) + 'px ' + props.height + 'px',
  backgroundRepeat: 'repeat-x',
  imageRendering: 'pixelated' as const,
}))
</script>
