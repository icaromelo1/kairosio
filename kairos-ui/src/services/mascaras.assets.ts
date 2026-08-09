// Ponte entre os arquivos estáticos (PNG das máscaras, sprites, confianca.json)
// e a string de 256 caracteres que a tela edita e a API grava.
import confiancaJson from '@/game/furniture/avatar-mascaras/confianca.json'
import { avatarSpriteUrl } from '@/game/pixi/avatar'
import type { CoresAlvo } from '@/game/recolorir'
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

function hexParaRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminancia(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

function rgbParaHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
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

const RAMPA_BAIXO = 0.55
const RAMPA_CIMA = 1.35

/**
 * Recolore a arte 16x16 usando a máscara EM EDIÇÃO (string), não o PNG em
 * disco — é o que faz o preview reagir à pincelada. Mesma rampa de luminância
 * do motor do jogo (game/recolorir.ts), que lê a máscara do arquivo e por isso
 * não serviria aqui: mostraria a máscara antiga.
 */
export function recolorirComMascara(arte: ImageData, pixels: string, cores: CoresAlvo): void {
  const alvo: Record<string, [number, number, number] | null> = {
    pele: cores.pele ? hexParaRgb(cores.pele) : null,
    cabelo: cores.cabelo ? hexParaRgb(cores.cabelo) : null,
    roupa: cores.roupa ? hexParaRgb(cores.roupa) : null,
  }

  const faixa: Record<string, { min: number; max: number }> = {}
  for (let i = 0, p = 0; i < arte.data.length; i += 4, p++) {
    if (arte.data[i + 3] < 128) continue
    const regiao = regiaoDoCodigo(pixels[p] ?? '.')
    if (!regiao || regiao === 'contorno' || !alvo[regiao]) continue
    const l = luminancia(arte.data[i], arte.data[i + 1], arte.data[i + 2])
    const f = faixa[regiao] ?? { min: 1, max: 0 }
    f.min = Math.min(f.min, l)
    f.max = Math.max(f.max, l)
    faixa[regiao] = f
  }

  for (let i = 0, p = 0; i < arte.data.length; i += 4, p++) {
    if (arte.data[i + 3] < 128) continue
    const regiao = regiaoDoCodigo(pixels[p] ?? '.')
    if (!regiao || regiao === 'contorno') continue
    const cor = alvo[regiao]
    const f = faixa[regiao]
    if (!cor || !f) continue
    const [h0, s0, l0] = rgbParaHsl(cor[0], cor[1], cor[2])
    const l = luminancia(arte.data[i], arte.data[i + 1], arte.data[i + 2])
    const proporcao = f.max > f.min ? (l - f.min) / (f.max - f.min) : 0.5
    const baixo = l0 * RAMPA_BAIXO
    const cima = Math.min(1, l0 * RAMPA_CIMA)
    const [r, g, b] = hslParaRgb(h0, s0, baixo + proporcao * (cima - baixo))
    arte.data[i] = r
    arte.data[i + 1] = g
    arte.data[i + 2] = b
  }
}
