import { calcularBolhas, type Pessoa } from '@/mundo/bolhas'
import { salaDoPonto } from './grade'
import type { Mapa, Sala } from './tipos'

const RAIO_CHEIO = 2
const RAIO_MAX = 10
const RAIO_PORTA = 2
const OCLUSAO_PAREDE = 0.25
const OCLUSAO_PORTA = 0.7

export function salaFechadaDoPonto(mapa: Mapa, x: number, y: number): Sala | null {
  const sala = salaDoPonto(mapa, x, y)
  return sala && !sala.aberta ? sala : null
}

function curvaDistancia(d: number): number {
  if (d <= RAIO_CHEIO) return 1
  if (d >= RAIO_MAX) return 0
  const t = (d - RAIO_CHEIO) / (RAIO_MAX - RAIO_CHEIO)
  return (1 - t) ** 2
}

function centroDaPorta(sala: Sala, porta: Sala['portas'][number]): { x: number; y: number } {
  if (porta.lado === 'norte') return { x: sala.x + porta.centro, y: sala.y }
  if (porta.lado === 'sul') return { x: sala.x + porta.centro, y: sala.y + sala.profundidade }
  if (porta.lado === 'oeste') return { x: sala.x, y: sala.y + porta.centro }
  return { x: sala.x + sala.largura, y: sala.y + porta.centro }
}

function pertoDaPorta(sala: Sala, ouvinte: { x: number; y: number }): boolean {
  return sala.portas.some((porta) => {
    const c = centroDaPorta(sala, porta)
    return Math.hypot(c.x - ouvinte.x, c.y - ouvinte.y) <= RAIO_PORTA + porta.largura / 2
  })
}

export function ganhoDoPeer(args: {
  mapa: Mapa
  falante: { x: number; y: number }
  ouvinte: { x: number; y: number }
  trancadas: Set<string>
  callFalante?: string | null
  callOuvinte?: string | null
}): number {
  const { mapa, falante, ouvinte, trancadas, callFalante = null, callOuvinte = null } = args
  if (callFalante !== null && callFalante === callOuvinte) return 1
  const d = Math.hypot(falante.x - ouvinte.x, falante.y - ouvinte.y)
  const salaFalante = salaFechadaDoPonto(mapa, falante.x, falante.y)
  const salaOuvinte = salaFechadaDoPonto(mapa, ouvinte.x, ouvinte.y)
  let oclusao = OCLUSAO_PAREDE
  if (salaFalante?.id === salaOuvinte?.id) oclusao = 1
  else if (salaFalante && trancadas.has(salaFalante.id)) oclusao = 0
  else if (salaFalante && pertoDaPorta(salaFalante, ouvinte)) oclusao = OCLUSAO_PORTA
  return curvaDistancia(d) * oclusao
}

export function callsDoMapa(mapa: Mapa, pessoas: Pessoa[]): Map<string, string> {
  const calls = new Map<string, string>()
  const soltas: Pessoa[] = []
  for (const pessoa of pessoas) {
    const sala = salaFechadaDoPonto(mapa, pessoa.x, pessoa.y)
    if (sala) calls.set(pessoa.id, `sala:${sala.id}`)
    else soltas.push(pessoa)
  }
  for (const [id, membros] of calcularBolhas(soltas)) calls.set(id, `bolha:${[...membros].sort()[0]}`)
  return calls
}
