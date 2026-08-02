import { Graphics, GraphicsContext, TilingSprite, Texture, type Renderer } from 'pixi.js'
import type { MapObject } from '../maps'

const arquivos = import.meta.glob('./svg-surface/*.svg', { query: '?raw', import: 'default', eager: true })

const SVG_POR_KIND: Record<string, string> = {}
for (const [caminho, conteudo] of Object.entries(arquivos)) {
  const kind = caminho.split('/').pop()?.replace(/\.svg$/, '')
  if (kind && typeof conteudo === 'string') SVG_POR_KIND[kind] = conteudo
}

const texturaCache = new Map<string, Texture | null>()

function obterTextura(kind: string, renderer: Renderer): Texture | null {
  const emCache = texturaCache.get(kind)
  if (emCache !== undefined) return emCache

  const svg = SVG_POR_KIND[kind]
  let tex: Texture | null = null
  if (svg) {
    try {
      const g = new Graphics(new GraphicsContext().svg(svg))
      tex = renderer.generateTexture({ target: g, resolution: 1 })
      g.destroy()
    } catch {
      tex = null
    }
  }
  texturaCache.set(kind, tex)
  return tex
}

export function temSuperficie(kind: string): boolean {
  return kind in SVG_POR_KIND
}

export function criarSuperficie(
  o: MapObject,
  renderer: Renderer,
  caixa: { x: number; y: number; w: number; h: number },
  tilePx: number,
): TilingSprite | null {
  const tex = obterTextura(o.kind, renderer)
  if (!tex) return null

  const sprite = new TilingSprite({ texture: tex, width: caixa.w, height: caixa.h })
  sprite.position.set(caixa.x, caixa.y)
  sprite.tileScale.set(tilePx / tex.width, tilePx / tex.height)
  return sprite
}
