// Renderer de mapa no PixiJS (Épico 1b/1c) — desenha um MapDef (piso, paredes,
// objetos) a partir do schema de dados e hospeda os avatares numa camada com

import { Application, Container, Graphics, Text } from 'pixi.js'
import type { MapDef, MapObject } from '../maps'
import { criarSvgGraphics, varianteParaObjeto } from '../furniture/catalog'
import { criarSuperficie, temSuperficie } from '../furniture/surfaces'
import type { AvatarPuppet } from './avatar'
import { estadoDeLuz, type EstadoLuz } from '../lighting'
import { Minimap } from './minimap'

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

// objetos "em pé" (billboards) — ficam ancorados na base e entram na entityLayer
// ordenada por Y (profundidade). os de fora (rug/water/path/grass/panel/flower)
// são "de chão" e ficam na camada de baixo.
const UPRIGHT_KINDS = new Set<MapObject['kind']>([
  'desk', 'board', 'jukebox', 'servers', 'shelf', 'plant', 'tree', 'fountain',
  'bench', 'lamp', 'table', 'column', 'chair', 'sofa', 'hedge', 'wall', 'custom',
])


export class MapScene {
  app: Application
  /** Container da câmera — move-se ao contrário do alvo pra dar o follow. */
  world: Container
  private floorLayer: Container
  private objectLayer: Container // objetos "de chão" (rug/água/caminho/grama) — sempre embaixo
  private shadowLayer: Container // sombras dos objetos em pé (no chão, não giram)
  private entityLayer: Container // objetos em pé + avatares, ordenados por Y (profundidade)
  private roofLayer: Container
  private areas: { x: number; y: number; w: number; h: number }[] = []
  private areaAtual = -1
  private dentroDeCobertura = false
  private pulso = 0
  private lightingLayer: Container
  private darkness: Graphics | null = null
  private lightPools: Graphics | null = null
  private playerLight: Graphics | null = null
  private luz: EstadoLuz = estadoDeLuz()
  private minimap: Minimap
  private ghostLayer: Container
  private avatars = new Map<string, AvatarPuppet>()
  private jukeboxIcons: Container[] = [] // notas ♪ sobre objetos jukebox — visíveis só enquanto toca
  map: MapDef | null = null

  constructor() {
    this.app = new Application()
    this.world = new Container()
    this.floorLayer = new Container()
    this.objectLayer = new Container()
    this.shadowLayer = new Container()
    this.entityLayer = new Container()
    this.entityLayer.sortableChildren = true // ordena por zIndex (= Y da base)
    this.ghostLayer = new Container()
    this.minimap = new Minimap()
    this.roofLayer = new Container()
    this.roofLayer.eventMode = 'none'
    this.lightingLayer = new Container()
    this.lightingLayer.eventMode = 'none'
  }

  async init(host: HTMLElement, background = '#0d0d14') {
    await this.app.init({ background, resizeTo: host, antialias: false })
    host.appendChild(this.app.canvas)
    this.world.addChild(this.floorLayer, this.objectLayer, this.shadowLayer, this.entityLayer, this.roofLayer, this.lightingLayer, this.ghostLayer)
    this.app.stage.addChild(this.world)
    this.app.stage.addChild(this.minimap.root)
    this.minimap.posicionar(this.app.screen.width, this.app.screen.height)
    this.app.renderer.on('resize', () => {
      this.setZoom(this.zoom)
      this.minimap.posicionar(this.app.screen.width, this.app.screen.height)
    })
    this.app.ticker.add(() => {
      this.pulso += this.app.ticker.deltaMS / 1000
      this.aplicarPulso()
    })
  }

  // removeChildren no Pixi 8 NÃO destrói — sem destroy explícito, cada troca de
  // mapa (e cada ghost do editor) vazava Graphics/geometria na GPU
  private clearLayer(layer: Container) {
    for (const child of layer.removeChildren()) child.destroy({ children: true })
  }

