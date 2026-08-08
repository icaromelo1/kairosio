<script setup lang="ts">
import { computed, ref, watch, useId } from 'vue'
import PixelIcon from '@/components/PixelIcon.vue'
import TileThumb from '@/components/TileThumb.vue'
import CatalogoTiles from '@/components/CatalogoTiles.vue'
import { buscar, type TileResultado } from '@/game/furniture/busca'
import type { MapObject, ObjectKind } from '@/game/maps'
import canonicoJson from '@/game/furniture/canonico.json'

interface Canon {
  w: number
  h: number
  hVis: number
}
const CANONICO = canonicoJson as unknown as Record<string, Canon>

/* Índice plano das peças: `buscar('')` devolve o catálogo inteiro (sem termo e
   sem categoria nada é filtrado). Serve pra recuperar o `opaco` do tile que o
   objeto já usa — o tileRef guardado no mapa só tem pack/i/cols/tile. */
const PECAS_POR_CHAVE = new Map<string, TileResultado>()
for (const p of buscar('')) PECAS_POR_CHAVE.set(`${p.pack}:${p.i}`, p)

/* Kinds cuja arte é uma SUPERFÍCIE (grama, água, piso, parede): a cena resolve
   esses antes de olhar o tileRef, então trocar o sprite neles só surte efeito
   virando 'tile'. Nos demais o kind é preservado — é ele que decide se o objeto
   entra na camada ordenada por Y (o avatar passar atrás depende disso). */
const KINDS_DE_SUPERFICIE = new Set<ObjectKind>(['grass', 'panel', 'path', 'wall', 'water', 'rug', 'custom'])

const props = defineProps<{
  objeto: MapObject
  rotulo: string
  podeEditar: boolean
}>()

const emit = defineEmits<{
  alterar: [Partial<MapObject>]
  remover: []
  fechar: []
}>()

const idLargura = useId()
const idPegada = useId()
const idAltura = useId()

const travado = ref(true)
const trocando = ref(false)

watch(
  () => props.objeto.id,
  () => {
    travado.value = true
    trocando.value = false
  },
)

const peca = computed(() => {
  const r = props.objeto.tileRef
  return r ? (PECAS_POR_CHAVE.get(`${r.pack}:${r.i}`) ?? null) : null
})

const nome = computed(() => peca.value?.nome ?? props.rotulo)

/** Proporção canônica da ARTE (largura ÷ altura desenhada). */
const aspecto = computed<number | null>(() => {
  const o = props.objeto
  if (o.tileRef) {
    const p = peca.value
    if (p && p.opaco.h > 0) return p.opaco.w / p.opaco.h
    return null
  }
  const c = CANONICO[o.kind]
  if (c && c.hVis > 0) return c.w / c.hVis
  return null
})

const alturaDesenhada = computed(() => props.objeto.hVis ?? props.objeto.h)

const foraDaProporcao = computed(() => {
  const a = aspecto.value
  if (!a) return false
  const atual = props.objeto.w / (alturaDesenhada.value || 1)
  return Math.abs(atual - a) / a > 0.08
})

function valor(e: Event): number {
  return Number((e.target as HTMLInputElement).value)
}

function inteiro(v: number, min = 1, max = 40): number {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, Math.round(v)))
}

/** A altura desenhada é fracionária (a copa de uma árvore raramente fecha em
 *  tile cheio), mas em passos de 1/4 de tile pra não virar número irracional. */
function quarto(v: number, min = 0.25, max = 40): number {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, Math.round(v * 4) / 4))
}

function mudarLargura(e: Event) {
  const w = inteiro(valor(e))
  if (travado.value && aspecto.value) emit('alterar', { w, hVis: quarto(w / aspecto.value) })
  else emit('alterar', { w })
}

function mudarPegada(e: Event) {
  emit('alterar', { h: inteiro(valor(e)) })
}

function mudarAltura(e: Event) {
  const hVis = quarto(valor(e))
  if (travado.value && aspecto.value) emit('alterar', { hVis, w: inteiro(hVis * aspecto.value) })
  else emit('alterar', { hVis })
}

/* Soltar a trava é o único caminho pra esticar/achatar a arte. Como o estrago é
   silencioso (a peça continua "funcionando", só sai deformada), pede confirmação
   explícita; religar a trava reencaixa a altura na proporção da arte. */
function alternarTrava() {
  if (!props.podeEditar) return
  if (travado.value) {
    const ok = window.confirm(
      'Soltar a trava de proporção?\n\n' +
        'A peça pode ficar esticada ou achatada — a proporção original da arte deixa de ser respeitada.',
    )
    if (!ok) return
    travado.value = false
    return
  }
  travado.value = true
  if (aspecto.value) emit('alterar', { hVis: quarto(props.objeto.w / aspecto.value) })
}

function girar() {
  emit('alterar', { rotation: (((props.objeto.rotation || 0) + 90) % 360) || undefined })
}

