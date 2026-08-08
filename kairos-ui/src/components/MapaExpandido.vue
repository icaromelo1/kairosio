<template>
  <div class="me-overlay" @click.self="emit('fechar')">
    <div class="k-card me-card">
      <header class="me-head">
        <span class="k-chip"><PixelIcon name="map-pin" size="0.6875rem" />mapa</span>
        <span class="me-titulo">{{ map.name }}</span>
        <button class="k-btn k-btn-ghost k-btn-sm" @click="emit('fechar')">esc<PixelIcon name="close" size="0.75rem" /></button>
      </header>

      <div class="me-corpo">
        <div ref="palco" class="me-palco">
          <!-- as tags vivem NUM WRAPPER do tamanho exato do canvas: o palco é
               maior e centraliza o desenho, então posicionar direto nele
               deslocava todo rótulo pelo tamanho da sobra -->
          <div class="me-desenho" :style="{ width: `${caixa.w}px`, height: `${caixa.h}px` }">
            <canvas ref="tela" class="me-tela pixelated" />
            <span
              v-for="s in salasComGente" :key="s.id"
              class="me-tag" :class="{ 'me-tag-sua': s.id === salaAtualId, 'me-tag-trancada': s.trancada }"
              :style="{ left: `${s.cx}px`, top: `${s.cy}px` }"
            >
              <PixelIcon v-if="s.trancada" name="lock" size="0.625rem" />
              {{ s.nome }} · {{ s.gente.length }}
            </span>
          </div>
        </div>

        <aside class="me-lista">
          <div class="me-lista-tit">
            <span class="k-label me-cap">salas</span>
            <span class="k-label me-cap">{{ totalDeGente }} no mundo</span>
          </div>
          <div class="me-rolagem">
            <section
              v-for="s in salasOrdenadas" :key="s.id"
              class="me-sala me-sala-alvo" :class="{ 'me-sala-sua': s.id === salaAtualId }"
              :title="`Dois cliques para ir até ${s.nome}`"
              @dblclick="emit('ir-para-sala', s.id)"
            >
              <div class="me-sala-cab">
                <span class="me-sala-nome ellipsis">
                  <PixelIcon v-if="s.trancada" name="lock" size="0.625rem" />{{ s.nome }}
                </span>
                <span class="me-sala-n">{{ s.gente.length }}</span>
              </div>
              <p v-if="!s.gente.length" class="me-vazia">vazia</p>
              <ul v-else class="me-gente">
                <li v-for="p in s.gente" :key="p.id" :class="{ 'me-eu': p.eu }">
                  <span class="me-ponto" :style="{ background: p.eu ? 'var(--accent)' : 'var(--mundo)' }" />
                  <span class="ellipsis">{{ p.nome }}</span>
                </li>
              </ul>
            </section>

            <section v-if="foraDeSala.length" class="me-sala">
              <div class="me-sala-cab">
                <span class="me-sala-nome ellipsis">ao ar livre</span>
                <span class="me-sala-n">{{ foraDeSala.length }}</span>
              </div>
              <ul class="me-gente">
                <li v-for="p in foraDeSala" :key="p.id" :class="{ 'me-eu': p.eu }">
                  <span class="me-ponto" :style="{ background: p.eu ? 'var(--accent)' : 'var(--mundo)' }" />
                  <span class="ellipsis">{{ p.nome }}</span>
                </li>
              </ul>
            </section>
          </div>
        </aside>
      </div>

      <footer class="me-pe">
        <span class="me-legenda"><span class="me-ponto" style="background: var(--accent)" />você</span>
        <span class="me-legenda"><span class="me-ponto" style="background: var(--mundo)" />outras pessoas</span>
        <span class="me-legenda"><span class="me-ponto me-ponto-tranca" />sala trancada</span>
        <span class="me-legenda me-legenda-dica">esc fecha</span>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { MapDef } from '@/game/maps'
import { agruparPorSala, foraDeSala as forasDoMapa, type PessoaNaSala } from '@/game/salas'
import PixelIcon from '@/components/PixelIcon.vue'

