import indiceTinyTown from './indice-tiny-town.json'
import indiceTinyFarm from './indice-tiny-farm.json'
import indiceTinyBattle from './indice-tiny-battle.json'
import indiceTinySki from './indice-tiny-ski.json'
import indiceTinyDungeon from './indice-tiny-dungeon.json'

export interface TileIndiceEntry {
  i: number
  nome: string
  cat: string
  tags: string[]
  opaco: { w: number; h: number }
  solido: boolean
  // usos alternativos além da categoria principal (ex.: coluna = parede + decoracao)
  serveComo: string[]
  // true depois da revisão manual do índice (tela /admin/tiles, ainda não implementada)
  revisado: boolean
}

interface TileIndice {
  pack: string
  tile: number
  cols: number
  categorias?: string[]
  tiles: TileIndiceEntry[]
}

export interface TileResultado extends TileIndiceEntry {
  pack: string
  cols: number
  tile: number
}

/* O vocabulário do mundo é a série Tiny — um artista, uma série, feita para conviver.
   rpg-urban e modern-city saíram daqui de propósito: eram 1.522 dos 1.654 tiles a
   revisar e são de outra família visual. Não foram apagados — os PNG e os índices
   continuam no repo, e a cena desenha peça já colocada por criarSpriteDeTile, que lê
   o tileRef do objeto e nunca este arquivo. Logo mapa antigo continua igual, e voltar
   um pack é reimportar o JSON e acrescentar na lista abaixo.
   Os avatares vêm de recortes próprios em avatar/, também alheios a esta lista. */
const INDICES = [
  indiceTinyTown, indiceTinyFarm, indiceTinyBattle, indiceTinySki, indiceTinyDungeon,
] as unknown as TileIndice[]

function semAcento(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export interface Folha {
  pack: string
  cols: number
  tile: number
  tiles: TileResultado[]
}

// a folha inteira de um pack, na ordem do tilesheet — é o que permite exibir o
// catálogo com a disposição original, onde o objeto de vários tiles se lê inteiro
export function folhas(): Folha[] {
  return INDICES.map((idx) => ({
    pack: idx.pack,
    cols: idx.cols,
    tile: idx.tile,
    tiles: idx.tiles.map((t) => ({ ...t, pack: idx.pack, cols: idx.cols, tile: idx.tile })),
  }))
}

export function categorias(): string[] {
  const set = new Set<string>()
  for (const idx of INDICES) {
    for (const t of idx.tiles) set.add(t.cat)
  }
  return [...set].sort()
}

const SINONIMOS: Record<string, string[]> = {
  mesa: ['balcao', 'bancada', 'vitrine', 'caixote', 'banca'],
  escrivaninha: ['balcao', 'bancada', 'armario'],
  luminaria: ['poste', 'lampada', 'luz'],
  lousa: ['quadro', 'tela', 'placa'],
  servidor: ['painel', 'gerador', 'maquina'],
  fonte: ['poco', 'chafariz', 'piscina'],
  cadeira: ['poltrona', 'banqueta', 'banco'],
}

export function expandir(termo: string): string[] {
  const base = termo.trim().toLowerCase()
  const extra = SINONIMOS[base] || []
  return [base, ...extra].filter(Boolean)
}

// serveComo entra aqui e não só no filtro de categoria porque é o que a revisão
// manual grava: a coluna revisada como "parede + decoracao" tem que aparecer nas duas
export function casa(t: TileIndiceEntry, alvos: string[], cat?: string): boolean {
  if (cat && t.cat !== cat && !t.serveComo.includes(cat)) return false
  if (!alvos.length) return true
  const nome = semAcento(t.nome)
  return alvos.some(
    (a) =>
      nome.includes(a) ||
      t.tags.some((tag) => semAcento(tag).includes(a)) ||
      t.serveComo.some((s) => semAcento(s).includes(a)),
  )
}

export function alvosDe(termo: string): string[] {
  return expandir(termo).map(semAcento).filter(Boolean)
}

export function buscar(termo: string, cat?: string): TileResultado[] {
  const alvos = alvosDe(termo)
  const resultado: TileResultado[] = []
  for (const idx of INDICES) {
    for (const t of idx.tiles) {
      if (!casa(t, alvos, cat)) continue
      resultado.push({ ...t, pack: idx.pack, cols: idx.cols, tile: idx.tile })
    }
  }
  return resultado
}
