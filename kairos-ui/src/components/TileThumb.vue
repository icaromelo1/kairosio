<script lang="ts">
import { Assets } from 'pixi.js'
import { tilemapUrls } from '@/game/furniture/catalog'

let carga: Promise<unknown> | null = null

/* Estado de MÓDULO (por isso o segundo bloco <script>): `Texture.from(url)` só
   enxerga o que já está no cache do Assets, e a cena nunca carrega os tilesheets
   — carregarPacks() só pega os PNGs soltos do Kenney e as superfícies. Sem isto,
   criarSpriteDeTile devolve null e a miniatura sai vazia. Uma carga por página,
   compartilhada por todas as miniaturas. */
export function tilemapsCarregados(): Promise<unknown> {
  if (!carga) carga = Assets.load(tilemapUrls())
  return carga
}
</script>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { criarSpriteDeTile } from '@/game/furniture/catalog'

const props = withDefaults(
  defineProps<{
    peca: { pack: string; i: number; cols: number; tile: number }
    /** Lado do bitmap interno em px — o tamanho na tela vem do CSS do pai. */
    lado?: number
  }>(),
  { lado: 64 },
)

const tela = ref<HTMLCanvasElement | null>(null)
const vazio = ref(false)

/* O recorte vem de criarSpriteDeTile — a mesma função que a cena usa pra
   desenhar o objeto no mapa. Assim a miniatura não pode divergir do que vai
   aparecer no mundo (o caminho antigo repetia a aritmética de recorte e ainda
   guardava a largura/altura de cada atlas na mão). */
async function desenhar() {
  const el = tela.value
  if (!el) return
  await tilemapsCarregados()
  const ctx = el.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, el.width, el.height)

  const sprite = criarSpriteDeTile(props.peca, { x: 0, y: 0, w: props.lado, h: props.lado })
  if (!sprite) {
    vazio.value = true
    return
  }
  const textura = sprite.texture
  const fonte = textura.source.resource as CanvasImageSource | null
  const q = textura.frame
  if (fonte) {
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(fonte, q.x, q.y, q.width, q.height, 0, 0, el.width, el.height)
    vazio.value = false
  } else {
    vazio.value = true
  }
  sprite.destroy()
  textura.destroy(false)
}

onMounted(desenhar)
watch(() => `${props.peca.pack}:${props.peca.i}`, desenhar)
</script>

<template>
  <span class="tt-raiz">
    <canvas ref="tela" class="tt-tela" :width="lado" :height="lado" aria-hidden="true"></canvas>
    <span v-if="vazio" class="tt-vazio" aria-hidden="true">?</span>
  </span>
</template>

<style scoped>
.tt-raiz {
  display: block;
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  line-height: 0;
}

.tt-tela {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

.tt-vazio {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: var(--f-sans);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  color: var(--text-3);
}
</style>
