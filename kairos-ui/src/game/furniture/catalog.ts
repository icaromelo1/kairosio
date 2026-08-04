import { Assets, Graphics, GraphicsContext, Sprite, Texture } from 'pixi.js'
import type { MapObject } from '../maps'

const svgFiles = import.meta.glob('./svg/*.svg', { query: '?raw', import: 'default', eager: true })

const SVG_POR_KIND: Record<string, string> = {}
for (const [path, conteudo] of Object.entries(svgFiles)) {
  const kind = path.split('/').pop()?.replace(/\.svg$/, '')
  if (kind && typeof conteudo === 'string') SVG_POR_KIND[kind] = conteudo
}

const contextCache = new Map<string, GraphicsContext | null>()

function obterContext(kind: string): GraphicsContext | null {
  const emCache = contextCache.get(kind)
  if (emCache !== undefined) return emCache

  const svg = SVG_POR_KIND[kind]
  let ctx: GraphicsContext | null = null
  if (svg) {
    try {
      ctx = new GraphicsContext().svg(svg)
    } catch {
      ctx = null
    }
  }
  contextCache.set(kind, ctx)
  return ctx
}

function viewBoxDe(kind: string): { w: number; h: number } {
  const svg = SVG_POR_KIND[kind]
  const m = svg && /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)
  return m ? { w: parseFloat(m[1]), h: parseFloat(m[2]) } : { w: 100, h: 100 }
}

export function temSvg(kind: string): boolean {
  return obterContext(kind) !== null
}

export function criarSvgGraphics(
  o: MapObject,
  caixa: { x: number; y: number; w: number; h: number },
): Graphics | null {
  const ctx = obterContext(o.kind)
  if (!ctx) return null

  const vb = viewBoxDe(o.kind)
  const g = new Graphics(ctx)
  g.scale.set(caixa.w / vb.w, caixa.h / vb.h)
  g.position.set(caixa.x, caixa.y)
  return g
}

const pngFiles = import.meta.glob('./kenney/*.png', { query: '?url', import: 'default', eager: true })

const PNG_POR_PACK: Record<string, Record<string, string>> = {}
for (const [path, url] of Object.entries(pngFiles)) {
  const partes = path.split('/')
  const pack = partes[1]
  const kind = partes[2]?.replace(/\.png$/, '')
  if (!pack || !kind || typeof url !== 'string') continue
  PNG_POR_PACK[pack] = PNG_POR_PACK[pack] || {}
  PNG_POR_PACK[pack][kind] = url
}

export function packsDisponiveis(): string[] {
  return Object.keys(PNG_POR_PACK)
}

export async function carregarPacks(): Promise<void> {
  const urls = Object.values(PNG_POR_PACK).flatMap((m) => Object.values(m))
  if (!urls.length) return
  await Assets.load(urls)
}

export function criarSpriteDoPack(
  kind: string,
  pack: string,
  caixa: { x: number; y: number; w: number; h: number },
): Sprite | null {
  const url = PNG_POR_PACK[pack]?.[kind]
  if (!url) return null
  let textura: Texture
  try {
    textura = Texture.from(url)
  } catch {
    return null
  }
  if (!textura) return null
  const s = new Sprite(textura)
  s.texture.source.scaleMode = 'nearest'
  s.position.set(caixa.x, caixa.y)
  s.width = caixa.w
  s.height = caixa.h
  return s
}
