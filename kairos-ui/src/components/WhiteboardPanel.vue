<template>
  <div class="wb-overlay" @click="$emit('close')">
    <div class="k-card wb-card q-pa-lg column" @click.stop>
      <div class="row items-center justify-between">
        <span class="k-chip"><PixelIcon name="pencil" size="0.6875rem" />lousa</span>
        <button class="k-btn k-btn-ghost k-btn-sm" @click="$emit('close')">esc<PixelIcon name="close" size="0.75rem" /></button>
      </div>

      <div class="row items-center q-gutter-xs">
        <button
          v-for="c in palette" :key="c"
          class="wb-color-swatch"
          :class="{ 'wb-color-active': c === currentColor }"
          :style="{ background: c }"
          @click="currentColor = c"
        />
        <div class="col" />
        <button class="k-btn k-btn-ghost k-btn-sm" @click="handleClear">limpar</button>
      </div>

      <canvas
        ref="canvasEl"
        class="wb-canvas"
        width="640"
        height="400"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointerleave="onPointerUp"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { joinBoard, sendStroke, clearBoard, onBoardState, onBoardStroke, onBoardClear } from '@/services/presence'
import PixelIcon from '@/components/PixelIcon.vue'

interface Point { x: number; y: number }
interface Stroke { id: string; color: string; points: Point[] }

const props = defineProps<{ objectId: string }>()
defineEmits(['close'])

const palette = ['#111111', '#e03131', '#1971c2', '#2f9e44', '#f08c00']
const currentColor = ref(palette[0])

const canvasEl = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null

const strokes = ref<Stroke[]>([])
let activeStroke: Stroke | null = null
let drawing = false

let cleanupState: (() => void) | null = null
let cleanupStroke: (() => void) | null = null
let cleanupClear: (() => void) | null = null

function redraw() {
  if (!ctx || !canvasEl.value) return
  const { width, height } = canvasEl.value
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  for (const stroke of strokes.value) {
    drawStroke(stroke)
  }
}

function drawStroke(stroke: Stroke) {
  if (!ctx || !canvasEl.value || stroke.points.length < 2) return
  const { width, height } = canvasEl.value
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  const first = stroke.points[0]
  ctx.moveTo(first.x * width, first.y * height)
  for (let i = 1; i < stroke.points.length; i++) {
    const p = stroke.points[i]
    ctx.lineTo(p.x * width, p.y * height)
  }
  ctx.stroke()
}

function upsertStroke(stroke: Stroke) {
  const idx = strokes.value.findIndex((s) => s.id === stroke.id)
  if (idx >= 0) {
    strokes.value[idx] = stroke
  } else {
    strokes.value.push(stroke)
  }
  redraw()
}

function getRelativePoint(e: PointerEvent): Point | null {
  if (!canvasEl.value) return null
  const rect = canvasEl.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height
  return { x, y }
}

let lastSentAt = 0
const THROTTLE_MS = 100

function throttledSend() {
  const now = Date.now()
  if (now - lastSentAt < THROTTLE_MS) return
  lastSentAt = now
  if (activeStroke) sendStroke(props.objectId, activeStroke)
}

function onPointerDown(e: PointerEvent) {
  const point = getRelativePoint(e)
  if (!point) return
  drawing = true
  activeStroke = {
    id: crypto.randomUUID(),
    color: currentColor.value,
    points: [point],
  }
  strokes.value.push(activeStroke)
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!drawing || !activeStroke) return
  const point = getRelativePoint(e)
  if (!point) return
  activeStroke.points.push(point)
  redraw()
  throttledSend()
}

function onPointerUp() {
  if (!drawing || !activeStroke) {
    drawing = false
    return
  }
  drawing = false
  sendStroke(props.objectId, activeStroke)
  activeStroke = null
}

function handleClear() {
  clearBoard(props.objectId)
}

onMounted(() => {
  ctx = canvasEl.value?.getContext('2d') ?? null
  redraw()

  joinBoard(props.objectId)

  cleanupState = onBoardState((snapshot) => {
    strokes.value = snapshot
    redraw()
  })

  cleanupStroke = onBoardStroke((stroke) => {
    upsertStroke(stroke)
  })

  cleanupClear = onBoardClear(() => {
    strokes.value = []
    redraw()
  })
})

onUnmounted(() => {
  cleanupState?.()
  cleanupStroke?.()
  cleanupClear?.()
})
</script>

<style scoped>
.wb-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(0.375rem);
  display: grid;
  place-items: center;
  z-index: 50;
  padding: 1.5rem;
}

.wb-card {
  gap: var(--sp-16);
  width: min(45rem, 100%);
  max-height: 90vh;
  overflow-y: auto;
  overflow-x: hidden;
  flex-wrap: nowrap;
}

.wb-canvas {
  width: 100%;
  height: auto;
  aspect-ratio: 640 / 400;
  background: #ffffff;
  border: 0.0625rem solid var(--border);
  touch-action: none;
  cursor: crosshair;
}

.wb-color-swatch {
  width: 1.5rem;
  height: 1.5rem;
  border: 0.125rem solid var(--border-strong);
  border-radius: 0;
  cursor: pointer;
  padding: 0;
}

.wb-color-active {
  border-color: var(--primary-hi);
  box-shadow: 0 0 0 0.0625rem var(--primary);
}

@media (max-width: 26.25rem) {
  .wb-overlay {
    padding: 0.625rem;
  }
  .wb-card.q-pa-lg {
    padding: 1rem;
  }
}
</style>
