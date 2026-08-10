<template>
  <div class="ed-root">
    <!-- Ferramentas -->
    <aside class="k-card ed-side" :class="{ 'ed-side-open': sidebarOpen }">
      <header class="ed-head">
        <button class="k-btn k-btn-sm ed-hit" @click="router.push('/game')">
          <PixelIcon name="chevron-left" size="0.875rem" />jogo
        </button>
        <span class="k-chip">Editor</span>
      </header>

      <div class="ed-body">
        <div class="ed-grupo">
          <label class="k-label" :for="idNome">Mundo</label>
          <input
            :id="idNome"
            v-model.trim="map.name"
            maxlength="40"
            class="k-input ed-hit"
            placeholder="nome do mundo"
            :disabled="!canEdit"
          />
          <div class="ed-campos">
            <label class="ed-campo" :for="idLargura">
              <span class="k-label">Largura</span>
              <input
                :id="idLargura"
                v-model.number="map.width"
                type="number"
                min="8"
                max="120"
                class="k-input k-input-sm ed-hit"
                :disabled="!canEdit"
                @change="render"
              />
            </label>
            <label class="ed-campo" :for="idAltura">
              <span class="k-label">Altura</span>
              <input
                :id="idAltura"
                v-model.number="map.height"
                type="number"
                min="8"
                max="120"
                class="k-input k-input-sm ed-hit"
                :disabled="!canEdit"
                @change="render"
              />
            </label>
          </div>
        </div>

        <div class="ed-grupo">
          <span class="k-label">Histórico</span>
          <div class="ed-linha">
            <button class="k-btn k-btn-sm ed-hit" :disabled="!canUndo" @click="undo">
              <PixelIcon name="undo" size="0.875rem" />desfazer
            </button>
            <button class="k-btn k-btn-sm ed-hit" :disabled="!canRedo" @click="redo">
              <PixelIcon name="redo" size="0.875rem" />refazer
            </button>
          </div>
        </div>

        <div class="ed-grupo">
          <span class="k-label">Ferramenta</span>
          <div class="ed-linha">
            <button
              class="k-btn k-btn-sm ed-hit"
              :class="{ 'k-active': tool === 'select' }"
              :aria-pressed="tool === 'select'"
              @click="tool = 'select'"
            >
              <PixelIcon name="pointer" size="0.875rem" />selecionar
            </button>
            <button
              class="k-btn k-btn-sm ed-hit"
              :class="{ 'k-active': tool === 'place' }"
              :aria-pressed="tool === 'place'"
              @click="tool = 'place'"
            >
              <PixelIcon name="plus" size="0.875rem" />colocar
            </button>
            <button
              class="k-btn k-btn-sm ed-hit"
              :class="{ 'k-active': tool === 'erase' }"
              :aria-pressed="tool === 'erase'"
              @click="tool = 'erase'"
            >
              <PixelIcon name="delete" size="0.875rem" />apagar
            </button>
            <button
              class="k-btn k-btn-sm ed-hit"
              :class="{ 'k-active': tool === 'spawn' }"
              :aria-pressed="tool === 'spawn'"
              @click="tool = 'spawn'"
            >
              <PixelIcon name="target" size="0.875rem" />spawn
            </button>
            <button
              class="k-btn k-btn-sm ed-hit"
              :class="{ 'k-active': tool === 'toggle' }"
              :aria-pressed="tool === 'toggle'"
              @click="tool = 'toggle'"
            >
              <PixelIcon name="wall" size="0.875rem" />colisão
            </button>
          </div>
          <p class="ed-dica">{{ DICA_FERRAMENTA[tool] }}</p>
        </div>

        <div class="ed-grupo">
          <span class="k-label">Marcações</span>
          <button
            class="k-btn k-btn-sm ed-hit ed-toggle"
            role="checkbox"
            :aria-checked="mostrarCaixas"
            @click="mostrarCaixas = !mostrarCaixas"
          >
            <PixelIcon :name="mostrarCaixas ? 'checkbox-on' : 'checkbox'" size="0.875rem" />
            colisão e altura de todos
          </button>
          <ul class="ed-legenda">
            <li>
              <span class="ed-amostra ed-amostra-colisao" aria-hidden="true"></span>
              <span>pegada de colisão</span>
            </li>
            <li>
              <span class="ed-amostra ed-amostra-altura" aria-hidden="true"></span>
              <span>altura desenhada</span>
            </li>
          </ul>
        </div>

        <div class="ed-grupo">
          <span class="k-label">Peça a colocar</span>
          <button
            class="k-btn k-btn-sm ed-hit ed-toggle"
            role="checkbox"
            :aria-checked="placeSolid"
            @click="placeSolid = !placeSolid"
          >
            <PixelIcon :name="placeSolid ? 'checkbox-on' : 'checkbox'" size="0.875rem" />sólido (colisão)
          </button>
          <button
            class="k-btn k-btn-sm ed-hit ed-toggle"
            role="checkbox"
            :aria-checked="placeSittable"
            @click="placeSittable = !placeSittable"
          >
            <PixelIcon :name="placeSittable ? 'checkbox-on' : 'checkbox'" size="0.875rem" />sentável
          </button>
          <button class="k-btn k-btn-sm ed-hit ed-toggle" @click="rotate">
            <PixelIcon name="reload" size="0.875rem" />girar: {{ placeRotation }}°
          </button>
          <div class="ed-paleta">
            <button
              v-for="p in PALETTE"
              :key="p.kind + p.label"
              class="k-btn k-btn-sm ed-hit ed-peca"
              :class="{ 'k-active': tool === 'place' && current.label === p.label }"
              :aria-pressed="tool === 'place' && current.label === p.label"
              @click="selectObj(p)"
            >
              {{ p.label }}
            </button>
          </div>
        </div>

        <div class="ed-grupo">
          <CatalogoTiles
            :atual="current.tileRef ? { pack: current.tileRef.pack, i: current.tileRef.i } : null"
            :desabilitado="!canEdit"
            @escolher="selecionarTile"
          />
        </div>

        <div class="ed-grupo">
          <button class="k-btn k-btn-sm ed-hit ed-toggle" :aria-expanded="showPixel" @click="showPixel = !showPixel">
            <PixelIcon :name="showPixel ? 'chevron-down' : 'chevron-right'" size="0.875rem" />criar objeto próprio
          </button>
          <div v-if="showPixel" class="ed-pixel-panel">
            <div class="ed-swatch-row">
              <button
                v-for="col in PIXEL_COLORS"
                :key="col || 'none'"
                class="ed-swatch"
                :class="{ 'ed-swatch-active': pixelColor === col }"
                :style="{ background: col || 'var(--bg-2)' }"
                :title="col ? `pintar com ${col}` : 'apagar o pixel'"
                :aria-label="col ? `pintar com ${col}` : 'apagar o pixel'"
                :aria-pressed="pixelColor === col"
                @click="pixelColor = col"
              >
                <PixelIcon v-if="!col" name="delete" size="0.75rem" />
              </button>
            </div>
            <div class="ed-pixel-grid">
              <template v-for="(row, r) in pixelGrid">
                <div
                  v-for="(cell, c) in row"
                  :key="r + '-' + c"
                  class="ed-pixel-cell"
                  :style="{ background: cell || 'var(--bg-2)' }"
                  @pointerdown="paintCell(r, c)"
                  @pointerenter="(e: PointerEvent) => { if (e.buttons) paintCell(r, c) }"
                ></div>
              </template>
            </div>
            <div class="ed-linha">
              <button class="k-btn k-btn-sm ed-hit" @click="useCustom">usar como pincel</button>
              <button class="k-btn k-btn-sm ed-hit" @click="clearPixels">limpar</button>
            </div>
          </div>
        </div>
      </div>

      <footer class="ed-foot">
        <p v-if="!canEdit" class="ed-dica ed-dica-alerta">Mundo oficial ou de outro usuário — somente leitura.</p>
        <button class="k-btn k-btn-primary ed-hit ed-bloco" :disabled="!canEdit || saving" @click="save">
          <PixelIcon name="save" size="0.875rem" />{{ saving ? 'salvando…' : isNew ? 'criar mundo' : 'salvar' }}
        </button>
        <button v-if="!isNew && canEdit" class="k-btn k-btn-sm ed-hit ed-bloco ed-apagar" :disabled="saving" @click="del">
          <PixelIcon name="trash" size="0.875rem" />apagar mundo
        </button>
        <p v-if="msg" class="ed-msg">{{ msg }}</p>
      </footer>
    </aside>

    <!-- Palco -->
    <div class="ed-stage" ref="host" @pointerdown="onClick" @pointermove="onMove" @pointerleave="onLeave">
      <!-- só aparece em telas estreitas (a barra lateral vira sobreposição) -->
      <button
        class="k-btn ed-hit ed-mobile-toggle"
        :title="sidebarOpen ? 'Fechar ferramentas' : 'Abrir ferramentas'"
        :aria-label="sidebarOpen ? 'Fechar ferramentas' : 'Abrir ferramentas'"
        @pointerdown.stop
        @click="sidebarOpen = !sidebarOpen"
      >
        <PixelIcon :name="sidebarOpen ? 'close' : 'menu'" size="1.125rem" />
      </button>

      <div
        v-if="objetoSelecionado"
        class="ed-props"
        @pointerdown.stop
        @pointermove.stop
        @pointerleave.stop
      >
        <PainelObjeto
          class="ed-props-card"
          :objeto="objetoSelecionado"
          :rotulo="rotuloSelecionado"
          :pode-editar="canEdit"
          @alterar="alterarSelecionado"
          @remover="removerSelecionado"
          @fechar="selecionadoId = null"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, useId } from 'vue'
