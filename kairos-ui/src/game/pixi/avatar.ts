// Boneco modular animado (Épico 2) — avatar nativo no PixiJS montado por partes
// (cabeça, tronco, 2 braços, 2 pernas) numa hierarquia de "ossos". A animação é
// procedural + keyframes nos transforms das partes: andar, parado, dançar e olhar
// pra direção. As cores vêm da customização paramétrica (mesmos campos do
// characterStore), então cada parte é desenhada/tingida na hora — sem arte pronta.

import { Container, Graphics } from 'pixi.js'

export interface AvatarLook {
  hairStyle: 'short' | 'curly' | 'ponytail' | 'mohawk' | 'helmet' | 'buzz' | 'long'
  hairColor: string
  skin: string
  topColor: string
  pantsColor: string
}

export type Facing = 'down' | 'up' | 'left' | 'right'
export type Pose = 'idle' | 'walk' | 'dance' | 'wave'

// 1 unidade = 1 "pixel" da arte 16x20. UNIT controla o tamanho final do avatar.
// (reduzido de 5 → 4: personagem menor, mais proporcional aos objetos do mapa)
const UNIT = 4
// contorno escuro pra silhueta destacar em qualquer piso
const OUTLINE = 0x07070c

function darken(hex: string, amount: number): number {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16)
  let r = (n >> 16) & 0xff
  let g = (n >> 8) & 0xff
  let b = n & 0xff
  r = Math.max(0, Math.min(255, Math.round(r * (1 + amount))))
  g = Math.max(0, Math.min(255, Math.round(g * (1 + amount))))
  b = Math.max(0, Math.min(255, Math.round(b * (1 + amount))))
  return (r << 16) | (g << 8) | b
}

function toNum(hex: string): number {
  return darken(hex, 0)
}

function px(g: Graphics, x: number, y: number, w: number, h: number, color: number) {
  g.rect(x * UNIT, y * UNIT, w * UNIT, h * UNIT).fill({ color })
}

const HAIR: Record<AvatarLook['hairStyle'], [number, number, number, number][]> = {
  short:    [[4, 1, 8, 2], [3, 2, 1, 2], [12, 2, 1, 2]],
  curly:    [[3, 1, 10, 2], [3, 3, 1, 1], [12, 3, 1, 1], [4, 0, 8, 1]],
  ponytail: [[4, 1, 8, 2], [3, 2, 1, 3], [12, 2, 1, 1], [12, 2, 2, 5]],
  mohawk:   [[7, 0, 2, 3], [6, 1, 1, 1], [9, 1, 1, 1]],
  helmet:   [[3, 1, 10, 3], [3, 4, 1, 2], [12, 4, 1, 2]],
  buzz:     [[4, 1, 8, 1], [4, 2, 8, 1]],
  long:     [[4, 1, 8, 2], [3, 2, 1, 6], [12, 2, 1, 6], [2, 3, 1, 4], [13, 3, 1, 4]],
}

export class AvatarPuppet {
  readonly root: Container
  private head: Container
  private face: Graphics
  private backHead!: Graphics
  private torso: Container
  private armL: Container
  private armR: Container
  private legL: Container
  private legR: Container

  private t = 0
  private pose: Pose = 'idle'
  private facing: Facing = 'down'

