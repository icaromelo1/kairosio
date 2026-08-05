import { Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import presetsRaw from '../furniture/avatar/presets.json'
import { ESCALA_PADRAO } from '../escala-avatar'

export interface AvatarPresetInfo {
  id: string
  nome: string
}

export const AVATAR_PRESETS: AvatarPresetInfo[] = presetsRaw as AvatarPresetInfo[]

const DEFAULT_PRESET = AVATAR_PRESETS[0]?.id ?? 'ruivo-verde'
const PRESET_IDS = new Set(AVATAR_PRESETS.map((p) => p.id))

type Direcao = 'baixo' | 'cima' | 'esquerda' | 'direita'

const AVATAR_SPRITE_MODULES = import.meta.glob('../furniture/avatar/*/*.png', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

const AVATAR_SPRITES: Record<string, Record<string, string>> = {}
for (const [path, url] of Object.entries(AVATAR_SPRITE_MODULES)) {
  const parts = path.split('/')
  const preset = parts[parts.length - 2]
  const frame = parts[parts.length - 1]?.replace(/\.png$/, '')
  if (!preset || !frame || typeof url !== 'string') continue
  AVATAR_SPRITES[preset] = AVATAR_SPRITES[preset] || {}
  AVATAR_SPRITES[preset][frame] = url
}

void Assets.load(Object.values(AVATAR_SPRITE_MODULES))

export function avatarSpriteUrl(preset: string, direcao: Direcao, quadro: 0 | 1 | 2): string {
  const set = AVATAR_SPRITES[preset] || AVATAR_SPRITES[DEFAULT_PRESET]
  return set?.[`${direcao}-${quadro}`] ?? ''
}

function resolveTexture(preset: string, direcao: Direcao, quadro: number): Texture {
  const set = AVATAR_SPRITES[preset] || AVATAR_SPRITES[DEFAULT_PRESET]
  const url = set?.[`${direcao}-${quadro}`]
  return url ? Texture.from(url) : Texture.EMPTY
}

export interface AvatarLook {
  hairStyle: string
  hairColor: string
  skin: string
  topColor: string
  pantsColor: string
  accessory?: 'none' | 'glasses' | 'hat'
}

export type Facing = 'down' | 'up' | 'left' | 'right'
export type Pose = 'idle' | 'walk' | 'dance' | 'wave' | 'sit' | 'giro' | 'pulo' | 'robo'

const UNIT = 6


const BODY_SIZE = 16 * UNIT

const ACCESSORIES: NonNullable<AvatarLook['accessory']>[] = ['none', 'glasses', 'hat']
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/

export function sanitizeLook(raw: unknown): AvatarLook {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const color = (v: unknown, fallback: string) =>
    typeof v === 'string' && HEX_COLOR.test(v) ? v : fallback
  return {
    hairStyle: typeof a.hairStyle === 'string' && PRESET_IDS.has(a.hairStyle) ? a.hairStyle : DEFAULT_PRESET,
    hairColor: color(a.hairColor, '#3d2817'),
    skin: color(a.skin, '#e8b894'),
    topColor: color(a.topColor, '#7c3aed'),
    pantsColor: color(a.pantsColor, '#1f2937'),
    accessory: ACCESSORIES.includes(a.accessory as NonNullable<AvatarLook['accessory']>)
      ? (a.accessory as AvatarLook['accessory'])
      : 'none',
  }
}

const DIR_FOR_FACING: Record<Facing, Direcao> = {
  down: 'baixo',
  up: 'cima',
  left: 'esquerda',
  right: 'direita',
}

const WALK_SEQ = [0, 1, 0, 2]

export class AvatarPuppet {
  readonly root: Container
  private bodyLayer: Container
  private body: Sprite
  private preset: string

  private t = 0
  private pose: Pose = 'idle'
  private facing: Facing = 'down'
  private frame = 0
  private mirror = 1
  private escala = ESCALA_PADRAO
  private nameLabel: Text
  private photoLayer: Container
  private photoSprite: Sprite | null = null
  private photoUrl: string | null = null

  constructor(look: AvatarLook) {
    this.root = new Container()
    this.preset = PRESET_IDS.has(look.hairStyle) ? look.hairStyle : DEFAULT_PRESET

    const shadow = new Graphics()
    shadow.ellipse(8 * UNIT, 20 * UNIT, 4 * UNIT, 0.8 * UNIT).fill({ color: 0x000000, alpha: 0.4 })
    this.root.addChild(shadow)

    this.photoLayer = new Container()
    this.photoLayer.visible = false
    this.root.addChild(this.photoLayer)

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
    this.nameLabel.position.set(8 * UNIT, 20 * UNIT - BODY_SIZE - 10)
    this.nameLabel.visible = false
    this.nameLabel.zIndex = 999999
    this.root.addChild(this.nameLabel)

    this.bodyLayer = new Container()
    this.bodyLayer.position.set(8 * UNIT, 20 * UNIT)
    this.body = new Sprite(resolveTexture(this.preset, 'baixo', 0))
    this.body.texture.source.scaleMode = 'nearest'
    this.body.anchor.set(0.5, 1)
    this.body.width = BODY_SIZE
    this.body.height = BODY_SIZE
    this.bodyLayer.addChild(this.body)
    this.root.addChild(this.bodyLayer)

    this.root.pivot.set(8 * UNIT, 20 * UNIT)
    this.root.addChild(this.nameLabel)
    this.updateRootScale()
  }

  private cartBack?: Container
  private cartFront?: Container
  setBoost(on: boolean) {
    if (on && !this.cartBack) {
      const U = UNIT
      const red = 0xd11f2a
      const redDark = 0x8e1018
      const redLite = 0xf2545b
      const tire = 0x141418
      const rim = 0xc8c8d6

      const back = new Container()
      const gb = new Graphics()
      for (const wx of [2.2, 13.8]) {
        gb.circle(wx * U, 18.5 * U, 2.7 * U).fill({ color: tire })
        gb.circle(wx * U, 18.5 * U, 1.3 * U).fill({ color: rim })
        gb.circle(wx * U, 18.5 * U, 0.5 * U).fill({ color: 0x2a2a32 })
      }
      gb.rect(0.5 * U, 11.5 * U, 15 * U, 7 * U).fill({ color: red })
      gb.rect(0.5 * U, 11.5 * U, 15 * U, 1 * U).fill({ color: redLite })
      gb.rect(3.5 * U, 11 * U, 9 * U, 6 * U).fill({ color: 0x2a0a0c })
      gb.rect(0.5 * U, 10 * U, 3 * U, 7 * U).fill({ color: red })
      gb.rect(12.5 * U, 10 * U, 3 * U, 7 * U).fill({ color: red })
      gb.rect(0.5 * U, 10 * U, 3 * U, 1 * U).fill({ color: redLite })
      gb.rect(12.5 * U, 10 * U, 3 * U, 1 * U).fill({ color: redLite })
      gb.rect(-1.5 * U, 10 * U, 1.2 * U, 4.5 * U).fill({ color: redDark })
      gb.rect(-2 * U, 10 * U, 3 * U, 1 * U).fill({ color: red })
      back.addChild(gb)

      const front = new Container()
      const gf = new Graphics()
      gf.rect(0.5 * U, 16.5 * U, 15 * U, 4 * U).fill({ color: red })
      gf.rect(0.5 * U, 16.5 * U, 15 * U, 1 * U).fill({ color: redLite })
      gf.rect(0.5 * U, 19.8 * U, 15 * U, 0.8 * U).fill({ color: redDark })
      gf.rect(15.5 * U, 16.5 * U, 2.6 * U, 3 * U).fill({ color: red })
      gf.rect(15.5 * U, 16.5 * U, 2.6 * U, 0.9 * U).fill({ color: redLite })
      gf.rect(17.2 * U, 17 * U, 1 * U, 2 * U).fill({ color: redDark })
      gf.rect(7.2 * U, 16.5 * U, 1.6 * U, 4 * U).fill({ color: 0xf4f4f8, alpha: 0.9 })
      front.addChild(gf)

      this.cartBack = back
      this.cartFront = front
      this.root.addChildAt(back, 1)
      this.root.addChildAt(front, this.root.getChildIndex(this.bodyLayer) + 1)
    }
    if (this.cartBack) this.cartBack.visible = on
    if (this.cartFront) this.cartFront.visible = on
  }

  setPose(pose: Pose) {
    this.pose = pose
  }

  setFacing(facing: Facing) {
    if (facing === this.facing) return
    this.facing = facing
    this.applyTexture()
  }

  private applyTexture() {
    const dir = DIR_FOR_FACING[this.facing]
    const tex = resolveTexture(this.preset, dir, this.frame)
    tex.source.scaleMode = 'nearest'
    this.body.texture = tex
  }

  setEscala(valor: number) {
    this.escala = Math.max(0.4, Math.min(3, valor))
    this.updateRootScale()
  }

  private updateRootScale() {
    this.root.scale.set(this.mirror * this.escala, this.escala)
    this.nameLabel.scale.set(this.mirror / this.escala, 1 / this.escala)
  }

  setOculto(v: boolean) {
    this.root.alpha = v ? 0.35 : 1
  }

  setName(name: string) {
    this.nameLabel.text = name
  }
  setNameVisible(visible: boolean) {
    this.nameLabel.visible = visible
  }

  private setBodyVisible(v: boolean) {
    this.bodyLayer.visible = v
  }

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
      if (this.photoUrl !== url) return
      if (!this.photoSprite) {
        const size = 16 * UNIT
        const mask = new Graphics().circle(size / 2, size / 2, size / 2).fill(0xffffff)
        const ring = new Graphics().circle(size / 2, size / 2, size / 2).stroke({ width: 2, color: 0x07070c })
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
      this.photoLayer.visible = false
      this.setBodyVisible(true)
    }
  }

  update(dt: number) {
    this.t += dt
    const t = this.t
    let frame = 0
    this.bodyLayer.rotation = 0
    this.bodyLayer.scale.set(1, 1)
    this.bodyLayer.position.set(8 * UNIT, 20 * UNIT)

    if (this.pose === 'walk') {
      frame = WALK_SEQ[Math.floor(t * 8) % WALK_SEQ.length] ?? 0
      this.bodyLayer.position.y = 20 * UNIT - Math.abs(Math.sin(t * 9)) * 0.4 * UNIT
    } else if (this.pose === 'dance') {
      const s = Math.sin(t * 6)
      this.bodyLayer.rotation = s * 0.22
      this.bodyLayer.position.y = 20 * UNIT - Math.abs(s) * 1.2 * UNIT
      this.bodyLayer.scale.set(1 - Math.abs(s) * 0.05, 1 + Math.abs(s) * 0.05)
    } else if (this.pose === 'giro') {
      this.bodyLayer.rotation = t * 3.2
    } else if (this.pose === 'pulo') {
      const bounce = Math.abs(Math.sin(t * 7))
      this.bodyLayer.position.y = 20 * UNIT - bounce * 1.8 * UNIT
      this.bodyLayer.scale.set(1 + bounce * 0.08, 1 - bounce * 0.12)
    } else if (this.pose === 'robo') {
      const step = Math.sin(t * 3) >= 0 ? 1 : -1
      frame = step > 0 ? 1 : 2
      this.bodyLayer.rotation = step * 0.08
    } else if (this.pose === 'wave') {
      const s = Math.sin(t * 9)
      this.bodyLayer.rotation = s * 0.1
    } else if (this.pose === 'sit') {
      this.bodyLayer.scale.set(1.05, 0.8)
      this.bodyLayer.position.y = 20 * UNIT - 0.6 * UNIT
    } else {
      const b = Math.sin(t * 2)
      this.bodyLayer.position.y = 20 * UNIT - Math.abs(b) * 0.25 * UNIT
    }

    if (frame !== this.frame) {
      this.frame = frame
      this.applyTexture()
    }
  }

  destroy() {
    this.root.destroy({ children: true })
  }
}