import { me } from '@/services/auth.api'
import { useRoute, useRouter } from 'vue-router'
import { Container, Graphics } from 'pixi.js'
import { MapScene, TILE_PX } from '@/game/pixi/scene'
import type { MapDef, MapObject, ObjectKind } from '@/game/maps'
import { isSolid } from '@/game/maps'
import { fetchMap, createMap, saveMap, deleteMap } from '@/services/maps.api'
import { useAuthStore } from '@/stores/useAuthStore'
import PixelIcon from '@/components/PixelIcon.vue'
import CatalogoTiles from '@/components/CatalogoTiles.vue'
import PainelObjeto from '@/components/PainelObjeto.vue'
import type { TileResultado } from '@/game/furniture/busca'
import origemKenney from '@/game/furniture/kenney/origem.json'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const idNome = useId()
const idLargura = useId()
const idAltura = useId()

const host = ref<HTMLElement | null>(null)
const saving = ref(false)
const msg = ref('')

type Ferramenta = 'select' | 'place' | 'erase' | 'spawn' | 'toggle'
// abre em "selecionar": clicar num objeto agora ABRE as propriedades dele em vez
// de despejar mais uma peça em cima. escolher uma peça da paleta ou do catálogo
// volta pra "colocar" sozinho.
const tool = ref<Ferramenta>('select')
const DICA_FERRAMENTA: Record<Ferramenta, string> = {
  select: 'Clique num objeto pra abrir as propriedades dele.',
  place: 'Clique no mapa pra colocar a peça escolhida.',
  erase: 'Clique num objeto pra apagá-lo.',
  spawn: 'Clique onde os visitantes vão nascer.',
  toggle: 'Clique num objeto pra ligar/desligar a colisão.',
}

