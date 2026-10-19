import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'
import '@babylonjs/core/Culling/ray'
import { Engine } from '@babylonjs/core/Engines/engine'
import { Scene } from '@babylonjs/core/scene'
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera'
import { Camera } from '@babylonjs/core/Cameras/camera'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { ESPESSURA_PAREDE, Grade, paredesDe, salaDoPonto } from './grade'
import { estacaoDe, nomeDe, pecaDe } from './mobilia'
import { CatalogoDeMobilia } from './modelosMobilia'
import type { AvatarVisual } from './avatar'
import type { Estacao, Mapa, Movel, Pose, Sala } from './tipos'

const ELEVACAO = (55 * Math.PI) / 180
const DISTANCIA_CAMERA = 40
const ALTURA_PAREDE = 1.1
const VELOCIDADE = 3.2
const TURBO = 1.8
const ALCANCE_INTERACAO = 1.3
const ZOOM_MIN = 3.5
const ZOOM_MAX = 12

export interface EstadoLocal {
  x: number
  y: number
  direcao: number
  pose: Pose
}

export interface Interacao {
  movel: Movel
  acao: string
  estacao: Estacao | null
  sentavel: boolean
}

export interface OpcoesDoMundo {
  aoMover?: (estado: EstadoLocal) => void
  aoMudarInteracao?: (interacao: Interacao | null) => void
  aoMudarSala?: (sala: Sala | null) => void
}

interface Pessoa {
  visual: AvatarVisual
  rotulo: HTMLDivElement
  x: number
  y: number
  alvoX: number
  alvoY: number
  direcao: number
  alvoDirecao: number
  pose: Pose
  nomeVisivel: boolean
}

function cor(hex: string): Color3 {
  return Color3.FromHexString(hex)
}

function anguloSuave(atual: number, alvo: number, t: number): number {
  let delta = alvo - atual
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  return atual + delta * Math.min(1, t)
}

export class Mundo {
  readonly motor: Engine
  readonly cena: Scene
  private readonly camera: FreeCamera
  private readonly sombra: ShadowGenerator
  private readonly raizMapa: TransformNode
  private readonly pessoas = new Map<string, Pessoa>()
  private readonly catalogo: CatalogoDeMobilia
  private grade: Grade | null = null
  mapa: Mapa | null = null
  private zoom = 6.5
  private interacao: Interacao | null = null
  private salaAtual: Sala | null = null
  private sentadoEm: { movel: Movel; antes: { x: number; y: number } } | null = null
  private poseForcada: { pose: Pose; ate: number } | null = null
  dancando = false
  noclip = false
  controlavel = true
  readonly local: EstadoLocal = { x: 0, y: 0, direcao: 0, pose: 'parado' }
  private ultimoEnviado = ''
  private redimensionar = () => this.motor.resize()

