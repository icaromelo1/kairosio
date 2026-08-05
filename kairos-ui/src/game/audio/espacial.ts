import type { MapDef, MapObject } from '../maps'

export const RAIO_CHEIO = 2
export const RAIO_MAX = 10
export const RAIO_PORTA = 2
export const OCLUSAO_PAREDE = 0.25
export const OCLUSAO_PORTA = 0.7

export function salaDoPonto(map: MapDef, x: number, y: number): string | null {
  for (const o of map.objects) {
    if (o.kind !== 'area' || !o.id) continue
    if (x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) return o.id
  }
  return null
}

export function curvaDistancia(d: number): number {
  if (d <= RAIO_CHEIO) return 1
  if (d >= RAIO_MAX) return 0
  const t = (d - RAIO_CHEIO) / (RAIO_MAX - RAIO_CHEIO)
  return (1 - t) ** 2
}

const portasPorSalaPorMapa = new WeakMap<MapDef, Map<string, MapObject[]>>()

function tocaOuSobrepoe(a: MapObject, b: MapObject, tolerancia: number): boolean {
  return (
    a.x < b.x + b.w + tolerancia &&
    a.x + a.w + tolerancia > b.x &&
    a.y < b.y + b.h + tolerancia &&
    a.y + a.h + tolerancia > b.y
  )
}

function portasPorSala(map: MapDef): Map<string, MapObject[]> {
  const existente = portasPorSalaPorMapa.get(map)
  if (existente) return existente

  const indice = new Map<string, MapObject[]>()
  const areas = map.objects.filter((o) => o.kind === 'area' && o.id)
  const portas = map.objects.filter((o) => o.kind === 'door')
  for (const area of areas) {
    indice.set(
      area.id,
      portas.filter((porta) => tocaOuSobrepoe(area, porta, 1)),
    )
  }
  portasPorSalaPorMapa.set(map, indice)
  return indice
}

function distanciaAoRetangulo(p: { x: number; y: number }, o: MapObject): number {
  const dx = Math.max(o.x - p.x, 0, p.x - (o.x + o.w))
  const dy = Math.max(o.y - p.y, 0, p.y - (o.y + o.h))
  return Math.hypot(dx, dy)
}

function pertoDeAlgumaPortaDaSala(
  map: MapDef,
  sala: string,
  ouvinte: { x: number; y: number },
): boolean {
  const portas = portasPorSala(map).get(sala)
  if (!portas || portas.length === 0) return false
  for (const porta of portas) {
    if (distanciaAoRetangulo(ouvinte, porta) <= RAIO_PORTA) return true
  }
  return false
}

export function oclusao(args: {
  map: MapDef
  salaFalante: string | null
  salaOuvinte: string | null
  ouvinte: { x: number; y: number }
  trancadas: Set<string>
}): number {
  const { map, salaFalante, salaOuvinte, ouvinte, trancadas } = args

  if (salaFalante === salaOuvinte) return 1
  if (salaFalante !== null && trancadas.has(salaFalante)) return 0
  if (salaFalante !== null && pertoDeAlgumaPortaDaSala(map, salaFalante, ouvinte)) {
    return OCLUSAO_PORTA
  }
  return OCLUSAO_PAREDE
}

export function ganhoDoPeer(args: {
  map: MapDef
  falante: { x: number; y: number }
  ouvinte: { x: number; y: number }
  trancadas: Set<string>
  callFalante?: string | null
  callOuvinte?: string | null
}): number {
  const { map, falante, ouvinte, trancadas, callFalante = null, callOuvinte = null } = args
  if (callFalante !== null && callFalante === callOuvinte) return 1
  const d = Math.hypot(falante.x - ouvinte.x, falante.y - ouvinte.y)
  const salaFalante = salaDoPonto(map, falante.x, falante.y)
  const salaOuvinte = salaDoPonto(map, ouvinte.x, ouvinte.y)
  return curvaDistancia(d) * oclusao({ map, salaFalante, salaOuvinte, ouvinte, trancadas })
}
