import '@babylonjs/loaders/glTF'
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { AssetContainer } from '@babylonjs/core/assetContainer'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup'
import type { Material } from '@babylonjs/core/Materials/material'
import type { Node } from '@babylonjs/core/node'
import type { Scene } from '@babylonjs/core/scene'
import type { AvatarVisual } from '../avatar'
import type { Pose } from '../tipos'
import { PECAS, SLOTS, pecaDe, type Aparencia } from './catalogo'

const URL_PERSONAGEM = `${import.meta.env.BASE_URL}modelos/personagem.glb`
const conteineres = new WeakMap<Scene, Promise<AssetContainer>>()
const MALHAS = new Set(['corpo', ...PECAS.map((p) => p.malha).filter((m): m is string => !!m)])

export function carregarPersonagem(cena: Scene): Promise<AssetContainer> {
  let pedido = conteineres.get(cena)
  if (!pedido) {
    pedido = LoadAssetContainerAsync(URL_PERSONAGEM, cena)
    conteineres.set(cena, pedido)
  }
  return pedido
}

function pintar(material: Material, hex: string) {
  const alvo = material as Material & { albedoColor?: Color3; diffuseColor?: Color3 }
  const cor = Color3.FromHexString(hex)
  if (alvo.albedoColor) alvo.albedoColor = cor.toLinearSpace()
  else if (alvo.diffuseColor) alvo.diffuseColor = cor
}

export class AvatarModelo implements AvatarVisual {
  readonly raiz: TransformNode
  readonly malhas: AbstractMesh[]
  private readonly pecas = new Map<string, Node[]>()
  private readonly materiais = new Map<string, Material>()
  private readonly animacoes = new Map<string, AnimationGroup>()
  private readonly todasAnimacoes: AnimationGroup[]
  private readonly esqueletos: { dispose(): void }[]
  private atual: AnimationGroup | null = null
  private pose: Pose | null = null

  constructor(cena: Scene, conteiner: AssetContainer, aparencia: Aparencia) {
    this.raiz = new TransformNode('avatar', cena)
    const instancia = conteiner.instantiateModelsToScene((nome) => nome, true, { doNotInstantiate: true })
    for (const no of instancia.rootNodes) no.parent = this.raiz
    this.todasAnimacoes = instancia.animationGroups
    this.esqueletos = instancia.skeletons
    for (const grupo of instancia.animationGroups) {
      grupo.stop()
      this.animacoes.set(grupo.name, grupo)
    }
    this.malhas = this.raiz.getChildMeshes(false)
    for (const no of this.raiz.getDescendants(false)) {
      if (MALHAS.has(no.name)) this.pecas.set(no.name, [...(this.pecas.get(no.name) ?? []), no])
    }
    for (const malha of this.malhas) {
      malha.isPickable = false
      malha.alwaysSelectAsActiveMesh = true
      const material = malha.material
      if (material) {
        const materiais = 'subMaterials' in material ? (material as unknown as { subMaterials: Material[] }).subMaterials : [material]
        for (const m of materiais) if (m) this.materiais.set(m.name, m)
      }
    }
    this.aplicar(aparencia)
    this.definirPose('parado')
  }

  aplicar(aparencia: Aparencia) {
    const visiveis = new Set<string>(['corpo'])
    const chapeu = aparencia.pecas.chapeu.id !== 'nenhum'
    for (const { slot } of SLOTS) {
      let peca = pecaDe(slot, aparencia.pecas[slot].id)
      if (peca?.somemComChapeu && chapeu) peca = pecaDe('cabelo', 'curto')
      if (peca?.malha) visiveis.add(peca.malha)
    }
    for (const [nome, nos] of this.pecas) for (const no of nos) no.setEnabled(visiveis.has(nome))
    const pele = this.materiais.get('pele')
    if (pele) pintar(pele, aparencia.pele)
    const cabelo = this.materiais.get('tinta_cabelo')
    if (cabelo) pintar(cabelo, aparencia.corCabelo)
    for (const definicao of SLOTS) {
      if (!definicao.colorivel) continue
      const material = this.materiais.get(definicao.material)
      if (material) pintar(material, aparencia.pecas[definicao.slot].cor)
    }
  }

  definirPose(pose: Pose) {
    if (pose === this.pose) return
    this.pose = pose
    const proximo = this.animacoes.get(pose) ?? this.animacoes.get('parado') ?? null
    if (proximo === this.atual) return
    this.atual?.stop()
    this.atual = proximo
    proximo?.start(true, 1)
  }

  atualizar() {}

  destruir() {
    for (const grupo of this.todasAnimacoes) grupo.dispose()
    for (const esqueleto of this.esqueletos) esqueleto.dispose()
    this.raiz.dispose(false, true)
  }
}
