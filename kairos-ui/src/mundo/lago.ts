import { Effect } from '@babylonjs/core/Materials/effect'
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder'
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder'
import { CreateIcoSphere } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder'
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer'
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import type { Scene } from '@babylonjs/core/scene'
import { textura } from './materiais'
import type { Area } from './tipos'

const NIVEL_AGUA = 0.12
const ALTURA_BORDA = 0.34
const LARGURA_BORDA = 0.42

Effect.ShadersStore.aguaLagoVertexShader = `
precision highp float;
attribute vec3 position;
uniform mat4 world;
uniform mat4 viewProjection;
varying vec2 vLocal;
varying vec3 vMundo;
void main() {
  vLocal = position.xy;
  vec4 w = world * vec4(position, 1.0);
  vMundo = w.xyz;
  gl_Position = viewProjection * w;
}`

Effect.ShadersStore.aguaLagoFragmentShader = `
precision highp float;
varying vec2 vLocal;
varying vec3 vMundo;
uniform float tempo;
uniform vec3 luz;
uniform vec3 raso;
uniform vec3 fundo;
uniform vec3 espuma;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruido(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float celula(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = vec2(hash(i + g), hash(i + g + 17.0));
      o = 0.5 + 0.5 * sin(tempo * 0.7 + 6.2831 * o);
      d = min(d, length(g + o - f));
    }
  }
  return d;
}
void main() {
  float r = length(vLocal);
  vec2 p = vMundo.xz;
  float prof = smoothstep(0.05, 0.9, 1.0 - r);
  vec3 c = mix(raso, fundo, prof);
  float sombraBorda = smoothstep(0.78, 1.0, r) * smoothstep(-0.2, 0.9, -vLocal.y);
  c *= 1.0 - sombraBorda * 0.35;
  float caustica = smoothstep(0.42, 0.62, celula(p * 1.3 + vec2(tempo * 0.05, 0.0)));
  c += caustica * (1.0 - prof * 0.7) * 0.1;
  float ondas = ruido(p * 2.6 + tempo * vec2(0.22, 0.15)) + ruido(p * 4.4 - tempo * vec2(0.18, 0.27));
  c += smoothstep(1.4, 1.52, ondas) * 0.16;
  c += smoothstep(0.2, 1.0, vLocal.y) * 0.06;
  float borda = smoothstep(0.84, 0.97, r + (ruido(p * 5.0 + tempo * 0.6) - 0.5) * 0.08);
  float aneis = smoothstep(0.82, 1.0, sin(r * 46.0 - tempo * 1.8)) * smoothstep(0.7, 0.95, r) * (1.0 - borda);
  c = mix(c, espuma, clamp(borda * 0.6 + aneis * 0.18, 0.0, 1.0));
  float alfa = mix(0.62, 0.9, prof);
  alfa = max(alfa, borda);
  gl_FragColor = vec4(c * luz, alfa);
}`

