import { Assets, Rectangle, Sprite, Texture } from 'pixi.js'
import { superficieUrls } from './surfaces'


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
  // os tilesheets entram aqui também: criarSpriteDeTile usa Texture.from, que no
  // Pixi 8 só lê o cache — sem carregar, todo objeto com tileRef caía calado no
  // desenho antigo em vez da arte. São 56 KB no total
  const urls = [
    ...Object.values(PNG_POR_PACK).flatMap((m) => Object.values(m)),
    ...superficieUrls(),
    ...tilemapUrls(),
  ]
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

const tilemapFiles = import.meta.glob('./tilemaps/*.png', { query: '?url', import: 'default', eager: true })

const TILEMAP_POR_PACK: Record<string, string> = {}
for (const [caminho, url] of Object.entries(tilemapFiles)) {
  const pack = caminho.split('/').pop()?.replace(/\.png$/, '')
  if (pack && typeof url === 'string') TILEMAP_POR_PACK[pack] = url
}

export function tilemapUrls(): string[] {
  return Object.values(TILEMAP_POR_PACK)
}

export function criarSpriteDeTile(
  ref: { pack: string; i: number; cols: number; tile: number },
  caixa: { x: number; y: number; w: number; h: number },
): Sprite | null {
  const url = TILEMAP_POR_PACK[ref.pack]
  if (!url) return null
  let base: Texture
  try {
    base = Texture.from(url)
  } catch {
    return null
  }
  if (!base) return null
  const passo = ref.tile + 1
  const col = ref.i % ref.cols
  const lin = Math.floor(ref.i / ref.cols)
  const recorte = new Rectangle(col * passo, lin * passo, ref.tile, ref.tile)
  const textura = new Texture({ source: base.source, frame: recorte })
  textura.source.scaleMode = 'nearest'
  const s = new Sprite(textura)
  s.position.set(caixa.x, caixa.y)
  s.width = caixa.w
  s.height = caixa.h
  return s
}