function alternarSolido() {
  emit('alterar', { solid: !props.objeto.solid })
}

function alternarSentavel() {
  emit('alterar', { sittable: props.objeto.sittable ? undefined : true })
}

/* Troca de sprite = só a ARTE muda. id, posição, rotação, solidez, tamanho e o
   papel de interativo (nome/ação) continuam os mesmos — sem apagar e recriar,
   que era a única forma de trocar a peça antes. */
function trocarSprite(r: TileResultado) {
  const o = props.objeto
  emit('alterar', {
    kind: KINDS_DE_SUPERFICIE.has(o.kind) ? 'tile' : o.kind,
    tileRef: { pack: r.pack, i: r.i, cols: r.cols, tile: r.tile },
    arte: undefined,
    color: undefined,
    pixels: undefined,
  })
  trocando.value = false
}
</script>

<template>
  <section class="k-card po" aria-label="Propriedades do objeto selecionado">
    <header class="po-topo">
      <span class="po-titulo">
        <span v-if="objeto.tileRef" class="po-thumb">
          <TileThumb :peca="objeto.tileRef" />
        </span>
        <span class="po-nome">{{ nome }}</span>
      </span>
      <button
        type="button"
        class="k-btn k-btn-ghost po-hit po-fechar"
        title="Fechar propriedades"
        aria-label="Fechar propriedades"
        @click="emit('fechar')"
      >
        <PixelIcon name="close" size="0.875rem" />
      </button>
    </header>

    <div class="po-corpo">
      <p class="po-linha-info">
        <span class="k-label po-label-inline">Posição</span>
        <span class="k-num po-num">{{ objeto.x }}, {{ objeto.y }}</span>
      </p>

      <p v-if="!podeEditar" class="po-aviso">Somente leitura.</p>

      <div class="po-grupo">
        <div class="po-cabecalho-grupo">
          <span class="k-label po-label-inline">Tamanho</span>
          <button
            type="button"
            class="k-btn k-btn-sm po-hit"
            :class="{ 'k-active': travado }"
            :disabled="!podeEditar || !aspecto"
            :aria-pressed="travado"
            :title="
              aspecto
                ? travado
                  ? 'Proporção travada na medida canônica da arte'
                  : 'Proporção solta — a arte pode deformar'
                : 'Esta peça não tem proporção canônica'
            "
            @click="alternarTrava"
          >
            <PixelIcon :name="travado ? 'lock' : 'unlock'" size="0.875rem" />{{ travado ? 'travada' : 'solta' }}
          </button>
        </div>

        <div class="po-campos">
          <label class="po-campo" :for="idLargura">
            <span class="k-label">Largura</span>
            <input
              :id="idLargura"
              class="k-input k-input-sm po-hit"
              type="number"
              min="1"
              max="40"
              step="1"
              :value="objeto.w"
              :disabled="!podeEditar"
              @change="mudarLargura"
            />
          </label>
          <label class="po-campo" :for="idAltura">
            <span class="k-label">Altura desenhada</span>
            <input
              :id="idAltura"
              class="k-input k-input-sm po-hit"
              type="number"
              min="0.25"
              max="40"
              step="0.25"
              :value="alturaDesenhada"
              :disabled="!podeEditar"
              @change="mudarAltura"
            />
          </label>
          <label class="po-campo" :for="idPegada">
            <span class="k-label">Pegada (colisão)</span>
            <input
              :id="idPegada"
              class="k-input k-input-sm po-hit"
              type="number"
              min="1"
              max="40"
              step="1"
              :value="objeto.h"
              :disabled="!podeEditar"
              @change="mudarPegada"
            />
          </label>
        </div>

        <p v-if="!aspecto" class="po-dica">Sem proporção canônica registrada — os três campos são livres.</p>
        <p v-else-if="!travado && foraDaProporcao" class="po-dica po-dica-alerta">
          A arte está fora da proporção original. Trave de novo pra reencaixar.
        </p>
      </div>

      <div class="po-grupo">
        <span class="k-label po-label-inline">Colisão × altura desenhada</span>
        <button
          type="button"
          class="k-btn k-btn-sm po-hit po-toggle"
          role="checkbox"
          :aria-checked="!!objeto.solid"
          :disabled="!podeEditar"
          @click="alternarSolido"
        >
          <PixelIcon :name="objeto.solid ? 'checkbox-on' : 'checkbox'" size="0.875rem" />bloqueia a passagem
        </button>
        <button
          type="button"
          class="k-btn k-btn-sm po-hit po-toggle"
          role="checkbox"
          :aria-checked="!!objeto.sittable"
          :disabled="!podeEditar"
          @click="alternarSentavel"
        >
          <PixelIcon :name="objeto.sittable ? 'checkbox-on' : 'checkbox'" size="0.875rem" />dá pra sentar
        </button>

        <ul class="po-legenda">
          <li>
            <span class="po-amostra po-amostra-colisao" aria-hidden="true"></span>
            <span
              >Pegada de colisão — {{ objeto.w }}×{{ objeto.h }} tiles{{ objeto.solid ? '' : ' (atravessável)' }}</span
            >
          </li>
          <li>
            <span class="po-amostra po-amostra-altura" aria-hidden="true"></span>
            <span>Altura desenhada — {{ objeto.w }}×{{ alturaDesenhada }} tiles, ancorada na base</span>
          </li>
        </ul>
        <p class="po-dica">
          Altura maior que a pegada é o que deixa o avatar passar atrás da copa e esbarrar só no tronco.
        </p>
      </div>

      <div class="po-grupo">
        <span class="k-label po-label-inline">Rotação</span>
        <button type="button" class="k-btn k-btn-sm po-hit" :disabled="!podeEditar" @click="girar">
          <PixelIcon name="reload" size="0.875rem" />girar: {{ objeto.rotation || 0 }}°
        </button>
      </div>

      <div class="po-grupo">
        <button
          type="button"
          class="k-btn k-btn-sm po-hit po-bloco"
          :disabled="!podeEditar"
          :aria-expanded="trocando"
          @click="trocando = !trocando"
        >
          <PixelIcon :name="trocando ? 'chevron-down' : 'chevron-right'" size="0.875rem" />trocar sprite
        </button>
        <p v-if="trocando" class="po-dica">
          A peça nova entra no lugar da atual: id, posição, tamanho, rotação e solidez ficam como estão.
        </p>
        <CatalogoTiles
          v-if="trocando"
          :atual="objeto.tileRef ? { pack: objeto.tileRef.pack, i: objeto.tileRef.i } : null"
          :desabilitado="!podeEditar"
          @escolher="trocarSprite"
        />
      </div>
    </div>

    <footer class="po-rodape">
      <button type="button" class="k-btn k-btn-sm po-hit po-apagar" :disabled="!podeEditar" @click="emit('remover')">
        <PixelIcon name="trash" size="0.875rem" />apagar objeto
      </button>
    </footer>
  </section>
