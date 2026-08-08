import { Texture } from 'pixi.js'

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

export type Regiao = 'pele' | 'cabelo' | 'roupa' | 'contorno'

export interface CoresAlvo {
  pele?: string | null
  cabelo?: string | null
  roupa?: string | null
}

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

function luminancia(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

function hexParaRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbParaHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return [h, s, l]
}

function hslParaRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const canal = (t: number) => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return [
    Math.round(canal(h + 1 / 3) * 255),
    Math.round(canal(h) * 255),
    Math.round(canal(h - 1 / 3) * 255),
  ]
}

// a rampa abre em torno da luminância da cor pedida: dá espaço para sombra e
// luz sem estourar nem apagar
const RAMPA_BAIXO = 0.55
const RAMPA_CIMA = 1.35

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

  const alvo: Record<string, [number, number, number] | null> = {
    pele: cores.pele ? hexParaRgb(cores.pele) : null,
    cabelo: cores.cabelo ? hexParaRgb(cores.cabelo) : null,
    roupa: cores.roupa ? hexParaRgb(cores.roupa) : null,
  }

  // primeiro passo: descobrir a faixa de luminância que cada região ocupa hoje,
  // para o remapeamento respeitar a proporção original de sombra e luz
  const faixa: Record<string, { min: number; max: number }> = {}
  for (let i = 0; i < arte.data.length; i += 4) {
    if (arte.data[i + 3] < 128) continue
    const regiao = regiaoDoPixel(mascara.data, i)
    if (!regiao || regiao === 'contorno' || !alvo[regiao]) continue
    const l = luminancia(arte.data[i], arte.data[i + 1], arte.data[i + 2])
    const f = faixa[regiao] ?? { min: 1, max: 0 }
    f.min = Math.min(f.min, l)
    f.max = Math.max(f.max, l)
    faixa[regiao] = f
  }

  for (let i = 0; i < arte.data.length; i += 4) {
    if (arte.data[i + 3] < 128) continue
    const regiao = regiaoDoPixel(mascara.data, i)
    if (!regiao || regiao === 'contorno') continue
    const cor = alvo[regiao]
    const f = faixa[regiao]
    if (!cor || !f) continue

    const [h0, s0, l0] = rgbParaHsl(cor[0], cor[1], cor[2])
    const l = luminancia(arte.data[i], arte.data[i + 1], arte.data[i + 2])
    // região de tom único não tem proporção a preservar: vai direto na cor
    const p = f.max > f.min ? (l - f.min) / (f.max - f.min) : 0.5
    const baixo = l0 * RAMPA_BAIXO
    const cima = Math.min(1, l0 * RAMPA_CIMA)
    const [r, g, b] = hslParaRgb(h0, s0, baixo + p * (cima - baixo))
    arte.data[i] = r
    arte.data[i + 1] = g
    arte.data[i + 2] = b
  }

  ctx.putImageData(arte, 0, 0)
  const textura = Texture.from(ctx.canvas)
  textura.source.scaleMode = 'nearest'
  cacheTextura.set(chave, textura)
  return textura
}
