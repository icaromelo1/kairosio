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

const OBJECT_STYLE: Partial<Record<MapObject['kind'], { color: number; alpha: number }>> = {
  desk: { color: 0x2a2440, alpha: 1 },
  board: { color: 0x14323a, alpha: 1 },
  jukebox: { color: 0x2a1f3a, alpha: 1 },
  servers: { color: 0x1a1430, alpha: 1 },
  shelf: { color: 0x2a2418, alpha: 1 },
  table: { color: 0x352b1a, alpha: 1 },
  fountain: { color: 0x2563a8, alpha: 1 },
}
const DEFAULT_STYLE = { color: 0x2a2a3a, alpha: 1 }

const GLOW: Record<NonNullable<MapObject['glow']>, number> = {
  purple: 0x7c3aed,
  cyan: 0x22d3ee,
  gold: 0xfbbf24,
  green: 0x34d399,
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
    const circle = o.shape === 'circle'
    const cx = x + w / 2
    const cy = y + h / 2
    const r = Math.min(w, h) / 2

    const shape = (gg: Graphics) => (circle ? gg.circle(cx, cy, r) : gg.rect(x, y, w, h))

    // base
    if (o.color) {
      shape(g).fill(o.color)
    } else {
      const st = OBJECT_STYLE[o.kind] ?? DEFAULT_STYLE
      shape(g).fill({ color: st.color, alpha: st.alpha })
      if (!circle) g.rect(x, y, w, Math.max(3, h * 0.18)).fill({ color: 0xffffff, alpha: 0.05 })
    }

    // detalhe por tipo — dá caráter (tronco, água, pernas, livros, etc.)
    this.drawDetail(g, o, { x, y, w, h, cx, cy, r })

    if (o.glow && o.name) {
      shape(g).stroke({ width: 2, color: GLOW[o.glow], alpha: 0.75 })
    }
    this.objectLayer.addChild(g)
  }

  private drawDetail(
    g: Graphics,
    o: MapObject,
    b: { x: number; y: number; w: number; h: number; cx: number; cy: number; r: number },
  ) {
    const { x, y, w, h, cx, cy, r } = b
    switch (o.kind) {
      case 'tree':
        // copa com luz + tronco saindo embaixo
        g.circle(cx, cy, r).fill({ color: 0x000000, alpha: 0.18 })
        g.circle(cx - r * 0.25, cy - r * 0.25, r * 0.55).fill({ color: 0xffffff, alpha: 0.12 })
        g.rect(cx - 3, cy + r * 0.7, 6, r * 0.6).fill({ color: 0x3a2a18 })
        break
      case 'fountain':
        // anéis de água
        g.circle(cx, cy, r * 0.66).fill({ color: 0x3b82c4, alpha: 0.9 })
        g.circle(cx, cy, r * 0.32).fill({ color: 0x7cc4f0, alpha: 0.9 })
        g.circle(cx - r * 0.2, cy - r * 0.2, r * 0.12).fill({ color: 0xffffff, alpha: 0.5 })
        break
      case 'desk':
      case 'table':
        // tampo + pernas
        g.rect(x, y, w, Math.max(4, h * 0.22)).fill({ color: 0xffffff, alpha: 0.08 })
        g.rect(x + 2, y + h - 6, 5, 6).fill({ color: 0x000000, alpha: 0.4 })
        g.rect(x + w - 7, y + h - 6, 5, 6).fill({ color: 0x000000, alpha: 0.4 })
        break
      case 'shelf': {
        // lombadas de livros coloridas
        const books = [0x7c3aed, 0xfbbf24, 0x22d3ee, 0x34d399, 0xf87171, 0xa78bfa, 0xfb923c]
        const n = Math.max(3, Math.floor(w / 10))
        for (let i = 0; i < n; i++) {
          g.rect(x + 4 + i * ((w - 8) / n), y + 4, (w - 8) / n - 2, h - 8).fill({ color: books[i % books.length], alpha: 0.85 })
        }
        break
      }
      case 'jukebox':
        g.circle(cx, y + h * 0.4, Math.min(w, h) * 0.22).fill({ color: 0x000000, alpha: 0.55 })
        g.circle(cx, y + h * 0.4, 2).fill({ color: 0xfb923c })
        break
      case 'servers':
        for (let i = 0; i < 5; i++) {
          g.rect(x + 4, y + 5 + i * ((h - 8) / 5), w - 8, 2).fill({ color: 0x34d399, alpha: 0.8 })
        }
        break
      case 'plant':
        g.rect(x, y + h * 0.6, w, h * 0.4).fill({ color: 0x6b4a2a })
        g.circle(cx, y + h * 0.35, Math.min(w, h) * 0.4).fill({ color: 0x34944a, alpha: 0.9 })
        break
      case 'flower':
        g.circle(x + w * 0.3, y + h * 0.4, 3).fill({ color: 0xffffff, alpha: 0.5 })
        g.circle(x + w * 0.7, y + h * 0.6, 3).fill({ color: 0xffffff, alpha: 0.5 })
        break
      case 'bench':
        g.rect(x, y, w, Math.max(3, h * 0.4)).fill({ color: 0xffffff, alpha: 0.1 })
        break
      case 'lamp':
        g.circle(cx, cy, r * 1.6).fill({ color: 0xfbbf24, alpha: 0.12 })
        g.circle(cx, cy, Math.max(2, r * 0.4)).fill({ color: 0xfde68a })
        break
      default:
        break
    }
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