function aleatorio(semente: string) {
  let h = 2166136261
  for (const letra of semente) h = Math.imul(h ^ letra.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

function pintarVertices(malha: Mesh, cor: Color3, variacao: () => number) {
  const total = malha.getTotalVertices()
  const cores: number[] = []
  for (let i = 0; i < total; i++) {
    const v = 0.9 + variacao() * 0.16
    cores.push(cor.r * v, cor.g * v, cor.b * v, 1)
  }
  malha.setVerticesData(VertexBuffer.ColorKind, cores)
}

function deformar(malha: Mesh, variacao: () => number, forca: number) {
  const posicoes = malha.getVerticesData(VertexBuffer.PositionKind)
  if (!posicoes) return
  const deslocamentos = new Map<string, number>()
  for (let i = 0; i < posicoes.length; i += 3) {
    const chave = `${posicoes[i].toFixed(3)},${posicoes[i + 1].toFixed(3)},${posicoes[i + 2].toFixed(3)}`
    let d = deslocamentos.get(chave)
    if (d === undefined) {
      d = 1 + (variacao() - 0.5) * forca
      deslocamentos.set(chave, d)
    }
    posicoes[i] *= d
    posicoes[i + 1] *= d
    posicoes[i + 2] *= d
  }
  malha.updateVerticesData(VertexBuffer.PositionKind, posicoes)
}

export interface Lago {
  atualizar(decorrido: number): void
  definirLuz(cor: Color3): void
  contornaveis: Mesh[]
}

export function construirLago(cena: Scene, area: Area, pai: TransformNode, sombra: ShadowGenerator): Lago {
  const sorte = aleatorio(area.id)
  const rx = area.largura / 2
  const rz = area.profundidade / 2
  const ix = rx - LARGURA_BORDA
  const iz = rz - LARGURA_BORDA
  const raiz = new TransformNode(`lago-${area.id}`, cena)
  raiz.parent = pai
  raiz.position.set(area.x, 0, area.y)
  const preparar = (malha: Mesh, recebe = true) => {
    malha.parent = raiz
    malha.isPickable = false
    malha.receiveShadows = recebe
    return malha
  }

  const fosco = (nome: string, hex: string, tex?: string, escala = 1) => {
    const material = new StandardMaterial(`${nome}-${area.id}`, cena)
    material.diffuseColor = Color3.FromHexString(hex)
    material.specularColor = Color3.Black()
    if (tex) {
      const t = textura(cena, tex).clone()
      t.uScale = escala
      t.vScale = escala
      material.diffuseTexture = t
    }
    return material
  }

  const fundoLago = preparar(CreateDisc(`lagoFundo-${area.id}`, { radius: 1, tessellation: 64 }, cena))
  fundoLago.rotation.x = Math.PI / 2
  fundoLago.scaling.set(ix, iz, 1)
  fundoLago.position.y = 0.02
  fundoLago.material = fosco('lagoFundo', '#3f6b62', 'cascalho', 3)

  const parede = preparar(CreateCylinder(`lagoParede-${area.id}`, { diameter: 2, height: ALTURA_BORDA, tessellation: 64, cap: Mesh.NO_CAP, sideOrientation: Mesh.BACKSIDE }, cena))
  parede.scaling.set(ix + 0.02, 1, iz + 0.02)
  parede.position.y = ALTURA_BORDA / 2
  parede.material = fosco('lagoParede', '#6f6a5e', 'pavimento', 4)

  const pedras: Mesh[] = []
  const tons = ['#b9b2a2', '#a8a091', '#c8c1b0', '#9d9585', '#b3ab98'].map((h) => Color3.FromHexString(h))
  const fileiras = [
    { raio: LARGURA_BORDA * 0.5, tamanho: 0.27, altura: ALTURA_BORDA + 0.03, desvio: 0 },
    { raio: LARGURA_BORDA * 0.82, tamanho: 0.2, altura: ALTURA_BORDA * 0.55, desvio: 0.5 },
  ]
  for (const fileira of fileiras) {
    const ax = ix + fileira.raio
    const az = iz + fileira.raio
    const perimetro = Math.PI * (3 * (ax + az) - Math.sqrt((3 * ax + az) * (ax + 3 * az)))
    const quantidade = Math.round(perimetro / (fileira.tamanho * 1.45))
    for (let k = 0; k < quantidade; k++) {
      const angulo = ((k + fileira.desvio + (sorte() - 0.5) * 0.25) / quantidade) * Math.PI * 2
      const pedra = CreateIcoSphere('pedraLago', { radius: 1, subdivisions: 1, flat: true }, cena)
      deformar(pedra, sorte, 0.32)
      const tamanho = fileira.tamanho * (0.8 + sorte() * 0.45)
      pedra.scaling.set(tamanho * (1 + sorte() * 0.4), fileira.altura * (0.75 + sorte() * 0.3), tamanho)
      pedra.position.set(Math.cos(angulo) * ax, fileira.altura * 0.42, Math.sin(angulo) * az)
      pedra.rotation.y = -angulo + (sorte() - 0.5) * 0.6
      pedra.rotation.z = (sorte() - 0.5) * 0.18
      pintarVertices(pedra, tons[Math.floor(sorte() * tons.length)], sorte)
      pedras.push(pedra)
    }
  }
  const borda = preparar(Mesh.MergeMeshes(pedras, true, true)!)
  borda.name = `lagoBorda-${area.id}`
  const materialPedra = fosco('lagoPedra', '#ffffff', 'variacao', 2)
  borda.material = materialPedra
  borda.useVertexColors = true
  sombra.addShadowCaster(borda)

  const agua = preparar(CreateDisc(`lagoAgua-${area.id}`, { radius: 1, tessellation: 96 }, cena), false)
  agua.rotation.x = Math.PI / 2
  agua.scaling.set(ix + 0.02, iz + 0.02, 1)
  agua.position.y = NIVEL_AGUA
  const shader = new ShaderMaterial(`aguaLago-${area.id}`, cena, 'aguaLago', {
    attributes: ['position'],
    uniforms: ['world', 'viewProjection', 'tempo', 'luz', 'raso', 'fundo', 'espuma'],
    needAlphaBlending: true,
  })
  shader.setColor3('raso', Color3.FromHexString('#3fa6b0'))
  shader.setColor3('fundo', Color3.FromHexString('#1b4f84'))
  shader.setColor3('espuma', Color3.FromHexString('#d8f1ee'))
  shader.setColor3('luz', Color3.White())
  shader.setFloat('tempo', 0)
  shader.backFaceCulling = false
  agua.material = shader
  agua.alphaIndex = 10

  const peixes: { no: TransformNode; raio: number; velocidade: number; fase: number; altura: number }[] = []
  const corpoKoi = fosco('koi', '#f08a3c')
  const manchaKoi = fosco('koiMancha', '#fbf3e6')
  for (let k = 0; k < 4; k++) {
    const no = new TransformNode(`koi-${area.id}-${k}`, cena)
    no.parent = raiz
    const corpo = preparar(CreateSphere('koiCorpo', { diameter: 1, segments: 8 }, cena), false)
    corpo.scaling.set(0.12, 0.06, 0.32)
    corpo.material = k % 2 ? manchaKoi : corpoKoi
    corpo.parent = no
    const mancha = preparar(CreateSphere('koiCabeca', { diameter: 1, segments: 6 }, cena), false)
    mancha.scaling.set(0.07, 0.045, 0.1)
    mancha.position.z = 0.07
    mancha.position.y = 0.01
    mancha.material = k % 2 ? corpoKoi : manchaKoi
    mancha.parent = no
    const cauda = preparar(CreateDisc('koiCauda', { radius: 0.07, tessellation: 3 }, cena), false)
    cauda.rotation.x = Math.PI / 2
    cauda.position.z = -0.15
    cauda.material = corpo.material
    cauda.parent = no
    peixes.push({ no, raio: 0.3 + sorte() * 0.4, velocidade: (0.18 + sorte() * 0.15) * (k % 2 ? -1 : 1), fase: sorte() * Math.PI * 2, altura: 0.05 + sorte() * 0.03 })
  }

  const folhas: { malha: Mesh; fase: number }[] = []
  const materialFolha = fosco('vitoria', '#5e9a3c')
  const materialFlor = fosco('lotus', '#f5a6c4')
  const materialMiolo = fosco('lotusMiolo', '#f7d64a')
  for (let k = 0; k < 7; k++) {
    const angulo = sorte() * Math.PI * 2
    const dist = 0.35 + sorte() * 0.5
    const raioFolha = 0.16 + sorte() * 0.12
    const folha = preparar(CreateDisc('vitoria', { radius: raioFolha, tessellation: 20, arc: 0.88 }, cena))
    folha.rotation.x = Math.PI / 2
    folha.rotation.y = sorte() * Math.PI * 2
    folha.position.set(Math.cos(angulo) * ix * dist, NIVEL_AGUA + 0.008, Math.sin(angulo) * iz * dist)
    folha.material = materialFolha
    folhas.push({ malha: folha, fase: sorte() * 6 })
    if (k % 3 === 0) {
      const flor = new TransformNode('lotus', cena)
      flor.parent = raiz
      flor.position.set(folha.position.x, NIVEL_AGUA + 0.03, folha.position.z)
      for (let p = 0; p < 6; p++) {
        const petala = preparar(CreateSphere('petala', { diameter: 1, segments: 6 }, cena), false)
        const giro = (p / 6) * Math.PI * 2
        petala.scaling.set(0.05, 0.05, 0.11)
        petala.position.set(Math.sin(giro) * 0.05, 0.03, Math.cos(giro) * 0.05)
        petala.rotation.set(-0.7, giro, 0)
        petala.material = materialFlor
        petala.parent = flor
      }
      const miolo = preparar(CreateSphere('miolo', { diameter: 0.06, segments: 6 }, cena), false)
      miolo.position.y = 0.05
      miolo.material = materialMiolo
      miolo.parent = flor
    }
  }

  const juncos: TransformNode[] = []
  const materialJunco = fosco('junco', '#6f9a3e')
  const materialTaboa = fosco('taboa', '#7a4f2c')
  for (let k = 0; k < 3; k++) {
    const angulo = (k / 3) * Math.PI * 2 + sorte() * 0.8 + 0.6
    const moita = new TransformNode('junco', cena)
    moita.parent = raiz
    moita.position.set(Math.cos(angulo) * (ix - 0.15), 0.05, Math.sin(angulo) * (iz - 0.15))
    for (let h = 0; h < 9; h++) {
      const altura = 0.45 + sorte() * 0.4
      const haste = preparar(CreateCylinder('haste', { height: altura, diameterTop: 0.006, diameterBottom: 0.03, tessellation: 4 }, cena))
      haste.position.set((sorte() - 0.5) * 0.25, altura / 2, (sorte() - 0.5) * 0.25)
      haste.rotation.set((sorte() - 0.5) * 0.35, 0, (sorte() - 0.5) * 0.35)
      haste.material = materialJunco
      haste.parent = moita
      sombra.addShadowCaster(haste)
      if (h % 3 === 0) {
        const taboa = preparar(CreateCylinder('taboa', { height: 0.12, diameter: 0.045, tessellation: 6 }, cena))
        taboa.position.y = altura / 2 - 0.02
        taboa.material = materialTaboa
        taboa.parent = haste
      }
    }
    juncos.push(moita)
  }

  let tempo = sorte() * 100
  return {
    contornaveis: [borda],
    definirLuz(cor: Color3) {
      shader.setColor3('luz', cor)
    },
    atualizar(decorrido: number) {
      tempo += decorrido
      shader.setFloat('tempo', tempo)
      for (const peixe of peixes) {
        const a = peixe.fase + tempo * peixe.velocidade
        const ondula = Math.sin(tempo * 1.3 + peixe.fase) * 0.08
        peixe.no.position.set(Math.cos(a) * ix * (peixe.raio + ondula), peixe.altura, Math.sin(a) * iz * (peixe.raio + ondula))
        const sentido = Math.sign(peixe.velocidade)
        peixe.no.rotation.y = Math.atan2(-Math.sin(a) * ix * sentido, Math.cos(a) * iz * sentido) + Math.sin(tempo * 6 + peixe.fase) * 0.12
      }
      for (const folha of folhas) folha.malha.position.y = NIVEL_AGUA + 0.008 + Math.sin(tempo * 1.1 + folha.fase) * 0.004
      juncos.forEach((moita, i) => {
        moita.rotation.z = Math.sin(tempo * 0.9 + i * 2) * 0.04
        moita.rotation.x = Math.cos(tempo * 0.7 + i) * 0.03
      })
    },
  }
}
