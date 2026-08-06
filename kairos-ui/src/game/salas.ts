import type { MapDef, MapObject } from './maps'

// Quem está em qual sala, num lugar só.
//
// Esta conta já existia copiada no MapaExpandido, no GamePage e no servidor —
// e cada cópia errou de um jeito: a do servidor pegava a PRIMEIRA área que
// contém o ponto em vez da menor, e a praça (área aberta) entrava como sala.
// Terceira cópia seria a que diverge sem ninguém notar.

export interface PessoaNaSala {
  id: string
  nome: string
  x: number
  y: number
  eu?: boolean
}

export interface SalaComGente {
  id: string
  nome: string
  aberta: boolean
  gente: PessoaNaSala[]
  x: number
  y: number
  w: number
  h: number
}

type AreaObj = MapObject & { id: string }

function areasDoMapa(map: MapDef): AreaObj[] {
  return map.objects.filter((o): o is AreaObj => o.kind === 'area' && !!o.id)
}

function nomeDaArea(a: MapObject): string {
  const bruto = a as { name?: string; nome?: string; id?: string }
  return bruto.name ?? bruto.nome ?? bruto.id ?? 'sala'
}

/** A MENOR área que contém o ponto — sala pequena dentro de saguão grande. */
export function salaDoPonto(map: MapDef, x: number, y: number): string | null {
  let achado: string | null = null
  let menor = Infinity
  for (const a of areasDoMapa(map)) {
    if (x < a.x || x >= a.x + a.w || y < a.y || y >= a.y + a.h) continue
    const tamanho = a.w * a.h
    if (tamanho < menor) {
      menor = tamanho
      achado = a.id
    }
  }
  return achado
}

/** Só sala FECHADA conta como sala: praça é área aberta e vale como mundo. */
export function salaFechadaDoPonto(map: MapDef, x: number, y: number): string | null {
  const id = salaDoPonto(map, x, y)
  if (!id) return null
  const area = areasDoMapa(map).find((a) => a.id === id)
  return area && !(area as { aberta?: boolean }).aberta ? id : null
}

export function agruparPorSala(map: MapDef, pessoas: PessoaNaSala[]): SalaComGente[] {
  const porSala = new Map<string, PessoaNaSala[]>()
  for (const p of pessoas) {
    const id = salaDoPonto(map, p.x, p.y)
    if (!id) continue
    porSala.set(id, [...(porSala.get(id) ?? []), p])
  }
  return areasDoMapa(map).map((a) => ({
    id: a.id,
    nome: nomeDaArea(a),
    aberta: (a as { aberta?: boolean }).aberta === true,
    gente: porSala.get(a.id) ?? [],
    x: a.x,
    y: a.y,
    w: a.w,
    h: a.h,
  }))
}

/** Quem não está em sala nenhuma — o pessoal do mundo aberto. */
export function foraDeSala(map: MapDef, pessoas: PessoaNaSala[]): PessoaNaSala[] {
  return pessoas.filter((p) => !salaDoPonto(map, p.x, p.y))
}
