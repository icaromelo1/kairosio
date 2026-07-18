<template>
  <div ref="containerRef" class="vg-grid"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  videoElements: Map<string, HTMLVideoElement>
  peerIds: string[]
}>()

const containerRef = ref<HTMLDivElement | null>(null)

function sync() {
  const container = containerRef.value
  if (!container) return
  const wanted = new Set(props.peerIds)
  for (const child of Array.from(container.children)) {
    const id = child.getAttribute('data-peer-id')
    if (!id || !wanted.has(id)) container.removeChild(child)
  }
  for (const id of props.peerIds) {
    const el = props.videoElements.get(id)
    if (!el) continue
    if (el.parentElement !== container) {
      el.setAttribute('data-peer-id', id)
      el.classList.add('vg-video')
      container.appendChild(el)
    }
  }
}

watch(() => props.peerIds, sync, { immediate: true, flush: 'post' })

onBeforeUnmount(() => {
  const container = containerRef.value
  if (!container) return
  while (container.firstChild) container.removeChild(container.firstChild)
})
</script>

<style scoped>
.vg-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
  gap: 0.25rem;
  margin-top: 0.25rem;
}
.vg-grid :deep(.vg-video) {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  background: var(--bg-1);
  border: 0.0625rem solid var(--border);
}
</style>
