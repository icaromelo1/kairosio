// Renderer de mapa no PixiJS (Épico 1b/1c) — desenha um MapDef (piso, paredes,
// objetos) a partir do schema de dados e hospeda os avatares numa camada com
// câmera que segue um alvo. Reutilizável tanto no preview /lab quanto no /game.

import { Application, Container, Graphics } from 'pixi.js'
import type { MapDef, MapObject } from '../maps'
import type { AvatarPuppet } from './avatar'

// tamanho de um tile em px na tela (independe do schema, que conta em tiles)
export const TILE_PX = 40

function hexNum(c: string, fallback: number): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim())
  return m ? parseInt(m[1], 16) : fallback
}

const OBJECT_STYLE: Record<MapObject['kind'], { color: number; alpha: number }> = {
  desk: { color: 0x2a2440, alpha: 1 },
  board: { color: 0x14323a, alpha: 1 },
  jukebox: { color: 0x2a1f3a, alpha: 1 },
  servers: { color: 0x1a1430, alpha: 1 },
  shelf: { color: 0x2a2418, alpha: 1 },
  rug: { color: 0x000000, alpha: 0 },
  panel: { color: 0x000000, alpha: 0 },
  grass: { color: 0x000000, alpha: 0 },
}

const GLOW: Record<NonNullable<MapObject['glow']>, number> = {
  purple: 0x7c3aed,
  cyan: 0x22d3ee,
  gold: 0xfbbf24,
}

export class MapScene {
  app: Application
  /** Container da câmera — move-se ao contrário do alvo pra dar o follow. */
  world: Container
  private floorLayer: Container
  private objectLayer: Container
  private avatarLayer: Container
  private avatars = new Map<string, AvatarPuppet>()
  map: MapDef | null = null

  constructor() {
    this.app = new Application()
    this.world = new Container()
    this.floorLayer = new Container()
    this.objectLayer = new Container()
    this.avatarLayer = new Container()
  }

  async init(host: HTMLElement, background = '#0d0d14') {
    await this.app.init({ background, resizeTo: host, antialias: false })
    host.appendChild(this.app.canvas)
    this.world.addChild(this.floorLayer, this.objectLayer, this.avatarLayer)
    this.app.stage.addChild(this.world)
  }

  setMap(map: MapDef) {
    this.map = map
    this.floorLayer.removeChildren()
    this.objectLayer.removeChildren()

    const pal = map.palette
    const floorA = hexNum(pal.floor[0], 0x1a1a26)
    const floorB = hexNum(pal.floor[1], 0x1d1d2a)
    const wall = hexNum(pal.wall, 0x0d0d14)
    const wallTop = hexNum(pal.wallTop, 0x252535)

    const g = new Graphics()
    // piso quadriculado
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const isWall = x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1
        const color = isWall ? wall : (x + y) % 2 === 0 ? floorA : floorB
        g.rect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX).fill({ color })
      }
    }
    // topo das paredes (faixa superior) dá um respiro 2.5D
    g.rect(0, 0, map.width * TILE_PX, TILE_PX).fill({ color: wallTop })
    this.floorLayer.addChild(g)

    // objetos
    for (const o of map.objects) this.drawObject(o)
  }

  private drawObject(o: MapObject) {
    const g = new Graphics()
    const x = o.x * TILE_PX
    const y = o.y * TILE_PX
    const w = o.w * TILE_PX
    const h = o.h * TILE_PX

    if (o.color) {
      // cenário (rug/panel/grass): Pixi aceita a string rgba() direto
      g.rect(x, y, w, h).fill(o.color)
    } else {
      const st = OBJECT_STYLE[o.kind]
      g.rect(x, y, w, h).fill({ color: st.color, alpha: st.alpha })
      g.rect(x, y, w, Math.max(3, h * 0.18)).fill({ color: 0xffffff, alpha: 0.05 })
    }

    if (o.glow && o.name) {
      g.rect(x, y, w, h).stroke({ width: 2, color: GLOW[o.glow], alpha: 0.7 })
    }
    this.objectLayer.addChild(g)
  }

  addAvatar(id: string, puppet: AvatarPuppet) {
    this.avatars.set(id, puppet)
    this.avatarLayer.addChild(puppet.root)
  }

  removeAvatar(id: string) {
    const p = this.avatars.get(id)
    if (p) {
      this.avatarLayer.removeChild(p.root)
      p.destroy()
      this.avatars.delete(id)
    }
  }

  avatar(id: string): AvatarPuppet | undefined {
    return this.avatars.get(id)
  }

  /** Posiciona um avatar em coordenadas de TILE (float). */
  placeAvatar(id: string, tileX: number, tileY: number) {
    const p = this.avatars.get(id)
    if (p) p.root.position.set(tileX * TILE_PX, tileY * TILE_PX)
  }

  /** Centraliza a câmera no alvo (tiles), com clamp nas bordas do mapa. */
  follow(tileX: number, tileY: number) {
    if (!this.map) return
    const vw = this.app.renderer.width
    const vh = this.app.renderer.height
    const worldW = this.map.width * TILE_PX
    const worldH = this.map.height * TILE_PX
    let cx = vw / 2 - tileX * TILE_PX
    let cy = vh / 2 - tileY * TILE_PX
    // não mostra além das bordas (quando o mapa cabe, centraliza)
    cx = worldW > vw ? Math.min(0, Math.max(vw - worldW, cx)) : (vw - worldW) / 2
    cy = worldH > vh ? Math.min(0, Math.max(vh - worldH, cy)) : (vh - worldH) / 2
    this.world.position.set(Math.round(cx), Math.round(cy))
  }

  /** Reordena avatares por Y pra dar profundidade (quem está mais embaixo, na frente). */
  sortAvatars() {
    this.avatarLayer.children.sort((a, b) => a.position.y - b.position.y)
  }

  destroy() {
    for (const p of this.avatars.values()) p.destroy()
    this.avatars.clear()
    this.app.destroy(true)
  }
}