  constructor(
    private readonly tela: HTMLCanvasElement,
    private readonly camadaNomes: HTMLElement,
    private readonly opcoes: OpcoesDoMundo = {},
  ) {
    this.motor = new Engine(tela, true, { stencil: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' }, true)
    this.cena = new Scene(this.motor)
    this.cena.useRightHandedSystem = true
    this.cena.clearColor = Color4.FromHexString('#e2d5b8ff')
    this.cena.ambientColor = new Color3(0.3, 0.3, 0.3)

    this.camera = new FreeCamera('camera', new Vector3(0, 20, 20), this.cena)
    this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA
    this.camera.minZ = 0.5
    this.camera.maxZ = 120
    this.camera.inputs.clear()

    const ceu = new HemisphericLight('ceu', new Vector3(0, 1, 0.3), this.cena)
    ceu.diffuse = cor('#fff6e6')
    ceu.groundColor = cor('#8a7a66')
    ceu.specular = Color3.Black()
    ceu.intensity = 0.62

    const sol = new DirectionalLight('sol', new Vector3(-0.45, -1, -0.6).normalize(), this.cena)
    sol.diffuse = cor('#fff1d6')
    sol.specular = Color3.Black()
    sol.intensity = 0.55
    sol.autoUpdateExtends = true
    this.sombra = new ShadowGenerator(2048, sol)
    this.sombra.usePercentageCloserFiltering = true
    this.sombra.filteringQuality = ShadowGenerator.QUALITY_MEDIUM
    this.sombra.bias = 0.0008
    this.sombra.normalBias = 0.02
    this.sombra.darkness = 0.35

    this.raizMapa = new TransformNode('mapa', this.cena)
    this.catalogo = new CatalogoDeMobilia(this.cena)
    window.addEventListener('resize', this.redimensionar)
    this.tela.addEventListener('wheel', this.aoRolar, { passive: false })
    this.motor.runRenderLoop(() => this.quadro())
  }

  async definirMapa(mapa: Mapa) {
    this.mapa = mapa
    this.grade = new Grade(mapa)
    for (const filho of this.raizMapa.getChildren()) filho.dispose(false, true)
    this.construirPiso(mapa)
    this.construirParedes(mapa)
    await this.catalogo.carregar()
    for (const movel of mapa.mobilia) {
      const no = this.catalogo.instanciar(movel)
      if (!no) continue
      no.parent = this.raizMapa
      for (const malha of no.getChildMeshes()) {
        this.sombra.addShadowCaster(malha)
        malha.receiveShadows = true
        malha.isPickable = false
      }
    }
    this.sentadoEm = null
    this.teleportar(mapa.spawn.x, mapa.spawn.y)
  }

  private construirPiso(mapa: Mapa) {
    const base = CreateGround('piso', { width: mapa.largura, height: mapa.profundidade }, this.cena)
    base.position.set(mapa.largura / 2, 0, mapa.profundidade / 2)
    base.material = this.materialFosco('piso', mapa.piso)
    base.receiveShadows = true
    base.parent = this.raizMapa
    base.isPickable = false
    for (const sala of mapa.salas) {
      const piso = CreateGround(`piso-${sala.id}`, { width: sala.largura, height: sala.profundidade }, this.cena)
      piso.position.set(sala.x + sala.largura / 2, 0.004, sala.y + sala.profundidade / 2)
      piso.material = this.materialFosco(`piso-${sala.id}`, sala.piso)
      piso.receiveShadows = true
      piso.parent = this.raizMapa
      piso.isPickable = false
    }
  }

  private construirParedes(mapa: Mapa) {
    const material = this.materialFosco('parede', '#d8c7a2')
    const topo = this.materialFosco('paredeTopo', '#7a6a52')
    for (const parede of paredesDe(mapa)) {
      const comprimento = parede.fim - parede.inicio + ESPESSURA_PAREDE
      const meio = (parede.inicio + parede.fim) / 2
      const largura = parede.horizontal ? comprimento : ESPESSURA_PAREDE
      const profundidade = parede.horizontal ? ESPESSURA_PAREDE : comprimento
      const x = parede.horizontal ? meio : parede.linha
      const y = parede.horizontal ? parede.linha : meio
      const bloco = CreateBox('parede', { width: largura, depth: profundidade, height: ALTURA_PAREDE }, this.cena)
      bloco.position.set(x, ALTURA_PAREDE / 2, y)
      bloco.material = material
      bloco.parent = this.raizMapa
      bloco.receiveShadows = true
      bloco.isPickable = false
      this.sombra.addShadowCaster(bloco)
      const tampa = CreateBox('paredeTopo', { width: largura + 0.01, depth: profundidade + 0.01, height: 0.04 }, this.cena)
      tampa.position.set(x, ALTURA_PAREDE + 0.02, y)
      tampa.material = topo
      tampa.parent = this.raizMapa
      tampa.isPickable = false
    }
  }

  private materialFosco(nome: string, hex: string): StandardMaterial {
    const material = new StandardMaterial(nome, this.cena)
    material.diffuseColor = cor(hex)
    material.specularColor = Color3.Black()
    return material
  }

  adicionarPessoa(id: string, visual: AvatarVisual, nome: string, x: number, y: number) {
    this.removerPessoa(id)
    const rotulo = document.createElement('div')
    rotulo.className = 'mundo-nome'
    rotulo.textContent = nome
    this.camadaNomes.appendChild(rotulo)
    for (const malha of visual.malhas) {
      this.sombra.addShadowCaster(malha)
      malha.isPickable = false
    }
    visual.raiz.position.set(x, 0, y)
    this.pessoas.set(id, { visual, rotulo, x, y, alvoX: x, alvoY: y, direcao: 0, alvoDirecao: 0, pose: 'parado', nomeVisivel: true })
  }

  trocarVisual(id: string, visual: AvatarVisual) {
    const pessoa = this.pessoas.get(id)
    if (!pessoa) return
    pessoa.visual.destruir()
    for (const malha of visual.malhas) {
      this.sombra.addShadowCaster(malha)
      malha.isPickable = false
    }
    pessoa.visual = visual
    visual.raiz.position.set(pessoa.x, 0, pessoa.y)
    visual.raiz.rotation.y = pessoa.direcao
    visual.definirPose(pessoa.pose)
  }

  removerPessoa(id: string) {
    const pessoa = this.pessoas.get(id)
    if (!pessoa) return
    pessoa.visual.destruir()
    pessoa.rotulo.remove()
    this.pessoas.delete(id)
  }

  temPessoa(id: string): boolean {
    return this.pessoas.has(id)
  }

  atualizarRemoto(id: string, x: number, y: number, direcao: number, pose: Pose, nome?: string) {
    const pessoa = this.pessoas.get(id)
    if (!pessoa) return
    const distancia = Math.hypot(x - pessoa.x, y - pessoa.y)
    if (distancia > 4) {
      pessoa.x = x
      pessoa.y = y
    }
    pessoa.alvoX = x
    pessoa.alvoY = y
    pessoa.alvoDirecao = direcao
    if (pessoa.pose !== pose) {
      pessoa.pose = pose
      pessoa.visual.definirPose(pose)
    }
    if (nome !== undefined && pessoa.rotulo.textContent !== nome) pessoa.rotulo.textContent = nome
  }

  mostrarNome(id: string, visivel: boolean) {
    const pessoa = this.pessoas.get(id)
    if (pessoa) pessoa.nomeVisivel = visivel
  }

  posicaoDe(id: string): { x: number; y: number } | null {
    const pessoa = this.pessoas.get(id)
    return pessoa ? { x: pessoa.x, y: pessoa.y } : null
  }

  teleportar(x: number, y: number) {
    this.local.x = x
    this.local.y = y
    const eu = this.pessoas.get('eu')
    if (eu) {
      eu.x = eu.alvoX = x
      eu.y = eu.alvoY = y
    }
  }

  interagir() {
    if (this.sentadoEm) {
      this.levantar()
      return
    }
    const alvo = this.interacao
    if (!alvo) return
    if (alvo.sentavel) this.sentar(alvo.movel)
  }

  gesto(pose: 'acenar' | 'dancar') {
    if (pose === 'dancar') {
      this.dancando = !this.dancando
      return
    }
    this.poseForcada = { pose, ate: performance.now() + 2500 }
  }

  private sentar(movel: Movel) {
    this.sentadoEm = { movel, antes: { x: this.local.x, y: this.local.y } }
    this.local.x = movel.x
    this.local.y = movel.y
    this.local.direcao = (movel.giro * Math.PI) / 180
    this.dancando = false
  }

  private levantar() {
    if (!this.sentadoEm) return
    this.local.x = this.sentadoEm.antes.x
    this.local.y = this.sentadoEm.antes.y
    this.sentadoEm = null
  }

  definirZoom(valor: number) {
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, valor))
  }

