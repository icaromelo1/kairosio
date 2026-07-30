<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    size?: string
    off?: boolean
  }>(),
  {
    size: '1em',
    off: false,
  },
)

/* O glob do Vite só aceita caminho relativo, absoluto ou alias — o especificador
   bare ("pixelarticons/svg/*.svg") estoura "Invalid glob ... must start with '/' or './'".
   Daí o caminho absoluto a partir da raiz do projeto + exhaustive, que remove o
   node_modules da lista de ignore padrão do matcher. */
const rawIcons = import.meta.glob<string>('/node_modules/pixelarticons/svg/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
  exhaustive: true,
})

const icons = Object.entries(rawIcons).reduce<Record<string, string>>((acc, [path, raw]) => {
  const file = path.split('/').pop()
  if (file) acc[file.replace(/\.svg$/, '')] = raw
  return acc
}, {})

const parsed = computed(() => {
  const raw = icons[props.name]

  if (!raw) {
    console.warn(`[PixelIcon] ícone "${props.name}" não existe em pixelarticons`)
    return null
  }

  return {
    viewBox: raw.match(/viewBox="([^"]+)"/i)?.[1] ?? '0 0 24 24',
    inner: raw.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/i)?.[1] ?? '',
  }
})
</script>

<template>
  <span class="pixel-icon" :class="{ 'pixel-icon--off': off && !!parsed }">
    <svg
      v-if="parsed"
      xmlns="http://www.w3.org/2000/svg"
      :viewBox="parsed.viewBox"
      :width="size"
      :height="size"
      fill="currentColor"
      shape-rendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      v-html="parsed.inner"
    />
  </span>
</template>

<style scoped>
.pixel-icon {
  display: inline-flex;
  position: relative;
  line-height: 0;
  vertical-align: -0.125em;
  flex: none;
}

.pixel-icon svg {
  display: block;
  image-rendering: pixelated;
}

/* O pacote só traz mic-off — as demais variantes desligadas não existem,
   então a barra é desenhada aqui e serve pra qualquer ícone. */
.pixel-icon--off::after {
  content: '';
  position: absolute;
  top: 50%;
  left: -0.0625rem;
  width: calc(100% + 0.125rem);
  height: 0.125rem;
  margin-top: -0.0625rem;
  background: var(--err);
  transform: rotate(-45deg);
  pointer-events: none;
}
</style>
