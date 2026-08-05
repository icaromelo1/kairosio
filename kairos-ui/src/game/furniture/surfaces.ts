import { Container, Graphics, GraphicsContext, Sprite, TilingSprite, Texture, type Renderer } from 'pixi.js'
import type { MapObject } from '../maps'

const arquivosSvg = import.meta.glob('./svg-surface/*.svg', { query: '?raw', import: 'default', eager: true })

const SVG_POR_KIND: Record<string, string> = {}
for (const [caminho, conteudo] of Object.entries(arquivosSvg)) {
  const kind = caminho.split('/').pop()?.replace(/\.svg$/, '')
  if (kind && typeof conteudo === 'string') SVG_POR_KIND[kind] = conteudo
}

const texturaSvgCache = new Map<string, Texture | null>()

function obterTexturaSvg(kind: string, renderer: Renderer): Texture | null {
  const emCache = texturaSvgCache.get(kind)
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
  texturaSvgCache.set(kind, tex)
  return tex
}

const arquivosPeca = import.meta.glob('./superficie/*/*.png', { query: '?url', import: 'default', eager: true })

const PECAS_POR_KIND: Record<string, Record<string, string>> = {}
for (const [caminho, url] of Object.entries(arquivosPeca)) {
  const partes = caminho.split('/')
  const kind = partes[2]
  const peca = partes[3]?.replace(/\.png$/, '')
  if (!kind || !peca || typeof url !== 'string') continue
  PECAS_POR_KIND[kind] = PECAS_POR_KIND[kind] || {}
  PECAS_POR_KIND[kind][peca] = url
}

export function superficieUrls(): string[] {
  return Object.values(PECAS_POR_KIND).flatMap((m) => Object.values(m))
}

const COR_FALLBACK: Record<string, number> = {
  wall: 0x2b2b38,
}

export function temSuperficie(kind: string): boolean {
  return kind in PECAS_POR_KIND || kind in SVG_POR_KIND || kind in COR_FALLBACK
}

interface Expostas {
  t: boolean
  r: boolean
  b: boolean
  l: boolean
}

function pecaParaMascara(kind: string, expostas: Expostas): string | undefined {
  const pecas = PECAS_POR_KIND[kind]
  if (!pecas) return undefined

  const { t, r, b, l } = expostas
  let tentativas: string[]

  if (t && r && b && l) tentativas = ['isolated', 'mid']
  else if (t && l && !r && !b) tentativas = ['tl']
  else if (t && r && !l && !b) tentativas = ['tr']
  else if (b && l && !r && !t) tentativas = ['bl']
  else if (b && r && !l && !t) tentativas = ['br']
  else if (t && !r && !b && !l) tentativas = ['top']
  else if (b && !r && !t && !l) tentativas = ['bottom']
  else if (l && !t && !r && !b) tentativas = ['left']
  else if (r && !t && !b && !l) tentativas = ['right']
  else if (l && r && !t && !b) tentativas = ['vstrip', 'mid']
  else if (t && b && !l && !r) tentativas = ['hstrip', 'mid']
  else if (t && l && b && !r) tentativas = ['cap-left', 'left']
  else if (t && r && b && !l) tentativas = ['cap-right', 'right']
  else if (t && l && r && !b) tentativas = ['cap-top', 'top']
  else if (l && r && b && !t) tentativas = ['cap-bottom', 'bottom']
  else tentativas = ['mid']

  for (const nome of tentativas) {
    const url = pecas[nome]
    if (url) return url
  }
  return undefined
}

function criarSpritePeca(url: string, w: number, h: number): Sprite | null {
  let textura: Texture
  try {
    textura = Texture.from(url)
  } catch {
    return null
  }
  if (!textura) return null
  const s = new Sprite(textura)
  s.texture.source.scaleMode = 'nearest'
  s.width = w
  s.height = h
  return s
}

function criarPecaFallback(kind: string, renderer: Renderer, w: number, h: number): TilingSprite | Graphics | null {
  const tex = obterTexturaSvg(kind, renderer)
  if (tex) {
    const sprite = new TilingSprite({ texture: tex, width: w, height: h })
    sprite.tileScale.set(w / tex.width, h / tex.height)
    return sprite
  }

  const cor = COR_FALLBACK[kind]
  if (cor !== undefined) {
    const g = new Graphics()
    g.rect(0, 0, w, h).fill({ color: cor })
    return g
  }
  return null
}

function vizinhoIgual(o: MapObject, irmaos: MapObject[] | undefined, x: number, y: number): boolean {
  if (!irmaos) return false
  for (const outro of irmaos) {
    if (outro === o || outro.kind !== o.kind) continue
    const ox = Math.round(outro.x)
    const oy = Math.round(outro.y)
    if (x >= ox && x < ox + Math.round(outro.w) && y >= oy && y < oy + Math.round(outro.h)) return true
  }
  return false
}

export function criarSuperficie(
  o: MapObject,
  renderer: Renderer,
  caixa: { x: number; y: number; w: number; h: number },
  tilePx: number,
  irmaos?: MapObject[],
): Container | null {
  if (!temSuperficie(o.kind)) return null

  const cols = Number.isFinite(o.w) && o.w > 0 ? Math.round(o.w) : 1
  const rows = Number.isFinite(o.h) && o.h > 0 ? Math.round(o.h) : 1
  const tileW = caixa.w / cols || tilePx
  const tileH = caixa.h / rows || tilePx

  const raiz = new Container()
  raiz.position.set(caixa.x, caixa.y)

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const gx = Math.round(o.x) + tx
      const gy = Math.round(o.y) + ty
      const expostas: Expostas = {
        t: ty > 0 ? false : !vizinhoIgual(o, irmaos, gx, gy - 1),
        r: tx < cols - 1 ? false : !vizinhoIgual(o, irmaos, gx + 1, gy),
        b: ty < rows - 1 ? false : !vizinhoIgual(o, irmaos, gx, gy + 1),
        l: tx > 0 ? false : !vizinhoIgual(o, irmaos, gx - 1, gy),
      }

      const url = pecaParaMascara(o.kind, expostas)
      const peca = url ? criarSpritePeca(url, tileW, tileH) : criarPecaFallback(o.kind, renderer, tileW, tileH)
      if (!peca) continue

      peca.position.set(tx * tileW, ty * tileH)
      raiz.addChild(peca)
    }
  }

  return raiz.children.length ? raiz : null
}
