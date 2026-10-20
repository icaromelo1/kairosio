import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'
import '@babylonjs/core/Culling/ray'
import { Engine } from '@babylonjs/core/Engines/engine'
import { Scene } from '@babylonjs/core/scene'
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera'
import { Camera } from '@babylonjs/core/Cameras/camera'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { PointLight } from '@babylonjs/core/Lights/pointLight'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder'
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration'
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { ESPESSURA_PAREDE, Grade, areaDoPonto, paredesDe, salaDoPonto } from './grade'
import { estacaoDe, nomeDe, pecaDe } from './mobilia'
import { CatalogoDeMobilia } from './modelosMobilia'
import { calcularRota } from './rota'
import { luzDaHora } from './luz'
import { materialDePiso, textura } from './materiais'
import { construirLago, type Lago } from './lago'
import type { AvatarVisual } from './avatar'
import type { Area, Estacao, Mapa, Movel, Pose, Sala } from './tipos'

const ELEVACAO = (36 * Math.PI) / 180
const DISTANCIA_CAMERA = 40
const ALTURA_PAREDE = 1.1
const ALTURA_CERCA = 0.9
const VELOCIDADE = 3.2
const TURBO = 1.8
const LENTIDAO_AGUA = 0.5
const ALCANCE_INTERACAO = 1.3
const DISTANCIA_PESSOAL = 0.55
const ZOOM_MIN = 2.8
const ZOOM_MAX = 12

const CORES_DE_AREA: Record<Area['tipo'], string> = {
  caminho: '#e2cfa3',
  pedra: '#d6cdbb',
  deck: '#c4935f',
  agua: '#4f9fcc',
  terra: '#8a6a48',
  grama: '#7fb85c',
}

const TEXTURAS_DE_AREA: Record<Area['tipo'], { nome: string; tamanho: number }> = {
  caminho: { nome: 'cascalho', tamanho: 2.5 },
  pedra: { nome: 'pavimento', tamanho: 3 },
  deck: { nome: 'deck', tamanho: 3 },
  agua: { nome: 'variacao', tamanho: 4 },
  terra: { nome: 'cascalho', tamanho: 2 },
  grama: { nome: 'grama', tamanho: 3 },
}

const TAMANHO_DE_TEXTURA: Record<string, number> = { madeira: 3, carpete: 2, ladrilho: 2.4, pavimento: 3, cascalho: 2.5, deck: 3, grama: 3 }
const ALCANCE_DA_SOMBRA = 18
const COR_CONTORNO = new Color3(0.16, 0.12, 0.09)

const LUZ_DAS_SALAS: Record<string, string> = {
  salao: '#fff1dc', reuniao: '#f4f6ff', copa: '#ffd8a0', foco: '#ffe9c8', ideias: '#ffe2f2', reuniao2: '#f4f6ff',
  servidores: '#9fc4ff', jogos: '#d6b6ff', recepcao: '#fff0d2', cabine1: '#ffe2b0', cabine2: '#ffe2b0', descompressao: '#ffd2a8',
}

interface EstadoLocal {
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

export interface Rota {
  pontos: { x: number; y: number }[]
  nome: string
}

interface OpcoesDoMundo {
  aoMover?: (estado: EstadoLocal) => void
  aoMudarInteracao?: (interacao: Interacao | null) => void
  aoMudarSala?: (sala: Sala | null) => void
  aoMudarRota?: (rota: Rota | null, aviso?: string) => void
  aoQuadro?: (dt: number) => void
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
  visivel: boolean
  escala: number
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
  private readonly ceu: HemisphericLight
  private readonly sol: DirectionalLight
  private readonly sombra: ShadowGenerator
  private readonly teto: DirectionalLight
  private readonly ambienteInterno: HemisphericLight
  private readonly sombraInterna: ShadowGenerator
  private luzesDeSala: PointLight[] = []
  private readonly internas = new Set<AbstractMesh>()
  private readonly dentro = new Map<string, boolean>()
  private lagos: Lago[] = []
  private luzDaAgua = Color3.White()
  private readonly raizMapa: TransformNode
  private readonly pessoas = new Map<string, Pessoa>()
  private readonly catalogo: CatalogoDeMobilia
  private grade: Grade | null = null
  mapa: Mapa | null = null
  private zoom = 4.4
  private interacao: Interacao | null = null
  private salaAtual: Sala | null = null
  private sentadoEm: { movel: Movel; antes: { x: number; y: number } } | null = null
  private poseForcada: { pose: Pose; ate: number } | null = null
  private rota: (Rota & { indice: number; parado: number; ultimaDistancia: number; replanos: number; alvo: { x: number; y: number } }) | null = null
  private deslocamento = { x: 0, y: 0 }
  dancando = false
  noclip = false
  controlavel = true
  trancadas = new Set<string>()
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
    this.cena.clearColor = Color4.FromHexString('#7fb35cff')
    const processamento = this.cena.imageProcessingConfiguration
    processamento.toneMappingEnabled = true
    processamento.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
    processamento.exposure = 1.35
    processamento.contrast = 1.12

