<template>
  <div class="ed-root">
    <!-- Toolbar -->
    <aside class="ed-side">
      <div class="ed-head">
        <button class="ed-back" @click="router.push('/map-select')">‹ Mundos</button>
        <strong>Editor</strong>
      </div>

      <input v-model.trim="map.name" maxlength="40" class="ed-input" placeholder="Nome do mundo" :disabled="!canEdit" />

      <div class="ed-row">
        <label>Largura<input v-model.number="map.width" type="number" min="8" max="120" class="ed-num" :disabled="!canEdit" @change="render" /></label>
        <label>Altura<input v-model.number="map.height" type="number" min="8" max="120" class="ed-num" :disabled="!canEdit" @change="render" /></label>
      </div>

      <div class="ed-label">Ferramenta</div>
      <div class="ed-tools">
        <button :class="['ed-tool', tool === 'spawn' && 'on']" @click="tool = 'spawn'">⌖ Spawn</button>
        <button :class="['ed-tool', tool === 'erase' && 'on']" @click="tool = 'erase'">⌫ Apagar</button>
        <button :class="['ed-tool', tool === 'toggle' && 'on']" @click="tool = 'toggle'">⊟ Colisão</button>
      </div>

      <div class="ed-label">Objetos</div>
      <label style="display:flex;gap:6px;align-items:center;font-size:12px;color:#c8c8d8;cursor:pointer">
        <input type="checkbox" v-model="placeSolid" /> sólido (colisão)
      </label>
      <button class="ed-tool" style="align-self:flex-start" @click="rotate">↻ Girar: {{ placeRotation }}°</button>
      <div class="ed-palette">
        <button
          v-for="p in PALETTE" :key="p.kind + p.label"
          :class="['ed-obj', tool === 'place' && current?.label === p.label && 'on']"
          @click="selectObj(p)"
        >{{ p.label }}</button>
      </div>

      <button class="ed-tool" style="align-self:flex-start;margin-top:8px" @click="showPixel = !showPixel">{{ showPixel ? '▾' : '▸' }} Criar objeto próprio</button>
      <div v-if="showPixel" style="background:#1a1a26;border:1px solid #262636;padding:8px;border-radius:6px">
        <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:6px">
          <button v-for="col in PIXEL_COLORS" :key="col || 'none'" @click="pixelColor = col"
            :style="{ width: '18px', height: '18px', borderRadius: '3px', cursor: 'pointer', border: pixelColor === col ? '2px solid #fff' : '1px solid #444', background: col || '#0d0d14' }">{{ col ? '' : '⌫' }}</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(8,15px);gap:1px;width:fit-content">
          <template v-for="(row, r) in pixelGrid">
            <div v-for="(cell, c) in row" :key="r + '-' + c"
              @pointerdown="paintCell(r, c)" @pointerenter="(e: any) => e.buttons && paintCell(r, c)"
              :style="{ width: '15px', height: '15px', background: cell || '#1d1d2a', cursor: 'crosshair' }"></div>
          </template>
        </div>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button class="ed-tool" @click="useCustom">Usar como pincel</button>
          <button class="ed-tool" @click="clearPixels">Limpar</button>
        </div>
      </div>

      <div class="ed-spacer"></div>
      <p v-if="!canEdit" class="ed-note">Mundo oficial ou de outro usuário — somente leitura.</p>
      <button class="ed-save" :disabled="!canEdit || saving" @click="save">{{ saving ? 'Salvando…' : isNew ? 'Criar mundo' : 'Salvar' }}</button>
      <button v-if="!isNew && canEdit" class="ed-del" :disabled="saving" @click="del">Apagar mundo</button>
      <p v-if="msg" class="ed-msg">{{ msg }}</p>
    </aside>

    <!-- Stage -->
    <div class="ed-stage" ref="host" @pointerdown="onClick" @pointermove="onMove" @pointerleave="scene?.clearGhost()"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MapScene } from '@/game/pixi/scene'
