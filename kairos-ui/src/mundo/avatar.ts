import { Color3 } from '@babylonjs/core/Maths/math.color'
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder'
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import type { Scene } from '@babylonjs/core/scene'
import type { Pose } from './tipos'

export interface AvatarVisual {
  readonly raiz: TransformNode
  readonly malhas: AbstractMesh[]
  definirPose(pose: Pose): void
  atualizar(dt: number): void
  destruir(): void
}

export class AvatarCapsula implements AvatarVisual {
  readonly raiz: TransformNode
  readonly malhas: AbstractMesh[]
  private pose: Pose = 'parado'
  private tempo = 0
  private readonly corpo: AbstractMesh

  constructor(cena: Scene, cor = '#2c7441') {
    this.raiz = new TransformNode('avatar', cena)
    const material = new StandardMaterial('avatarCapsula', cena)
    material.diffuseColor = Color3.FromHexString(cor)
    material.specularColor = Color3.Black()
    this.corpo = CreateCapsule('corpo', { height: 1.1, radius: 0.22 }, cena)
    this.corpo.material = material
    this.corpo.position.y = 0.55
    this.corpo.parent = this.raiz
    const nariz = CreateSphere('nariz', { diameter: 0.12 }, cena)
    nariz.material = material
    nariz.position.set(0, 0.85, 0.22)
    nariz.parent = this.raiz
    this.malhas = [this.corpo, nariz]
  }

  definirPose(pose: Pose) {
    this.pose = pose
  }

  atualizar(dt: number) {
    this.tempo += dt
    const pulo = this.pose === 'andar' ? Math.abs(Math.sin(this.tempo * 10)) * 0.06 : 0
    this.corpo.position.y = (this.pose === 'sentar' ? 0.35 : 0.55) + pulo
  }

  destruir() {
    this.raiz.dispose(false, true)
  }
}
