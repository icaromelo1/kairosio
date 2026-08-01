<template>
  <div class="ed-root">
    <!-- Toolbar -->
    <aside class="ed-side" :class="{ 'ed-side-open': sidebarOpen }">
      <div class="ed-head">
        <button class="ed-back" @click="router.push('/game')">‹ Jogo</button>
        <strong>Editor</strong>
      </div>

      <input v-model.trim="map.name" maxlength="40" class="ed-input" placeholder="Nome do mundo" :disabled="!canEdit" />

      <div class="ed-row">
        <label>Largura<input v-model.number="map.width" type="number" min="8" max="120" class="ed-num" :disabled="!canEdit" @change="render" /></label>
        <label>Altura<input v-model.number="map.height" type="number" min="8" max="120" class="ed-num" :disabled="!canEdit" @change="render" /></label>
      </div>

      <div class="ed-label">Histórico</div>
      <div class="ed-tools">
        <button class="ed-tool" :disabled="!canUndo" @click="undo"><PixelIcon name="undo" size="0.875rem" />Desfazer</button>
        <button class="ed-tool" :disabled="!canRedo" @click="redo"><PixelIcon name="redo" size="0.875rem" />Refazer</button>
      </div>

      <div class="ed-label">Ferramenta</div>
      <div class="ed-tools">
        <button :class="['ed-tool', tool === 'spawn' && 'k-active']" @click="tool = 'spawn'"><PixelIcon name="target" size="0.875rem" />Spawn</button>
        <button :class="['ed-tool', tool === 'erase' && 'k-active']" @click="tool = 'erase'"><PixelIcon name="delete" size="0.875rem" />Apagar</button>
        <button :class="['ed-tool', tool === 'toggle' && 'k-active']" @click="tool = 'toggle'"><PixelIcon name="wall" size="0.875rem" />Colisão</button>
      </div>

      <div class="ed-label">Objetos</div>
      <label class="ed-checkbox-label">
        <input type="checkbox" v-model="placeSolid" /> sólido (colisão)
      </label>
      <label class="ed-checkbox-label">
        <input type="checkbox" v-model="placeSittable" /> sentável
      </label>
      <button class="ed-tool ed-tool-start" @click="rotate"><PixelIcon name="reload" size="0.875rem" />Girar: {{ placeRotation }}°</button>
      <div class="ed-palette">
        <button
          v-for="p in PALETTE" :key="p.kind + p.label"
          :class="['ed-obj', tool === 'place' && current?.label === p.label && 'k-active']"
          @click="selectObj(p)"
        >{{ p.label }}</button>
      </div>

      <button class="ed-tool ed-tool-start ed-tool-mt" @click="showPixel = !showPixel"><PixelIcon :name="showPixel ? 'chevron-down' : 'chevron-right'" size="0.875rem" />Criar objeto próprio</button>
      <div v-if="showPixel" class="ed-pixel-panel column q-gutter-xs">
        <div class="row q-gutter-xs ed-swatch-row">
          <button
            v-for="col in PIXEL_COLORS" :key="col || 'none'" @click="pixelColor = col"
            class="ed-swatch" :class="{ 'ed-swatch-active': pixelColor === col }"
            :style="{ background: col || '#0d0d14' }"
            :title="col ? `pintar com ${col}` : 'apagar o pixel'"
            :aria-label="col ? `pintar com ${col}` : 'apagar o pixel'"
          ><PixelIcon v-if="!col" name="delete" size="0.75rem" /></button>
        </div>
        <div class="ed-pixel-grid">
          <template v-for="(row, r) in pixelGrid">
            <div
              v-for="(cell, c) in row" :key="r + '-' + c"
              class="ed-pixel-cell"
              :style="{ background: cell || '#1d1d2a' }"
              @pointerdown="paintCell(r, c)" @pointerenter="(e: any) => e.buttons && paintCell(r, c)"
            ></div>
          </template>
        </div>
        <div class="row q-gutter-xs">
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
    <div class="ed-stage" ref="host" @pointerdown="onClick" @pointermove="onMove" @pointerleave="onLeave">
      <!-- só aparece em telas estreitas (a sidebar de 240px vira overlay) -->
      <button
        class="ed-mobile-toggle"
        :title="sidebarOpen ? 'Fechar ferramentas' : 'Abrir ferramentas'"
        :aria-label="sidebarOpen ? 'Fechar ferramentas' : 'Abrir ferramentas'"
        @click="sidebarOpen = !sidebarOpen"
      ><PixelIcon :name="sidebarOpen ? 'close' : 'menu'" size="1.125rem" /></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MapScene } from '@/game/pixi/scene'
