import type { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import type { Pose } from './tipos'

export interface AvatarVisual {
  readonly raiz: TransformNode
  readonly malhas: AbstractMesh[]
  definirPose(pose: Pose): void
  atualizar(dt: number): void
  destruir(): void
}
