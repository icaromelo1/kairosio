import { Color3 } from '@babylonjs/core/Maths/math.color'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import type { Material } from '@babylonjs/core/Materials/material'
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import type { Scene } from '@babylonjs/core/scene'

const BASE_TEXTURAS = `${import.meta.env.BASE_URL}texturas/`

export function converterMaterial(cena: Scene, original: Material): StandardMaterial {
  if (original instanceof StandardMaterial) return original
  const pbr = original as PBRMaterial
  const material = new StandardMaterial(original.name, cena)
  material.diffuseColor = (pbr.albedoColor ?? Color3.White()).toGammaSpace()
  if (pbr.albedoTexture) material.diffuseTexture = pbr.albedoTexture
  const metal = pbr.metallic ?? 0
  const aspereza = pbr.roughness ?? 1
  material.specularColor = Color3.White().scale(0.04 + metal * 0.35)
  material.specularPower = 8 + (1 - aspereza) * 80
  if (pbr.emissiveColor && (pbr.emissiveColor.r || pbr.emissiveColor.g || pbr.emissiveColor.b)) {
    material.emissiveColor = pbr.emissiveColor.toGammaSpace()
    material.disableLighting = false
  }
  material.backFaceCulling = original.backFaceCulling
  return material
}

export function converterMalhas(cena: Scene, malhas: AbstractMesh[]) {
  const convertidos = new Map<Material, StandardMaterial>()
  for (const malha of malhas) {
    const original = malha.material
    if (!original || original instanceof StandardMaterial) continue
    let novo = convertidos.get(original)
    if (!novo) {
      novo = converterMaterial(cena, original)
      convertidos.set(original, novo)
    }
    malha.material = novo
  }
  for (const original of convertidos.keys()) original.dispose(false, false)
}

export function pintarMaterial(material: Material, hex: string) {
  const cor = Color3.FromHexString(hex)
  if (material instanceof StandardMaterial) material.diffuseColor = cor
  else (material as PBRMaterial).albedoColor = cor.toLinearSpace()
}

const texturas = new Map<string, Texture>()

export function textura(cena: Scene, nome: string): Texture {
  const chave = `${cena.uid}:${nome}`
  let existente = texturas.get(chave)
  if (!existente) {
    existente = new Texture(`${BASE_TEXTURAS}${nome}.jpg`, cena)
    existente.anisotropicFilteringLevel = 8
    texturas.set(chave, existente)
    cena.onDisposeObservable.addOnce(() => texturas.delete(chave))
  }
  return existente
}

export function materialDePiso(cena: Scene, nome: string, cor: string, nomeTextura: string, largura: number, profundidade: number, tamanhoDoLadrilho: number): StandardMaterial {
  const material = new StandardMaterial(nome, cena)
  material.diffuseColor = Color3.FromHexString(cor)
  material.specularColor = Color3.Black()
  const base = textura(cena, nomeTextura).clone()
  base.uScale = largura / tamanhoDoLadrilho
  base.vScale = profundidade / tamanhoDoLadrilho
  material.diffuseTexture = base
  const variacao = textura(cena, 'variacao').clone()
  variacao.uScale = largura / 18
  variacao.vScale = profundidade / 18
  material.lightmapTexture = variacao
  material.useLightmapAsShadowmap = true
  return material
}