import type { MapDef, MapObject, ObjectKind } from '@/game/maps'
import { isSolid } from '@/game/maps'
import { fetchMap, createMap, saveMap, deleteMap } from '@/services/maps.api'
import { useAuthStore } from '@/stores/useAuthStore'
import PixelIcon from '@/components/PixelIcon.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const host = ref<HTMLElement | null>(null)
const saving = ref(false)
const msg = ref('')
const tool = ref<'place' | 'erase' | 'spawn' | 'toggle'>('place')
// sidebar de 240px vira overlay em telas estreitas — some por padrão pra não
// tampar o canvas; irrelevante em telas largas (CSS sempre mostra .ed-side lá)
const sidebarOpen = ref(false)

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
const placeSittable = ref<boolean>(false)
const placeRotation = ref<number>(0)
function rotate() { placeRotation.value = (placeRotation.value + 90) % 360 }

const HISTORY_LIMIT = 50
const historyStack = ref<string[]>([])
const historyIndex = ref<number>(-1)
const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < historyStack.value.length - 1)

function snapshot() {
  if (historyIndex.value < historyStack.value.length - 1) {
    historyStack.value.splice(historyIndex.value + 1)
  }
  historyStack.value.push(JSON.stringify({ objects: map.objects, spawn: map.spawn }))
  if (historyStack.value.length > HISTORY_LIMIT) {
    historyStack.value.shift()
  }
  historyIndex.value = historyStack.value.length - 1
}

function applySnapshot(raw: string) {
  const parsed = JSON.parse(raw) as { objects: MapObject[]; spawn: { x: number; y: number } }
  map.objects.splice(0, map.objects.length, ...parsed.objects)
  map.spawn = parsed.spawn
  render()
}

function undo() {
  if (!canUndo.value) return
  historyIndex.value--
  applySnapshot(historyStack.value[historyIndex.value])
}

function redo() {
  if (!canRedo.value) return
  historyIndex.value++
  applySnapshot(historyStack.value[historyIndex.value])
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

function onKeydown(e: KeyboardEvent) {
  if (isTextInputTarget(e.target)) return
  if (!(e.ctrlKey || e.metaKey)) return
  const key = e.key.toLowerCase()
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault()
    undo()
  } else if ((key === 'z' && e.shiftKey) || key === 'y') {
    e.preventDefault()
    redo()
  }
}

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

function onLeave() {
  scene?.clearGhost()
}