import type { MapDef, MapObject, ObjectKind } from '@/game/maps'
import { fetchMap, createMap, saveMap, deleteMap } from '@/services/maps.api'
import { useAuthStore } from '@/stores/useAuthStore'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const host = ref<HTMLElement | null>(null)
const saving = ref(false)
const msg = ref('')
const tool = ref<'place' | 'erase' | 'spawn' | 'toggle'>('place')

const isNew = computed(() => route.params.id === 'new')

const DEFAULT_PALETTE = {
  floor: ['#1a1a26', '#1d1d2a'] as [string, string],
  floorTrim: '#15151f', wall: '#0d0d14', wallTop: '#252535', accent: '#7c3aed',
}

const map = reactive<MapDef>({
  id: 'new', name: 'Novo Mundo', blurb: '', hours: 'sempre', label: 'custom',
  width: 24, height: 16, palette: { ...DEFAULT_PALETTE }, spawn: { x: 12, y: 8 }, objects: [],
})

interface PaletteItem {
  kind: ObjectKind; label: string; w: number; h: number
  solid?: boolean; shape?: 'rect' | 'circle'; color?: string
  glow?: MapObject['glow']; name?: string; action?: string
}
const PALETTE: PaletteItem[] = [
  { kind: 'desk', label: 'Mesa', w: 4, h: 2, solid: true, glow: 'purple', name: 'Mesa', action: 'Abrir' },
  { kind: 'shelf', label: 'Estante', w: 3, h: 2, solid: true },
  { kind: 'jukebox', label: 'Jukebox', w: 2, h: 2, solid: true },
  { kind: 'servers', label: 'Servidores', w: 3, h: 3, solid: true },
  { kind: 'board', label: 'Lousa', w: 4, h: 1, glow: 'cyan' },
  { kind: 'table', label: 'Mesa redonda', w: 3, h: 2, solid: true },
  { kind: 'rug', label: 'Tapete', w: 4, h: 3, color: 'rgba(124,58,237,0.16)' },
  { kind: 'plant', label: 'Planta', w: 1, h: 2, color: 'rgba(52,211,153,0.6)' },
  { kind: 'tree', label: 'Árvore', w: 3, h: 3, shape: 'circle', color: '#2f7d3a', solid: true },
  { kind: 'flower', label: 'Flores', w: 2, h: 2, color: 'rgba(244,114,182,0.8)' },
  { kind: 'bench', label: 'Banco', w: 2, h: 1, color: '#5a4a32', solid: true },
  { kind: 'fountain', label: 'Fonte', w: 4, h: 4, shape: 'circle', color: '#2563a8', solid: true },
  { kind: 'water', label: 'Água', w: 4, h: 3, color: 'rgba(37,99,168,0.7)' },
  { kind: 'hedge', label: 'Cerca-viva', w: 3, h: 1, color: '#1f5a2e', solid: true },
  { kind: 'path', label: 'Caminho', w: 3, h: 1, color: 'rgba(120,110,90,0.5)' },
  { kind: 'lamp', label: 'Poste', w: 1, h: 1, color: 'rgba(251,191,36,0.85)' },
  { kind: 'column', label: 'Coluna', w: 1, h: 2, color: 'rgba(251,191,36,0.22)', solid: true },
  { kind: 'chair', label: 'Cadeira', w: 1, h: 1, solid: true, name: 'Cadeira', action: 'Sentar' },
  { kind: 'sofa', label: 'Sofá', w: 3, h: 1, solid: true, name: 'Sofá', action: 'Sentar' },
  { kind: 'grass', label: 'Grama', w: 3, h: 2, color: 'rgba(52,211,153,0.25)' },
  { kind: 'panel', label: 'Painel', w: 2, h: 1, color: 'rgba(34,211,238,0.18)' },
]
const current = ref<PaletteItem>(PALETTE[0])
const placeSolid = ref<boolean>(!!PALETTE[0].solid)
const placeRotation = ref<number>(0)
function rotate() { placeRotation.value = (placeRotation.value + 90) % 360 }

