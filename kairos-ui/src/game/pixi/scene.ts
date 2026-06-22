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
  chair: { color: 0x5a4a32, alpha: 1 },
  sofa: { color: 0x6b4a3a, alpha: 1 },
}
const DEFAULT_STYLE = { color: 0x2a2a3a, alpha: 1 }

const GLOW: Record<NonNullable<MapObject['glow']>, number> = {
  purple: 0x7c3aed,
  cyan: 0x22d3ee,
  gold: 0xfbbf24,
  green: 0x34d399,
}

// objetos "em pé" (billboards) — contra-giram com a câmera pra não ficar de cabeça pra baixo.
// os de fora (rug/water/path/grass/panel/flower) são "de chão" e giram com o piso.
const UPRIGHT_KINDS = new Set<MapObject['kind']>([
  'desk', 'board', 'jukebox', 'servers', 'shelf', 'plant', 'tree', 'fountain',
  'bench', 'lamp', 'table', 'column', 'chair', 'sofa', 'hedge', 'custom',
])

export class MapScene {
  app: Application
  /** Container da câmera — move-se ao contrário do alvo pra dar o follow. */
  world: Container
  private floorLayer: Container
  private objectLayer: Container
  private avatarLayer: Container
  private ghostLayer: Container
  private avatars = new Map<string, AvatarPuppet>()
  // containers dos objetos "em pé" que contra-giram com a câmera
  private uprightObjects: { c: Container; own: number }[] = []
  map: MapDef | null = null

  constructor() {
    this.app = new Application()
    this.world = new Container()
    this.floorLayer = new Container()
    this.objectLayer = new Container()
    this.avatarLayer = new Container()
    this.ghostLayer = new Container()
  }

  async init(host: HTMLElement, background = '#0d0d14') {
    await this.app.init({ background, resizeTo: host, antialias: false })
    host.appendChild(this.app.canvas)
    this.world.addChild(this.floorLayer, this.objectLayer, this.ghostLayer, this.avatarLayer)
    this.app.stage.addChild(this.world)
  }