type Pessoa = PessoaNaSala

const props = defineProps<{
  map: MapDef
  eu: Pessoa
  outros: Pessoa[]
  trancadas: Set<string>
  salaAtualId: string | null
}>()

const emit = defineEmits<{ fechar: []; 'ir-para-sala': [salaId: string] }>()

const tela = ref<HTMLCanvasElement | null>(null)
const palco = ref<HTMLElement | null>(null)
const caixa = ref({ w: 0, h: 0, escala: 1 })

const CORES: Record<string, string> = {
  grass: '#4a9a5e', water: '#4a72b5', path: '#b3aba0', wall: '#8e877e',
  panel: '#d9caa9', tree: '#2f7d46', hedge: '#3f7a48', door: '#f2a93b',
  fountain: '#6b9fd4',
}
const COR_AREA = '#efe0bd'
const COR_MOVEL = '#8a7256'
const COR_FUNDO = '#f4e4c1'

const todos = computed<Pessoa[]>(() => [{ ...props.eu, eu: true }, ...props.outros])

const salas = computed(() =>
  agruparPorSala(props.map, todos.value).map((s) => ({
    ...s,
    trancada: props.trancadas.has(s.id),
    cx: (s.x + s.w / 2) * caixa.value.escala,
    cy: (s.y + s.h / 2) * caixa.value.escala,
  })),
)

const salasComGente = computed(() => salas.value.filter((s) => s.gente.length > 0 || s.trancada))
const salasOrdenadas = computed(() =>
  [...salas.value].sort((a, b) => b.gente.length - a.gente.length || a.nome.localeCompare(b.nome)),
)
const foraDeSala = computed(() => forasDoMapa(props.map, todos.value))
const totalDeGente = computed(() => todos.value.length)