  constructor(look: AvatarLook) {
    this.root = new Container()

    // sombra (não se move com os membros)
    const shadow = new Graphics()
    shadow.ellipse(8 * UNIT, 20 * UNIT, 4 * UNIT, 0.8 * UNIT).fill({ color: 0x000000, alpha: 0.4 })
    this.root.addChild(shadow)

    const skin = toNum(look.skin)
    const skinDark = darken(look.skin, -0.18)
    const top = toNum(look.topColor)
    const topDark = darken(look.topColor, -0.28)
    const topLite = darken(look.topColor, 0.16)
    const pants = toNum(look.pantsColor)
    const pantsDark = darken(look.pantsColor, -0.3)
    const pantsLite = darken(look.pantsColor, 0.22)
    const boot = darken(look.pantsColor, -0.55)
    const hair = toNum(look.hairColor)
    const hairDark = darken(look.hairColor, -0.3)

    // ---- pernas (pivot no quadril) ----
    this.legL = this.makeLeg(pants, pantsDark, pantsLite, boot, 'left')
    this.legR = this.makeLeg(pants, pantsDark, pantsLite, boot, 'right')
    this.legL.position.set(6 * UNIT, 14 * UNIT)
    this.legR.position.set(10 * UNIT, 14 * UNIT)

    // ---- braços (pivot no ombro) ----
    this.armL = this.makeArm(skin, skinDark, top, topDark)
    this.armR = this.makeArm(skin, skinDark, top, topDark)
    this.armL.position.set(3 * UNIT, 9 * UNIT)
    this.armR.position.set(13 * UNIT, 9 * UNIT)

    // ---- tronco ----
    this.torso = new Container()
    const tg = new Graphics()
    px(tg, 3, 8, 10, 7, OUTLINE) // contorno
    px(tg, 3, 9, 10, 5, top)
    px(tg, 3, 9, 2, 5, topLite) // luz na esquerda
    px(tg, 11, 9, 2, 5, topDark) // sombra na direita
    px(tg, 3, 13, 10, 1, topDark) // barra inferior
    px(tg, 7, 8, 2, 1, skinDark) // pescoço
    this.torso.addChild(tg)
    this.torso.pivot.set(8 * UNIT, 9 * UNIT)
    this.torso.position.set(8 * UNIT, 9 * UNIT)

    // ---- cabeça (skin + cabelo + rosto) ----
    this.head = new Container()
    const hg = new Graphics()
    px(hg, 3, 1, 10, 8, OUTLINE) // contorno
    px(hg, 4, 2, 8, 6, skin)
    px(hg, 3, 3, 1, 4, skin)
    px(hg, 12, 3, 1, 4, skin)
    px(hg, 11, 3, 1, 4, skinDark) // sombra do rosto
    px(hg, 4, 7, 8, 1, skinDark)
    for (const [x, y, w, h] of HAIR[look.hairStyle]) px(hg, x, y, w, h, hair)
    px(hg, 4, 1, 8, 1, hairDark) // topo do cabelo
    this.head.addChild(hg)
    // rosto (olhos + boca) — escondido quando vira de costas (up)
    this.face = new Graphics()
    px(this.face, 6, 5, 1, 1, 0x101018)
    px(this.face, 9, 5, 1, 1, 0x101018)
    px(this.face, 7, 6, 2, 1, skinDark)
    this.head.addChild(this.face)
    // nuca (parte de trás da cabeça) — cabelo cobrindo o rosto quando olha pra cima
    this.backHead = new Graphics()
    px(this.backHead, 4, 3, 8, 5, hair)
    px(this.backHead, 4, 2, 8, 1, hairDark)
    this.backHead.visible = false
    this.head.addChild(this.backHead)
    this.head.pivot.set(8 * UNIT, 8 * UNIT)
    this.head.position.set(8 * UNIT, 8 * UNIT)

    // ordem de empilhamento — braços NA FRENTE do tronco pra ficarem visíveis
    // ao levantar (dança); cabeça por cima de tudo
    this.root.addChild(this.legL, this.legR, this.torso, this.armL, this.armR, this.head)
    // pivot do conjunto nos pés, pra posicionar pelo chão
    this.root.pivot.set(8 * UNIT, 20 * UNIT)
  }

  private makeLeg(pants: number, pantsDark: number, pantsLite: number, boot: number, side: 'left' | 'right'): Container {
    const c = new Container()
    const g = new Graphics()
    const U = UNIT
    // contorno; depois calça (4 de largura) e bota, desenhados do quadril (0,0) pra baixo
    g.rect(-2 * U - 1, -1, 4 * U + 2, 6 * U + 2).fill({ color: OUTLINE })
    g.rect(-2 * U, 0, 4 * U, 4 * U).fill({ color: pants })
    // luz/sombra lateral dá volume
    g.rect(side === 'left' ? -2 * U : 1 * U, 0, 1 * U, 4 * U).fill({ color: side === 'left' ? pantsLite : pantsDark })
    g.rect(-2 * U, 3 * U, 4 * U, 1 * U).fill({ color: pantsDark })
    // bota
    g.rect(-2 * U, 4 * U, 4 * U, 2 * U).fill({ color: boot })
    g.rect(-2 * U, 4 * U, 4 * U, 1 * U).fill({ color: pantsDark })
    c.addChild(g)
    return c
  }

