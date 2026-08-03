import { Container, Graphics } from 'pixi.js'
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

export class Minimap {
  root: Container
  private base: Graphics
  private pontos: Graphics
  private escala = 1
  private largura = 0
  private altura = 0

  constructor(private ladoMax = 160) {
    this.root = new Container()
    this.root.eventMode = 'none'
    this.base = new Graphics()
    this.pontos = new Graphics()
    this.root.addChild(this.base, this.pontos)
  }

  construir(map: MapDef) {
    this.escala = this.ladoMax / Math.max(map.width, map.height)
    this.largura = map.width * this.escala
    this.altura = map.height * this.escala

    const g = this.base
    g.clear()
    g.rect(-3, -3, this.largura + 6, this.altura + 6).fill({ color: COR_FUNDO, alpha: 0.85 })
    g.rect(-3, -3, this.largura + 6, this.altura + 6).stroke({ width: 1, color: 0x6e7a8f, alpha: 0.5 })

    for (const o of map.objects) {
      if (o.kind === 'area') {
        g.rect(o.x * this.escala, o.y * this.escala, o.w * this.escala, o.h * this.escala)
          .fill({ color: COR_AREA, alpha: 0.9 })
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
  }

  atualizar(eu: { x: number; y: number }, outros: { x: number; y: number }[]) {
    const g = this.pontos
    g.clear()
    for (const p of outros) {
      g.circle(p.x * this.escala, p.y * this.escala, 2).fill({ color: COR_PEER })
    }
    g.circle(eu.x * this.escala, eu.y * this.escala, 3).fill({ color: COR_VOCE })
    g.circle(eu.x * this.escala, eu.y * this.escala, 5).stroke({ width: 1, color: COR_VOCE, alpha: 0.6 })
  }

  posicionar(telaW: number, telaH: number, margem = 16) {
    this.root.position.set(telaW - this.largura - margem, telaH - this.altura - margem)
  }
}
