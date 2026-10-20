import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase'
import { RegisterMaterialPlugin } from '@babylonjs/core/Materials/materialPluginManager'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import type { Material } from '@babylonjs/core/Materials/material'
import type { MaterialDefines } from '@babylonjs/core/Materials/materialDefines'
import type { UniformBuffer } from '@babylonjs/core/Materials/uniformBuffer'
import type { Scene } from '@babylonjs/core/scene'

export const MAX_RECORTES = 16
export const MAX_LUZES = 24
const BORDA_SUAVE = 0.25

export interface Recorte {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface AmbienteDeRecorte {
  recorte: Recorte
  escuro: number
  calor: number
}

export interface EstadoDoAmbiente {
  recortes: AmbienteDeRecorte[]
  escuroFora: number
  luzes: { x: number; y: number; raio: number }[]
  jogador: { x: number; y: number; raio: number }
  noite: number
  tempo: number
}

const NEUTRO: EstadoDoAmbiente = {
  recortes: [], escuroFora: 0, luzes: [], jogador: { x: 0, y: 0, raio: 0 }, noite: 0, tempo: 0,
}

const estados = new WeakMap<Scene, EstadoDoAmbiente>()

export function estadoDoAmbiente(cena: Scene): EstadoDoAmbiente {
  let estado = estados.get(cena)
  if (!estado) {
    estado = { ...NEUTRO, recortes: [], luzes: [], jogador: { ...NEUTRO.jogador } }
    estados.set(cena, estado)
  }
  return estado
}

const FUNCOES = `
vec3 ambienteNaCena(vec3 cor, vec3 p) {
  vec2 q = p.xz;
  float escuro = ambGeral.y;
  float calor = 0.0;
  for (int i = 0; i < ${MAX_RECORTES}; i++) {
    if (float(i) >= ambGeral.z) break;
    vec4 r = ambRecortes[i] + vec4(-0.12, -0.12, 0.12, 0.12);
    vec2 dentroX = smoothstep(vec2(r.x, -r.z) - ambGeral.w, vec2(r.x, -r.z) + ambGeral.w, vec2(q.x, -q.x));
    vec2 dentroY = smoothstep(vec2(r.y, -r.w) - ambGeral.w, vec2(r.y, -r.w) + ambGeral.w, vec2(q.y, -q.y));
    float peso = dentroX.x * dentroX.y * dentroY.x * dentroY.y;
    escuro = mix(escuro, ambValores[i].x, peso);
    calor = mix(calor, ambValores[i].y, peso);
  }
  vec3 resultado = cor * (1.0 - escuro);
  resultado *= mix(vec3(1.0), vec3(1.07, 1.0, 0.88), calor);
  float noite = ambNoite.x;
  if (noite > 0.001) {
    float onda = 1.0 + sin(ambNoite.y * 1.7) * 0.05 + sin(ambNoite.y * 0.6) * 0.03;
    vec3 brilho = vec3(0.0);
    for (int i = 0; i < ${MAX_LUZES}; i++) {
      if (float(i) >= ambNoite.z) break;
      vec3 l = ambLuzes[i].xyz;
      float d = distance(q, l.xy);
      brilho += vec3(1.0, 0.82, 0.55) * smoothstep(l.z, 0.0, d) * 0.9 * onda;
    }
    float dj = distance(q, ambJogador.xy);
    brilho += vec3(0.62, 0.74, 1.0) * smoothstep(ambJogador.z, 0.0, dj) * 0.55 * (2.0 - onda);
    resultado += cor * brilho * noite * (1.0 - escuro * 0.6);
  }
  return resultado;
}
`

class AmbientePlugin extends MaterialPluginBase {
  private readonly recortes = new Float32Array(MAX_RECORTES * 4)
  private readonly valores = new Float32Array(MAX_RECORTES * 4)
  private readonly luzes = new Float32Array(MAX_LUZES * 4)

  constructor(material: Material) {
    super(material, 'Ambiente', 210, { AMBIENTE: false })
    this._enable(true)
  }

  override getClassName() {
    return 'AmbientePlugin'
  }

  override prepareDefines(defines: MaterialDefines) {
    defines.AMBIENTE = true
  }

  override getUniforms() {
    return {
      ubo: [
        { name: 'ambGeral', size: 4, type: 'vec4' },
        { name: 'ambNoite', size: 4, type: 'vec4' },
        { name: 'ambJogador', size: 4, type: 'vec4' },
        { name: 'ambRecortes', size: 4, type: 'vec4', arraySize: MAX_RECORTES },
        { name: 'ambValores', size: 4, type: 'vec4', arraySize: MAX_RECORTES },
        { name: 'ambLuzes', size: 4, type: 'vec4', arraySize: MAX_LUZES },
      ],
      fragment: `#ifdef AMBIENTE
uniform vec4 ambGeral;
uniform vec4 ambNoite;
uniform vec4 ambJogador;
uniform vec4 ambRecortes[${MAX_RECORTES}];
uniform vec4 ambValores[${MAX_RECORTES}];
uniform vec4 ambLuzes[${MAX_LUZES}];
#endif`,
    }
  }

  override bindForSubMesh(uniformBuffer: UniformBuffer, cena: Scene) {
    const e = estados.get(cena) ?? NEUTRO
    const total = Math.min(MAX_RECORTES, e.recortes.length)
    for (let i = 0; i < total; i++) {
      const { recorte: r, escuro, calor } = e.recortes[i]
      this.recortes.set([r.x0, r.y0, r.x1, r.y1], i * 4)
      this.valores.set([escuro, calor, 0, 0], i * 4)
    }
    uniformBuffer.updateFloat4('ambGeral', 0, e.escuroFora, total, BORDA_SUAVE)
    uniformBuffer.updateFloatArray('ambRecortes', this.recortes)
    uniformBuffer.updateFloatArray('ambValores', this.valores)
    const luzes = Math.min(MAX_LUZES, e.luzes.length)
    for (let i = 0; i < luzes; i++) {
      const l = e.luzes[i]
      this.luzes.set([l.x, l.y, l.raio, 0], i * 4)
    }
    uniformBuffer.updateFloatArray('ambLuzes', this.luzes)
    uniformBuffer.updateFloat4('ambNoite', e.noite, e.tempo, luzes, 0)
    uniformBuffer.updateFloat4('ambJogador', e.jogador.x, e.jogador.y, e.jogador.raio, 0)
  }

  override getCustomCode(tipo: string) {
    if (tipo !== 'fragment') return null
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `#ifdef AMBIENTE\n${FUNCOES}\n#endif`,
      CUSTOM_FRAGMENT_BEFORE_FOG: '#ifdef AMBIENTE\ncolor.rgb = ambienteNaCena(color.rgb, vPositionW);\n#endif',
    }
  }
}

let registrado = false

export function registrarAmbiente() {
  if (registrado) return
  registrado = true
  RegisterMaterialPlugin('Ambiente', (material) => (material instanceof StandardMaterial ? new AmbientePlugin(material) : null))
}
