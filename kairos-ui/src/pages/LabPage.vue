<template>
  <div class="lab-root column no-wrap">
    <div class="lab-toolbar row items-center q-gutter-md">
      <strong class="lab-title">Lab · Mapa + Avatar (PixiJS)</strong>
      <span class="lab-hint">WASD/setas · mapas vindos da API</span>
      <label class="lab-field row items-center q-gutter-xs">Mundo
        <select v-model="currentId" @change="loadMap" class="lab-select" :disabled="!maps.length">
          <option v-for="m in maps" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
      </label>
      <button @click="dancing = !dancing" class="lab-btn">{{ dancing ? 'Parar' : 'Dançar' }}</button>
      <label class="lab-field row items-center q-gutter-xs">Cabelo
        <select v-model="look.hairStyle" @change="rebuild" class="lab-select">
          <option value="short">curto</option>
          <option value="curly">cacheado</option>
          <option value="ponytail">rabo</option>
          <option value="mohawk">moicano</option>
          <option value="helmet">capacete</option>
        </select>
      </label>
      <label v-for="c in colorFields" :key="c.key" class="lab-field row items-center q-gutter-xs">
        {{ c.label }}
        <input type="color" v-model="look[c.key]" @input="rebuild" class="lab-color" />
      </label>
      <span v-if="error" class="lab-error">{{ error }}</span>
    </div>
    <div ref="host" class="lab-stage"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { MapScene } from '@/game/pixi/scene'
import { AvatarPuppet, type AvatarLook, type Facing } from '@/game/pixi/avatar'
import { isSolid, type MapDef } from '@/game/maps'
import { fetchMaps } from '@/services/maps.api'

const host = ref<HTMLElement | null>(null)
const dancing = ref(false)
const maps = ref<MapDef[]>([])
const currentId = ref('')
const error = ref('')

const look = reactive<AvatarLook>({
  hairStyle: 'short',
  hairColor: '#3d2817',
  skin: '#e8b894',
  topColor: '#7c3aed',
  pantsColor: '#3b4252',
})

const colorFields = [
  { key: 'topColor' as const, label: 'Camisa' },
  { key: 'pantsColor' as const, label: 'Calça' },
  { key: 'hairColor' as const, label: 'Cabelo' },
  { key: 'skin' as const, label: 'Pele' },
]

let scene: MapScene | null = null
const pos = reactive({ x: 11, y: 9 })
let facing: Facing = 'down'
const keys = new Set<string>()

function currentMap(): MapDef | undefined {
  return maps.value.find((m) => m.id === currentId.value)
}

function onKeyDown(e: KeyboardEvent) {
  const k = e.key.toLowerCase()
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault()
  keys.add(k)
}
function onKeyUp(e: KeyboardEvent) { keys.delete(e.key.toLowerCase()) }

function loadMap() {
  const map = currentMap()
  if (!scene || !map) return
  scene.setMap(map)
  pos.x = map.spawn.x
  pos.y = map.spawn.y
}

function rebuild() {
  if (!scene) return
  scene.removeAvatar('me')
  scene.addAvatar('me', new AvatarPuppet({ ...look }))
}

onMounted(async () => {
  scene = new MapScene()
  await scene.init(host.value!)
  scene.addAvatar('me', new AvatarPuppet({ ...look }))

  try {
    maps.value = await fetchMaps()
    if (maps.value.length) {
      currentId.value = maps.value[0].id
      loadMap()
    } else {
      error.value = 'Nenhum mapa cadastrado'
    }
  } catch (e) {
    error.value = (e as Error).message
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  scene.app.ticker.add((ticker) => {
    if (!scene) return
    const map = currentMap()
    if (!map) return
    const dt = Math.min(ticker.deltaMS / 1000, 0.05)
    const sp = 5 * dt
    let dx = 0, dy = 0
    if (keys.has('w') || keys.has('arrowup')) dy -= sp
    if (keys.has('s') || keys.has('arrowdown')) dy += sp
    if (keys.has('a') || keys.has('arrowleft')) dx -= sp
    if (keys.has('d') || keys.has('arrowright')) dx += sp

    const moving = dx !== 0 || dy !== 0
    if (moving) {
      if (!isSolid(map, Math.floor(pos.x + dx), Math.floor(pos.y))) pos.x += dx
      if (!isSolid(map, Math.floor(pos.x), Math.floor(pos.y + dy))) pos.y += dy
      if (Math.abs(dx) > Math.abs(dy)) facing = dx < 0 ? 'left' : 'right'
      else facing = dy < 0 ? 'up' : 'down'
    }

    const me = scene.avatar('me')
    if (me) {
      me.setFacing(facing)
      me.setPose(dancing.value ? 'dance' : moving ? 'walk' : 'idle')
      me.update(dt)
    }
    scene.placeAvatar('me', pos.x, pos.y)
    scene.follow(pos.x, pos.y)
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  scene?.destroy()
  scene = null
})
</script>

<style scoped>
.lab-root {
  height: 100vh;
  background: #0d0d14;
  color: #e8e8f0;
  font-family: system-ui;
}

.lab-toolbar {
  padding: 10px 16px;
  flex-wrap: wrap;
  border-bottom: 1px solid #252535;
}

.lab-title { letter-spacing: 0.04em; }
.lab-hint { font-size: 12px; color: #8a8aa0; }
.lab-field { font-size: 12px; }
.lab-error { font-size: 12px; color: #f87171; }

.lab-select {
  background: #1d1d2a;
  color: #e8e8f0;
  border: 1px solid #303045;
  padding: 3px;
  border-radius: 2px;
}

.lab-btn {
  appearance: none;
  background: #7c3aed;
  border: none;
  color: #fff;
  padding: 6px 14px;
  cursor: pointer;
  font-size: 13px;
  border-radius: 2px;
}

.lab-color {
  width: 26px;
  height: 22px;
  border: none;
  background: none;
  cursor: pointer;
}

.lab-stage {
  flex: 1;
  overflow: hidden;
}
</style>
