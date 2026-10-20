import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase'
import { RegisterMaterialPlugin } from '@babylonjs/core/Materials/materialPluginManager'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import type { Material } from '@babylonjs/core/Materials/material'
import type { MaterialDefines } from '@babylonjs/core/Materials/materialDefines'
import type { UniformBuffer } from '@babylonjs/core/Materials/uniformBuffer'
import type { Scene } from '@babylonjs/core/scene'

export const MAX_RECORTES = 16
export const MAX_LUZES = 24

export interface Recorte {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface EstadoDoAmbiente {
  sala: Recorte | null
  outras: Recorte[]
  forca: number
  escuroFora: number
  calor: number
  luzes: { x: number; y: number; raio: number }[]
  jogador: { x: number; y: number; raio: number }
  noite: number
  tempo: number
}

const NEUTRO: EstadoDoAmbiente = {
  sala: null, outras: [], forca: 0, escuroFora: 0, calor: 0, luzes: [], jogador: { x: 0, y: 0, raio: 0 }, noite: 0, tempo: 0,
}

const estados = new WeakMap<Scene, EstadoDoAmbiente>()

export function estadoDoAmbiente(cena: Scene): EstadoDoAmbiente {
  let estado = estados.get(cena)
  if (!estado) {
    estado = { ...NEUTRO, outras: [], luzes: [], jogador: { ...NEUTRO.jogador } }
    estados.set(cena, estado)
  }
  return estado
}

const FUNCOES = `
vec3 ambienteNaCena(vec3 cor, vec3 p) {
  vec2 q = p.xz;
  float fora = 1.0;
  if (ambSala.z > ambSala.x) {
    vec4 s = ambSala + vec4(-0.12, -0.12, 0.12, 0.12);
    fora = (q.x < s.x || q.x > s.z || q.y < s.y || q.y > s.w) ? 1.0 : 0.0;
  }
  float outra = 0.0;
  for (int i = 0; i < ${MAX_RECORTES}; i++) {
    if (float(i) >= ambParametros.w) break;
    vec4 r = ambOutras[i];
    if (q.x > r.x && q.x < r.z && q.y > r.y && q.y < r.w) { outra = 1.0; break; }
  }
  float escuro = ambSala.z > ambSala.x ? fora * ambParametros.y : 0.0;
  escuro = max(escuro, outra * 0.5);
  vec3 resultado = cor * (1.0 - escuro * ambParametros.x);
  if (ambSala.z > ambSala.x && fora < 0.5) {
    resultado *= mix(vec3(1.0), vec3(1.07, 1.0, 0.88), ambParametros.z * ambParametros.x);
  }
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
    resultado += cor * brilho * noite * (1.0 - escuro * ambParametros.x * 0.6);
  }
  return resultado;
}
`

class AmbientePlugin extends MaterialPluginBase {
  private readonly outras = new Float32Array(MAX_RECORTES * 4)
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
        { name: 'ambSala', size: 4, type: 'vec4' },
        { name: 'ambParametros', size: 4, type: 'vec4' },
        { name: 'ambNoite', size: 4, type: 'vec4' },
        { name: 'ambJogador', size: 4, type: 'vec4' },
        { name: 'ambOutras', size: 4, type: 'vec4', arraySize: MAX_RECORTES },
        { name: 'ambLuzes', size: 4, type: 'vec4', arraySize: MAX_LUZES },
      ],
      fragment: `#ifdef AMBIENTE
uniform vec4 ambSala;
uniform vec4 ambParametros;
uniform vec4 ambNoite;
uniform vec4 ambJogador;
uniform vec4 ambOutras[${MAX_RECORTES}];
uniform vec4 ambLuzes[${MAX_LUZES}];
#endif`,
    }
  }

  override bindForSubMesh(uniformBuffer: UniformBuffer, cena: Scene) {
    const e = estados.get(cena) ?? NEUTRO
    const sala = e.sala
    uniformBuffer.updateFloat4('ambSala', sala?.x0 ?? 0, sala?.y0 ?? 0, sala?.x1 ?? -1, sala?.y1 ?? 0)
    const outras = Math.min(MAX_RECORTES, e.outras.length)
    for (let i = 0; i < outras; i++) {
      const r = e.outras[i]
      this.outras.set([r.x0, r.y0, r.x1, r.y1], i * 4)
    }
    uniformBuffer.updateFloat4('ambParametros', e.forca, e.escuroFora, e.calor, outras)
    uniformBuffer.updateFloatArray('ambOutras', this.outras)
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
