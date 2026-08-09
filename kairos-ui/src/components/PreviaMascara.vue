<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { CoresAlvo } from '@/game/recolorir'
import { LADO } from '@/services/mascaras.pixels'
import { carregarImagem, contexto, recolorirComMascara, urlDoSprite } from '@/services/mascaras.assets'

const props = withDefaults(
  defineProps<{
    preset: string
    quadro: string
    /** Máscara em edição (256 chars) — não o PNG em disco. */
    pixels: string
    cores: CoresAlvo
    rotulo: string
    lado?: number
  }>(),
  { lado: 48 },
)

const tela = ref<HTMLCanvasElement | null>(null)

/* Pintar rápido dispara vários desenhos; sem o contador, um desenho lento
   chegando depois pinta por cima da pincelada mais nova. */
let geracao = 0

async function desenhar() {
  const el = tela.value
  if (!el) return
  const ctx = el.getContext('2d')
  if (!ctx) return
  const meu = ++geracao

  const url = urlDoSprite(props.preset, props.quadro)
  ctx.clearRect(0, 0, el.width, el.height)
  if (!url) return

  const img = await carregarImagem(url)
  if (meu !== geracao || tela.value !== el) return

  const fonte = contexto(LADO, LADO)
  if (!fonte) return
  fonte.drawImage(img, 0, 0, LADO, LADO)
  const arte = fonte.getImageData(0, 0, LADO, LADO)
  recolorirComMascara(arte, props.pixels, props.cores)
  fonte.putImageData(arte, 0, 0)

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(fonte.canvas, 0, 0, LADO, LADO, 0, 0, el.width, el.height)
}

onMounted(desenhar)
watch(
  () => [props.preset, props.quadro, props.pixels, props.cores.pele, props.cores.cabelo, props.cores.roupa].join('|'),
  desenhar,
)
</script>

<template>
  <figure class="pm-cel">
    <span class="pm-grama">
      <canvas ref="tela" class="pm-tela" :width="lado" :height="lado" aria-hidden="true"></canvas>
    </span>
    <figcaption class="pm-rotulo">{{ rotulo }}</figcaption>
  </figure>
</template>

<style scoped>
.pm-cel {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
}

/* o resultado se julga sobre a grama do mapa, que é onde o avatar vive */
.pm-grama {
  display: block;
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border: 0.125rem solid var(--tinta);
  background-color: #4fa05a;
  background-image: conic-gradient(#47934f 0 25%, #4fa05a 0 50%, #47934f 0 75%, #4fa05a 0);
  background-size: 2rem 2rem;
}

.pm-tela {
  position: absolute;
  left: 50%;
  bottom: 10%;
  transform: translateX(-50%);
  width: 3rem;
  height: 3rem;
  image-rendering: pixelated;
}

.pm-rotulo {
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
  line-height: 1;
}
</style>