    this.camera = new FreeCamera('camera', new Vector3(0, 20, 20), this.cena)
    this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA
    this.camera.minZ = 0.5
    this.camera.maxZ = 140
    this.camera.inputs.clear()

    this.ceu = new HemisphericLight('ceu', new Vector3(0, 1, 0.3), this.cena)
    this.ceu.specular = Color3.Black()
    this.sol = new DirectionalLight('sol', new Vector3(-0.45, -1, -0.6).normalize(), this.cena)
    this.sol.specular = Color3.Black()
    this.sol.autoUpdateExtends = false
    this.sol.autoCalcShadowZBounds = false
    this.sol.orthoLeft = -ALCANCE_DA_SOMBRA
    this.sol.orthoRight = ALCANCE_DA_SOMBRA
    this.sol.orthoTop = ALCANCE_DA_SOMBRA
    this.sol.orthoBottom = -ALCANCE_DA_SOMBRA
    this.sol.shadowMinZ = 1
    this.sol.shadowMaxZ = 80
    this.sombra = new ShadowGenerator(4096, this.sol)
    this.sombra.usePercentageCloserFiltering = true
    this.sombra.filteringQuality = ShadowGenerator.QUALITY_HIGH
    this.sombra.bias = 0.0005
    this.sombra.normalBias = 0.015
    this.sombra.darkness = 0.25
    this.teto = new DirectionalLight('teto', new Vector3(0.15, -1, -0.55).normalize(), this.cena)
    this.teto.diffuse = cor('#fff3df')
    this.teto.specular = Color3.Black()
    this.teto.intensity = 0.7
    this.teto.position = new Vector3(32, 30, 20)
    this.ambienteInterno = new HemisphericLight('ambienteInterno', new Vector3(0, 1, 0.6), this.cena)
    this.ambienteInterno.diffuse = cor('#fff6ea')
    this.ambienteInterno.groundColor = cor('#9a8a74')
    this.ambienteInterno.specular = Color3.Black()
    this.ambienteInterno.intensity = 0.68
    this.sombraInterna = new ShadowGenerator(2048, this.teto)
    this.sombraInterna.usePercentageCloserFiltering = true
    this.sombraInterna.filteringQuality = ShadowGenerator.QUALITY_HIGH
    this.sombraInterna.bias = 0.0006
    this.sombraInterna.normalBias = 0.015
    this.sombraInterna.darkness = 0.45
    this.teto.includedOnlyMeshes = []
    this.ambienteInterno.includedOnlyMeshes = []
    const pipeline = new DefaultRenderingPipeline('pos', true, this.cena, [this.camera])
    pipeline.fxaaEnabled = true
    pipeline.samples = 4
    pipeline.bloomEnabled = true
    pipeline.bloomThreshold = 0.82
    pipeline.bloomWeight = 0.28
    pipeline.bloomKernel = 48
    pipeline.bloomScale = 0.5
    pipeline.sharpenEnabled = true
    pipeline.sharpen.edgeAmount = 0.18
    this.definirHora(12)

    this.raizMapa = new TransformNode('mapa', this.cena)
    this.catalogo = new CatalogoDeMobilia(this.cena)
    window.addEventListener('resize', this.redimensionar)
    this.tela.addEventListener('wheel', this.aoRolar, { passive: false })
    this.motor.runRenderLoop(() => this.quadro())
  }

