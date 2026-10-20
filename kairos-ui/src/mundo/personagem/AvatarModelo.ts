import '@babylonjs/loaders/glTF'
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader'
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
import { converterMalhas, pintarMaterial } from '../materiais'

const URL_PERSONAGEM = `${import.meta.env.BASE_URL}modelos/personagem.glb`
const conteineres = new WeakMap<Scene, Promise<AssetContainer>>()
const CORTES = ['chapeu', 'aba'] as const
const MALHAS = new Set(['corpo', ...PECAS.flatMap((p) => (p.malha ? [p.malha, ...(p.slot === 'cabelo' ? CORTES.map((c) => `${p.malha}_${c}`) : [])] : []))])

export function carregarPersonagem(cena: Scene): Promise<AssetContainer> {
  let pedido = conteineres.get(cena)
  if (!pedido) {
    pedido = LoadAssetContainerAsync(URL_PERSONAGEM, cena)
    conteineres.set(cena, pedido)
  }
  return pedido
}

export class AvatarModelo implements AvatarVisual {
  readonly raiz: TransformNode
  readonly malhas: AbstractMesh[]
  private readonly pecas = new Map<string, Node[]>()
  private readonly materiais = new Map<string, Material[]>()
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
    converterMalhas(cena, this.malhas)
    for (const no of this.raiz.getDescendants(false)) {
      if (MALHAS.has(no.name)) this.pecas.set(no.name, [...(this.pecas.get(no.name) ?? []), no])
    }
    for (const malha of this.malhas) {
      malha.isPickable = false
      malha.alwaysSelectAsActiveMesh = true
      const material = malha.material
      if (material) {
        const materiais = 'subMaterials' in material ? (material as unknown as { subMaterials: Material[] }).subMaterials : [material]
        for (const m of materiais) {
          if (!m) continue
          const base = m.name.split('#')[0]
          const lista = this.materiais.get(base) ?? []
          if (!lista.includes(m)) lista.push(m)
          this.materiais.set(base, lista)
        }
      }
    }
    this.aplicar(aparencia)
    this.definirPose('parado')
  }

  aplicar(aparencia: Aparencia) {
    const visiveis = new Set<string>(['corpo'])
    const corte = pecaDe('chapeu', aparencia.pecas.chapeu.id)?.corte
    const semBaixo = !!pecaDe('cima', aparencia.pecas.cima.id)?.cobreBaixo
    for (const { slot } of SLOTS) {
      const peca = pecaDe(slot, aparencia.pecas[slot].id)
      if (!peca?.malha || (slot === 'baixo' && semBaixo)) continue
      visiveis.add(slot === 'cabelo' && corte ? `${peca.malha}_${corte}` : peca.malha)
    }
    for (const [nome, nos] of this.pecas) for (const no of nos) no.setEnabled(visiveis.has(nome))
    this.pintar('pele', aparencia.pele)
    this.pintar('tinta_cabelo', aparencia.corCabelo)
    for (const definicao of SLOTS) {
      if (!definicao.colorivel) continue
      const item = aparencia.pecas[definicao.slot]
      this.pintar(definicao.material, item.cor)
      const segunda = item.cor2 ?? pecaDe(definicao.slot, item.id)?.cor2
      if (segunda) this.pintar(`${definicao.material}2`, segunda)
    }
  }

  private pintar(material: string, cor: string) {
    for (const m of this.materiais.get(material) ?? []) pintarMaterial(m, cor)
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
