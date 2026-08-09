<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Assets, type Texture } from 'pixi.js'
import { avatarSpriteUrl } from '@/game/pixi/avatar'
import { precisaRecolorir, temMascara, texturaRecolorida, type CoresAlvo } from '@/game/recolorir'

const props = withDefaults(
  defineProps<{
    preset: string
    direcao: 'baixo' | 'cima' | 'esquerda' | 'direita'
    rotulo: string
    cores?: CoresAlvo
    /** Quadro do ciclo de caminhada; 0 é o parado. */
    quadro?: 0 | 1 | 2
    /** Lado do bitmap interno em px — o tamanho na tela vem do CSS. */
    lado?: number
  }>(),
  { lado: 48, quadro: 0 },
)

interface Recorte {
  img: CanvasImageSource
  sx: number
  sy: number
  sw: number
  sh: number
}

/* Sai do mesmo motor que a cena usa (texturaRecolorida), não de uma segunda
   implementação de recoloração: se o preview divergir do jogo, a pessoa escolhe
   uma cor e recebe outra ao entrar no mapa. */
async function recorte(): Promise<Recorte | null> {
  const url = avatarSpriteUrl(props.preset, props.direcao, props.quadro)
  if (!url) return null
  const base = await Assets.load<Texture>(url)
  const quadro = `${props.direcao}-${props.quadro}`
  const cores = props.cores ?? {}

  if (precisaRecolorir(cores) && temMascara(props.preset, quadro)) {
    const pintada = await texturaRecolorida(base, props.preset, quadro, cores)
    const fonte = pintada?.source.resource as CanvasImageSource | undefined
    if (pintada && fonte) return { img: fonte, sx: 0, sy: 0, sw: pintada.width, sh: pintada.height }
  }

  const fonte = base.source.resource as CanvasImageSource | undefined
  if (!fonte) return null
  const q = base.frame
  return { img: fonte, sx: q.x, sy: q.y, sw: q.width, sh: q.height }
}

const tela = ref<HTMLCanvasElement | null>(null)

/* Trocar de cor rápido dispara vários desenhos; sem o contador, uma recoloração
   lenta chegando depois pinta por cima da escolha mais nova. */
let geracao = 0

async function desenhar() {
  const el = tela.value
  if (!el) return
  const ctx = el.getContext('2d')
  if (!ctx) return
  const meu = ++geracao
  const dados = await recorte()
  if (meu !== geracao || tela.value !== el) return
  ctx.clearRect(0, 0, el.width, el.height)
  if (!dados) return
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(dados.img, dados.sx, dados.sy, dados.sw, dados.sh, 0, 0, el.width, el.height)
}

onMounted(desenhar)
watch(
  () => [props.preset, props.direcao, props.quadro, props.cores?.pele, props.cores?.cabelo, props.cores?.roupa].join('|'),
  desenhar,
)
</script>

<template>
  <figure class="av-cel">
    <span class="av-grama">
      <canvas ref="tela" class="av-tela" :width="lado" :height="lado" aria-hidden="true"></canvas>
    </span>
    <figcaption class="av-rotulo">{{ rotulo }}</figcaption>
  </figure>
</template>

<style scoped>
.av-cel {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
}

/* xadrez de 2rem (32px) nos dois verdes da grama do mapa: a cor do avatar se
   julga sobre o fundo em que ele vive, não sobre o creme do painel. */
.av-grama {
  display: block;
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border: 0.125rem solid var(--tinta);
  background-color: #4fa05a;
  background-image: conic-gradient(#47934f 0 25%, #4fa05a 0 50%, #47934f 0 75%, #4fa05a 0);
  background-size: 4rem 4rem;
}

.av-tela {
  position: absolute;
  left: 50%;
  bottom: 10%;
  transform: translateX(-50%);
  width: 3rem;
  height: 3rem;
  image-rendering: pixelated;
}

.av-rotulo {
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
  line-height: 1;
}
</style>