  definirHora(hora: number) {
    const luz = luzDaHora(hora)
    this.ceu.diffuse = cor(luz.ceu)
    this.ceu.groundColor = cor(luz.chao)
    this.ceu.intensity = luz.intensidadeCeu
    this.sol.diffuse = cor(luz.sol)
    this.sol.intensity = luz.intensidadeSol
    this.cena.clearColor = Color4.FromHexString(`${luz.fundo}ff`)
    this.luzDaAgua = Color3.White().scale(0.15).add(cor(luz.ceu).scale(luz.intensidadeCeu * 0.6 + luz.intensidadeSol * 0.3))
    for (const lago of this.lagos ?? []) lago.definirLuz(this.luzDaAgua)
  }

  async definirMapa(mapa: Mapa) {
    this.mapa = mapa
    this.grade = new Grade(mapa)
    for (const filho of this.raizMapa.getChildren()) filho.dispose(false, true)
    for (const luz of this.luzesDeSala) luz.dispose()
    this.luzesDeSala = []
    this.internas.clear()
    this.construirPiso(mapa)
    this.construirParedes(mapa)
    await this.catalogo.carregar()
    for (const movel of mapa.mobilia) {
      const interna = !!salaDoPonto(mapa, movel.x, movel.y)
      const no = this.catalogo.instanciar(movel, interna)
      if (!no) continue
      no.parent = this.raizMapa
      for (const malha of no.getChildMeshes()) {
        malha.receiveShadows = true
        malha.isPickable = false
        if (malha.name.startsWith('movel-')) {
          if (interna) this.internas.add(malha)
          ;(interna ? this.sombraInterna : this.sombra).addShadowCaster(malha)
        }
      }
    }
    this.contornar([...this.catalogo.todasAsFontes(false), ...this.catalogo.todasAsFontes(true)], 0.012)
    for (const fonte of this.catalogo.todasAsFontes(false)) this.sombra.addShadowCaster(fonte)
    for (const fonte of this.catalogo.todasAsFontes(true)) {
      this.internas.add(fonte)
      this.sombraInterna.addShadowCaster(fonte)
    }
    this.criarLuzesDeSala(mapa)
    this.aplicarLuzes()
    this.sentadoEm = null
    this.cancelarRota()
    this.teleportar(mapa.spawn.x, mapa.spawn.y)
  }

  private construirPiso(mapa: Mapa) {
    this.lagos = []
    const base = CreateGround('piso', { width: mapa.largura, height: mapa.profundidade }, this.cena)
    base.position.set(mapa.largura / 2, 0, mapa.profundidade / 2)
    base.material = materialDePiso(this.cena, 'piso', mapa.piso, 'gramado', mapa.largura, mapa.profundidade, 4)
    base.receiveShadows = true
    base.parent = this.raizMapa
    base.isPickable = false
    const areas = mapa.areas ?? []
    areas.forEach((area, i) => {
      const altura = 0.004 + i * 0.0006
      const circulo = area.forma === 'circulo'
      if (area.tipo === 'agua') {
        this.construirLago(area)
        return
      }
      const malha = circulo
        ? CreateDisc(`area-${area.id}`, { radius: 0.5, tessellation: 48 }, this.cena)
        : CreateGround(`area-${area.id}`, { width: 1, height: 1 }, this.cena)
      if (circulo) {
        malha.rotation.x = Math.PI / 2
        malha.scaling.set(area.largura, area.profundidade, 1)
      } else {
        malha.scaling.set(area.largura, 1, area.profundidade)
      }
      malha.position.set(area.x, altura, area.y)
      const tex = TEXTURAS_DE_AREA[area.tipo]
      const material = materialDePiso(this.cena, `area-${area.id}`, CORES_DE_AREA[area.tipo], tex.nome, area.largura, area.profundidade, tex.tamanho)
      malha.material = material
      malha.receiveShadows = true
      malha.parent = this.raizMapa
      malha.isPickable = false
    })
    for (const sala of mapa.salas) {
      const piso = CreateGround(`piso-${sala.id}`, { width: sala.largura, height: sala.profundidade }, this.cena)
      piso.position.set(sala.x + sala.largura / 2, sala.murada ? 0.012 : 0.014, sala.y + sala.profundidade / 2)
      const nomeTextura = sala.textura ?? 'madeira'
      const materialPiso = materialDePiso(this.cena, `piso-${sala.id}`, sala.piso, nomeTextura, sala.largura, sala.profundidade, TAMANHO_DE_TEXTURA[nomeTextura] ?? 3)
      materialPiso.maxSimultaneousLights = 6
      piso.material = materialPiso
      piso.receiveShadows = true
      this.internas.add(piso)
      piso.parent = this.raizMapa
      piso.isPickable = false
    }
  }