function onMove(e: PointerEvent) {
  if (!scene || !canEdit.value || tool.value !== 'place') { scene?.clearGhost(); return }
  const { x, y } = scene.screenToTile(e.clientX, e.clientY)
  if (x < 1 || y < 1 || x > map.width - 2 || y > map.height - 2) { scene.clearGhost(); return }
  const p = current.value
  scene.showGhost(x, y, Math.min(p.w, map.width - 1 - x), Math.min(p.h, map.height - 1 - y), p.color || 0x7c3aed, p.shape === 'circle')
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function onClick(e: PointerEvent) {
  if (!scene || !canEdit.value) return
  const { x, y } = scene.screenToTile(e.clientX, e.clientY)
  if (x < 1 || y < 1 || x > map.width - 2 || y > map.height - 2) return

  if (tool.value === 'spawn') {
    if (isSolid(map, x, y)) {
      msg.value = 'Não é possível colocar o spawn numa posição sólida.'
      return
    }
    map.spawn = { x, y }
    snapshot()
    return
  }
  if (tool.value === 'erase') {
    for (let i = map.objects.length - 1; i >= 0; i--) {
      const o = map.objects[i]
      if (x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) {
        map.objects.splice(i, 1)
        snapshot()
        render()
        return
      }
    }
    return
  }
  if (tool.value === 'toggle') {
    for (let i = map.objects.length - 1; i >= 0; i--) {
      const o = map.objects[i]
      if (x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) {
        o.solid = !o.solid
        snapshot()
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
  const rect = { x, y, w: Math.max(1, w), h: Math.max(1, h) }
  if (placeSolid.value && map.objects.some((o) => o.solid && rectsOverlap(rect, o))) {
    msg.value = 'Objeto colide com um obstáculo sólido existente.'
    return
  }
  const obj: MapObject = {
    id: `${p.kind}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    kind: p.kind, x, y, w: rect.w, h: rect.h,
    solid: placeSolid.value, shape: p.shape, color: p.color, glow: p.glow, name: p.name, action: p.action,
    rotation: placeRotation.value || undefined,
    sittable: placeSittable.value || undefined,
  }
  if (p.kind === 'custom' && customPixels) obj.pixels = customPixels
  map.objects.push(obj)
  snapshot()
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
    router.replace('/game')
  } catch {
    msg.value = 'Falha ao apagar o mundo.'
    saving.value = false
  }
}

onMounted(async () => {
  // convidado não cria mundo — precisa de conta
  if (isNew.value && auth.isGuest) {
    router.replace('/game')
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
  snapshot()
  render()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  scene?.destroy()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.ed-root { height: 100vh; display: grid; grid-template-columns: 15rem 1fr; background: #0a0a10; color: #e8e8f0; font-family: system-ui; }
.ed-side { background: #14141f; border-right: 0.0625rem solid #252535; padding: 0.875rem; display: flex; flex-direction: column; gap: 0.625rem; overflow-y: auto; }
.ed-head { display: flex; align-items: center; justify-content: space-between; }
.ed-back { background: transparent; border: 0.0625rem solid #303045; color: #c8c8d8; padding: 0.25rem 0.625rem; cursor: pointer; border-radius: 0.1875rem; font-size: 0.75rem; }
.ed-input { background: #1d1d2a; border: 0.0625rem solid #303045; color: #e8e8f0; padding: 0.5rem; border-radius: 0.25rem; font-size: 0.875rem; }
.ed-row { display: flex; gap: 0.5rem; }
.ed-row label { flex: 1; font-size: 0.6875rem; color: #8a8aa0; display: flex; flex-direction: column; gap: 0.25rem; }
.ed-num { background: #1d1d2a; border: 0.0625rem solid #303045; color: #e8e8f0; padding: 0.375rem; border-radius: 0.25rem; width: 100%; box-sizing: border-box; }
.ed-label { font-size: 0.625rem; letter-spacing: 0.16em; color: #6a6a80; text-transform: uppercase; margin-top: 0.375rem; }
/* o ícone + gap deixa cada botão ~8px mais largo que o glifo de texto que havia
   antes: os 3 de "Ferramenta" não cabem mais na sidebar de 15rem numa linha só */
.ed-tools { display: flex; gap: 0.375rem; flex-wrap: wrap; }
.ed-tools .ed-tool { flex: 1 1 auto; }
.ed-tool, .ed-obj { background: #1d1d2a; border: 0.0625rem solid #303045; color: #c8c8d8; padding: 0.375rem 0.5rem; cursor: pointer; border-radius: 0.25rem; font-size: 0.75rem; }
.ed-tool { display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem; }
.ed-tool.k-active, .ed-obj.k-active { color: #fff; }
.ed-tool:disabled { opacity: 0.4; cursor: default; }
.ed-palette { display: grid; grid-template-columns: 1fr 1fr; gap: 0.375rem; }
.ed-spacer { flex: 1; }
.ed-note { font-size: 0.6875rem; color: #fbbf24; }
.ed-save { background: #7c3aed; border: none; color: #fff; padding: 0.625rem; cursor: pointer; border-radius: 0.25rem; font-weight: 600; }
.ed-save:disabled { opacity: 0.5; cursor: default; }
.ed-del { background: transparent; border: 0.0625rem solid rgba(248,113,113,0.5); color: #f87171; padding: 0.5rem; cursor: pointer; border-radius: 0.25rem; margin-top: 0.375rem; }
.ed-msg { font-size: 0.75rem; color: #34d399; text-align: center; }
.ed-stage { position: relative; overflow: hidden; cursor: crosshair; }

.ed-checkbox-label { display: flex; gap: 0.375rem; align-items: center; font-size: 0.75rem; color: #c8c8d8; cursor: pointer; }
.ed-tool-start { align-self: flex-start; }
.ed-tool-mt { margin-top: 0.5rem; }

.ed-pixel-panel { background: #1a1a26; border: 0.0625rem solid #262636; padding: 0.5rem; border-radius: 0.375rem; }
.ed-swatch-row { flex-wrap: wrap; }
.ed-swatch { width: 1.125rem; height: 1.125rem; border-radius: 0.1875rem; cursor: pointer; border: 0.0625rem solid #444; display: grid; place-items: center; padding: 0; color: var(--text); }
.ed-swatch-active { border: 0.125rem solid #fff; }
.ed-pixel-grid { display: grid; grid-template-columns: repeat(8, 0.9375rem); gap: 0.0625rem; width: fit-content; }
.ed-pixel-cell { width: 0.9375rem; height: 0.9375rem; cursor: crosshair; }

.ed-mobile-toggle {
  display: none;
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 110;
  width: 2.25rem;
  height: 2.25rem;
  background: rgba(13, 13, 20, 0.85);
  border: 0.0625rem solid #303045;
  color: #e8e8f0;
  cursor: pointer;
  border-radius: 0.25rem;
  font-size: 1rem;
  place-items: center;
  padding: 0;
}

/* Telas estreitas (ou zoom alto): 15rem de sidebar fixa sobrava quase nada pro
   canvas do editor. Vira overlay flutuante, escondida por padrão; o botão de
   menu abre por cima do canvas em vez de dividir o grid. */
@media (max-width: 48rem) {
  .ed-root {
    grid-template-columns: 1fr;
  }
  .ed-side {
    display: none;
  }
  .ed-side.ed-side-open {
    display: flex;
    position: fixed;
    top: 0;
    left: 0;
    width: min(17.5rem, 85vw);
    height: 100vh;
    z-index: 100;
    box-shadow: 0.5rem 0 1.5rem rgba(0, 0, 0, 0.5);
  }
  .ed-mobile-toggle {
    display: grid;
  }
}
</style>
