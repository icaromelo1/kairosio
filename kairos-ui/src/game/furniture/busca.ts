import indiceRpgUrban from './indice-rpg-urban.json'
import indiceModernCity from './indice-modern-city.json'
import indiceTinyTown from './indice-tiny-town.json'

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

const INDICES = [indiceRpgUrban, indiceModernCity, indiceTinyTown] as unknown as TileIndice[]

function semAcento(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
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

export function buscar(termo: string, cat?: string): TileResultado[] {
  const alvos = expandir(termo).map(semAcento).filter(Boolean)
  const resultado: TileResultado[] = []
  for (const idx of INDICES) {
    for (const t of idx.tiles) {
      if (cat && t.cat !== cat) continue
      if (alvos.length) {
        const nome = semAcento(t.nome)
        const bate = alvos.some((a) => nome.includes(a) || t.tags.some((tag) => semAcento(tag).includes(a)))
        if (!bate) continue
      }
      resultado.push({ ...t, pack: idx.pack, cols: idx.cols, tile: idx.tile })
    }
  }
  return resultado
}