  private construirLago(area: Area) {
    const lago = construirLago(this.cena, area, this.raizMapa, this.sombra)
    this.contornar(lago.contornaveis, 0.012)
    lago.definirLuz(this.luzDaAgua)
    this.lagos.push(lago)
  }

  private criarLuzesDeSala(mapa: Mapa) {
    for (const sala of mapa.salas) {
      const piso = this.cena.getMeshByName(`piso-${sala.id}`)
      if (!piso) continue
      const luz = new PointLight(`luz-${sala.id}`, new Vector3(sala.x + sala.largura / 2, 3.2, sala.y + sala.profundidade / 2), this.cena)
      luz.diffuse = cor(sala.luz ?? LUZ_DAS_SALAS[sala.id] ?? '#fff1dc')
      luz.specular = Color3.Black()
      luz.intensity = sala.murada ? 0.35 : 0.55
      luz.range = Math.max(sala.largura, sala.profundidade) * (sala.murada ? 0.75 : 1.1)
      luz.includedOnlyMeshes = [piso]
      this.luzesDeSala.push(luz)
    }
  }

  private aplicarLuzes() {
    const internas = [...this.internas]
    this.sol.excludedMeshes = internas
    this.ceu.excludedMeshes = internas
    this.teto.includedOnlyMeshes = internas
    this.ambienteInterno.includedOnlyMeshes = internas
  }

  private ehParedeDoPredio(mapa: Mapa, p: { horizontal: boolean; linha: number; inicio: number; fim: number }): boolean {
    return mapa.salas.some((sala) => {
      if (!sala.murada) return false
      if (p.horizontal) return (Math.abs(p.linha - sala.y) < 0.01 || Math.abs(p.linha - sala.y - sala.profundidade) < 0.01) && p.inicio >= sala.x - 0.01 && p.fim <= sala.x + sala.largura + 0.01
      return (Math.abs(p.linha - sala.x) < 0.01 || Math.abs(p.linha - sala.x - sala.largura) < 0.01) && p.inicio >= sala.y - 0.01 && p.fim <= sala.y + sala.profundidade + 0.01
    })
  }

  private construirParedes(mapa: Mapa) {
    const parede = this.materialFosco('parede', '#efe4cc')
    parede.diffuseTexture = textura(this.cena, 'reboco')
    const rodape = this.materialFosco('rodape', '#6b5a44')
    const topo = this.materialFosco('paredeTopo', '#8a7558')
    const cerca = this.materialFosco('cerca', '#5c9a4c')
    cerca.diffuseTexture = textura(this.cena, 'grama')
    const cercaTopo = this.materialFosco('cercaTopo', '#76b45f')
    cercaTopo.diffuseTexture = textura(this.cena, 'grama')
    let interna = false
    const bloco = (nome: string, largura: number, profundidade: number, altura: number, x: number, y: number, z: number, material: StandardMaterial, sombra: boolean) => {
      const malha = CreateBox(nome, { width: largura, depth: profundidade, height: altura }, this.cena)
      malha.position.set(x, y, z)
      malha.material = material
      malha.parent = this.raizMapa
      malha.receiveShadows = true
      malha.isPickable = false
      if (interna) this.internas.add(malha)
      if (sombra) {
        this.sombra.addShadowCaster(malha)
        if (interna) this.sombraInterna.addShadowCaster(malha)
      }
    }
    for (const p of paredesDe(mapa)) {
      interna = !p.externa && !this.ehParedeDoPredio(mapa, p)
      const altura = p.externa ? ALTURA_CERCA : ALTURA_PAREDE
      const espessura = p.externa ? 0.6 : ESPESSURA_PAREDE
      const comprimento = p.fim - p.inicio + espessura
      const meio = (p.inicio + p.fim) / 2
      const largura = p.horizontal ? comprimento : espessura
      const profundidade = p.horizontal ? espessura : comprimento
      const x = p.horizontal ? meio : p.linha
      const z = p.horizontal ? p.linha : meio
      bloco('parede', largura, profundidade, altura, x, altura / 2, z, p.externa ? cerca : parede, true)
      bloco('paredeTopo', largura + 0.02, profundidade + 0.02, 0.05, x, altura + 0.025, z, p.externa ? cercaTopo : topo, false)
      if (!p.externa) {
        bloco('rodape', p.horizontal ? largura : espessura + 0.04, p.horizontal ? espessura + 0.04 : profundidade, 0.12, x, 0.06, z, rodape, false)
      }
    }
  }

