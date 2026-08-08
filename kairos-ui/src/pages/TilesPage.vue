<template>
  <div class="tp-root" data-captura-teclado>
    <header class="tp-topo">
      <button class="k-btn k-btn-ghost k-btn-sm" @click="router.push('/game')">
        <PixelIcon name="corner-up-left" size="0.75rem" />jogo
      </button>
      <span class="k-chip">revisão de tiles</span>

      <nav class="tp-packs">
        <button
          v-for="p in PACKS" :key="p.pack"
          class="k-btn k-btn-ghost k-btn-xs" :class="{ 'k-active': pack === p.pack }"
          @click="trocarPack(p.pack)"
        >{{ p.pack }} <span class="tp-n">{{ revisadosNoPack(p.pack) }}/{{ p.tiles.length }}</span></button>
      </nav>

      <span class="tp-progresso">
        <span class="tp-n">{{ totalRevisado }}/{{ TOTAL }}</span>
        <span v-if="salvoEm" class="tp-salvo">salvo {{ salvoEm }}</span>
        <span v-else-if="erro" class="tp-erro">{{ erro }}</span>
      </span>

      <button class="k-btn k-btn-ghost k-btn-xs" @click="grade = !grade">
        {{ grade ? 'foco (g)' : 'grade (g)' }}
      </button>
    </header>

    <main v-if="carregando" class="tp-vazio">carregando as revisões já feitas…</main>

    <main v-else-if="grade" class="tp-grade">
      <button
        v-for="t in tilesDoPack" :key="t.i"
        class="tp-cel" :class="{ 'tp-cel-ok': feito(t.i), 'tp-cel-duvida': duvidas.has(t.i) }"
        :title="`${t.i} · ${nomeDe(t)}`"
        @click="irPara(t.i)"
      >
        <TileThumb :peca="{ pack, i: t.i, cols: packAtual.cols, tile: packAtual.tile }" :lado="32" />
      </button>
    </main>

    <main v-else-if="atual" class="tp-foco">
      <section class="tp-palco">
        <div class="tp-grande">
          <TileThumb :peca="{ pack, i: atual.i, cols: packAtual.cols, tile: packAtual.tile }" :lado="128" />
        </div>
        <div class="tp-vizinhos">
          <span class="k-label">vizinhos no sheet</span>
          <div class="tp-vizinhos-linha">
            <TileThumb
              v-for="v in vizinhos" :key="v"
              :peca="{ pack, i: v, cols: packAtual.cols, tile: packAtual.tile }"
              :lado="40"
              :class="{ 'tp-viz-atual': v === atual.i }"
            />
          </div>
          <p class="k-hint-text">O sheet é o que desfaz a ambiguidade: isto é topo de árvore, não arbusto.</p>
        </div>
      </section>

      <section class="tp-form">
        <div class="tp-cab">
          <span class="k-label">tile {{ posicao + 1 }} de {{ tilesDoPack.length }} · {{ pack }} #{{ atual.i }}</span>
        </div>

        <div class="tp-campo">
          <span class="k-label">nome (n)</span>
          <input
            ref="campoNome" v-model="nome" class="k-input tp-input" maxlength="80"
            @keydown.enter.prevent="confirmar" @keydown.esc.prevent="campoNome?.blur()"
          />
        </div>

        <div class="tp-campo">
          <span class="k-label">categoria (1–9, 0, q, w)</span>
          <div class="tp-cats">
            <button
              v-for="(c, i) in CATEGORIAS" :key="c"
              class="k-btn k-btn-ghost k-btn-xs tp-cat" :class="{ 'k-active': cat === c }"
              @click="cat = c"
            ><span class="tp-tecla">{{ TECLAS[i] }}</span>{{ c }}</button>
          </div>
        </div>

        <div class="tp-campo">
          <span class="k-label">solidez (s)</span>
          <button class="k-btn k-btn-sm" :class="{ 'k-active': solido }" @click="solido = !solido">
            {{ solido ? 'sólido — barra o caminho' : 'não sólido — dá para atravessar' }}
          </button>
          <p class="k-hint-text">Campo do tile, não da categoria: a coluna que também é decoração continua sólida.</p>
        </div>

        <div class="tp-campo">
          <span class="k-label">serve como (a)</span>
          <div class="tp-cats">
            <button
              v-for="c in CATEGORIAS.filter((x) => x !== cat)" :key="c"
              class="k-btn k-btn-ghost k-btn-xs tp-cat" :class="{ 'k-active': serveComo.includes(c) }"
              @click="alternarServe(c)"
            >{{ c }}</button>
          </div>
        </div>

        <div class="tp-acoes">
          <button class="k-btn k-btn-ghost k-btn-sm" :disabled="posicao === 0" @click="irPara(tilesDoPack[posicao - 1].i)">
            ← voltar
          </button>
          <button class="k-btn k-btn-ghost k-btn-sm" :class="{ 'k-active': duvidas.has(atual.i) }" @click="marcarDuvida">
            dúvida (d)
          </button>
          <button class="k-btn k-btn-primary k-btn-sm tp-confirmar" :disabled="salvando" @click="confirmar">
            {{ salvando ? 'salvando…' : 'confirmar e avançar · enter' }}
          </button>
        </div>

        <div v-if="duvidas.size" class="tp-duvidas">
          <span class="k-label">fila de dúvidas ({{ duvidas.size }})</span>
          <div class="tp-cats">
            <button
              v-for="i in [...duvidas]" :key="i"
              class="k-btn k-btn-ghost k-btn-xs" @click="irPara(i)"
            >#{{ i }}</button>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PixelIcon from '@/components/PixelIcon.vue'