// a barra lateral vira sobreposição em telas estreitas — some por padrão pra não
// tampar o canvas; irrelevante em telas largas (CSS sempre mostra .ed-side lá)
const sidebarOpen = ref(false)

const isNew = computed(() => route.params.id === 'new')

// kinds que têm sprite no pacote Kenney (fonte: furniture/kenney/origem.json)
const KINDS_KENNEY = new Set(Object.keys(origemKenney))

// mundo novo nasce ao ar livre. a paleta anterior era a do tema escuro com o
// roxo #7c3aed, aposentado quando a interface virou pixel art clara — mundo
// criado hoje saía com o visual de duas gerações atrás.
const DEFAULT_PALETTE = {
  floor: ['#4a9a5e', '#409c62'] as [string, string],
  floorTrim: '#3f7a48', wall: '#8e877e', wallTop: '#b3aba0', accent: '#f2a93b',
}

const map = reactive<MapDef>({
  id: 'new', name: 'Novo Mundo', blurb: '', hours: 'sempre', label: 'custom',
  width: 24, height: 16, palette: { ...DEFAULT_PALETTE }, spawn: { x: 12, y: 8 }, objects: [],
})

interface PaletteItem {
  kind: ObjectKind; label: string; w: number; h: number
  solid?: boolean; shape?: 'rect' | 'circle'; color?: string
  glow?: MapObject['glow']; name?: string; action?: string
  tileRef?: MapObject['tileRef']
}
const PALETTE: PaletteItem[] = [
  { kind: 'desk', label: 'Mesa', w: 4, h: 2, solid: true, glow: 'purple', name: 'Mesa', action: 'Abrir' },
  { kind: 'shelf', label: 'Estante', w: 3, h: 2, solid: true },
  { kind: 'jukebox', label: 'Jukebox', w: 2, h: 2, solid: true },
  { kind: 'servers', label: 'Servidores', w: 3, h: 3, solid: true },
  { kind: 'board', label: 'Lousa', w: 4, h: 1, glow: 'cyan' },
  { kind: 'table', label: 'Mesa redonda', w: 3, h: 2, solid: true },
  { kind: 'rug', label: 'Tapete', w: 4, h: 3, color: 'rgba(44,116,65,0.18)' },
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
  if (e.key === 'Escape' && selecionadoId.value) {
    selecionadoId.value = null
    return
  }
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

// sudo edita qualquer mundo, inclusive os oficiais — quem confere de novo é o
// PUT /map/:id, que refaz a checagem no servidor
const ehSudo = ref(false)
void me().then((p) => { ehSudo.value = !!p.isAdmin }).catch(() => { ehSudo.value = false })

const canEdit = computed(
  () => isNew.value || ehSudo.value || (!!map.ownerId && map.ownerId === auth.userId),
)

let scene: MapScene | null = null

function selectObj(p: PaletteItem) {
  current.value = p
  placeSolid.value = !!p.solid // sugere o padrão do objeto; usuário pode alterar
  tool.value = 'place'
}

function selecionarTile(r: TileResultado) {
  current.value = {
    kind: 'tile',
    label: r.nome,
    w: 1,
    h: 1,
    solid: r.solido,
    tileRef: { pack: r.pack, i: r.i, cols: r.cols, tile: r.tile },
  }
  placeSolid.value = r.solido
  tool.value = 'place'
}

// --- seleção + propriedades ---
const selecionadoId = ref<string | null>(null)
const objetoSelecionado = computed<MapObject | null>(
  () => map.objects.find((o) => o.id === selecionadoId.value) ?? null,
)
const rotuloSelecionado = computed(() => {
  const o = objetoSelecionado.value
  if (!o) return ''
  return PALETTE.find((p) => p.kind === o.kind)?.label ?? o.kind
})

function objetoNoTile(x: number, y: number): MapObject | null {
  for (let i = map.objects.length - 1; i >= 0; i--) {
    const o = map.objects[i]
    if (x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) return o
  }
  return null
}

// única porta de escrita do painel: aplica o patch no objeto que já está no
// mapa (id, posição e o resto ficam de pé), grava no histórico e redesenha.
function alterarSelecionado(patch: Partial<MapObject>) {
  const o = objetoSelecionado.value
  if (!o || !canEdit.value) return
  Object.assign(o, patch)
  snapshot()
  render()
}

function removerSelecionado() {
  const id = selecionadoId.value
  if (!id || !canEdit.value) return
  const i = map.objects.findIndex((o) => o.id === id)
  if (i < 0) return
  map.objects.splice(i, 1)
  selecionadoId.value = null
  snapshot()
  render()
}

// --- marcações de colisão × altura desenhada ---
const mostrarCaixas = ref(true)
const COR_COLISAO = 0xa83232
const COR_ALTURA = 0x2a4d8f
let caixas: Container | null = null

/** Hachura a 45° recortada no retângulo (o Pixi não tem preenchimento de padrão). */
function hachurar(g: Graphics, x: number, y: number, w: number, h: number, forte: boolean) {
  const passo = 8
  for (let d = passo; d < w + h; d += passo) {
    g.moveTo(x + Math.max(0, d - h), y + Math.min(d, h))
    g.lineTo(x + Math.min(d, w), y + Math.max(0, d - w))
  }
  g.stroke({ width: 1, color: COR_COLISAO, alpha: forte ? 0.9 : 0.5 })
  g.rect(x, y, w, h).stroke({ width: 2, color: COR_COLISAO, alpha: forte ? 1 : 0.7 })
}

/** Contorno tracejado — o Pixi 8 não tem dash nativo, então sai segmento a segmento. */
function tracejar(g: Graphics, x: number, y: number, w: number, h: number, forte: boolean) {
  const traco = 6
  const lados: [number, number, number, number][] = [
    [x, y, x + w, y],
    [x + w, y, x + w, y + h],
    [x + w, y + h, x, y + h],
    [x, y + h, x, y],
  ]
  for (const [ax, ay, bx, by] of lados) {
    const comp = Math.hypot(bx - ax, by - ay)
    if (comp <= 0) continue
    const ux = (bx - ax) / comp
    const uy = (by - ay) / comp
    for (let d = 0; d < comp; d += traco * 2) {
      const f = Math.min(d + traco, comp)
      g.moveTo(ax + ux * d, ay + uy * d)
      g.lineTo(ax + ux * f, ay + uy * f)
    }
  }
  g.stroke({ width: 2, color: COR_ALTURA, alpha: forte ? 1 : 0.65 })
}

/* As duas caixas SOBREPOSTAS, não uma de cada vez: é a diferença entre elas que
   explica a árvore — pegada de 1 tile no tronco, 4 tiles de copa desenhada por
   cima. Sem enxergar as duas juntas, "por que o avatar atravessa a copa?" só se
   descobre testando no jogo. */
function desenharCaixas() {
  if (!caixas) return
  for (const c of caixas.removeChildren()) c.destroy({ children: true })
  const g = new Graphics()
  let desenhou = false

  for (const o of map.objects) {
    const sel = o.id === selecionadoId.value
    if (!sel && !mostrarCaixas.value) continue
    if (o.kind === 'area') continue
    desenhou = true

    const x = o.x * TILE_PX
    const y = o.y * TILE_PX
    const w = o.w * TILE_PX
    const h = o.h * TILE_PX
    const alturaVis = Math.max(0.25, o.hVis ?? o.h) * TILE_PX
    const topoArte = y + h - alturaVis

    tracejar(g, x, topoArte, w, alturaVis, sel)

    if (o.solid) {
      hachurar(g, x, y, w, h, sel)
    } else {
      g.rect(x, y, w, h).stroke({ width: 1, color: COR_COLISAO, alpha: sel ? 0.55 : 0.28 })
    }

    if (sel) {
      const topo = Math.min(y, topoArte)
      g.rect(x - 3, topo - 3, w + 6, y + h - topo + 6).stroke({ width: 2, color: 0xf2a93b, alpha: 0.95 })
    }
  }

  if (desenhou) caixas.addChild(g)
  else g.destroy()
}

function render() {
  if (!scene) return
  map.width = Math.max(8, Math.min(120, map.width))
  map.height = Math.max(8, Math.min(120, map.height))
  scene.setMap(map)
  scene.fit()
  desenharCaixas()
}

watch([selecionadoId, mostrarCaixas], desenharCaixas)

function onLeave() {
  scene?.clearGhost()
}

function onMove(e: PointerEvent) {
  if (!scene || !canEdit.value || tool.value !== 'place') { scene?.clearGhost(); return }
  const { x, y } = scene.screenToTile(e.clientX, e.clientY)
  if (x < 1 || y < 1 || x > map.width - 2 || y > map.height - 2) { scene.clearGhost(); return }
  const p = current.value
  scene.showGhost(x, y, Math.min(p.w, map.width - 1 - x), Math.min(p.h, map.height - 1 - y), p.color || 0x2c7441, p.shape === 'circle')
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function onClick(e: PointerEvent) {
  if (!scene) return
  const { x, y } = scene.screenToTile(e.clientX, e.clientY)
  if (x < 0 || y < 0 || x > map.width - 1 || y > map.height - 1) return

  // selecionar funciona até em mundo somente leitura: ver as medidas de uma peça
  // não escreve nada
  if (tool.value === 'select') {
    selecionadoId.value = objetoNoTile(x, y)?.id ?? null
    return
  }

  if (!canEdit.value) return
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
    const alvo = objetoNoTile(x, y)
    if (!alvo) return
    map.objects.splice(map.objects.indexOf(alvo), 1)
    if (selecionadoId.value === alvo.id) selecionadoId.value = null
    snapshot()
    render()
    return
  }
  if (tool.value === 'toggle') {
    const alvo = objetoNoTile(x, y)
    if (!alvo) return
    alvo.solid = !alvo.solid
    snapshot()
    render()
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
    tileRef: p.tileRef,
  }
  // sem `arte`, criarSpriteDoPack nem é tentado e o objeto cai no SVG antigo —
  // por isso o que se colocava pelo editor saía com a arte de antes do Kenney
  if (KINDS_KENNEY.has(p.kind)) obj.arte = 'kenney'
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
  await scene.init(host.value!, '#d9c9aa')
  // camada própria do editor, por cima de tudo (inclusive do ghost). fica na
  // world do Pixi, então usa coordenada de tile direto e acompanha zoom/pan.
  caixas = new Container()
  caixas.eventMode = 'none'
  scene.world.addChild(caixas)
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
  // app.destroy(true, { children: true }) leva a world junto — e a camada de
  // marcações com ela; aqui só se solta a referência
  caixas = null
  scene?.destroy()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.ed-root {
  height: 100vh;
  display: grid;
  grid-template-columns: 17.5rem 1fr;
  background: var(--bg-0);
  color: var(--text);
  font-family: var(--f-sans);
}

/* .k-card traz sombra flutuante; encaixada na coluna do grid ela vira só o
   contorno duplo + a divisa de tinta contra o palco */
.ed-side {
  display: flex;
  flex-direction: column;
  min-height: 0;
  box-shadow: var(--contorno-duplo);
  border-right: 0.125rem solid var(--tinta);
}

.ed-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.625rem 0.75rem;
  border-bottom: 0.125rem solid var(--tinta);
  background: var(--bg-2);
}

/* o corpo é o ÚNICO trecho que rola: antes a coluna inteira era o contêiner de
   rolagem e, com o conteúdo passando da altura, o cabeçalho subia pra fora da
   viewport (o "‹ Jogo" com y negativo) e os blocos do fim ficavam inalcançáveis */
.ed-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ed-body > * {
  flex: 0 0 auto;
}

.ed-grupo {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
  border-top: 0.125rem solid var(--border);
  padding-top: 0.625rem;
}

.ed-body > .ed-grupo:first-child {
  border-top: 0;
  padding-top: 0;
}

.ed-foot {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border-top: 0.125rem solid var(--tinta);
  background: var(--bg-2);
}

/* flex-wrap + base mínima: botão não encolhe abaixo do próprio texto, quebra
   linha. era o que cortava "criar objeto próprio", "usar como pincel" & cia. */
.ed-linha {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.ed-linha > .k-btn {
  flex: 1 1 auto;
}

.ed-campos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
  gap: 0.5rem;
}

.ed-campo {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

/* alvo mínimo de 32×32 em todo controle */
.ed-hit {
  min-height: 2rem;
  min-width: 2rem;
}

.ed-toggle,
.ed-bloco {
  width: 100%;
  justify-content: flex-start;
  text-align: left;
  white-space: normal;
}

.ed-bloco {
  justify-content: center;
  text-align: center;
}

.ed-paleta {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
  gap: 0.375rem;
}

/* sem fundo próprio: era o .ed-obj com background creme que vencia o do
   .k-active por especificidade e deixava "Mesa" selecionada em creme sobre
   creme (1,00:1, texto invisível) */
.ed-peca {
  white-space: normal;
  text-align: center;
  line-height: 1.2;
  padding-left: 0.375rem;
  padding-right: 0.375rem;
}

.ed-dica {
  margin: 0;
  font-size: 0.6875rem;
  line-height: 1.4;
  color: var(--text-3);
  overflow-wrap: anywhere;
}

.ed-dica-alerta {
  color: var(--accent-texto);
}

.ed-msg {
  margin: 0;
  font-size: 0.75rem;
  color: var(--ok);
  text-align: center;
  overflow-wrap: anywhere;
}

.ed-apagar {
  border-color: var(--err);
  color: var(--err);
}

.ed-apagar:hover:not(:disabled) {
  background: var(--err);
  color: var(--bg-2);
}

.ed-legenda {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ed-legenda li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.6875rem;
  color: var(--text-2);
}

.ed-amostra {
  flex: 0 0 auto;
  width: 1.5rem;
  height: 1rem;
  border: 0.125rem solid var(--tinta);
}

.ed-amostra-colisao {
  border-color: var(--err);
  background: repeating-linear-gradient(45deg, var(--err) 0 0.125rem, transparent 0.125rem 0.375rem);
}

.ed-amostra-altura {
  border-color: var(--mundo);
  border-style: dashed;
  background: var(--bg-2);
}

.ed-pixel-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--bg-0);
  border: 0.125rem solid var(--tinta);
  padding: 0.5rem;
}