function desenhar() {
  const cv = tela.value
  const host = palco.value
  if (!cv || !host) return

  const dispo = host.getBoundingClientRect()
  if (!dispo.width || !dispo.height) return
  const escala = Math.min(dispo.width / props.map.width, dispo.height / props.map.height)
  const w = Math.floor(props.map.width * escala)
  const h = Math.floor(props.map.height * escala)
  caixa.value = { w, h, escala }

  const dpr = Math.min(2, window.devicePixelRatio || 1)
  cv.width = Math.floor(w * dpr)
  cv.height = Math.floor(h * dpr)
  cv.style.width = `${w}px`
  cv.style.height = `${h}px`

  const ctx = cv.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.imageSmoothingEnabled = false

  ctx.fillStyle = COR_FUNDO
  ctx.fillRect(0, 0, w, h)

  for (const o of props.map.objects) {
    if (o.kind !== 'area') continue
    ctx.fillStyle = COR_AREA
    ctx.fillRect(o.x * escala, o.y * escala, o.w * escala, o.h * escala)
  }
  for (const o of props.map.objects) {
    if (o.kind === 'area') continue
    const cor = CORES[o.kind] ?? (o.solid ? COR_MOVEL : null)
    if (!cor) continue
    ctx.fillStyle = cor
    ctx.fillRect(o.x * escala, o.y * escala, Math.max(1, o.w * escala), Math.max(1, o.h * escala))
  }

  ctx.lineWidth = 2
  for (const o of props.map.objects) {
    if (o.kind !== 'area' || !o.id) continue
    const trancada = props.trancadas.has(o.id)
    ctx.strokeStyle = trancada ? '#a83232' : 'rgba(36, 28, 21, 0.35)'
    ctx.setLineDash(trancada ? [] : [4, 4])
    ctx.strokeRect(o.x * escala, o.y * escala, o.w * escala, o.h * escala)
  }
  ctx.setLineDash([])

  for (const p of props.outros) {
    ctx.fillStyle = '#2a4d8f'
    ctx.beginPath()
    ctx.arc(p.x * escala, p.y * escala, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#241c15'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  ctx.fillStyle = '#f2a93b'
  ctx.beginPath()
  ctx.arc(props.eu.x * escala, props.eu.y * escala, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#241c15'
  ctx.lineWidth = 2
  ctx.stroke()
}

let observer: ResizeObserver | null = null

function aoTeclar(e: KeyboardEvent) {
  const k = e.key.toLowerCase()
  if (k === 'escape') {
    e.preventDefault()
    e.stopPropagation()
    emit('fechar')
  }
}

onMounted(async () => {
  await nextTick()
  desenhar()
  if (typeof ResizeObserver !== 'undefined' && palco.value) {
    observer = new ResizeObserver(() => desenhar())
    observer.observe(palco.value)
  }
  window.addEventListener('keydown', aoTeclar, true)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('keydown', aoTeclar, true)
})

watch(() => [props.eu.x, props.eu.y, props.outros.length, props.trancadas.size], desenhar)
</script>

<style scoped>
.me-overlay {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  background: rgba(36, 28, 21, 0.55);
  padding: 1.5rem;
}

.me-card {
  width: 70vw;
  height: 70vh;
  min-width: 30rem;
  display: flex;
  flex-direction: column;
  padding: 0.875rem;
  gap: 0.75rem;
}

.me-head { display: flex; align-items: center; gap: 0.75rem; }
.me-titulo {
  flex: 1;
  font-family: var(--f-num);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text);
}

.me-corpo { flex: 1; display: grid; grid-template-columns: 1fr 15rem; gap: 0.75rem; min-height: 0; }

.me-palco {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 0;
  background: var(--bg-2);
  border: 0.125rem solid var(--tinta);
  overflow: hidden;
}
.me-desenho { position: relative; }
.me-tela { display: block; }

/* rótulo da sala fica sobre o desenho, ancorado no centro dela */
.me-tag {
  position: absolute;
  transform: translate(-50%, -50%);
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.1875rem 0.375rem;
  background: var(--bg-1);
  border: 0.125rem solid var(--tinta);
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text);
  white-space: nowrap;
  pointer-events: none;
}
.me-tag-sua { background: var(--accent); }
.me-tag-trancada { border-color: var(--err); color: var(--err); }

.me-lista { display: flex; flex-direction: column; gap: 0.5rem; min-height: 0; }
.me-lista-tit { display: flex; align-items: center; justify-content: space-between; }
.me-cap { margin: 0; }
.me-rolagem {
  flex: 1;
  overflow-y: auto;
  border: 0.125rem solid var(--tinta);
  background: var(--bg-2);
  min-height: 0;
}

.me-sala { border-bottom: 0.125rem solid rgba(36, 28, 21, 0.12); padding: 0.4375rem 0.5rem; }
.me-sala:last-child { border-bottom: none; }
.me-sala-alvo { cursor: pointer; user-select: none; }
.me-sala-alvo:hover { background: rgba(44, 116, 65, 0.1); }
.me-sala-sua { background: rgba(242, 169, 59, 0.18); }
.me-sala-cab { display: flex; align-items: center; justify-content: space-between; gap: 0.375rem; }
.me-sala-nome {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-family: var(--f-sans);
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text);
  min-width: 0;
}
.me-sala-n { font-family: var(--f-num); font-size: 0.875rem; font-weight: 700; color: var(--text-2); }
.me-vazia { margin: 0.125rem 0 0; font-size: 0.6875rem; color: var(--text-3); }
.me-gente { list-style: none; margin: 0.25rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.125rem; }
.me-gente li { display: flex; align-items: center; gap: 0.375rem; font-size: 0.75rem; color: var(--text-2); min-width: 0; }
.me-eu { font-weight: 700; color: var(--text); }
.me-ponto { width: 0.5rem; height: 0.5rem; flex: none; border: 0.0625rem solid var(--tinta); }
.me-ponto-tranca { background: transparent; border: 0.125rem solid var(--err); }

.me-pe { display: flex; align-items: center; gap: 0.875rem; flex-wrap: wrap; }
.me-legenda {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-3);
}
.me-legenda-dica { margin-left: auto; }
</style>
