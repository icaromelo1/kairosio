// Boneco modular animado (Épico 2) — avatar nativo no PixiJS montado por partes
// (cabeça, tronco, 2 braços, 2 pernas) numa hierarquia de "ossos". A animação é
// procedural + keyframes nos transforms das partes: andar, parado, dançar e olhar
// pra direção. As cores vêm da customização paramétrica (mesmos campos do
// characterStore), então cada parte é desenhada/tingida na hora — sem arte pronta.

import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js'

export interface AvatarLook {
  hairStyle: 'short' | 'curly' | 'ponytail' | 'mohawk' | 'helmet' | 'buzz' | 'long'
  hairColor: string
  skin: string
  topColor: string
  pantsColor: string
  accessory?: 'none' | 'glasses' | 'hat'
}

export type Facing = 'down' | 'up' | 'left' | 'right'
export type Pose = 'idle' | 'walk' | 'dance' | 'wave' | 'sit'

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

const HAIR_STYLES: AvatarLook['hairStyle'][] = ['short', 'curly', 'ponytail', 'mohawk', 'helmet', 'buzz', 'long']
const ACCESSORIES: NonNullable<AvatarLook['accessory']>[] = ['none', 'glasses', 'hat']
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/

/** Look remoto vem da rede — qualquer campo fora do esperado cai no default em
 *  vez de derrubar o puppet (HAIR[x] undefined explodia o ticker da sala inteira). */
