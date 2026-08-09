import { Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import presetsRaw from '../furniture/avatar/presets.json'
import { ESCALA_PADRAO } from '../escala-avatar'
import { GESTO_DANCA, quadroEm, type DirecaoGesto } from '../gestos'
import { precisaRecolorir, temMascara, texturaRecolorida, type CoresAlvo } from '../recolorir'

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

// texturas recoloridas ficam aqui assim que saem do forno; o desenho é
// síncrono, então a primeira leitura devolve o preset original e o quadro
// seguinte já pega a versão pintada
const RECOLORIDAS = new Map<string, Texture>()
const EM_FORNO = new Set<string>()

function chaveRecolor(preset: string, quadro: string, c: CoresAlvo): string {
  return `${preset}/${quadro}|${c.pele ?? ''}|${c.cabelo ?? ''}|${c.roupa ?? ''}`
}

const DIRECOES: Direcao[] = ['baixo', 'cima', 'esquerda', 'direita']

/**
 * Assa os 12 quadros do visual e só resolve quando todos estão prontos.
 *
 * Sem isto o boneco parado ficava para sempre com a cor original: resolveTexture é
 * síncrona e devolve a textura crua no cache miss, enquanto applyTexture só é
 * chamado quando a direção ou o quadro do ciclo mudam. Andando os quadros trocam e
 * a segunda passada pegava a versão pintada — parado, nunca.
 */
async function prepararAvatar(preset: string, cores?: CoresAlvo): Promise<void> {
  if (!cores || !precisaRecolorir(cores)) return
  const pedidos: Promise<unknown>[] = []
  for (const dir of DIRECOES) {
    for (const quadro of [0, 1, 2] as const) {
      const nome = `${dir}-${quadro}`
      if (!temMascara(preset, nome)) continue
      const chave = chaveRecolor(preset, nome, cores)
      if (RECOLORIDAS.has(chave)) continue
      const set = AVATAR_SPRITES[preset] || AVATAR_SPRITES[DEFAULT_PRESET]
      const url = set?.[nome]
      if (!url) continue
      pedidos.push(
        texturaRecolorida(Texture.from(url), preset, nome, cores)
          .then((t) => { if (t) RECOLORIDAS.set(chave, t) }),
      )
    }
  }
  await Promise.all(pedidos)
}

function resolveTexture(
  preset: string,
  direcao: Direcao,
  quadro: number,
  cores?: CoresAlvo,
): Texture {
  const set = AVATAR_SPRITES[preset] || AVATAR_SPRITES[DEFAULT_PRESET]
  const nome = `${direcao}-${quadro}`
  const url = set?.[nome]
  const base = url ? Texture.from(url) : Texture.EMPTY
  if (!cores || !precisaRecolorir(cores) || !temMascara(preset, nome)) return base

  const chave = chaveRecolor(preset, nome, cores)
  const pronta = RECOLORIDAS.get(chave)
  if (pronta) return pronta
  if (!EM_FORNO.has(chave)) {
    EM_FORNO.add(chave)
    void texturaRecolorida(base, preset, nome, cores)
      .then((t) => { if (t) RECOLORIDAS.set(chave, t) })
      .finally(() => EM_FORNO.delete(chave))
  }
  return base
}

export interface AvatarLook {
  hairStyle: string
  hairColor: string
  skin: string
  topColor: string
  pantsColor: string
}

export type Facing = 'down' | 'up' | 'left' | 'right'
export type Pose = 'idle' | 'walk' | 'dance' | 'wave' | 'sit' | 'giro' | 'pulo' | 'robo'

const UNIT = 6


const BODY_SIZE = 16 * UNIT

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/

export function sanitizeLook(raw: unknown): AvatarLook {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const color = (v: unknown, fallback: string) =>
    typeof v === 'string' && HEX_COLOR.test(v) ? v : fallback
  return {
    hairStyle: typeof a.hairStyle === 'string' && PRESET_IDS.has(a.hairStyle) ? a.hairStyle : DEFAULT_PRESET,
    hairColor: color(a.hairColor, '#3d2817'),
    skin: color(a.skin, '#e8b894'),
    topColor: color(a.topColor, '#2c7441'),
    pantsColor: color(a.pantsColor, '#1f2937'),
  }
}

// sanitizeLook sempre preenche uma cor, então cor igual ao padrão significa
// "não escolheu" — recolorir nesse caso repintaria todo mundo sem ninguém ter
// pedido. Só entra na rampa o que difere do padrão
const COR_PADRAO = { hairColor: '#3d2817', skin: '#e8b894', topColor: '#2c7441' }

function coresEscolhidas(look: AvatarLook): CoresAlvo {
  const usar = (v: string, padrao: string) =>
    v && v.toLowerCase() !== padrao ? v : null
  return {
    cabelo: usar(look.hairColor, COR_PADRAO.hairColor),
    pele: usar(look.skin, COR_PADRAO.skin),
    roupa: usar(look.topColor, COR_PADRAO.topColor),
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
  private cores: CoresAlvo

  private t = 0
  private pose: Pose = 'idle'
  private facing: Facing = 'down'
  private frame = 0
  private escala = ESCALA_PADRAO
  private nameLabel: Text
  private photoLayer: Container
  private photoSprite: Sprite | null = null
  private photoUrl: string | null = null

  constructor(look: AvatarLook) {
    this.root = new Container()
    this.preset = PRESET_IDS.has(look.hairStyle) ? look.hairStyle : DEFAULT_PRESET
    this.cores = coresEscolhidas(look)

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
    this.body = new Sprite(resolveTexture(this.preset, 'baixo', 0, this.cores))
    this.body.texture.source.scaleMode = 'nearest'
    this.body.anchor.set(0.5, 1)
    this.body.width = BODY_SIZE
    this.body.height = BODY_SIZE
    this.bodyLayer.addChild(this.body)
    this.root.addChild(this.bodyLayer)

    this.root.pivot.set(8 * UNIT, 20 * UNIT)
    this.root.addChild(this.nameLabel)
    this.updateRootScale()

    // o forno é assíncrono e o desenho é síncrono: sem reaplicar aqui, quem entra
    // parado fica com a cor original até dar o primeiro passo
    void prepararAvatar(this.preset, this.cores).then(() => {
      if (!this.morto) this.applyTexture()
    })
  }

  private morto = false

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
    const tex = resolveTexture(this.preset, dir, this.frame, this.cores)
    tex.source.scaleMode = 'nearest'
    this.body.texture = tex
  }

  setEscala(valor: number) {
    this.escala = Math.max(0.4, Math.min(3, valor))
    this.updateRootScale()
  }

  private updateRootScale() {
    this.root.scale.set(this.escala, this.escala)
    this.nameLabel.scale.set(1 / this.escala, 1 / this.escala)
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
    let direcaoGesto: DirecaoGesto | null = null
    this.bodyLayer.rotation = 0
    this.bodyLayer.scale.set(1, 1)
    this.bodyLayer.position.set(8 * UNIT, 20 * UNIT)

    if (this.pose === 'walk') {
      frame = WALK_SEQ[Math.floor(t * 8) % WALK_SEQ.length] ?? 0
      this.bodyLayer.position.y = 20 * UNIT - Math.abs(Math.sin(t * 9)) * 0.4 * UNIT
    } else if (this.pose === 'dance') {
      const passo = quadroEm(GESTO_DANCA, t * 1000)
      direcaoGesto = passo.direcao
      frame = passo.quadro
      this.bodyLayer.position.y = 20 * UNIT - passo.offsetY * UNIT
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

    if (direcaoGesto) {
      this.frame = frame
      const tex = resolveTexture(this.preset, direcaoGesto, frame, this.cores)
      tex.source.scaleMode = 'nearest'
      this.body.texture = tex
    } else if (frame !== this.frame) {
      this.frame = frame
      this.applyTexture()
    }
  }

  destroy() {
    this.morto = true
    this.root.destroy({ children: true })
  }
}