import TileThumb from '@/components/TileThumb.vue'
import { listarRevisoes, salvarRevisao, type TileRevisao } from '@/services/tiles.api'
import tinyTown from '@/game/furniture/indice-tiny-town.json'
import rpgUrban from '@/game/furniture/indice-rpg-urban.json'
import modernCity from '@/game/furniture/indice-modern-city.json'

interface TileIndice {
  i: number
  nome: string
  cat: string
  solido: boolean
  serveComo?: string[]
  revisado?: boolean
}
interface PackIndice { pack: string; tile: number; cols: number; tiles: TileIndice[] }

const CATEGORIAS = [
  'piso', 'parede', 'porta', 'janela', 'movel', 'natureza',
  'veiculo', 'personagem', 'sinal', 'decoracao', 'item', 'vazio',
]
const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'q', 'w']

const PACKS = [tinyTown, rpgUrban, modernCity] as unknown as PackIndice[]
const TOTAL = PACKS.reduce((n, p) => n + p.tiles.length, 0)

const router = useRouter()

const pack = ref(PACKS[0].pack)
const posicao = ref(0)
const grade = ref(false)
const carregando = ref(true)
const salvando = ref(false)
const salvoEm = ref('')
const erro = ref('')
const duvidas = ref(new Set<number>())
const campoNome = ref<HTMLInputElement | null>(null)

const nome = ref('')
const cat = ref('')
const solido = ref(false)
const serveComo = ref<string[]>([])

// o que já foi revisado, por pack — é isto que faz "fechar no 800" retomar no 801
const revisoes = ref(new Map<string, TileRevisao>())
const chave = (p: string, i: number) => `${p}#${i}`

const packAtual = computed(() => PACKS.find((p) => p.pack === pack.value) ?? PACKS[0])
const tilesDoPack = computed(() => packAtual.value.tiles)
const atual = computed<TileIndice | null>(() => tilesDoPack.value[posicao.value] ?? null)

const vizinhos = computed(() => {
  if (!atual.value) return []
  const cols = packAtual.value.cols
  const i = atual.value.i
  return [i - cols - 1, i - cols, i - cols + 1, i - 1, i, i + 1, i + cols - 1, i + cols, i + cols + 1]
    .filter((n) => n >= 0)
})

const totalRevisado = computed(() => revisoes.value.size)
function revisadosNoPack(p: string) {
  let n = 0
  for (const k of revisoes.value.keys()) if (k.startsWith(`${p}#`)) n++
  return n
}
function feito(i: number) { return revisoes.value.has(chave(pack.value, i)) }
function nomeDe(t: TileIndice) { return revisoes.value.get(chave(pack.value, t.i))?.nome ?? t.nome }

function carregarCampos() {
  const t = atual.value
  if (!t) return
  const r = revisoes.value.get(chave(pack.value, t.i))
  nome.value = r?.nome ?? t.nome
  cat.value = r?.cat ?? t.cat
  solido.value = r?.solido ?? t.solido
  serveComo.value = [...(r?.serveComo ?? t.serveComo ?? [])]
}
watch([atual, pack], carregarCampos, { immediate: true })

function irPara(i: number) {
  const idx = tilesDoPack.value.findIndex((t) => t.i === i)
  if (idx >= 0) { posicao.value = idx; grade.value = false }
}

function trocarPack(p: string) {
  pack.value = p
  posicao.value = 0
  void carregarRevisoes()
}

function alternarServe(c: string) {
  const i = serveComo.value.indexOf(c)
  if (i >= 0) serveComo.value.splice(i, 1)
  else serveComo.value.push(c)
}

function marcarDuvida() {
  const t = atual.value
  if (!t) return
  if (duvidas.value.has(t.i)) duvidas.value.delete(t.i)
  else duvidas.value.add(t.i)
  duvidas.value = new Set(duvidas.value)
}

async function confirmar() {
  const t = atual.value
  if (!t || salvando.value) return
  salvando.value = true
  erro.value = ''
  try {
    const dados = {
      nome: nome.value.trim() || t.nome,
      cat: cat.value,
      solido: solido.value,
      serveComo: [...serveComo.value],
      revisado: true,
    }
    const gravado = await salvarRevisao(pack.value, t.i, dados)
    revisoes.value.set(chave(pack.value, t.i), gravado)
    revisoes.value = new Map(revisoes.value)
    salvoEm.value = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    duvidas.value.delete(t.i)
    if (posicao.value < tilesDoPack.value.length - 1) posicao.value += 1
  } catch (e) {
    erro.value = 'não deu pra salvar — a decisão não foi gravada'
    console.error(e)
  } finally {
    salvando.value = false
  }
}

