import { Container, Graphics, Rectangle, type FederatedPointerEvent } from 'pixi.js'
import type { MapDef, MapObject } from '../maps'

const COR_POR_KIND: Partial<Record<MapObject['kind'], number>> = {
  wall: 0x6e7a8f,
  water: 0x4a5d8f,
  grass: 0x3f6b3a,
  path: 0x8a6a3a,
  tree: 0x5c9152,
  hedge: 0x3f6b3a,
  door: 0xd9c47a,
  fountain: 0x6b7fb5,
}
const COR_MOVEL = 0x4a3520
const COR_AREA = 0x2a2438
const COR_FUNDO = 0x14161c
const COR_VOCE = 0xd9c47a
const COR_PEER = 0x8c7ae6
const COR_FALANDO = 0x6be675
const COR_TRANCADA = 0xd9534f
const CORES_GRUPO = [0xfb923c, 0x22d3ee, 0x34d399, 0xf472b6, 0xa78bfa, 0xfacc15]

interface AreaGeom {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export class Minimap {
  root: Container
  private base: Graphics
  private pontos: Graphics
  private escala = 1
  private largura = 0
  private altura = 0
  private areas: AreaGeom[] = []
  private cliqueCb: ((x: number, y: number) => void) | null = null

  constructor(private ladoMax = 160) {
    this.root = new Container()
    this.root.eventMode = 'none'
    this.root.cursor = 'default'
    this.base = new Graphics()
    this.pontos = new Graphics()
    this.root.addChild(this.base, this.pontos)
    this.root.on('pointerdown', (e: FederatedPointerEvent) => {
      if (!this.cliqueCb) return
      const local = this.root.toLocal(e.global)
      this.cliqueCb(local.x / this.escala, local.y / this.escala)
    })
  }

  aoClicar(fn: (x: number, y: number) => void) {
    this.cliqueCb = fn
  }

  permitirClique(v: boolean) {
    this.root.eventMode = v ? 'static' : 'none'
    this.root.cursor = v ? 'pointer' : 'default'
  }

  construir(map: MapDef) {
    this.escala = this.ladoMax / Math.max(map.width, map.height)
    this.largura = map.width * this.escala
    this.altura = map.height * this.escala

    const g = this.base
    g.clear()
    g.rect(-3, -3, this.largura + 6, this.altura + 6).fill({ color: COR_FUNDO, alpha: 0.85 })
    g.rect(-3, -3, this.largura + 6, this.altura + 6).stroke({ width: 1, color: 0x6e7a8f, alpha: 0.5 })

    this.areas = []
    for (const o of map.objects) {
      if (o.kind === 'area') {
        g.rect(o.x * this.escala, o.y * this.escala, o.w * this.escala, o.h * this.escala)
          .fill({ color: COR_AREA, alpha: 0.9 })
        this.areas.push({ id: o.id, x: o.x, y: o.y, w: o.w, h: o.h })
      }
    }

    for (const o of map.objects) {
      if (o.kind === 'area') continue
      const cor = COR_POR_KIND[o.kind] ?? (o.solid ? COR_MOVEL : null)
      if (cor === null) continue
      g.rect(
        o.x * this.escala,
        o.y * this.escala,
        Math.max(1, o.w * this.escala),
        Math.max(1, o.h * this.escala),
      ).fill({ color: cor, alpha: o.solid ? 0.95 : 0.55 })
    }

    this.root.hitArea = new Rectangle(-3, -3, this.largura + 6, this.altura + 6)
  }

  atualizar(
    eu: { x: number; y: number },
    outros: { x: number; y: number; falando?: boolean; grupo?: number }[],
    trancadas?: Set<string>,
  ) {
    const g = this.pontos
    g.clear()

    if (trancadas && trancadas.size > 0) {
      for (const a of this.areas) {
        if (!trancadas.has(a.id)) continue
        g.rect(a.x * this.escala, a.y * this.escala, a.w * this.escala, a.h * this.escala)
          .stroke({ width: 1.5, color: COR_TRANCADA, alpha: 0.9 })
      }
    }

    const porGrupo = new Map<number, { x: number; y: number }[]>()
    for (const p of outros) {
      if (p.grupo === undefined || p.grupo === null) continue
      const lista = porGrupo.get(p.grupo) ?? []
      lista.push(p)
      porGrupo.set(p.grupo, lista)
    }
    for (const [grupo, pontos] of porGrupo) {
      if (pontos.length < 2) continue
      const cor = CORES_GRUPO[Math.abs(grupo) % CORES_GRUPO.length]
      for (let i = 0; i < pontos.length; i++) {
        for (let j = i + 1; j < pontos.length; j++) {
          g.moveTo(pontos[i].x * this.escala, pontos[i].y * this.escala)
            .lineTo(pontos[j].x * this.escala, pontos[j].y * this.escala)
            .stroke({ width: 1, color: cor, alpha: 0.45 })
        }
      }
      for (const p of pontos) {
        g.circle(p.x * this.escala, p.y * this.escala, 4.5).stroke({ width: 1.2, color: cor, alpha: 0.9 })
      }
    }

    for (const p of outros) {
      g.circle(p.x * this.escala, p.y * this.escala, 2).fill({ color: COR_PEER })
      if (p.falando) {
        g.circle(p.x * this.escala, p.y * this.escala, 4).stroke({ width: 1, color: COR_FALANDO, alpha: 0.85 })
      }
    }
    g.circle(eu.x * this.escala, eu.y * this.escala, 3).fill({ color: COR_VOCE })
    g.circle(eu.x * this.escala, eu.y * this.escala, 5).stroke({ width: 1, color: COR_VOCE, alpha: 0.6 })
  }

  posicionar(telaW: number, telaH: number, margem = 16) {
    this.root.position.set(telaW - this.largura - margem, telaH - this.altura - margem)
  }
}