  setMap(map: MapDef) {
    this.map = map
    this.floorLayer.removeChildren()
    this.objectLayer.removeChildren()
    this.uprightObjects = []

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
    if (o.pixels && o.pixels.length) {
      // objeto customizado: desenha a matriz de pixels escalada
      const rows = o.pixels.length
      const cols = o.pixels[0]?.length || 1
      const cw = w / cols
      const ch = h / rows
      for (let ry = 0; ry < rows; ry++) {
        for (let cc = 0; cc < cols; cc++) {
          const col = o.pixels[ry][cc]
          if (col) g.rect(x + cc * cw, y + ry * ch, cw + 0.5, ch + 0.5).fill(col)
        }
      }
    } else if (o.color) {
      shape(g).fill(o.color)
    } else {
      const st = OBJECT_STYLE[o.kind] ?? DEFAULT_STYLE
      shape(g).fill({ color: st.color, alpha: st.alpha })
      if (!circle) g.rect(x, y, w, Math.max(3, h * 0.18)).fill({ color: 0xffffff, alpha: 0.05 })
    }

    // detalhe por tipo (não em objetos customizados)
    if (!o.pixels) this.drawDetail(g, o, { x, y, w, h, cx, cy, r })

    if (o.glow && o.name) {
      shape(g).stroke({ width: 2, color: GLOW[o.glow], alpha: 0.75 })
    }
    const own = ((o.rotation || 0) * Math.PI) / 180
    const upright = UPRIGHT_KINDS.has(o.kind)
    if (upright || own) {
      const oc = new Container()
      oc.addChild(g)
      // billboard ancora na BASE do objeto (meio embaixo); chão gira no centro
      const baseX = upright ? cx : cx
      const baseY = upright ? y + h : cy
      oc.pivot.set(baseX, baseY)
      oc.position.set(baseX, baseY)
      oc.rotation = own + (upright ? -this.rotation : 0)
      this.objectLayer.addChild(oc)
      if (upright) this.uprightObjects.push({ c: oc, own })
    } else {
      this.objectLayer.addChild(g)
    }
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
      case 'chair':
      case 'sofa':
        // encosto no topo + assento
        g.rect(x, y, w, Math.max(4, h * 0.35)).fill({ color: 0x000000, alpha: 0.35 })
        g.rect(x + 2, y + h * 0.4, w - 4, h * 0.5).fill({ color: 0xffffff, alpha: 0.1 })
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

  private zoom = 1
  private rotation = 0 // radianos (0/90/180/270)

  setZoom(z: number) {
    this.zoom = Math.max(0.6, Math.min(2, z))
  }
  getZoom() {
    return this.zoom
  }
  /** Gira a câmera em passos de 90°. */
  rotateBy(deg: number) {
    this.rotation = ((this.rotation + (deg * Math.PI) / 180) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
  }
  getRotation() {
    return this.rotation
  }

  /** Centraliza a câmera no alvo (tiles), respeitando zoom e rotação. */
  follow(tileX: number, tileY: number) {
    if (!this.map) return
    const z = this.zoom
    const vw = this.app.renderer.width
    const vh = this.app.renderer.height
    this.world.scale.set(z)
    // objetos "em pé" contra-giram pra ficar de pé na rotação da câmera
    for (const u of this.uprightObjects) u.c.rotation = u.own - this.rotation
    if (this.rotation !== 0) {
      // rotação: gira em torno do avatar, sem clamp (centraliza nele)
      this.world.rotation = this.rotation
      this.world.pivot.set(tileX * TILE_PX, tileY * TILE_PX)
      this.world.position.set(vw / 2, vh / 2)
      // avatares contra-giram pra ficar em pé
      for (const p of this.avatars.values()) p.root.rotation = -this.rotation
      return
    }
    this.world.rotation = 0
    this.world.pivot.set(0, 0)
    for (const p of this.avatars.values()) p.root.rotation = 0
    const worldW = this.map.width * TILE_PX * z
    const worldH = this.map.height * TILE_PX * z
    let cx = vw / 2 - tileX * TILE_PX * z
    let cy = vh / 2 - tileY * TILE_PX * z
    cx = worldW > vw ? Math.min(0, Math.max(vw - worldW, cx)) : (vw - worldW) / 2
    cy = worldH > vh ? Math.min(0, Math.max(vh - worldH, cy)) : (vh - worldH) / 2
    this.world.position.set(Math.round(cx), Math.round(cy))
  }

  /** Reordena avatares por Y pra dar profundidade (quem está mais embaixo, na frente). */
  sortAvatars() {
    this.avatarLayer.children.sort((a, b) => a.position.y - b.position.y)
  }

  /** Modo editor: enquadra o mapa inteiro na viewport (sem câmera que segue). */
  fit(margin = 24) {
    if (!this.map) return
    const vw = this.app.renderer.width
    const vh = this.app.renderer.height
    const worldW = this.map.width * TILE_PX
    const worldH = this.map.height * TILE_PX
    const scale = Math.min((vw - margin * 2) / worldW, (vh - margin * 2) / worldH, 2)
    this.world.scale.set(scale)
    this.world.position.set(
      Math.round((vw - worldW * scale) / 2),
      Math.round((vh - worldH * scale) / 2),
    )
  }

  /** Mostra um preview translúcido do objeto no tile (editor). */
  showGhost(tileX: number, tileY: number, w: number, h: number, color: string | number = 0x7c3aed, circle = false) {
    this.ghostLayer.removeChildren()
    const g = new Graphics()
    const x = tileX * TILE_PX
    const y = tileY * TILE_PX
    const ww = w * TILE_PX
    const hh = h * TILE_PX
    if (circle) g.circle(x + ww / 2, y + hh / 2, Math.min(ww, hh) / 2).fill({ color, alpha: 0.45 })
    else g.rect(x, y, ww, hh).fill({ color, alpha: 0.45 })
    g.rect(x, y, ww, hh).stroke({ width: 1, color: 0xffffff, alpha: 0.6 })
    this.ghostLayer.addChild(g)
  }
  clearGhost() {
    this.ghostLayer.removeChildren()
  }

  /** Converte coordenadas de clique (clientX/Y) em coordenadas de TILE. */
  screenToTile(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.app.canvas.getBoundingClientRect()
    const s = this.world.scale.x || 1
    return {
      x: Math.floor((clientX - rect.left - this.world.position.x) / (TILE_PX * s)),
      y: Math.floor((clientY - rect.top - this.world.position.y) / (TILE_PX * s)),
    }
  }

  destroy() {
    for (const p of this.avatars.values()) p.destroy()
    this.avatars.clear()
    this.app.destroy(true)
  }
}