// --- criador de objeto próprio (pixel + paleta) ---
const PIXEL_N = 8
const PIXEL_COLORS = ['#000000', '#ffffff', '#f87171', '#fbbf24', '#34d399', '#22d3ee', '#7c3aed', '#fb923c', '#8b5a2b', null]
const pixelColor = ref<string | null>('#7c3aed')
const showPixel = ref(false)
const pixelGrid = reactive<(string | null)[][]>(
  Array.from({ length: PIXEL_N }, () => Array.from({ length: PIXEL_N }, () => null as string | null)),
)
let customPixels: (string | null)[][] | null = null
function paintCell(r: number, c: number) { pixelGrid[r][c] = pixelColor.value }
function clearPixels() { for (let r = 0; r < PIXEL_N; r++) for (let c = 0; c < PIXEL_N; c++) pixelGrid[r][c] = null }
function useCustom() {
  customPixels = pixelGrid.map((row) => row.slice())
  current.value = { kind: 'custom', label: 'Meu objeto', w: 2, h: 2, solid: placeSolid.value }
  tool.value = 'place'
}

const canEdit = computed(() => isNew.value || (!!map.ownerId && map.ownerId === auth.userId))

let scene: MapScene | null = null

function selectObj(p: PaletteItem) {
  current.value = p
  placeSolid.value = !!p.solid // sugere o padrão do objeto; usuário pode alterar
  tool.value = 'place'
}

function render() {
  if (!scene) return
  map.width = Math.max(8, Math.min(120, map.width))
  map.height = Math.max(8, Math.min(120, map.height))
  scene.setMap(map)
  scene.fit()
}

function onMove(e: PointerEvent) {
  if (!scene || !canEdit.value || tool.value !== 'place') { scene?.clearGhost(); return }
  const { x, y } = scene.screenToTile(e.clientX, e.clientY)
  if (x < 1 || y < 1 || x > map.width - 2 || y > map.height - 2) { scene.clearGhost(); return }
  const p = current.value
  scene.showGhost(x, y, Math.min(p.w, map.width - 1 - x), Math.min(p.h, map.height - 1 - y), p.color || 0x7c3aed, p.shape === 'circle')
}

