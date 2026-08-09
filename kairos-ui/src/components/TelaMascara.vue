<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import {
  COR_REGIAO,
  LADO,
  PIXELS,
  colunaDe,
  indiceDoPonto,
  linhaDe,
  regiaoDoCodigo,
} from '@/services/mascaras.pixels'
import { carregarImagem } from '@/services/mascaras.assets'

const props = defineProps<{
  pixels: string
  base: string
  confianca: string
  sprite: string
  overlay: boolean
}>()

const emit = defineEmits<{
  (e: 'pintar', indice: number, continuacao: boolean): void
  (e: 'fimTraco'): void
}>()

/* Zoom fixo de 8x: 16 px de fonte viram 128 px de tela. O tamanho na tela sai
   do CSS em rem; o mapeamento clique -> pixel mede a caixa real, então crescer
   a fonte do sistema não desloca a pintura. */
const ZOOM = 8
const LADO_TELA = LADO * ZOOM

const tela = ref<HTMLCanvasElement | null>(null)
const sobre = ref(-1)
let arte: HTMLImageElement | null = null
let pintando = false
let ultimo = -1

const padroes = new Map<string, CanvasPattern | null>()

function comAlfa(hex: string, alfa: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`
}

/* Hachura de 45° desenhada pixel a pixel: em arte pixelada, uma linha
   antisserrilhada vira borrão. (x + y) % 4 < 2 dá a diagonal exata e ainda
   ladrilha sem emenda entre células vizinhas. */
function padraoHachura(ctx: CanvasRenderingContext2D, cor: string): CanvasPattern | null {
  const pronto = padroes.get(cor)
  if (pronto !== undefined) return pronto
  const cv = document.createElement('canvas')
  cv.width = 8
  cv.height = 8
  const p = cv.getContext('2d')
  if (!p) return null
  const dados = p.createImageData(8, 8)
  const n = parseInt(cor.replace('#', ''), 16)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i = (y * 8 + x) * 4
      const marca = (x + y) % 4 < 2
      dados.data[i] = (n >> 16) & 255
      dados.data[i + 1] = (n >> 8) & 255
      dados.data[i + 2] = n & 255
      dados.data[i + 3] = marca ? 235 : 0
    }
  }
  p.putImageData(dados, 0, 0)
  const padrao = ctx.createPattern(cv, 'repeat')
  padroes.set(cor, padrao)
  return padrao
}

function desenhar() {
  const el = tela.value
  if (!el) return
  const ctx = el.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, LADO_TELA, LADO_TELA)
  ctx.imageSmoothingEnabled = false
  if (arte) ctx.drawImage(arte, 0, 0, LADO_TELA, LADO_TELA)

  if (props.overlay) desenharOverlay(ctx)
  desenharGrade(ctx)

  if (sobre.value >= 0) {
    ctx.strokeStyle = '#f2a93b'
    ctx.lineWidth = 2
    ctx.strokeRect(colunaDe(sobre.value) * ZOOM + 1, linhaDe(sobre.value) * ZOOM + 1, ZOOM - 2, ZOOM - 2)
  }
}

function desenharOverlay(ctx: CanvasRenderingContext2D) {
  for (let i = 0; i < PIXELS; i++) {
    const regiao = regiaoDoCodigo(props.pixels[i] ?? '.')
    if (!regiao) continue
    const x = colunaDe(i) * ZOOM
    const y = linhaDe(i) * ZOOM
    const cor = COR_REGIAO[regiao]
    const corrigido = props.base[i] !== undefined && props.base[i] !== props.pixels[i]
    const palpite = !corrigido && (props.confianca[i] === 'v' || props.confianca[i] === 'f')

    if (palpite) {
      const padrao = padraoHachura(ctx, cor)
      ctx.fillStyle = padrao ?? comAlfa(cor, 0.5)
      ctx.fillRect(x, y, ZOOM, ZOOM)
    } else {
      ctx.fillStyle = comAlfa(cor, corrigido ? 0.78 : 0.6)
      ctx.fillRect(x, y, ZOOM, ZOOM)
    }
  }

  // borda: cada região sai contornada, senão o translúcido se mistura com a
  // arte embaixo e ninguém sabe onde uma região termina
  ctx.lineWidth = 1
  for (let i = 0; i < PIXELS; i++) {
    const regiao = regiaoDoCodigo(props.pixels[i] ?? '.')
    if (!regiao) continue
    const coluna = colunaDe(i)
    const linha = linhaDe(i)
    const x = coluna * ZOOM
    const y = linha * ZOOM
    const corrigido = props.base[i] !== undefined && props.base[i] !== props.pixels[i]
    ctx.strokeStyle = corrigido ? 'rgba(242, 169, 59, 0.95)' : 'rgba(36, 28, 21, 0.8)'
    ctx.beginPath()
    if (linha === 0 || props.pixels[i - LADO] !== props.pixels[i]) {
      ctx.moveTo(x, y + 0.5)
      ctx.lineTo(x + ZOOM, y + 0.5)
    }
    if (linha === LADO - 1 || props.pixels[i + LADO] !== props.pixels[i]) {
      ctx.moveTo(x, y + ZOOM - 0.5)
      ctx.lineTo(x + ZOOM, y + ZOOM - 0.5)
    }
    if (coluna === 0 || props.pixels[i - 1] !== props.pixels[i]) {
      ctx.moveTo(x + 0.5, y)
      ctx.lineTo(x + 0.5, y + ZOOM)
    }
    if (coluna === LADO - 1 || props.pixels[i + 1] !== props.pixels[i]) {
      ctx.moveTo(x + ZOOM - 0.5, y)
      ctx.lineTo(x + ZOOM - 0.5, y + ZOOM)
    }
    ctx.stroke()
  }
}

function desenharGrade(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = 'rgba(36, 28, 21, 0.14)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let n = 1; n < LADO; n++) {
    ctx.moveTo(n * ZOOM + 0.5, 0)
    ctx.lineTo(n * ZOOM + 0.5, LADO_TELA)
    ctx.moveTo(0, n * ZOOM + 0.5)
    ctx.lineTo(LADO_TELA, n * ZOOM + 0.5)
  }
  ctx.stroke()
}

function indiceDe(e: PointerEvent): number | null {
  const el = tela.value
  if (!el) return null
  return indiceDoPonto(el.getBoundingClientRect(), e.clientX, e.clientY)
}

function aoDescer(e: PointerEvent) {
  const i = indiceDe(e)
  if (i === null) return
  e.preventDefault()
  pintando = true
  ultimo = i
  tela.value?.setPointerCapture(e.pointerId)
  emit('pintar', i, false)
}

function aoMover(e: PointerEvent) {
  const i = indiceDe(e)
  sobre.value = i ?? -1
  if (!pintando || i === null || i === ultimo) return
  ultimo = i
  emit('pintar', i, true)
}

function aoSubir() {
  if (!pintando) return
  pintando = false
  ultimo = -1
  emit('fimTraco')
}

function aoSair() {
  sobre.value = -1
}

async function trocarArte() {
  arte = null
  desenhar()
  if (!props.sprite) return
  const url = props.sprite
  const img = await carregarImagem(url)
  if (props.sprite !== url) return
  arte = img
  desenhar()
}

onMounted(() => {
  void trocarArte()
})
watch(() => props.sprite, trocarArte)
watch(() => [props.pixels, props.confianca, props.base, props.overlay, sobre.value], desenhar)
</script>

<template>
  <div class="tm-caixa">
    <canvas
      ref="tela"
      class="tm-tela"
      :width="LADO_TELA"
      :height="LADO_TELA"
      aria-label="máscara do quadro — clique para pintar a região escolhida"
      @pointerdown="aoDescer"
      @pointermove="aoMover"
      @pointerup="aoSubir"
      @pointercancel="aoSubir"
      @pointerleave="aoSair"
    ></canvas>
  </div>
</template>

<style scoped>
/* xadrez creme escurecido — NUNCA grama: a cor da máscara se julga contra
   neutro, e o resultado se julga no preview sobre grama, ali do lado. */
.tm-caixa {
  display: inline-block;
  line-height: 0;
  border: 0.125rem solid var(--tinta);
  box-shadow: var(--sombra-solida);
  background-color: #d8c7a4;
  background-image: conic-gradient(#c9b691 0 25%, #d8c7a4 0 50%, #c9b691 0 75%, #d8c7a4 0);
  background-size: 1rem 1rem;
}

.tm-tela {
  display: block;
  width: 8rem;
  height: 8rem;
  image-rendering: pixelated;
  cursor: crosshair;
  touch-action: none;
}
</style>
