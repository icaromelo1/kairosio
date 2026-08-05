import type { MapDef } from '../maps'
import { salaDoPonto } from './espacial'

export const RAIO_BASE_BOLHA = 5
export const INCREMENTO_BOLHA = 1.5
export const RAIO_MAX_BOLHA = 12
export const MAX_ITERACOES_PONTO_FIXO = 4

export const LIMIAR_ENTRAR_MIDIA = RAIO_BASE_BOLHA
export const LIMIAR_SAIR_MIDIA = 8

export interface Pessoa {
  id: string
  x: number
  y: number
}

export function raioBolha(tamanho: number): number {
  if (tamanho <= 1) return RAIO_BASE_BOLHA
  return Math.min(RAIO_MAX_BOLHA, RAIO_BASE_BOLHA + INCREMENTO_BOLHA * (tamanho - 1))
}

function distancia(a: Pessoa, b: Pessoa): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

class UnionFind {
  private pai = new Map<string, string>()

  constructor(ids: Iterable<string>) {
    for (const id of ids) this.pai.set(id, id)
  }

  find(id: string): string {
    let raiz = id
    while (this.pai.get(raiz) !== raiz) raiz = this.pai.get(raiz) as string
    let atual = id
    while (this.pai.get(atual) !== raiz) {
      const proximo = this.pai.get(atual) as string
      this.pai.set(atual, raiz)
      atual = proximo
    }
    return raiz
  }

  union(a: string, b: string): void {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.pai.set(ra, rb)
  }

  grupos(): Map<string, string[]> {
    const porRaiz = new Map<string, string[]>()
    for (const id of this.pai.keys()) {
      const raiz = this.find(id)
      const lista = porRaiz.get(raiz)
      if (lista) lista.push(id)
      else porRaiz.set(raiz, [id])
    }
    return porRaiz
  }
}

function assinaturaDosGrupos(grupos: Map<string, string[]>): string {
  return [...grupos.values()]
    .map((membros) => [...membros].sort().join(','))
    .sort()
    .join('|')
}

export function calcularBolhas(pessoas: Pessoa[]): Map<string, string[]> {
  if (pessoas.length === 0) return new Map()
  const raioPorPessoa = new Map(pessoas.map((p) => [p.id, RAIO_BASE_BOLHA]))
  let assinaturaAnterior: string | null = null
  let grupos = new Map<string, string[]>()

  for (let iteracao = 0; iteracao < MAX_ITERACOES_PONTO_FIXO; iteracao++) {
    const uf = new UnionFind(pessoas.map((p) => p.id))
    for (let i = 0; i < pessoas.length; i++) {
      for (let j = i + 1; j < pessoas.length; j++) {
        const a = pessoas[i]
        const b = pessoas[j]
        const limiar = Math.max(raioPorPessoa.get(a.id) as number, raioPorPessoa.get(b.id) as number)
        if (distancia(a, b) <= limiar) uf.union(a.id, b.id)
      }
    }
    grupos = uf.grupos()
    const assinatura = assinaturaDosGrupos(grupos)
    if (assinatura === assinaturaAnterior) break
    assinaturaAnterior = assinatura
    for (const membros of grupos.values()) {
      const raio = raioBolha(membros.length)
      for (const id of membros) raioPorPessoa.set(id, raio)
    }
  }

  const porPessoa = new Map<string, string[]>()
  for (const membros of grupos.values()) {
    if (membros.length < 2) continue
    for (const id of membros) porPessoa.set(id, membros)
  }
  return porPessoa
}

export function callsDoMapa(map: MapDef, pessoas: Pessoa[]): Map<string, string> {
  const porSala = new Map<string, Pessoa[]>()
  const semSala: Pessoa[] = []
  for (const pessoa of pessoas) {
    const sala = salaDoPonto(map, pessoa.x, pessoa.y)
    if (sala) {
      const lista = porSala.get(sala)
      if (lista) lista.push(pessoa)
      else porSala.set(sala, [pessoa])
    } else {
      semSala.push(pessoa)
    }
  }

  const calls = new Map<string, string>()
  for (const [salaId, membros] of porSala) {
    for (const pessoa of membros) calls.set(pessoa.id, `sala:${salaId}`)
  }

  const bolhas = calcularBolhas(semSala)
  for (const [id, membros] of bolhas) {
    calls.set(id, `bolha:${[...membros].sort()[0]}`)
  }

  return calls
}

export function historeseMidia(estavaDentro: boolean, distancia: number): boolean {
  return estavaDentro ? distancia <= LIMIAR_SAIR_MIDIA : distancia <= LIMIAR_ENTRAR_MIDIA
}