async function carregarRevisoes() {
  carregando.value = true
  try {
    const lista = await listarRevisoes(pack.value)
    const m = new Map(revisoes.value)
    for (const r of lista) m.set(chave(r.pack, r.indice), r)
    revisoes.value = m
    // retoma onde parou: o primeiro tile ainda não revisado deste pack
    const proximo = tilesDoPack.value.findIndex((t) => !m.has(chave(pack.value, t.i)))
    posicao.value = proximo >= 0 ? proximo : 0
  } catch {
    erro.value = 'não deu pra ler as revisões já feitas'
  } finally {
    carregando.value = false
    carregarCampos()
  }
}

// a ferramenta vive fora do canvas, então o teclado inteiro é dela — sem
// conflito com o WASD do jogo
function aoTeclado(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  const k = e.key.toLowerCase()
  const iTecla = TECLAS.indexOf(k)
  if (iTecla >= 0) { cat.value = CATEGORIAS[iTecla]; e.preventDefault(); return }
  if (k === 'enter') { e.preventDefault(); void confirmar(); return }
  if (k === 'n') { e.preventDefault(); void nextTick(() => campoNome.value?.focus()); return }
  if (k === 's') { e.preventDefault(); solido.value = !solido.value; return }
  if (k === 'd') { e.preventDefault(); marcarDuvida(); return }
  if (k === 'g') { e.preventDefault(); grade.value = !grade.value; return }
  if (k === 'arrowleft' && posicao.value > 0) { e.preventDefault(); posicao.value -= 1 }
  if (k === 'arrowright' && posicao.value < tilesDoPack.value.length - 1) { e.preventDefault(); posicao.value += 1 }
}

onMounted(() => {
  window.addEventListener('keydown', aoTeclado)
  void carregarRevisoes()
})
onUnmounted(() => window.removeEventListener('keydown', aoTeclado))
</script>

<style scoped>
.tp-root {
  min-height: 100vh;
  background: var(--bg-0);
  display: flex;
  flex-direction: column;
}

.tp-topo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.75rem 1rem;
  background: var(--bg-1);
  border-bottom: var(--ui-border-style);
}

.tp-packs { display: flex; gap: 0.375rem; flex-wrap: wrap; }
.tp-progresso { margin-left: auto; display: flex; align-items: center; gap: 0.75rem; }
.tp-n { font-family: var(--f-num); font-size: 0.875rem; font-variant-numeric: tabular-nums; }
.tp-salvo { font-family: var(--f-sans); font-size: 0.75rem; color: var(--text-3); }
.tp-erro { font-family: var(--f-sans); font-size: 0.75rem; color: var(--err); }

.tp-vazio { padding: 2rem; font-size: 0.8125rem; color: var(--text-3); }

.tp-grade {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(3rem, 1fr));
  gap: 0.25rem;
  padding: 1rem;
}

.tp-cel {
  min-width: 3rem;
  min-height: 3rem;
  display: grid;
  place-items: center;
  background: var(--bg-2);
  border: var(--ui-border-style);
  cursor: pointer;
}
.tp-cel-ok { box-shadow: inset 0 0 0 0.1875rem var(--ok); }
.tp-cel-duvida { box-shadow: inset 0 0 0 0.1875rem var(--warn); }

.tp-foco {
  display: grid;
  grid-template-columns: minmax(14rem, 20rem) minmax(0, 46rem);
  gap: 1.5rem;
  padding: 1.5rem;
  align-items: start;
  justify-content: center;
}

.tp-palco { display: flex; flex-direction: column; gap: 1rem; }
.tp-grande {
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: var(--bg-2);
  border: var(--ui-border-style);
  box-shadow: var(--contorno-duplo);
}
.tp-vizinhos { display: flex; flex-direction: column; gap: 0.5rem; }
.tp-vizinhos-linha { display: grid; grid-template-columns: repeat(3, 2.5rem); gap: 0.125rem; }
.tp-viz-atual { outline: 0.125rem solid var(--accent); }

.tp-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--bg-1);
  border: var(--ui-border-style);
  box-shadow: var(--contorno-duplo), var(--sombra-solida);
}

.tp-cab { border-bottom: 0.125rem solid var(--border); padding-bottom: 0.5rem; }
.tp-campo { display: flex; flex-direction: column; align-items: flex-start; gap: 0.375rem; }
.tp-input { width: 100%; max-width: 28rem; font-family: var(--f-sans); font-size: 0.8125rem; }
.tp-cats { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.tp-cat { gap: 0.375rem; }
.tp-tecla {
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  padding: 0 0.25rem;
  border: 0.0625rem solid var(--border-strong);
}

.tp-acoes { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.tp-confirmar { margin-left: auto; }
.tp-duvidas { display: flex; flex-direction: column; gap: 0.375rem; border-top: 0.125rem solid var(--border); padding-top: 0.75rem; }

@media (max-width: 52rem) {
  .tp-foco { grid-template-columns: 1fr; }
}
</style>