  private makeArm(skin: number, skinDark: number, sleeve: number, sleeveDark: number): Container {
    const c = new Container()
    const g = new Graphics()
    const U = UNIT
    // ombro (0,0) pra baixo: contorno + manga + mão
    g.rect(-1 * U - 1, -1, 2 * U + 2, 5 * U + 2).fill({ color: OUTLINE })
    g.rect(-1 * U, 0, 2 * U, 3 * U).fill({ color: sleeve })
    g.rect(0, 0, 1 * U, 3 * U).fill({ color: sleeveDark })
    g.rect(-1 * U, 3 * U, 2 * U, 1 * U).fill({ color: skin })
    g.rect(-1 * U, 4 * U, 2 * U, 1 * U).fill({ color: skinDark })
    c.addChild(g)
    return c
  }

  setPose(pose: Pose) {
    this.pose = pose
  }

  setFacing(facing: Facing) {
    if (facing === this.facing) return
    this.facing = facing
    // esquerda/direita = espelhar; cima = de costas (mostra a nuca, não some o rosto)
    if (facing === 'left') this.root.scale.x = -1
    else if (facing === 'right') this.root.scale.x = 1
    this.face.visible = facing !== 'up'
    this.backHead.visible = facing === 'up'
  }

  /** Avança a animação. dt em segundos. */
  update(dt: number) {
    this.t += dt
    const t = this.t
    const HIP_Y = 14 * UNIT
    const sideView = this.facing === 'left' || this.facing === 'right'

    if (this.pose === 'walk') {
      const phase = t * 9
      const s = Math.sin(phase)
      if (sideView) {
        // de lado: pêndulo (passada real frente↔trás)
        const swing = s * 0.55
        this.legL.rotation = swing
        this.legR.rotation = -swing
        this.legL.position.y = HIP_Y
        this.legR.position.y = HIP_Y
        this.armL.rotation = -swing * 0.85
        this.armR.rotation = swing * 0.85
      } else {
        // de frente/costas: marcha — pernas sobem alternadas
        this.legL.rotation = s * 0.1
        this.legR.rotation = -s * 0.1
        this.legL.position.y = HIP_Y - Math.max(0, s) * 2 * UNIT
        this.legR.position.y = HIP_Y - Math.max(0, -s) * 2 * UNIT
        this.armL.rotation = -s * 0.35
        this.armR.rotation = s * 0.35
      }
      // bob do corpo: 2x por passada (sobe quando as pernas se cruzam)
      this.torso.rotation = 0
      this.torso.position.y = (9 - Math.abs(Math.cos(phase)) * 0.4) * UNIT
      this.head.rotation = s * 0.04
    } else if (this.pose === 'dance') {
      const s = Math.sin(t * 6)
      const s2 = Math.sin(t * 6 + Math.PI / 2)
      // braços bem pra cima e abrindo — agora visíveis (na frente do tronco)
      this.armL.rotation = -2.3 + s * 0.45
      this.armR.rotation = 2.3 - s * 0.45
      this.legL.position.y = HIP_Y
      this.legR.position.y = HIP_Y
      this.legL.rotation = s2 * 0.22
      this.legR.rotation = -s2 * 0.22
      this.torso.rotation = s * 0.14
      this.torso.position.y = (9 - Math.abs(s) * 0.6) * UNIT
      this.head.rotation = -s * 0.12
    } else if (this.pose === 'wave') {
      // acenar — braço direito levantado balançando
      const s = Math.sin(t * 9)
      this.legL.rotation = 0
      this.legR.rotation = 0
      this.legL.position.y = HIP_Y
      this.legR.position.y = HIP_Y
      this.armL.rotation = 0.05
      this.armR.rotation = -2.4 + s * 0.4
      this.torso.rotation = 0
      this.torso.position.y = 9 * UNIT
      this.head.rotation = s * 0.05
    } else {
      // idle — respiração leve
      const b = Math.sin(t * 2)
      this.legL.rotation = 0
      this.legR.rotation = 0
      this.legL.position.y = HIP_Y
      this.legR.position.y = HIP_Y
      this.armL.rotation = b * 0.04
      this.armR.rotation = -b * 0.04
      this.torso.rotation = 0
      this.torso.position.y = (9 + b * 0.12) * UNIT
      this.head.rotation = 0
    }
  }

  destroy() {
    this.root.destroy({ children: true })
  }
}