  private readonly aoRolar = (e: WheelEvent) => {
    e.preventDefault()
    this.definirZoom(this.zoom * (e.deltaY > 0 ? 1.1 : 0.9))
  }

  private quadro() {
    const dt = Math.min(this.motor.getDeltaTime() / 1000, 0.05)
    this.moverLocal(dt)
    for (const [id, pessoa] of this.pessoas) {
      if (id === 'eu') {
        pessoa.x = pessoa.alvoX = this.local.x
        pessoa.y = pessoa.alvoY = this.local.y
        pessoa.alvoDirecao = this.local.direcao
        if (pessoa.pose !== this.local.pose) {
          pessoa.pose = this.local.pose
          pessoa.visual.definirPose(this.local.pose)
        }
      } else {
        const t = Math.min(1, dt * 10)
        pessoa.x += (pessoa.alvoX - pessoa.x) * t
        pessoa.y += (pessoa.alvoY - pessoa.y) * t
      }
      pessoa.direcao = anguloSuave(pessoa.direcao, pessoa.alvoDirecao, dt * 14)
      pessoa.visual.raiz.position.set(pessoa.x, 0, pessoa.y)
      pessoa.visual.raiz.rotation.y = pessoa.direcao
      pessoa.visual.atualizar(dt)
    }
    this.posicionarCamera()
    this.cena.render()
    this.posicionarNomes()
  }