  private posicionarSombra() {
    const alvo = new Vector3(this.local.x + this.deslocamento.x, 0, this.local.y + this.deslocamento.y)
    this.sol.position = alvo.subtract(this.sol.direction.scale(40))
  }

  private materialFosco(nome: string, hex: string): StandardMaterial {
    const existente = this.cena.getMaterialByName(nome)
    if (existente instanceof StandardMaterial) return existente
    const material = new StandardMaterial(nome, this.cena)
    material.diffuseColor = cor(hex)
    material.specularColor = Color3.Black()
    return material
  }

  private contornar(malhas: AbstractMesh[], espessura: number) {
    for (const malha of malhas) {
      if (malha.getTotalVertices() === 0) continue
      malha.renderOutline = true
      malha.outlineColor = COR_CONTORNO
      malha.outlineWidth = espessura
    }
  }

  adicionarPessoa(id: string, visual: AvatarVisual, nome: string, x: number, y: number) {
    this.contornar(visual.malhas, 0.014)
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
    this.pessoas.set(id, { visual, rotulo, x, y, alvoX: x, alvoY: y, direcao: 0, alvoDirecao: 0, pose: 'parado', nomeVisivel: true, visivel: true, escala: 1 })
    this.dentro.delete(id)
    this.atualizarZona(id)
  }

  private atualizarZona(id: string) {
    const pessoa = this.pessoas.get(id)
    if (!pessoa || !this.mapa) return
    const agora = !!salaDoPonto(this.mapa, pessoa.x, pessoa.y)
    if (this.dentro.get(id) === agora) return
    this.dentro.set(id, agora)
    for (const malha of pessoa.visual.malhas) {
      if (agora) {
        this.internas.add(malha)
        this.sombra.removeShadowCaster(malha)
        this.sombraInterna.addShadowCaster(malha)
      } else {
        this.internas.delete(malha)
        this.sombraInterna.removeShadowCaster(malha)
        this.sombra.addShadowCaster(malha)
      }
    }
    this.aplicarLuzes()
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
    this.contornar(visual.malhas, 0.014)
    this.dentro.delete(id)
    this.atualizarZona(id)
    visual.raiz.position.set(pessoa.x, 0, pessoa.y)
    visual.raiz.rotation.y = pessoa.direcao
    visual.raiz.scaling.setAll(pessoa.escala)
    visual.raiz.setEnabled(pessoa.visivel)
    visual.definirPose(pessoa.pose)
  }

  removerPessoa(id: string) {
    const pessoa = this.pessoas.get(id)
    if (!pessoa) return
    for (const malha of pessoa.visual.malhas) this.internas.delete(malha)
    pessoa.visual.destruir()
    pessoa.rotulo.remove()
    this.pessoas.delete(id)
    this.dentro.delete(id)
  }

  temPessoa(id: string): boolean {
    return this.pessoas.has(id)
  }

