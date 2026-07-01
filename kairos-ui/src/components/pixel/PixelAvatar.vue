<template>
  <svg
    class="pixelated"
    :width="16 * scale"
    :height="20 * scale"
    :viewBox="`0 0 16 20`"
    :style="{ display: 'block', animation: bobbing ? 'avatarBob 1.6s ease-in-out infinite' : undefined }"
  >
    <!-- shadow -->
    <ellipse v-if="shadow" cx="8" cy="19.5" rx="4" ry="0.6" fill="rgba(0,0,0,0.45)" />

    <!-- boots -->
    <rect x="4" y="18" width="3" height="2" fill="#0a0a10" />
    <rect x="9" y="18" width="3" height="2" fill="#0a0a10" />

    <!-- pants -->
    <rect x="4" y="14" width="8" height="4" :fill="pantsColor" />
    <rect x="7" y="14" width="2" height="4" :fill="shadePants(-0.2)" />
    <rect x="4" y="17" width="8" height="1" :fill="shadePants(-0.3)" />

    <!-- top/shirt -->
    <rect x="3" y="9" width="10" height="5" :fill="topColor" />
    <rect x="3" y="13" width="10" height="1" :fill="shadeTop(-0.25)" />
    <rect x="2" y="10" width="1" height="3" :fill="skin" />
    <rect x="13" y="10" width="1" height="3" :fill="skin" />
    <!-- hands -->
    <rect x="2" y="13" width="1" height="1" :fill="shadeSkin(-0.18)" />
    <rect x="13" y="13" width="1" height="1" :fill="shadeSkin(-0.18)" />

    <!-- neck -->
    <rect x="7" y="8" width="2" height="1" :fill="shadeSkin(-0.18)" />

    <!-- head base skin -->
    <rect x="4" y="2" width="8" height="6" :fill="skin" />
    <rect x="3" y="3" width="1" height="4" :fill="skin" />
    <rect x="12" y="3" width="1" height="4" :fill="skin" />
    <!-- cheek shadow -->
    <rect x="4" y="7" width="8" height="1" :fill="shadeSkin(-0.18)" />

    <!-- hair -->
    <rect
      v-for="(r, i) in hairRects"
      :key="i"
      :x="r[0]" :y="r[1]" :width="r[2] || 1" :height="r[3] || 1"
      :fill="hairColor"
    />

    <!-- eyes -->
    <rect x="6" y="5" width="1" height="1" fill="#0a0a10" />
    <rect x="9" y="5" width="1" height="1" fill="#0a0a10" />
    <!-- mouth -->
    <rect x="7" y="7" width="2" height="1" :fill="shadeSkin(-0.48)" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { shade } from '@/game/shadeHelper'

const props = withDefaults(defineProps<{
  scale?: number
  hairStyle?: 'short' | 'curly' | 'ponytail' | 'mohawk' | 'helmet' | 'buzz' | 'long'
  hairColor?: string
  skin?: string
  topColor?: string
  pantsColor?: string
  shadow?: boolean
  bobbing?: boolean
}>(), {
  scale: 8,
  hairStyle: 'short',
  hairColor: '#3d2817',
  skin: '#e8b894',
  topColor: '#7c3aed',
  pantsColor: '#1f2937',
  shadow: true,
  bobbing: false,
})

const HAIR_STYLES: Record<string, number[][]> = {
  short: [[4,2,8,1],[3,3,10,1],[3,4,10,1],[3,5,2,1],[11,5,2,1]],
  curly: [[4,1,1,1],[6,1,1,1],[9,1,1,1],[11,1,1,1],[3,2,10,1],[2,3,12,1],[2,4,12,1],[2,5,2,1],[12,5,2,1],[2,6,1,1],[13,6,1,1]],
  ponytail: [[4,2,8,1],[3,3,10,1],[3,4,10,1],[3,5,2,1],[11,5,2,1],[12,6,2,1],[12,7,2,1],[13,8,1,1]],
  mohawk: [[7,0,2,1],[7,1,2,1],[6,2,4,1],[4,3,8,1],[3,4,10,1],[3,5,1,1],[12,5,1,1]],
  helmet: [[4,2,8,1],[3,3,10,1],[3,4,10,1],[3,5,10,1],[3,6,1,1],[12,6,1,1],[7,0,2,1],[7,1,2,1]],
  buzz: [[4,2,8,1],[3,3,10,1],[4,4,8,1]],
  long: [[4,1,8,1],[3,2,10,1],[3,3,10,1],[3,4,2,1],[11,4,2,1],[2,4,1,5],[13,4,1,5],[2,9,1,1],[13,9,1,1]],
}

const hairRects = computed(() => HAIR_STYLES[props.hairStyle] || HAIR_STYLES.short)
const shadeSkin = (amt: number) => shade(props.skin, amt)
const shadeTop = (amt: number) => shade(props.topColor, amt)
const shadePants = (amt: number) => shade(props.pantsColor, amt)
</script>

<style scoped>
/* precisa ficar fora do <svg><defs> — um <style> ali dentro do template é tratado
   como "tag com efeito colateral" pelo compilador do Vue (o vite dev server bloqueia
   com um overlay; o vite build silenciosamente deixava passar, por isso só quebrava
   local, nunca em produção) */
@keyframes avatarBob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-1px); }
}
</style>
