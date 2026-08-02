import { Graphics, GraphicsContext } from 'pixi.js'
import type { MapObject } from '../maps'

export type FurnitureVariant = 'vector' | 'mine' | 'agy'

const mineFiles = import.meta.glob('./svg-mine/*.svg', { query: '?raw', import: 'default', eager: true })
const agyFiles = import.meta.glob('./svg-agy/*.svg', { query: '?raw', import: 'default', eager: true })

function indexar(files: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [path, conteudo] of Object.entries(files)) {
    const kind = path.split('/').pop()?.replace(/\.svg$/, '')
    if (kind && typeof conteudo === 'string') out[kind] = conteudo
  }
  return out
}

const SVG_POR_VARIANTE: Record<Exclude<FurnitureVariant, 'vector'>, Record<string, string>> = {
  mine: indexar(mineFiles),
  agy: indexar(agyFiles),
}

const contextCache = new Map<string, GraphicsContext | null>()

function obterContext(kind: string, variante: Exclude<FurnitureVariant, 'vector'>): GraphicsContext | null {
  const chave = `${variante}:${kind}`
  const emCache = contextCache.get(chave)
  if (emCache !== undefined) return emCache

  const svg = SVG_POR_VARIANTE[variante][kind]
  let ctx: GraphicsContext | null = null
  if (svg) {
    try {
      ctx = new GraphicsContext().svg(svg)
    } catch {
      ctx = null
    }
  }
  contextCache.set(chave, ctx)
  return ctx
}

export function temSvg(kind: string, variante: FurnitureVariant): boolean {
  if (variante === 'vector') return false
  return obterContext(kind, variante) !== null
}

export function criarSvgGraphics(
  o: MapObject,
  variante: FurnitureVariant,
  caixa: { x: number; y: number; w: number; h: number },
): Graphics | null {
  if (variante === 'vector') return null
  const ctx = obterContext(o.kind, variante)
  if (!ctx) return null

  const g = new Graphics(ctx)
  g.scale.set(caixa.w / 100, caixa.h / 100)
  g.position.set(caixa.x, caixa.y)
  return g
}

export const DEBUG_BANDAS = {
  ativo: true,
  linhaY: 60,
  colunaX: 60,
}

export function varianteParaObjeto(o: MapObject): FurnitureVariant {
  if (!DEBUG_BANDAS.ativo) return 'mine'
  if (o.y < DEBUG_BANDAS.linhaY) return 'vector'
  return o.x < DEBUG_BANDAS.colunaX ? 'mine' : 'agy'
}
