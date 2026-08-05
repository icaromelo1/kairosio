import rpgUrbanUrl from './tilemaps/rpg-urban.png'
import modernCityUrl from './tilemaps/modern-city.png'
import tinyTownUrl from './tilemaps/tiny-town.png'
import type { TileResultado } from './busca'

interface Atlas {
  url: string
  w: number
  h: number
}

const ATLAS_POR_PACK: Record<string, Atlas> = {
  'rpg-urban': { url: rpgUrbanUrl, w: 458, h: 305 },
  'modern-city': { url: modernCityUrl, w: 628, h: 475 },
  'tiny-town': { url: tinyTownUrl, w: 203, h: 186 },
}

const GAP = 1

export function estiloThumb(t: Pick<TileResultado, 'pack' | 'i' | 'cols' | 'tile'>, tamanho = 32): Record<string, string> {
  const atlas = ATLAS_POR_PACK[t.pack]
  if (!atlas) return {}
  const stride = t.tile + GAP
  const col = t.i % t.cols
  const row = Math.floor(t.i / t.cols)
  const escala = tamanho / t.tile
  return {
    width: `${tamanho}px`,
    height: `${tamanho}px`,
    backgroundImage: `url(${atlas.url})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${atlas.w * escala}px ${atlas.h * escala}px`,
    backgroundPosition: `-${col * stride * escala}px -${row * stride * escala}px`,
    imageRendering: 'pixelated',
  }
}