  private moverLocal(dt: number) {
    if (!this.mapa || !this.grade) return
    const entrada = this.controlavel ? this.direcaoDesejada() : { x: 0, y: 0, correndo: false }
    let movendo = false
    if (entrada.x || entrada.y) {
      if (this.sentadoEm) this.levantar()
      const norma = Math.hypot(entrada.x, entrada.y)
      const passo = VELOCIDADE * (entrada.correndo ? TURBO : 1) * dt
      const dx = (entrada.x / norma) * passo
      const dy = (entrada.y / norma) * passo
      const nx = this.local.x + dx
      const ny = this.local.y + dy
      const preso = this.grade.ocupado(this.local.x, this.local.y)
      if (this.noclip || preso || !this.grade.ocupado(nx, this.local.y)) this.local.x = Math.min(this.mapa.largura - 0.3, Math.max(0.3, nx))
      if (this.noclip || preso || !this.grade.ocupado(this.local.x, ny)) this.local.y = Math.min(this.mapa.profundidade - 0.3, Math.max(0.3, ny))
      this.local.direcao = Math.atan2(dx, dy)
      movendo = true
      this.dancando = false
      this.poseForcada = null
    }
    const agora = performance.now()
    if (this.poseForcada && agora > this.poseForcada.ate) this.poseForcada = null
    this.local.pose = this.sentadoEm ? 'sentar' : movendo ? 'andar' : this.poseForcada ? this.poseForcada.pose : this.dancando ? 'dancar' : 'parado'
    this.atualizarArredores()
    const assinatura = `${this.local.x.toFixed(2)}|${this.local.y.toFixed(2)}|${this.local.direcao.toFixed(2)}|${this.local.pose}`
    if (assinatura !== this.ultimoEnviado) {
      this.ultimoEnviado = assinatura
      this.opcoes.aoMover?.({ ...this.local })
    }
  }

  direcaoDesejada: () => { x: number; y: number; correndo: boolean } = () => ({ x: 0, y: 0, correndo: false })

  private atualizarArredores() {
    const mapa = this.mapa
    if (!mapa) return
    let melhor: Interacao | null = null
    let melhorDistancia = ALCANCE_INTERACAO
    if (!this.sentadoEm) {
      for (const movel of mapa.mobilia) {
        const peca = pecaDe(movel)
        const estacao = estacaoDe(movel)
        if (!peca || (!peca.sentavel && !estacao)) continue
        const raio = Math.max(peca.largura, peca.profundidade) / 2
        const distancia = Math.hypot(movel.x - this.local.x, movel.y - this.local.y) - raio
        if (distancia < melhorDistancia) {
          melhorDistancia = distancia
          const nome = nomeDe(movel)
          melhor = {
            movel,
            estacao,
            sentavel: !!peca.sentavel,
            acao: peca.sentavel ? 'sentar' : `abrir ${nome}`,
          }
        }
      }
    } else {
      melhor = { movel: this.sentadoEm.movel, estacao: null, sentavel: true, acao: 'levantar' }
    }
    if (melhor?.movel.id !== this.interacao?.movel.id || melhor?.acao !== this.interacao?.acao) {
      this.interacao = melhor
      this.opcoes.aoMudarInteracao?.(melhor)
    }
    const sala = salaDoPonto(mapa, this.local.x, this.local.y)
    if (sala?.id !== this.salaAtual?.id) {
      this.salaAtual = sala
      this.opcoes.aoMudarSala?.(sala)
    }
  }

  private posicionarCamera() {
    const alvo = new Vector3(this.local.x, 0.6, this.local.y)
    this.camera.position.set(alvo.x, alvo.y + Math.sin(ELEVACAO) * DISTANCIA_CAMERA, alvo.z + Math.cos(ELEVACAO) * DISTANCIA_CAMERA)
    this.camera.setTarget(alvo)
    const proporcao = this.motor.getRenderWidth() / Math.max(1, this.motor.getRenderHeight())
    this.camera.orthoTop = this.zoom
    this.camera.orthoBottom = -this.zoom
    this.camera.orthoLeft = -this.zoom * proporcao
    this.camera.orthoRight = this.zoom * proporcao
  }

  private posicionarNomes() {
    const largura = this.motor.getRenderWidth()
    const altura = this.motor.getRenderHeight()
    const escala = this.tela.clientWidth / Math.max(1, largura)
    const transformacao = this.cena.getTransformMatrix()
    const janela = this.camera.viewport.toGlobal(largura, altura)
    for (const pessoa of this.pessoas.values()) {
      if (!pessoa.nomeVisivel) {
        pessoa.rotulo.style.display = 'none'
        continue
      }
      const topo = pessoa.pose === 'sentar' ? 1.15 : 1.45
      const p = Vector3.Project(new Vector3(pessoa.x, topo, pessoa.y), Matrix.IdentityReadOnly, transformacao, janela)
      pessoa.rotulo.style.display = ''
      pessoa.rotulo.style.transform = `translate(${p.x * escala}px, ${p.y * escala}px) translate(-50%, -100%)`
    }
  }

  malhasDoMapa(): AbstractMesh[] {
    return this.raizMapa.getChildMeshes()
  }

  destruir() {
    window.removeEventListener('resize', this.redimensionar)
    this.tela.removeEventListener('wheel', this.aoRolar)
    for (const id of [...this.pessoas.keys()]) this.removerPessoa(id)
    this.motor.stopRenderLoop()
    this.cena.dispose()
    this.motor.dispose()
  }
}
