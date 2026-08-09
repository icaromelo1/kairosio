import { Texture } from 'pixi.js'
import { aplicarCores, type CoresAlvo, type Regiao } from './recolorir.core'

export type { CoresAlvo, Regiao }

// Recoloração por região, com rampa de luminância.
//
// Trocar cor por índice não funciona neste sprite: #8d5243 aparece nas quatro
// regiões do ruivo-verde ao mesmo tempo — é contorno de cabelo, sombra de rosto
// e sombra de roupa. Trocar "cor do cabelo" por índice repintaria tudo junto.
//
// A máscara diz a região de cada pixel. Dentro da região, os tons são ordenados
// por luminância e remapeados na rampa da cor-alvo: o mais escuro continua o
// mais escuro, o mais claro continua o mais claro. É isso que preserva sombra e
// luz em vez de achatar a região numa cor chapada.

const MASCARAS = import.meta.glob('./furniture/avatar-mascaras/*/*.png', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

const urlDaMascara = new Map<string, string>()
for (const [caminho, url] of Object.entries(MASCARAS)) {
  const partes = caminho.split('/')
  const preset = partes[partes.length - 2]
  const quadro = partes[partes.length - 1].replace(/\.png$/, '')
  urlDaMascara.set(`${preset}/${quadro}`, url)
}

const cacheMascara = new Map<string, ImageData | null>()
const cacheTextura = new Map<string, Texture>()

function contexto(w: number, h: number): CanvasRenderingContext2D | null {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  if (ctx) ctx.imageSmoothingEnabled = false
  return ctx
}

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, erro) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = erro
    img.src = url
  })
}

async function lerMascara(chave: string): Promise<ImageData | null> {
  if (cacheMascara.has(chave)) return cacheMascara.get(chave) ?? null
  const url = urlDaMascara.get(chave)
  if (!url) {
    cacheMascara.set(chave, null)
    return null
  }
  const img = await carregarImagem(url)
  const ctx = contexto(img.width, img.height)
  if (!ctx) return null
  ctx.drawImage(img, 0, 0)
  const dados = ctx.getImageData(0, 0, img.width, img.height)
  cacheMascara.set(chave, dados)
  return dados
}

function regiaoDoPixel(m: Uint8ClampedArray, i: number): Regiao | null {
  if (m[i + 3] < 128) return null
  const r = m[i], g = m[i + 1], b = m[i + 2]
  if (r > 200 && g > 200 && b > 200) return 'contorno'
  if (r > 200) return 'pele'
  if (g > 200) return 'cabelo'
  if (b > 200) return 'roupa'
  return null
}

function chaveDe(preset: string, quadro: string, cores: CoresAlvo): string {
  return `${preset}/${quadro}|${cores.pele ?? ''}|${cores.cabelo ?? ''}|${cores.roupa ?? ''}`
}

export function temMascara(preset: string, quadro: string): boolean {
  return urlDaMascara.has(`${preset}/${quadro}`)
}

export function precisaRecolorir(cores: CoresAlvo): boolean {
  return !!(cores.pele || cores.cabelo || cores.roupa)
}

/**
 * Devolve a textura recolorida, ou null quando não há máscara ou nada a trocar.
 * O resultado fica em cache pela combinação preset+quadro+cores — sem isso a
 * conta rodaria a cada quadro de animação.
 */
export async function texturaRecolorida(
  base: Texture,
  preset: string,
  quadro: string,
  cores: CoresAlvo,
): Promise<Texture | null> {
  if (!precisaRecolorir(cores)) return null
  const chave = chaveDe(preset, quadro, cores)
  const pronta = cacheTextura.get(chave)
  if (pronta) return pronta

  const mascara = await lerMascara(`${preset}/${quadro}`)
  if (!mascara) return null

  const fonte = base.source.resource as CanvasImageSource | undefined
  if (!fonte) return null
  const w = mascara.width
  const h = mascara.height
  const ctx = contexto(w, h)
  if (!ctx) return null
  ctx.drawImage(fonte, 0, 0, w, h)
  const arte = ctx.getImageData(0, 0, w, h)

  aplicarCores(arte, (p) => regiaoDoPixel(mascara.data, p * 4), cores)

  ctx.putImageData(arte, 0, 0)
  const textura = Texture.from(ctx.canvas)
  textura.source.scaleMode = 'nearest'
  cacheTextura.set(chave, textura)
  return textura
}