export function sanitizeLook(raw: unknown): AvatarLook {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const color = (v: unknown, fallback: string) =>
    typeof v === 'string' && HEX_COLOR.test(v) ? v : fallback
  return {
    hairStyle: HAIR_STYLES.includes(a.hairStyle as AvatarLook['hairStyle'])
      ? (a.hairStyle as AvatarLook['hairStyle'])
      : 'short',
    hairColor: color(a.hairColor, '#3d2817'),
    skin: color(a.skin, '#e8b894'),
    topColor: color(a.topColor, '#7c3aed'),
    pantsColor: color(a.pantsColor, '#1f2937'),
    accessory: ACCESSORIES.includes(a.accessory as NonNullable<AvatarLook['accessory']>)
      ? (a.accessory as AvatarLook['accessory'])
      : 'none',
  }
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
  private nameLabel: Text
  private photoLayer: Container
  private photoSprite: Sprite | null = null
  private photoUrl: string | null = null

  constructor(look: AvatarLook) {
    this.root = new Container()

    // sombra (não se move com os membros)
    const shadow = new Graphics()
    shadow.ellipse(8 * UNIT, 20 * UNIT, 4 * UNIT, 0.8 * UNIT).fill({ color: 0x000000, alpha: 0.4 })
    this.root.addChild(shadow)

    // camada da foto de perfil (círculo) — só visível quando setPhoto(url) é chamado
    this.photoLayer = new Container()
    this.photoLayer.visible = false
    this.root.addChild(this.photoLayer)

    // nome flutuante — só aparece quando alguém entra no raio de comunicação (ver setNameVisible)
    this.nameLabel = new Text({
      text: '',
      style: {
        fontFamily: '"Space Grotesk", sans-serif',
        fontSize: 11,
        fontWeight: '600',
        fill: 0xe8e8f0,
        stroke: { color: 0x0a0a10, width: 3 },
      },
    })
    this.nameLabel.anchor.set(0.5, 1)
    this.nameLabel.position.set(8 * UNIT, -6)
    this.nameLabel.visible = false
    this.nameLabel.zIndex = 999999
    this.root.addChild(this.nameLabel)

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
    // olhos maiores e fofos (com brilhinho) — estilo Stardew
    px(this.face, 6, 4, 1, 2, 0x20202e)
    px(this.face, 9, 4, 1, 2, 0x20202e)
    px(this.face, 6, 4, 1, 1, 0xffffff)
    px(this.face, 9, 4, 1, 1, 0xffffff)
    // bochechas rosadas
    px(this.face, 5, 6, 1, 1, 0xf7a8c0)
    px(this.face, 10, 6, 1, 1, 0xf7a8c0)
    // boquinha
    px(this.face, 7, 6, 2, 1, skinDark)
    this.head.addChild(this.face)
    // nuca (parte de trás da cabeça) — cabelo cobrindo o rosto quando olha pra cima
    this.backHead = new Graphics()
    px(this.backHead, 4, 3, 8, 5, hair)
    px(this.backHead, 4, 2, 8, 1, hairDark)
    this.backHead.visible = false
    this.head.addChild(this.backHead)
    // acessório (óculos / chapéu)
    if (look.accessory && look.accessory !== 'none') {
      const acc = new Graphics()
      if (look.accessory === 'glasses') {
        px(acc, 5, 4, 2, 2, 0x202028) // lente esq
        px(acc, 9, 4, 2, 2, 0x202028) // lente dir
        px(acc, 6, 4, 1, 1, 0x9cd2ff) // brilho
        px(acc, 10, 4, 1, 1, 0x9cd2ff)
        px(acc, 7, 4, 2, 1, 0x202028) // ponte
      } else if (look.accessory === 'hat') {
        px(acc, 3, 0, 10, 2, 0x2a2a3a) // copa
        px(acc, 2, 2, 12, 1, 0x44445a) // aba
        px(acc, 4, 0, 8, 1, 0x55556e) // brilho no topo
      }
      this.head.addChild(acc)
    }
    this.head.pivot.set(8 * UNIT, 8 * UNIT)
    this.head.position.set(8 * UNIT, 8 * UNIT)

    // ordem de empilhamento — braços NA FRENTE do tronco pra ficarem visíveis
    // ao levantar (dança); cabeça por cima de tudo
    this.root.addChild(this.legL, this.legR, this.torso, this.armL, this.armR, this.head)
    // pivot do conjunto nos pés, pra posicionar pelo chão
    this.root.pivot.set(8 * UNIT, 20 * UNIT)
    // nome sempre por cima de tudo (readicionar move pro fim da lista de filhos)
    this.root.addChild(this.nameLabel)
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

  private cartBack?: Container
  private cartFront?: Container
  /** Mostra/esconde um kart esportivo vermelho durante o boost (Shift).
   *  Em DUAS camadas: a traseira/assento ATRÁS do boneco e a frente/painel NA FRENTE
   *  das pernas (mas abaixo do tronco) → o personagem parece sentado DENTRO. */
  setBoost(on: boolean) {
    if (on && !this.cartBack) {
      const U = UNIT
      const red = 0xd11f2a
      const redDark = 0x8e1018
      const redLite = 0xf2545b
      const tire = 0x141418
      const rim = 0xc8c8d6

      // ---- camada TRASEIRA (atrás do boneco) ----
      const back = new Container()
      const gb = new Graphics()
      // rodas grandes saindo das laterais
      for (const wx of [2.2, 13.8]) {
        gb.circle(wx * U, 18.5 * U, 2.7 * U).fill({ color: tire })
        gb.circle(wx * U, 18.5 * U, 1.3 * U).fill({ color: rim })
        gb.circle(wx * U, 18.5 * U, 0.5 * U).fill({ color: 0x2a2a32 })
      }
      // corpo/assento + cockpit escuro (some sob o boneco)
      gb.rect(0.5 * U, 11.5 * U, 15 * U, 7 * U).fill({ color: red })
      gb.rect(0.5 * U, 11.5 * U, 15 * U, 1 * U).fill({ color: redLite })
      gb.rect(3.5 * U, 11 * U, 9 * U, 6 * U).fill({ color: 0x2a0a0c }) // cockpit (encosto do banco)
      // paredes laterais subindo pra "abraçar" o personagem
      gb.rect(0.5 * U, 10 * U, 3 * U, 7 * U).fill({ color: red })
      gb.rect(12.5 * U, 10 * U, 3 * U, 7 * U).fill({ color: red })
      gb.rect(0.5 * U, 10 * U, 3 * U, 1 * U).fill({ color: redLite })
      gb.rect(12.5 * U, 10 * U, 3 * U, 1 * U).fill({ color: redLite })
      // aerofólio traseiro (esquerda)
      gb.rect(-1.5 * U, 10 * U, 1.2 * U, 4.5 * U).fill({ color: redDark })
      gb.rect(-2 * U, 10 * U, 3 * U, 1 * U).fill({ color: red })
      back.addChild(gb)

      // ---- camada FRONTAL (na frente das pernas, abaixo do tronco) ----
      const front = new Container()
      const gf = new Graphics()
      // lip/bumper dianteiro cobrindo a parte de baixo do boneco → "sentado dentro"
      gf.rect(0.5 * U, 16.5 * U, 15 * U, 4 * U).fill({ color: red })
      gf.rect(0.5 * U, 16.5 * U, 15 * U, 1 * U).fill({ color: redLite }) // brilho no topo do painel
      gf.rect(0.5 * U, 19.8 * U, 15 * U, 0.8 * U).fill({ color: redDark }) // sombra na base
      // nariz esportivo apontando pra frente (direita)
      gf.rect(15.5 * U, 16.5 * U, 2.6 * U, 3 * U).fill({ color: red })
      gf.rect(15.5 * U, 16.5 * U, 2.6 * U, 0.9 * U).fill({ color: redLite })
      gf.rect(17.2 * U, 17 * U, 1 * U, 2 * U).fill({ color: redDark })
      // faixa de corrida branca no painel
      gf.rect(7.2 * U, 16.5 * U, 1.6 * U, 4 * U).fill({ color: 0xf4f4f8, alpha: 0.9 })
      front.addChild(gf)

      this.cartBack = back
      this.cartFront = front
      // traseira logo acima da sombra (índice 0), atrás de tudo
      this.root.addChildAt(back, 1)
      // frente inserida logo ANTES do tronco → cobre as pernas, fica sob tronco/braços/cabeça
      this.root.addChildAt(front, this.root.getChildIndex(this.torso))
    }
    if (this.cartBack) this.cartBack.visible = on
    if (this.cartFront) this.cartFront.visible = on
  }

  setFacing(facing: Facing) {
    if (facing === this.facing) return
    this.facing = facing
    // esquerda/direita = espelhar o rosto de frente; cima = de costas (mostra a nuca)
    if (facing === 'left') this.root.scale.x = -1
    else if (facing === 'right') this.root.scale.x = 1
    this.face.visible = facing !== 'up'
    this.backHead.visible = facing === 'up'
    // contra-espelha o nome pra não ficar de trás pra frente junto com o boneco
    this.nameLabel.scale.x = this.root.scale.x
  }

  /** Nome exibido flutuando sobre o boneco (some por padrão, aparece por proximidade). */
  setName(name: string) {
    this.nameLabel.text = name
  }
  setNameVisible(visible: boolean) {
    this.nameLabel.visible = visible
  }

  private setBodyVisible(v: boolean) {
    this.legL.visible = v
    this.legR.visible = v
    this.torso.visible = v
    this.armL.visible = v
    this.armR.visible = v
    this.head.visible = v
  }

  /** Foto de perfil (círculo) no lugar do boneco pixel — null volta a mostrar o sprite. */
  async setPhoto(url: string | null) {
    if (this.photoUrl === url) return
    this.photoUrl = url
    if (!url) {
      this.photoLayer.visible = false
      this.setBodyVisible(true)
      return
    }
    try {
      const texture = await Assets.load(url)
      if (this.photoUrl !== url) return // trocou de novo (ou foi limpa) enquanto carregava
      if (!this.photoSprite) {
        const size = 16 * UNIT
        const mask = new Graphics().circle(size / 2, size / 2, size / 2).fill(0xffffff)
        const ring = new Graphics().circle(size / 2, size / 2, size / 2).stroke({ width: 2, color: OUTLINE })
        this.photoSprite = new Sprite(texture)
        this.photoSprite.width = size
        this.photoSprite.height = size
        this.photoSprite.mask = mask
        this.photoLayer.addChild(mask, this.photoSprite, ring)
        this.photoLayer.position.set(0, 2 * UNIT)
      } else {
        this.photoSprite.texture = texture
      }
      this.photoLayer.visible = true
      this.setBodyVisible(false)
    } catch {
      // falha ao carregar a foto (ex: removida no meio do caminho) → mantém o sprite
      this.photoLayer.visible = false
      this.setBodyVisible(true)
    }
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
    } else if (this.pose === 'sit') {
      // sentado — pernas dobradas pra frente, corpo parado
      this.legL.rotation = -1.4
      this.legR.rotation = -1.4
      this.legL.position.y = HIP_Y
      this.legR.position.y = HIP_Y
      this.armL.rotation = 0.05
      this.armR.rotation = -0.05
      this.torso.rotation = 0
      this.torso.position.y = 9 * UNIT
      this.head.rotation = 0
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