function onClick(e: PointerEvent) {
  if (!scene || !canEdit.value) return
  const { x, y } = scene.screenToTile(e.clientX, e.clientY)
  if (x < 1 || y < 1 || x > map.width - 2 || y > map.height - 2) return

  if (tool.value === 'spawn') {
    map.spawn = { x, y }
    return
  }
  if (tool.value === 'erase') {
    // remove o último objeto que cobre o tile (topo)
    for (let i = map.objects.length - 1; i >= 0; i--) {
      const o = map.objects[i]
      if (x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) {
        map.objects.splice(i, 1)
        render()
        return
      }
    }
    return
  }
  if (tool.value === 'toggle') {
    // alterna a colisão do objeto no topo do tile
    for (let i = map.objects.length - 1; i >= 0; i--) {
      const o = map.objects[i]
      if (x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) {
        o.solid = !o.solid
        render()
        return
      }
    }
    return
  }
  // place
  const p = current.value
  const w = Math.min(p.w, map.width - 1 - x)
  const h = Math.min(p.h, map.height - 1 - y)
  const obj: MapObject = {
    id: `${p.kind}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    kind: p.kind, x, y, w: Math.max(1, w), h: Math.max(1, h),
    solid: placeSolid.value, shape: p.shape, color: p.color, glow: p.glow, name: p.name, action: p.action,
    rotation: placeRotation.value || undefined,
  }
  if (p.kind === 'custom' && customPixels) obj.pixels = customPixels
  map.objects.push(obj)
  render()
}

async function save() {
  msg.value = ''
  if (!map.name.trim()) { msg.value = 'Dê um nome ao mundo.'; return }
  saving.value = true
  try {
    const payload = {
      name: map.name, width: map.width, height: map.height,
      blurb: map.blurb, palette: map.palette, spawn: map.spawn, objects: map.objects,
    }
    if (isNew.value) {
      const created = await createMap(payload)
      msg.value = 'Mundo criado!'
      router.replace(`/editor/${created.id}`)
      Object.assign(map, created)
    } else {
      await saveMap(map.id, payload)
      msg.value = 'Salvo!'
    }
  } catch (e) {
    msg.value = (e as Error).message.includes('403') ? 'Sem permissão para salvar este mundo.' : 'Falha ao salvar.'
  } finally {
    saving.value = false
  }
}

async function del() {
  if (isNew.value || !confirm('Apagar este mundo? Não dá pra desfazer.')) return
  saving.value = true
  try {
    await deleteMap(route.params.id as string)
    router.replace('/map-select')
  } catch {
    msg.value = 'Falha ao apagar o mundo.'
    saving.value = false
  }
}

onMounted(async () => {
  // convidado não cria mundo — precisa de conta
  if (isNew.value && auth.isGuest) {
    router.replace('/map-select')
    return
  }
  scene = new MapScene()
  await scene.init(host.value!, '#0a0a10')
  if (!isNew.value) {
    try {
      const loaded = await fetchMap(route.params.id as string)
      Object.assign(map, loaded)
    } catch {
      msg.value = 'Mundo não encontrado.'
    }
  }
  render()
})

onUnmounted(() => scene?.destroy())
</script>

<style scoped>
.ed-root { height: 100vh; display: grid; grid-template-columns: 240px 1fr; background: #0a0a10; color: #e8e8f0; font-family: system-ui; }
.ed-side { background: #14141f; border-right: 1px solid #252535; padding: 14px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
.ed-head { display: flex; align-items: center; justify-content: space-between; }
.ed-back { background: transparent; border: 1px solid #303045; color: #c8c8d8; padding: 4px 10px; cursor: pointer; border-radius: 3px; font-size: 12px; }
.ed-input { background: #1d1d2a; border: 1px solid #303045; color: #e8e8f0; padding: 8px; border-radius: 4px; font-size: 14px; }
.ed-row { display: flex; gap: 8px; }
.ed-row label { flex: 1; font-size: 11px; color: #8a8aa0; display: flex; flex-direction: column; gap: 3px; }
.ed-num { background: #1d1d2a; border: 1px solid #303045; color: #e8e8f0; padding: 6px; border-radius: 4px; width: 100%; box-sizing: border-box; }
.ed-label { font-size: 10px; letter-spacing: 0.16em; color: #6a6a80; text-transform: uppercase; margin-top: 6px; }
.ed-tools { display: flex; gap: 6px; }
.ed-tool, .ed-obj { background: #1d1d2a; border: 1px solid #303045; color: #c8c8d8; padding: 6px 8px; cursor: pointer; border-radius: 4px; font-size: 12px; }
.ed-tool.on, .ed-obj.on { border-color: #7c3aed; background: rgba(124,58,237,0.18); color: #fff; }
.ed-palette { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.ed-spacer { flex: 1; }
.ed-note { font-size: 11px; color: #fbbf24; }
.ed-save { background: #7c3aed; border: none; color: #fff; padding: 10px; cursor: pointer; border-radius: 4px; font-weight: 600; }
.ed-save:disabled { opacity: 0.5; cursor: default; }
.ed-del { background: transparent; border: 1px solid rgba(248,113,113,0.5); color: #f87171; padding: 8px; cursor: pointer; border-radius: 4px; margin-top: 6px; }
.ed-msg { font-size: 12px; color: #34d399; text-align: center; }
.ed-stage { position: relative; overflow: hidden; cursor: crosshair; }
</style>