.ed-swatch-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.ed-swatch {
  width: 2rem;
  height: 2rem;
  cursor: pointer;
  border: 0.125rem solid var(--tinta);
  display: grid;
  place-items: center;
  padding: 0;
  color: var(--tinta);
}

.ed-swatch-active {
  box-shadow: inset 0 0 0 0.125rem var(--bg-2), 0 0 0 0.125rem var(--tinta);
}

/* a grade é superfície de pintura, não um controle discreto: as células
   acompanham a largura do painel (~1,8rem cada) */
.ed-pixel-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 0.0625rem;
  width: 100%;
  aspect-ratio: 1;
  border: 0.125rem solid var(--tinta);
}

.ed-pixel-cell {
  cursor: crosshair;
  min-height: 0;
}

.ed-stage {
  position: relative;
  overflow: hidden;
  cursor: crosshair;
}

.ed-props {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  bottom: 0.75rem;
  width: 19rem;
  max-width: calc(100% - 1.5rem);
  display: flex;
  z-index: 60;
  cursor: default;
}

.ed-props-card {
  flex: 1 1 auto;
  min-height: 0;
}

.ed-mobile-toggle {
  display: none;
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 110;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
}

/* Telas estreitas (ou zoom alto): a barra fixa sobrava quase nada pro canvas do
   editor. Vira sobreposição flutuante, escondida por padrão; o botão de menu
   abre por cima do canvas em vez de dividir o grid. */
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
    width: min(20rem, 92vw);
    height: 100vh;
    z-index: 100;
    box-shadow: var(--contorno-duplo), 0.5rem 0 1.5rem rgba(0, 0, 0, 0.5);
  }

  .ed-mobile-toggle {
    display: inline-flex;
  }

  /* propriedades viram gaveta de baixo: 19rem à direita cobriam o mapa inteiro */
  .ed-props {
    top: auto;
    left: 0.75rem;
    right: 0.75rem;
    bottom: 0.75rem;
    width: auto;
    max-width: none;
    max-height: 60vh;
  }
}
</style>
