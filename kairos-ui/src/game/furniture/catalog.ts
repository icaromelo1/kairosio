import { Graphics, GraphicsContext } from 'pixi.js'
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
