<template>
  <div style="height:100vh;display:flex;flex-direction:column;background:#0d0d14;color:#e8e8f0;font-family:system-ui">
    <div style="padding:10px 16px;display:flex;gap:16px;align-items:center;flex-wrap:wrap;border-bottom:1px solid #252535">
      <strong style="letter-spacing:0.04em">Lab · Avatar animado (PixiJS)</strong>
      <span style="font-size:12px;color:#8a8aa0">Mova com WASD / setas</span>
      <button @click="toggleDance" :style="btn">{{ dancing ? 'Parar' : 'Dançar' }}</button>
      <label style="font-size:12px;display:flex;gap:6px;align-items:center">Cabelo
        <select v-model="look.hairStyle" @change="rebuild" :style="sel">
          <option value="short">curto</option>
          <option value="curly">cacheado</option>
          <option value="ponytail">rabo</option>
          <option value="mohawk">moicano</option>
          <option value="helmet">capacete</option>
        </select>
      </label>
      <label v-for="c in colorFields" :key="c.key" style="font-size:12px;display:flex;gap:4px;align-items:center">
        {{ c.label }}
        <input type="color" v-model="look[c.key]" @input="rebuild" style="width:28px;height:24px;border:none;background:none;cursor:pointer" />
      </label>
    </div>
    <div ref="host" style="flex:1;overflow:hidden"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { Application, Container, Graphics } from 'pixi.js'
import { AvatarPuppet, type AvatarLook, type Facing } from '@/game/pixi/avatar'

const host = ref<HTMLElement | null>(null)
const dancing = ref(false)

const look = reactive<AvatarLook>({
  hairStyle: 'short',
  hairColor: '#3d2817',
  skin: '#e8b894',
  topColor: '#7c3aed',
  pantsColor: '#1f2937',
})

const colorFields = [
  { key: 'topColor' as const, label: 'Camisa' },
  { key: 'pantsColor' as const, label: 'Calça' },
  { key: 'hairColor' as const, label: 'Cabelo' },
  { key: 'skin' as const, label: 'Pele' },
]

const btn = 'appearance:none;background:#7c3aed;border:none;color:#fff;padding:6px 14px;cursor:pointer;font-size:13px;border-radius:2px'
const sel = 'background:#1d1d2a;color:#e8e8f0;border:1px solid #303045;padding:3px;border-radius:2px'

let app: Application | null = null
let puppet: AvatarPuppet | null = null
let world: Container | null = null
const pos = { x: 400, y: 320 }
let facing: Facing = 'down'
const keys = new Set<string>()

function onKeyDown(e: KeyboardEvent) {
  const k = e.key.toLowerCase()
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault()
  keys.add(k)
}
function onKeyUp(e: KeyboardEvent) { keys.delete(e.key.toLowerCase()) }

function toggleDance() { dancing.value = !dancing.value }

function rebuild() {
  if (!app || !world) return
  if (puppet) puppet.destroy()
  puppet = new AvatarPuppet({ ...look })
  world.addChild(puppet.root)
}

onMounted(async () => {
  app = new Application()
  await app.init({ background: '#12121c', resizeTo: host.value!, antialias: false })
  host.value!.appendChild(app.canvas)

  world = new Container()
  app.stage.addChild(world)

  // piso quadriculado simples
  const floor = new Graphics()
  for (let gx = 0; gx < 40; gx++) {
    for (let gy = 0; gy < 30; gy++) {
      const c = (gx + gy) % 2 === 0 ? 0x1a1a26 : 0x1d1d2a
      floor.rect(gx * 32, gy * 32, 32, 32).fill({ color: c })
    }
  }
  world.addChildAt(floor, 0)

  puppet = new AvatarPuppet({ ...look })
  world.addChild(puppet.root)

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000
    let dx = 0, dy = 0
    const sp = 140 * dt
    if (keys.has('w') || keys.has('arrowup')) dy -= sp
    if (keys.has('s') || keys.has('arrowdown')) dy += sp
    if (keys.has('a') || keys.has('arrowleft')) dx -= sp
    if (keys.has('d') || keys.has('arrowright')) dx += sp

    const moving = dx !== 0 || dy !== 0
    if (moving) {
      pos.x = Math.max(40, Math.min(1240, pos.x + dx))
      pos.y = Math.max(40, Math.min(920, pos.y + dy))
      if (Math.abs(dx) > Math.abs(dy)) facing = dx < 0 ? 'left' : 'right'
      else facing = dy < 0 ? 'up' : 'down'
    }

    if (puppet) {
      puppet.setFacing(facing)
      puppet.setPose(dancing.value ? 'dance' : moving ? 'walk' : 'idle')
      puppet.update(dt)
      puppet.root.position.set(pos.x, pos.y)
    }
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  app?.destroy(true)
})
</script>