</template>

<style scoped>
.po {
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 100%;
  padding: 0;
}

.po-topo {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  border-bottom: 0.125rem solid var(--tinta);
  background: var(--bg-2);
}

.po-titulo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.po-thumb {
  flex: 0 0 auto;
  width: 1.75rem;
  border: 0.125rem solid var(--tinta);
  background: var(--bg-0);
  padding: 0.0625rem;
}

.po-nome {
  font-family: var(--f-pixel);
  font-size: 0.6875rem;
  line-height: 1.3;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text);
  overflow-wrap: anywhere;
}

.po-fechar {
  flex: 0 0 auto;
  padding: 0.25rem;
}

.po-corpo {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.po-corpo > * {
  flex: 0 0 auto;
}

.po-grupo {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
  border-top: 0.125rem solid var(--border);
  padding-top: 0.625rem;
}

.po-cabecalho-grupo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.po-label-inline {
  margin-bottom: 0;
}

.po-linha-info {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.po-num {
  font-size: 0.875rem;
}

.po-campos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
  gap: 0.5rem;
}

.po-campo {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

/* Todo controle novo tem no mínimo 32×32 de alvo. */
.po-hit {
  min-height: 2rem;
  min-width: 2rem;
}

.po-toggle,
.po-bloco {
  width: 100%;
  justify-content: flex-start;
  text-align: left;
  white-space: normal;
}

.po-legenda {
  list-style: none;
  margin: 0.25rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.po-legenda li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.6875rem;
  line-height: 1.4;
  color: var(--text-2);
  overflow-wrap: anywhere;
}

.po-amostra {
  flex: 0 0 auto;
  width: 1.5rem;
  height: 1rem;
  border: 0.125rem solid var(--tinta);
}

/* Mesmas duas leituras do desenho sobre o mapa: hachura vermelha = colisão,
   tracejado azul = altura desenhada. */
.po-amostra-colisao {
  border-color: var(--err);
  background: repeating-linear-gradient(45deg, var(--err) 0 0.125rem, transparent 0.125rem 0.375rem);
}

.po-amostra-altura {
  border-color: var(--mundo);
  border-style: dashed;
  background: var(--bg-2);
}

.po-dica {
  margin: 0;
  font-size: 0.6875rem;
  line-height: 1.4;
  color: var(--text-3);
  overflow-wrap: anywhere;
}

.po-dica-alerta {
  color: var(--accent-texto);
}

.po-aviso {
  margin: 0;
  font-size: 0.6875rem;
  color: var(--accent-texto);
}

.po-rodape {
  flex: 0 0 auto;
  padding: 0.625rem 0.75rem;
  border-top: 0.125rem solid var(--tinta);
  background: var(--bg-2);
}

.po-apagar {
  width: 100%;
  border-color: var(--err);
  color: var(--err);
}

.po-apagar:hover:not(:disabled) {
  background: var(--err);
  color: var(--bg-2);
}
</style>