  setMap(map: MapDef) {
    this.map = map
    this.clearLayer(this.floorLayer)
    this.clearLayer(this.objectLayer)
    this.clearLayer(this.shadowLayer)
    this.clearLayer(this.roofLayer)
    this.areas = []
    this.areaAtual = -1
    // a entityLayer mistura objetos do mapa (descartáveis) com os avatares (vivos)
    const avatarRoots = new Set<Container>()
    for (const p of this.avatars.values()) avatarRoots.add(p.root)
    for (const child of this.entityLayer.removeChildren()) {
      if (!avatarRoots.has(child as Container)) child.destroy({ children: true })
    }
    this.jukeboxIcons = []
    // re-adiciona os avatares (ficam na entityLayer junto com objetos em pé)
    for (const p of this.avatars.values()) this.entityLayer.addChild(p.root)

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
        void 0
        g.rect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX).fill({ color })
      }
    }
    // topo das paredes (faixa superior) dá um respiro 2.5D
    g.rect(0, 0, map.width * TILE_PX, TILE_PX).fill({ color: wallTop })
    this.floorLayer.addChild(g)

    // objetos
    for (const o of map.objects) this.drawObject(o)

    this.setZoom(this.zoom)
    this.montarIluminacao(map)
    this.minimap.construir(map)
    this.minimap.posicionar(this.app.screen.width, this.app.screen.height)
  }

  // Modelo Gather: dentro de uma área, o lado de fora escurece; fora, os
  // interiores escurecem. Regiões não se sobrepõem, então o multiply não empilha.
  private redesenharMascara() {
    const map = this.map
    const dark = this.darkness
    if (!map || !dark) return

    const mw = map.width * TILE_PX
    const mh = map.height * TILE_PX
    const M = TILE_PX
    dark.clear()

    const dentro = this.areaAtual >= 0 ? this.areas[this.areaAtual] : null

    if (dentro) {
      const ax = dentro.x * TILE_PX
      const ay = dentro.y * TILE_PX
      const aw = dentro.w * TILE_PX
      const ah = dentro.h * TILE_PX
      // escurecer exige cor ESCURA: multiply por quase-branco (o tom do céu de dia)
      // não altera nada — o tint só tinge, quem escurece é o valor baixo do canal.
      const fora = { cor: 0x1b2030, alpha: Math.max(this.luz.alpha, 0.62) }
      dark.rect(-M, -M, mw + M * 2, ay + M).fill({ color: fora.cor, alpha: fora.alpha })
      dark.rect(-M, ay + ah, mw + M * 2, mh - ay - ah + M).fill({ color: fora.cor, alpha: fora.alpha })
      dark.rect(-M, ay, ax + M, ah).fill({ color: fora.cor, alpha: fora.alpha })
      dark.rect(ax + aw, ay, mw - ax - aw + M, ah).fill({ color: fora.cor, alpha: fora.alpha })
      dark.rect(ax, ay, aw, ah).fill({ color: 0xffe6bd, alpha: 0.1 })
      return
    }

    dark.rect(-M, -M, mw + M * 2, mh + M * 2).fill({ color: this.luz.tint, alpha: this.luz.alpha })
    for (const a of this.areas) {
      dark
        .rect(a.x * TILE_PX, a.y * TILE_PX, a.w * TILE_PX, a.h * TILE_PX)
        .fill({ color: 0x0d1020, alpha: 0.5 })
    }
  }

  private montarIluminacao(map: MapDef) {
    this.clearLayer(this.lightingLayer)
    this.darkness = null
    this.lightPools = null
    this.playerLight = null

    const mundoW = map.width * TILE_PX
    const mundoH = map.height * TILE_PX

    void mundoW
    void mundoH
    const dark = new Graphics()
    dark.blendMode = 'multiply'
    this.lightingLayer.addChild(dark)
    this.darkness = dark

    const pools = new Graphics()
    pools.blendMode = 'add'
    for (const o of map.objects) {
      if (o.kind !== 'lamp' && o.kind !== 'jukebox') continue
      const cx = (o.x + o.w / 2) * TILE_PX
      const cy = (o.y + o.h / 2) * TILE_PX
      this.desenharPoca(pools, cx, cy, TILE_PX * 3.6, 0xffd9a0)
    }
    this.lightingLayer.addChild(pools)
    this.lightPools = pools

    const pl = new Graphics()
    pl.blendMode = 'add'
    this.desenharPoca(pl, 0, 0, TILE_PX * 4.2, 0xbfd4ff)
    this.lightingLayer.addChild(pl)
    this.playerLight = pl

    this.aplicarLuz()
  }

  // poça de luz por círculos concêntricos — o alpha cai do centro pra borda.
  // gradiente de verdade exigiria textura; a aproximação some no blur do add.
  private desenharPoca(g: Graphics, cx: number, cy: number, raio: number, cor: number) {
    const passos = 7
    for (let i = passos; i >= 1; i--) {
      const t = i / passos
      g.circle(cx, cy, raio * t).fill({ color: cor, alpha: 0.055 * (1 - t) + 0.02 })
    }
  }

  // respiração das poças de luz — duas senoides fora de fase, pra não parecer
  // um piscar mecânico. amplitude some junto com a luz durante o dia.
  private aplicarPulso() {
    if (!this.lightPools && !this.playerLight) return
    const base = this.luz.raioLuz
    if (base <= 0.001) return
    const onda = 1 + Math.sin(this.pulso * 1.7) * 0.05 + Math.sin(this.pulso * 0.6) * 0.03
    if (this.lightPools) this.lightPools.alpha = base * onda
    if (this.playerLight) this.playerLight.alpha = base * 0.8 * (2 - onda)
  }

  private aplicarLuz() {
    this.redesenharMascara()
    // interior tem luz acesa a qualquer hora — o sistema precisa ser visível de dia
    const forca = this.areaAtual >= 0 ? Math.max(this.luz.raioLuz, 0.75) : this.luz.raioLuz
    if (this.lightPools) this.lightPools.alpha = forca
    if (this.playerLight) this.playerLight.alpha = forca * 0.8
  }

  atualizarLuz(hora?: number) {
    this.luz = estadoDeLuz(hora)
    this.aplicarLuz()
  }

  estadoLuz(): EstadoLuz {
    return this.luz
  }

  atualizarMinimapa(eu: { x: number; y: number }, outros: { x: number; y: number }[]) {
    this.minimap.atualizar(eu, outros)
  }

  mostrarMinimapa(v: boolean) {
    this.minimap.root.visible = v
  }

  posicionarLuzDoJogador(x: number, y: number) {
    if (this.playerLight) this.playerLight.position.set(x * TILE_PX, y * TILE_PX)

    let idx = -1
    for (let i = 0; i < this.areas.length; i++) {
      const a = this.areas[i]
      if (x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h) { idx = i; break }
    }
    if (idx !== this.areaAtual) {
      this.areaAtual = idx
      this.dentroDeCobertura = idx >= 0
      this.aplicarLuz()
    }
  }

  estaDentro(): boolean {
    return this.dentroDeCobertura
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

    if (o.kind === 'area') {
      this.areas.push({ x: o.x, y: o.y, w: o.w, h: o.h })
      return
    }

    if (o.kind === 'door') {
      const porta = new Graphics()
      porta.rect(x, y, w, h).fill({ color: 0x3a2f1e })
      porta.rect(x, y, w, Math.max(3, h * 0.18)).fill({ color: 0x6b5636 })
      porta.rect(x + w * 0.5 - 2, y + h * 0.45, 4, 4).fill({ color: 0xffd9a0 })
      porta.rect(x - w * 0.15, y - h * 0.12, w * 1.3, h * 0.16).fill({ color: 0x8c7ae6, alpha: 0.5 })
      this.roofLayer.addChild(porta)
      return
    }

    const variante = varianteParaObjeto(o)

    if (!o.pixels?.length && !o.color && variante !== 'vector' && temSuperficie(o.kind)) {
      const sup = criarSuperficie(o, this.app.renderer, { x, y, w, h }, TILE_PX)
      if (sup) {
        this.objectLayer.addChild(sup)
        return
      }
    }

    const svgG = o.pixels?.length ? null : criarSvgGraphics(o, variante, { x, y, w, h })

    if (svgG) {
      g.addChild(svgG)
      this.posicionarObjeto(o, g, { x, y, w, h, cx, cy, r })
      return
    }

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

    // hint de volume: topo mais claro + base mais escura sugerem "altura" (2.5D)
    if (UPRIGHT_KINDS.has(o.kind) && !o.pixels && !circle) {
      g.rect(x, y, w, Math.max(3, h * 0.2)).fill({ color: 0xffffff, alpha: 0.05 })
      g.rect(x, y + h * 0.74, w, h * 0.26).fill({ color: 0x000000, alpha: 0.2 })
    }

    if (o.glow && o.name) {
      shape(g).stroke({ width: 2, color: GLOW[o.glow], alpha: 0.75 })
    }
    if (o.kind === 'jukebox') {
      const note = new Text({ text: '♪', style: { fill: 0xfbbf24, fontSize: 16, fontWeight: 'bold' } })
      note.anchor.set(0.5)
      note.position.set(cx, y - 6)
      note.zIndex = 999999 // sempre por cima, é só um indicador de "tocando"
      note.visible = false
      this.entityLayer.addChild(note)
      this.jukeboxIcons.push(note)
    }

    this.posicionarObjeto(o, g, { x, y, w, h, cx, cy, r })
  }

  private posicionarObjeto(
    o: MapObject,
    g: Graphics,
    { y, w, h, cx, cy, r }: { x: number; y: number; w: number; h: number; cx: number; cy: number; r: number },
    sombraPropria = true,
  ) {
    const own = ((o.rotation || 0) * Math.PI) / 180
    const upright = UPRIGHT_KINDS.has(o.kind)
    if (upright) {
      // sombra elíptica no chão, na base (fica na shadowLayer, não gira/sobe)
      if (sombraPropria) {
        const sh = new Graphics()
        const shadowRx = o.kind === 'tree' ? r * 1.05 : w * 0.42
        sh.ellipse(cx, y + h, shadowRx, Math.max(4, h * 0.14)).fill({ color: 0x000000, alpha: 0.22 })
        this.shadowLayer.addChild(sh)
      }
      // billboard ancorado na BASE; vai pra entityLayer ordenada por Y
      const oc = new Container()
      oc.addChild(g)
      oc.pivot.set(cx, y + h)
      oc.position.set(cx, y + h)
      oc.rotation = own
      oc.zIndex = y + h // profundidade pela base
      this.entityLayer.addChild(oc)
    } else if (own) {
      const oc = new Container()
      oc.addChild(g)
      oc.pivot.set(cx, cy)
      oc.position.set(cx, cy)
      oc.rotation = own
      this.objectLayer.addChild(oc)
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
      case 'tree': {
        const trunkW = Math.max(3, r * 0.28)
        const trunkH = h * 0.5
        const trunkTop = y + h - trunkH
        g.rect(cx - trunkW / 2, trunkTop, trunkW, trunkH).fill({ color: 0x3a2a18 })
        g.rect(cx - trunkW / 2, trunkTop, trunkW * 0.45, trunkH).fill({ color: 0xffffff, alpha: 0.08 })
        const canopyCy = trunkTop + r * 0.35
        g.circle(cx, canopyCy, r).fill({ color: 0x000000, alpha: 0.18 })
        g.circle(cx, canopyCy, r * 0.9).fill({ color: 0x2f6b3a, alpha: 0.95 })
        g.circle(cx - r * 0.25, canopyCy - r * 0.25, r * 0.5).fill({ color: 0xffffff, alpha: 0.14 })
        break
      }
      case 'fountain':
        g.circle(cx, cy, r * 0.95).fill({ color: 0x000000, alpha: 0.15 })
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
        g.rect(x, y + h * 0.25, w, Math.max(3, h * 0.22)).fill({ color: 0xffffff, alpha: 0.12 })
        g.rect(x + 3, y + h - 6, 4, 6).fill({ color: 0x000000, alpha: 0.4 })
        g.rect(x + w - 7, y + h - 6, 4, 6).fill({ color: 0x000000, alpha: 0.4 })
        break
      case 'lamp': {
        const poleW = Math.max(2, w * 0.12)
        const poleH = h * 0.65
        const poleTop = y + h - poleH
        g.rect(cx - poleW / 2, poleTop, poleW, poleH).fill({ color: 0x3a3a42 })
        const headR = Math.max(4, r * 0.55)
        const headCy = poleTop - headR * 0.3
        g.circle(cx, headCy, headR * 2.2).fill({ color: 0xfbbf24, alpha: 0.12 })
        g.rect(cx - headR * 0.6, poleTop - headR * 0.4, headR * 1.2, headR * 0.5).fill({ color: 0x3a3a42 })
        g.circle(cx, headCy, headR).fill({ color: 0xfde68a })
        break
      }
      case 'column': {
        const shaftW = Math.max(4, w * 0.45)
        const capH = Math.max(3, h * 0.08)
        const baseH = Math.max(3, h * 0.1)
        g.rect(x, y, w, capH).fill({ color: 0xffffff, alpha: 0.15 })
        g.rect(cx - shaftW / 2, y + capH, shaftW, h - capH - baseH).fill({ color: 0xffffff, alpha: 0.06 })
        g.rect(x, y + h - baseH, w, baseH).fill({ color: 0x000000, alpha: 0.25 })
        break
      }
      case 'hedge': {
        const bumps = Math.max(3, Math.floor(w / 14))
        for (let i = 0; i < bumps; i++) {
          const bx = x + (i + 0.5) * (w / bumps)
          g.circle(bx, y + h * 0.3, (w / bumps) * 0.62).fill({ color: 0x2f6b3a, alpha: 0.9 })
        }
        g.rect(x, y + h * 0.55, w, h * 0.45).fill({ color: 0x1f4a28, alpha: 0.9 })
        break
      }
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
    this.entityLayer.addChild(puppet.root)
  }

  removeAvatar(id: string) {
    const p = this.avatars.get(id)
    if (p) {
      this.entityLayer.removeChild(p.root)
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
    if (p) {
      p.root.position.set(tileX * TILE_PX, tileY * TILE_PX)
      p.root.zIndex = tileY * TILE_PX // profundidade (y-sort junto com objetos)
    }
  }

  private zoom = 1
  // offset de pan (B3.3): deslocamento livre da câmera com Espaço+arrastar.
  // some (volta a centralizar no personagem) ao soltar o Espaço.
  private panX = 0
  private panY = 0

  // faixa estreita de propósito: o minimapa assumiu a navegação, então o zoom
  // não precisa mais afastar até o mapa inteiro — e faixa curta mantém nitidez.
  zoomMinimo(): number {
    return 0.75
  }

  setZoom(z: number) {
    this.zoom = Math.max(this.zoomMinimo(), Math.min(1.5, z))
  }
  getZoom() {
    return this.zoom
  }

  /** Acumula o deslocamento da câmera (arrastar com Espaço pressionado). */
  panBy(dx: number, dy: number) {
    this.panX += dx
    this.panY += dy
  }
  /** Zera o pan — a câmera volta a centralizar no personagem. */
  resetPan() {
    this.panX = 0
    this.panY = 0
  }

  /** Centraliza a câmera no alvo (tiles), respeitando zoom + offset de pan.
   *  Sem clamp de borda: o personagem fica SEMPRE no centro (B3.2). */
  follow(tileX: number, tileY: number) {
    if (!this.map) return
    const z = this.zoom
    const vw = this.app.renderer.width
    const vh = this.app.renderer.height
    this.world.scale.set(z)
    const cx = vw / 2 - tileX * TILE_PX * z + this.panX
    const cy = vh / 2 - tileY * TILE_PX * z + this.panY
    this.world.position.set(Math.round(cx), Math.round(cy))
  }

  cull(marginTiles = 2) {
    const z = this.zoom
    const vw = this.app.renderer.width
    const vh = this.app.renderer.height
    const marginPx = marginTiles * TILE_PX
    const left = -this.world.position.x / z - marginPx
    const top = -this.world.position.y / z - marginPx
    const right = (vw - this.world.position.x) / z + marginPx
    const bottom = (vh - this.world.position.y) / z + marginPx
    for (const p of this.avatars.values()) {
      const x = p.root.position.x
      const y = p.root.position.y
      p.root.visible = x >= left && x <= right && y >= top && y <= bottom
    }
  }

  /** Mostra/esconde a nota ♪ sobre todo objeto jukebox do mapa atual. */
  setJukeboxPlaying(playing: boolean) {
    for (const icon of this.jukeboxIcons) icon.visible = playing
  }

  /** Profundidade agora é automática (entityLayer.sortableChildren + zIndex por Y). */
  sortAvatars() {
    // no-op: o Pixi ordena objetos+avatares pelo zIndex (base Y) a cada render
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
    this.clearGhost()
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
    this.clearLayer(this.ghostLayer)
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
    this.app.destroy(true, { children: true })
  }
}
