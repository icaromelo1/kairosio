import { Engine } from '@babylonjs/core/Engines/engine'
import { Scene } from '@babylonjs/core/scene'
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { AvatarModelo, carregarPersonagem } from './AvatarModelo'
import type { Aparencia } from './catalogo'
import type { Pose } from '../tipos'

export class Previa {
  private readonly motor: Engine
  private readonly cena: Scene
  private avatar: AvatarModelo | null = null
  private girando = true
  private redimensionar = () => this.motor.resize()

  constructor(tela: HTMLCanvasElement) {
    this.motor = new Engine(tela, true, { preserveDrawingBuffer: false }, true)
    this.cena = new Scene(this.motor)
    this.cena.useRightHandedSystem = true
    this.cena.clearColor = new Color4(0, 0, 0, 0)
    const camera = new ArcRotateCamera('camera', Math.PI / 2, 1.2, 3.2, new Vector3(0, 0.62, 0), this.cena)
    camera.lowerRadiusLimit = 2
    camera.upperRadiusLimit = 4.5
    camera.lowerBetaLimit = 0.6
    camera.upperBetaLimit = 1.5
    camera.fov = 0.55
    camera.attachControl(tela, true)
    camera.panningSensibility = 0
    tela.addEventListener('pointerdown', () => { this.girando = false })
    const ceu = new HemisphericLight('ceu', new Vector3(0, 1, 0.3), this.cena)
    ceu.intensity = 0.75
    ceu.groundColor = Color3.FromHexString('#8a7a66')
    const sol = new DirectionalLight('sol', new Vector3(-0.4, -1, -0.6), this.cena)
    sol.intensity = 0.6
    const disco = CreateCylinder('disco', { diameter: 1.1, height: 0.04, tessellation: 32 }, this.cena)
    disco.position.y = -0.02
    const material = new StandardMaterial('disco', this.cena)
    material.diffuseColor = Color3.FromHexString('#d8c7a2')
    material.specularColor = Color3.Black()
    disco.material = material
    window.addEventListener('resize', this.redimensionar)
    this.cena.onBeforeRenderObservable.add(() => {
      if (this.girando) camera.alpha += this.motor.getDeltaTime() / 2600
    })
    this.motor.runRenderLoop(() => this.cena.render())
  }

  async mostrar(aparencia: Aparencia) {
    const conteiner = await carregarPersonagem(this.cena)
    if (!this.avatar) this.avatar = new AvatarModelo(this.cena, conteiner, aparencia)
    else this.avatar.aplicar(aparencia)
  }

  pose(pose: Pose) {
    this.avatar?.definirPose(pose)
  }

  destruir() {
    window.removeEventListener('resize', this.redimensionar)
    this.avatar?.destruir()
    this.motor.stopRenderLoop()
    this.cena.dispose()
    this.motor.dispose()
  }
}
