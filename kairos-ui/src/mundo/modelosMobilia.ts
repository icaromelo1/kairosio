import '@babylonjs/loaders/glTF'
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import type { Scene } from '@babylonjs/core/scene'
import { pecaDe } from './mobilia'
import type { Movel } from './tipos'

const URL_MOBILIA = `${import.meta.env.BASE_URL}modelos/mobilia.glb`

export class CatalogoDeMobilia {
  private fontes = new Map<string, Mesh[]>()
  private carregando: Promise<void> | null = null
  private reserva: StandardMaterial | null = null
  private contador = 0

  constructor(private readonly cena: Scene) {}

  carregar(): Promise<void> {
    this.carregando ??= this.buscar()
    return this.carregando
  }

  private async buscar() {
    try {
      const conteiner = await LoadAssetContainerAsync(URL_MOBILIA, this.cena)
      conteiner.addAllToScene()
      for (const no of conteiner.rootNodes) {
        for (const filho of no.getChildren()) {
          const malhas = (filho instanceof Mesh ? [filho] : []).concat(filho.getChildMeshes(false).filter((m): m is Mesh => m instanceof Mesh))
          const validas = malhas.filter((m) => m.getTotalVertices() > 0)
          if (!validas.length) continue
          for (const malha of validas) {
            malha.setParent(null)
            malha.isVisible = false
            malha.isPickable = false
            malha.receiveShadows = true
          }
          this.fontes.set(filho.name, validas)
        }
      }
    } catch {
      this.fontes.clear()
    }
  }

  instanciar(movel: Movel): TransformNode | null {
    const peca = pecaDe(movel)
    if (!peca) return null
    const no = new TransformNode(`movel-${movel.id}`, this.cena)
    no.position.set(movel.x, 0, movel.y)
    no.rotation.y = (movel.giro * Math.PI) / 180
    const fontes = this.fontes.get(movel.peca)
    if (fontes) {
      for (const fonte of fontes) {
        const instancia = fonte.createInstance(`${movel.peca}-${++this.contador}`)
        instancia.parent = no
        instancia.isPickable = false
      }
      return no
    }
    const caixa = CreateBox(`movel-${movel.peca}`, { width: peca.largura, depth: peca.profundidade, height: peca.solida ? 0.8 : 0.02 }, this.cena)
    caixa.position.y = peca.solida ? 0.4 : 0.01
    caixa.material = this.materialReserva()
    caixa.parent = no
    return no
  }

  private materialReserva(): StandardMaterial {
    if (!this.reserva) {
      this.reserva = new StandardMaterial('reservaMobilia', this.cena)
      this.reserva.diffuseColor = Color3.FromHexString('#a08a68')
      this.reserva.specularColor = Color3.Black()
    }
    return this.reserva
  }
}
