<template>
  <canvas
    ref="tela"
    class="mm-tela"
    :title="sudo ? 'clique para ir · dois cliques para teleportar' : 'clique para ir até lá'"
    @click="aoClicar"
    @dblclick="aoDuploClique"
  />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { paredesDe } from '@/mundo/grade'
import { pecaDe, pegadaDe } from '@/mundo/mobilia'
import type { Mapa } from '@/mundo/tipos'

interface Ponto {
  x: number
  y: number
  falando?: boolean
}

const props = defineProps<{
  mapa: Mapa
  ladoMaximo: number
  posicoes: () => { eu: Ponto; outros: Ponto[] }
  trancadas: Set<string>
  sudo?: boolean
}>()

const emit = defineEmits<{ ir: [x: number, y: number]; teleportar: [x: number, y: number] }>()

const CORES_DE_AREA: Record<string, string> = {
  caminho: '#d9c49a', pedra: '#cfc6b4', deck: '#b98c5e', agua: '#6fb6dc', terra: '#a07a52', grama: '#7fb35c',
}

const tela = ref<HTMLCanvasElement | null>(null)
let fundo: HTMLCanvasElement | null = null
let escala = 1
let quadro = 0
let ultimo = 0
let cliqueAdiado = 0

function desenharFundo() {
  const mapa = props.mapa
  escala = props.ladoMaximo / Math.max(mapa.largura, mapa.profundidade)
  const largura = Math.round(mapa.largura * escala)
  const altura = Math.round(mapa.profundidade * escala)
  const razao = window.devicePixelRatio || 1
  fundo = document.createElement('canvas')
  fundo.width = largura * razao
  fundo.height = altura * razao
  const g = fundo.getContext('2d')!
  g.scale(razao, razao)
  g.fillStyle = mapa.piso
  g.fillRect(0, 0, largura, altura)
  for (const area of mapa.areas ?? []) {
    g.fillStyle = CORES_DE_AREA[area.tipo] ?? '#ccc'
    if (area.forma === 'circulo') {
      g.beginPath()
      g.ellipse(area.x * escala, area.y * escala, (area.largura / 2) * escala, (area.profundidade / 2) * escala, 0, 0, Math.PI * 2)
      g.fill()
    } else {
      g.fillRect((area.x - area.largura / 2) * escala, (area.y - area.profundidade / 2) * escala, area.largura * escala, area.profundidade * escala)
    }
  }
  for (const sala of [...mapa.salas].sort((a, b) => b.largura * b.profundidade - a.largura * a.profundidade)) {
    g.fillStyle = sala.piso
    g.fillRect(sala.x * escala, sala.y * escala, sala.largura * escala, sala.profundidade * escala)
  }
  g.fillStyle = 'rgba(36, 28, 21, 0.45)'
  for (const movel of mapa.mobilia) {
    if (!pecaDe(movel)?.solida) continue
    const { largura: l, profundidade: p } = pegadaDe(movel)
    g.fillRect((movel.x - l / 2) * escala, (movel.y - p / 2) * escala, Math.max(1, l * escala), Math.max(1, p * escala))
  }
  for (const parede of paredesDe(mapa)) {
    g.strokeStyle = parede.externa ? '#3f7a35' : '#5a4a36'
    g.lineWidth = parede.externa ? 3 : 2
    g.beginPath()
    if (parede.horizontal) {
      g.moveTo(parede.inicio * escala, parede.linha * escala)
      g.lineTo(parede.fim * escala, parede.linha * escala)
    } else {
      g.moveTo(parede.linha * escala, parede.inicio * escala)
      g.lineTo(parede.linha * escala, parede.fim * escala)
    }
    g.stroke()
  }
  if (tela.value) {
    tela.value.width = largura * razao
    tela.value.height = altura * razao
    tela.value.style.width = `${largura}px`
    tela.value.style.height = `${altura}px`
  }
}

function desenhar(agora: number) {
  quadro = requestAnimationFrame(desenhar)
  if (agora - ultimo < 100 || !tela.value || !fundo) return
  ultimo = agora
  const g = tela.value.getContext('2d')!
  const razao = window.devicePixelRatio || 1
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.drawImage(fundo, 0, 0)
  g.scale(razao, razao)
  for (const sala of props.mapa.salas) {
    if (!props.trancadas.has(sala.id)) continue
    g.strokeStyle = '#a83232'
    g.lineWidth = 2
    g.setLineDash([4, 3])
    g.strokeRect(sala.x * escala + 1, sala.y * escala + 1, sala.largura * escala - 2, sala.profundidade * escala - 2)
    g.setLineDash([])
  }
  const { eu, outros } = props.posicoes()
  for (const p of outros) {
    g.fillStyle = p.falando ? '#f2a93b' : '#2a4d8f'
    g.beginPath()
    g.arc(p.x * escala, p.y * escala, 3.5, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#2c7441'
  g.strokeStyle = '#fff6e0'
  g.lineWidth = 2
  g.beginPath()
  g.arc(eu.x * escala, eu.y * escala, 4.5, 0, Math.PI * 2)
  g.fill()
  g.stroke()
}

function pontoDo(e: MouseEvent): { x: number; y: number } {
  const caixa = tela.value!.getBoundingClientRect()
  return { x: (e.clientX - caixa.left) / escala, y: (e.clientY - caixa.top) / escala }
}

function aoClicar(e: MouseEvent) {
  const { x, y } = pontoDo(e)
  window.clearTimeout(cliqueAdiado)
  cliqueAdiado = window.setTimeout(() => emit('ir', x, y), props.sudo ? 250 : 0)
}

function aoDuploClique(e: MouseEvent) {
  if (!props.sudo) return
  window.clearTimeout(cliqueAdiado)
  const { x, y } = pontoDo(e)
  emit('teleportar', x, y)
}

watch(() => [props.mapa, props.ladoMaximo], desenharFundo)

onMounted(() => {
  desenharFundo()
  quadro = requestAnimationFrame(desenhar)
})

onUnmounted(() => {
  cancelAnimationFrame(quadro)
  window.clearTimeout(cliqueAdiado)
})
</script>

<style scoped>
.mm-tela {
  display: block;
  cursor: crosshair;
  image-rendering: auto;
}
</style>