  atualizarRemoto(id: string, x: number, y: number, direcao: number, pose: Pose, nome?: string) {
    const pessoa = this.pessoas.get(id)
    if (!pessoa) return
    if (Math.hypot(x - pessoa.x, y - pessoa.y) > 4) {
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

  definirEscala(id: string, escala: number) {
    const pessoa = this.pessoas.get(id)
    if (!pessoa) return
    pessoa.escala = escala
    pessoa.visual.raiz.scaling.setAll(escala)
  }

  definirVisivel(id: string, visivel: boolean) {
    const pessoa = this.pessoas.get(id)
    if (!pessoa) return
    pessoa.visivel = visivel
    pessoa.visual.raiz.setEnabled(visivel)
  }

  mostrarNome(id: string, visivel: boolean) {
    const pessoa = this.pessoas.get(id)
    if (pessoa) pessoa.nomeVisivel = visivel
  }

  estaLivre(x: number, y: number): boolean {
    return !!this.grade && !this.grade.ocupado(x, y)
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
    if (alvo?.sentavel) this.sentar(alvo.movel)
  }

  gesto(pose: 'acenar' | 'dancar') {
    if (pose === 'dancar') {
      this.dancando = !this.dancando
      return
    }
    this.poseForcada = { pose, ate: performance.now() + 2500 }
  }

  festa(segundos = 5) {
    this.dancando = true
    window.setTimeout(() => { this.dancando = false }, segundos * 1000)
  }

  private sentar(movel: Movel) {
    this.cancelarRota()
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

  irPara(x: number, y: number, nome = 'lá'): boolean {
    if (!this.grade) return false
    const pontos = calcularRota(this.grade, this.local, { x, y }, (px, py) => this.bloqueadoPorTranca(px, py))
    if (!pontos?.length) {
      this.rota = null
      this.opcoes.aoMudarRota?.(null, `Não dá pra chegar em ${nome}.`)
      return false
    }
    if (this.sentadoEm) this.levantar()
    this.rota = { pontos, nome, indice: 0, parado: 0, ultimaDistancia: Infinity, replanos: 0, alvo: { x, y } }
    this.opcoes.aoMudarRota?.({ pontos, nome })
    return true
  }

  irParaSala(salaId: string): boolean {
    const mapa = this.mapa
    const sala = mapa?.salas.find((s) => s.id === salaId)
    if (!mapa || !sala) return false
    if (salaDoPonto(mapa, this.local.x, this.local.y)?.id === sala.id) {
      this.opcoes.aoMudarRota?.(null, `Você já está em ${sala.nome}.`)
      return false
    }
    return this.irPara(sala.x + sala.largura / 2, sala.y + sala.profundidade / 2, sala.nome)
  }

  cancelarRota(aviso?: string) {
    if (!this.rota) return
    this.rota = null
    this.opcoes.aoMudarRota?.(null, aviso)
  }

  definirZoom(valor: number) {
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, valor))
  }

  arrastarCamera(dxPx: number, dyPx: number) {
    const porPixel = (this.zoom * 2) / Math.max(1, this.tela.clientHeight)
    this.deslocamento.x -= dxPx * porPixel
    this.deslocamento.y -= (dyPx * porPixel) / Math.sin(ELEVACAO)
  }

  recentrarCamera() {
    this.deslocamento.x = 0
    this.deslocamento.y = 0
  }

  private readonly aoRolar = (e: WheelEvent) => {
    e.preventDefault()
    this.definirZoom(this.zoom * (e.deltaY > 0 ? 1.1 : 0.9))
  }

  private quadro() {
    const decorrido = Math.min(this.motor.getDeltaTime() / 1000, 0.5)
    const passos = Math.max(1, Math.ceil(decorrido / 0.05))
    for (let i = 0; i < passos; i++) this.moverLocal(decorrido / passos)
    const dt = Math.min(decorrido, 0.05)
    this.opcoes.aoQuadro?.(dt)
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
        const t = Math.min(1, decorrido * 10)
        pessoa.x += (pessoa.alvoX - pessoa.x) * t
        pessoa.y += (pessoa.alvoY - pessoa.y) * t
      }
      pessoa.direcao = anguloSuave(pessoa.direcao, pessoa.alvoDirecao, decorrido * 14)
      pessoa.visual.raiz.position.set(pessoa.x, 0, pessoa.y)
      pessoa.visual.raiz.rotation.y = pessoa.direcao
      pessoa.visual.atualizar(dt)
      this.atualizarZona(id)
    }
    this.posicionarCamera()
    this.posicionarSombra()
    for (const lago of this.lagos) lago.atualizar(decorrido)
    this.cena.render()
    this.posicionarNomes()
  }

  private bloqueadoPorTranca(x: number, y: number): boolean {
    if (!this.mapa || !this.trancadas.size) return false
    const destino = salaDoPonto(this.mapa, x, y)
    if (!destino || destino.aberta || !this.trancadas.has(destino.id)) return false
    return salaDoPonto(this.mapa, this.local.x, this.local.y)?.id !== destino.id
  }

  private esbarraEmAlguem(nx: number, ny: number): boolean {
    for (const [id, p] of this.pessoas) {
      if (id === 'eu' || !p.visivel) continue
      const depois = Math.hypot(p.x - nx, p.y - ny)
      if (depois < DISTANCIA_PESSOAL && depois < Math.hypot(p.x - this.local.x, p.y - this.local.y)) return true
    }
    return false
  }

  private direcaoDaRota(dt: number, profundidade = 0): { x: number; y: number } | null {
    const rota = this.rota
    if (!rota || profundidade > 3) return null
    const alvo = rota.pontos[rota.indice]
    const distancia = Math.hypot(alvo.x - this.local.x, alvo.y - this.local.y)
    if (distancia < 0.2) {
      rota.indice++
      rota.ultimaDistancia = Infinity
      if (rota.indice >= rota.pontos.length) {
        this.cancelarRota()
        return null
      }
      return this.direcaoDaRota(dt, profundidade + 1)
    }
    if (distancia < rota.ultimaDistancia - 0.01) {
      rota.ultimaDistancia = distancia
      rota.parado = 0
    } else {
      rota.parado += dt
      if (rota.parado > 0.8) {
        const { alvo: destino, nome, replanos } = rota
        if (replanos < 2 && this.irPara(destino.x, destino.y, nome) && this.rota) this.rota.replanos = replanos + 1
        else this.cancelarRota('Não consegui chegar até lá.')
        return null
      }
    }
    return { x: (alvo.x - this.local.x) / distancia, y: (alvo.y - this.local.y) / distancia }
  }

  private moverLocal(dt: number) {
    if (!this.mapa || !this.grade) return
    const entrada = this.controlavel ? this.direcaoDesejada() : { x: 0, y: 0, correndo: false }
    if (entrada.x || entrada.y) this.cancelarRota()
    const automatica = !entrada.x && !entrada.y ? this.direcaoDaRota(dt) : null
    const dirX = automatica ? automatica.x : entrada.x
    const dirY = automatica ? automatica.y : entrada.y
    let movendo = false
    let correndo = false
    if (dirX || dirY) {
      if (this.sentadoEm) this.levantar()
      const norma = Math.hypot(dirX, dirY)
      const naAgua = areaDoPonto(this.mapa, this.local.x, this.local.y)?.tipo === 'agua'
      const passo = VELOCIDADE * (entrada.correndo ? TURBO : 1) * (naAgua ? LENTIDAO_AGUA : 1) * dt
      const dx = (dirX / norma) * passo
      const dy = (dirY / norma) * passo
      const nx = this.local.x + dx
      const ny = this.local.y + dy
      const grade = this.grade
      const preso = grade.ocupado(this.local.x, this.local.y)
      const livre = (x: number, y: number) =>
        this.noclip || ((preso || !grade.ocupado(x, y)) && !this.bloqueadoPorTranca(x, y) && !this.esbarraEmAlguem(x, y))
      if (livre(nx, this.local.y)) this.local.x = Math.min(this.mapa.largura - 0.3, Math.max(0.3, nx))
      if (livre(this.local.x, ny)) this.local.y = Math.min(this.mapa.profundidade - 0.3, Math.max(0.3, ny))
      this.local.direcao = Math.atan2(dx, dy)
      movendo = true
      correndo = entrada.correndo && !naAgua
      this.dancando = false
      this.poseForcada = null
    }
    const agora = performance.now()
    if (this.poseForcada && agora > this.poseForcada.ate) this.poseForcada = null
    this.local.pose = this.sentadoEm ? 'sentar' : movendo ? (correndo ? 'correr' : 'andar') : this.poseForcada ? this.poseForcada.pose : this.dancando ? 'dancar' : 'parado'
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
    const sentado = !!this.sentadoEm
    for (const movel of mapa.mobilia) {
      const peca = pecaDe(movel)
      const estacao = estacaoDe(movel)
      if (!peca || (!peca.sentavel && !estacao)) continue
      if (sentado && !estacao) continue
      const raio = Math.max(peca.largura, peca.profundidade) / 2
      const distancia = Math.hypot(movel.x - this.local.x, movel.y - this.local.y) - raio
      if (distancia < melhorDistancia) {
        melhorDistancia = distancia
        melhor = { movel, estacao, sentavel: !!peca.sentavel, acao: peca.sentavel ? 'sentar' : `abrir ${nomeDe(movel)}` }
      }
    }
    if (sentado && !melhor) melhor = { movel: this.sentadoEm!.movel, estacao: null, sentavel: true, acao: 'levantar' }
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
    const alvo = new Vector3(this.local.x + this.deslocamento.x, 0.6, this.local.y + this.deslocamento.y)
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
      if (!pessoa.nomeVisivel || !pessoa.visivel) {
        pessoa.rotulo.style.display = 'none'
        continue
      }
      const topo = (pessoa.pose === 'sentar' ? 1.15 : 1.45) * pessoa.escala
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
