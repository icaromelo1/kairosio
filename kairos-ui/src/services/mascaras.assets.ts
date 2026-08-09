// Ponte entre os arquivos estáticos (PNG das máscaras, sprites, confianca.json)
// e a string de 256 caracteres que a tela edita e a API grava.
import confiancaJson from '@/game/furniture/avatar-mascaras/confianca.json'
import { avatarSpriteUrl } from '@/game/pixi/avatar'
import { aplicarCores, type CoresAlvo } from '@/game/recolorir.core'
import {
  LADO,
  MASCARA_VAZIA,
  QUADROS,
  chaveDe,
  direcaoDe,
  passoDe,
  regiaoDoCodigo,
} from './mascaras.pixels'

const MASCARAS = import.meta.glob('../game/furniture/avatar-mascaras/*/*.png', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

const urlPorChave = new Map<string, string>()
for (const [caminho, url] of Object.entries(MASCARAS)) {
  const partes = caminho.split('/')
  const preset = partes[partes.length - 2]
  const quadro = partes[partes.length - 1].replace(/\.png$/, '')
  urlPorChave.set(`${preset}/${quadro}`, url)
}

const confianca = confiancaJson as Record<string, string>

export function confiancaDe(preset: string, quadro: string): string {
  return confianca[chaveDe(preset, quadro)] ?? MASCARA_VAZIA
}

export function urlDoSprite(preset: string, quadro: string): string {
  return avatarSpriteUrl(preset, direcaoDe(quadro), passoDe(quadro))
}

const imagens = new Map<string, Promise<HTMLImageElement>>()

export function carregarImagem(url: string): Promise<HTMLImageElement> {
  const pronta = imagens.get(url)
  if (pronta) return pronta
  const carga = new Promise<HTMLImageElement>((ok, erro) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = erro
    img.src = url
  })
  imagens.set(url, carga)
  return carga
}

export function contexto(largura: number, altura: number): CanvasRenderingContext2D | null {
  const cv = document.createElement('canvas')
  cv.width = largura
  cv.height = altura
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  if (ctx) ctx.imageSmoothingEnabled = false
  return ctx
}

// mesma classificação de cor que o motor de recoloração usa (regiaoDoPixel em
// game/recolorir.ts): vermelho=pele, verde=cabelo, azul=roupa, branco=contorno
function codigoDoPixel(d: Uint8ClampedArray, i: number): string {
  if (d[i + 3] < 128) return '.'
  const r = d[i]
  const g = d[i + 1]
  const b = d[i + 2]
  if (r > 200 && g > 200 && b > 200) return 'o'
  if (r > 200) return 'p'
  if (g > 200) return 'c'
  if (b > 200) return 'r'
  return '.'
}

export async function lerMascaraBase(preset: string, quadro: string): Promise<string> {
  const url = urlPorChave.get(chaveDe(preset, quadro))
  if (!url) return MASCARA_VAZIA
  const img = await carregarImagem(url)
  const ctx = contexto(LADO, LADO)
  if (!ctx) return MASCARA_VAZIA
  ctx.drawImage(img, 0, 0, LADO, LADO)
  const dados = ctx.getImageData(0, 0, LADO, LADO).data
  let saida = ''
  for (let i = 0; i < dados.length; i += 4) saida += codigoDoPixel(dados, i)
  return saida
}

// os 72 quadros de uma vez: a fila por pior confiança e o progresso global
// n/72 precisam de todo mundo decodificado antes da primeira decisão
export async function lerTodasAsBases(presets: string[]): Promise<Map<string, string>> {
  const chaves: { preset: string; quadro: string }[] = []
  for (const preset of presets) for (const quadro of QUADROS) chaves.push({ preset, quadro })
  const lidas = await Promise.all(chaves.map((c) => lerMascaraBase(c.preset, c.quadro)))
  const mapa = new Map<string, string>()
  chaves.forEach((c, i) => mapa.set(chaveDe(c.preset, c.quadro), lidas[i]))
  return mapa
}

/**
 * Recolore a arte 16x16 usando a máscara EM EDIÇÃO (string), não o PNG em disco —
 * é o que faz o preview reagir à pincelada. A conta é a mesma do motor do jogo
 * (recolorir.core), inclusive o contorno seguindo a vizinhança: duas cópias da
 * regra já divergiram antes e o editor passaria a mentir sobre o resultado.
 */
export function recolorirComMascara(arte: ImageData, pixels: string, cores: CoresAlvo): void {
  aplicarCores(arte, (p) => regiaoDoCodigo(pixels[p] ?? '.'), cores)
}
