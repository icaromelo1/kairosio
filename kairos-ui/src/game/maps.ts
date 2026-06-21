// Motor de mapa — formato de dados próprio do Kairos (Épico 1a).
//
// Um mapa é orientado a DADOS: dimensões próprias, paleta visual, ponto de spawn
// e uma lista única de `objects` (interativos + cenário). Cada objeto pode ser
// `solid` (entra na colisão/hitbox) e ter forma retângulo ou círculo. Esse mesmo
// formato será lido e escrito pelo editor de mapa in-game (Épico 1e), por isso é
// simples e explícito.

export const TILE = 32

export interface MapPalette {
  floor: [string, string]
  floorTrim: string
  wall: string
  wallTop: string
  accent: string
}

// Interativos (abrem algo) + cenário/estrutura (decoração, paredes, natureza).
export type ObjectKind =
  | 'desk'
  | 'board'
  | 'jukebox'
  | 'servers'
  | 'shelf'
  | 'rug'
  | 'panel'
  | 'grass'
  | 'plant'
  | 'tree'
  | 'flower'
  | 'bench'
  | 'fountain'
  | 'water'
  | 'hedge'
  | 'path'
  | 'lamp'
  | 'table'
  | 'column'

export interface MapObject {
  id: string
  kind: ObjectKind
  x: number
  y: number
  w: number
  h: number
  /** Bloqueia o movimento (hitbox). Ausente = atravessável. */
  solid?: boolean
  /** Forma desenhada (padrão retângulo). */
  shape?: 'rect' | 'circle'
  /** Cor de override (cenário). Aceita hex ou rgba(). */
  color?: string
  // Campos de interativo (quando o objeto abre algo ao apertar [E]):
  name?: string
  action?: string
  glow?: 'purple' | 'cyan' | 'gold' | 'green'
  npc?: boolean
}

export interface MapDef {
  id: string
  name: string
  blurb: string
  hours: string
  label: string
  /** Dimensões em tiles — cada mapa tem o seu (destrava mapas maiores). */
  width: number
  height: number
  palette: MapPalette
  spawn: { x: number; y: number }
  objects: MapObject[]
}

export type MapId = 'studio' | 'athenaeum' | 'jardim'

export const MAPS: Record<MapId, MapDef> = {
  // ---------------------------------------------------------------- STUDIO
  // Pequeno e aconchegante — escritório dark.
  studio: {
    id: 'studio',
    name: 'Studio Tech',
    blurb: 'Escritório compacto com lousa, jukebox e sala de servidores.',
    hours: '24/7',
    label: 'default',
    width: 22,
    height: 15,
    spawn: { x: 11, y: 9 },
    palette: {
      floor: ['#1a1a26', '#1d1d2a'],
      floorTrim: '#15151f',
      wall: '#0d0d14',
      wallTop: '#252535',
      accent: '#7c3aed',
    },
    objects: [
      { id: 'rug', kind: 'rug', x: 8, y: 6, w: 6, h: 5, color: 'rgba(124,58,237,0.16)' },
      { id: 'desk', kind: 'desk', name: 'Mesa de Trabalho', action: 'Abrir Workspace', x: 9, y: 7, w: 4, h: 2, glow: 'purple', solid: true },
      { id: 'servers', kind: 'servers', name: 'Sala de Servidores', action: 'Falar com Agente IA', x: 2, y: 2, w: 3, h: 3, glow: 'purple', npc: true, solid: true },
      { id: 'shelf', kind: 'shelf', name: 'Estante de Notas', action: 'Abrir notas', x: 17, y: 2, w: 3, h: 2, glow: 'gold', solid: true },
      { id: 'jukebox', kind: 'jukebox', name: 'Rádio / Jukebox', action: 'Tocar playlist', x: 2, y: 11, w: 2, h: 2, glow: 'purple', solid: true },
      { id: 'board', kind: 'board', name: 'Lousa Estratégica', action: 'Brainstorm', x: 9, y: 1, w: 4, h: 1, glow: 'cyan' },
      { id: 'plant1', kind: 'plant', x: 19, y: 11, w: 1, h: 2, color: 'rgba(52,211,153,0.6)' },
      { id: 'plant2', kind: 'plant', x: 16, y: 11, w: 1, h: 2, color: 'rgba(52,211,153,0.45)' },
    ],
  },

  // ------------------------------------------------------------- ATHENAEUM
  // Grande biblioteca grega — muitos itens, colunas e estantes.
  athenaeum: {
    id: 'athenaeum',
    name: 'Athenaeum',
    blurb: 'Biblioteca grega ampla com colunas, mosaicos e luz dourada.',
    hours: 'alvorada',
    label: 'greek',
    width: 46,
    height: 30,
    spawn: { x: 23, y: 24 },
    palette: {
      floor: ['#221c12', '#262013'],
      floorTrim: '#1a1510',
      wall: '#0e0a06',
      wallTop: '#3a2e1e',
      accent: '#fbbf24',
    },
    objects: [
      { id: 'mosaic', kind: 'rug', x: 17, y: 11, w: 12, h: 9, color: 'rgba(251,191,36,0.12)' },
      { id: 'mosaic2', kind: 'rug', x: 20, y: 13, w: 6, h: 5, color: 'rgba(251,191,36,0.16)' },
      { id: 'desk', kind: 'desk', name: 'Mesa de Leitura', action: 'Abrir Workspace', x: 21, y: 14, w: 4, h: 2, glow: 'gold', solid: true },
      { id: 'board', kind: 'board', name: 'Lousa', action: 'Brainstorm', x: 20, y: 1, w: 6, h: 1, glow: 'cyan' },
      // colunas em fileira (sólidas)
      { id: 'c1', kind: 'column', x: 9, y: 5, w: 1, h: 2, color: 'rgba(251,191,36,0.22)', solid: true },
      { id: 'c2', kind: 'column', x: 18, y: 5, w: 1, h: 2, color: 'rgba(251,191,36,0.22)', solid: true },
      { id: 'c3', kind: 'column', x: 27, y: 5, w: 1, h: 2, color: 'rgba(251,191,36,0.22)', solid: true },
      { id: 'c4', kind: 'column', x: 36, y: 5, w: 1, h: 2, color: 'rgba(251,191,36,0.22)', solid: true },
      { id: 'c5', kind: 'column', x: 9, y: 23, w: 1, h: 2, color: 'rgba(251,191,36,0.22)', solid: true },
      { id: 'c6', kind: 'column', x: 18, y: 23, w: 1, h: 2, color: 'rgba(251,191,36,0.22)', solid: true },
      { id: 'c7', kind: 'column', x: 27, y: 23, w: 1, h: 2, color: 'rgba(251,191,36,0.22)', solid: true },
      { id: 'c8', kind: 'column', x: 36, y: 23, w: 1, h: 2, color: 'rgba(251,191,36,0.22)', solid: true },
      // estantes nas laterais (sólidas, uma interativa)
      { id: 'shelfL1', kind: 'shelf', name: 'Acervo Antigo', action: 'Abrir notas', x: 1, y: 4, w: 2, h: 6, glow: 'gold', solid: true },
      { id: 'shelfL2', kind: 'shelf', x: 1, y: 12, w: 2, h: 6, color: '#2a2418', solid: true },
      { id: 'shelfL3', kind: 'shelf', x: 1, y: 20, w: 2, h: 6, color: '#2a2418', solid: true },
      { id: 'shelfR1', kind: 'shelf', x: 43, y: 4, w: 2, h: 6, color: '#2a2418', solid: true },
      { id: 'shelfR2', kind: 'shelf', x: 43, y: 12, w: 2, h: 6, color: '#2a2418', solid: true },
      { id: 'shelfR3', kind: 'shelf', x: 43, y: 20, w: 2, h: 6, color: '#2a2418', solid: true },
      // mesas de leitura espalhadas
      { id: 'rd1', kind: 'table', x: 7, y: 13, w: 3, h: 2, color: '#352b1a', solid: true },
      { id: 'rd2', kind: 'table', x: 36, y: 13, w: 3, h: 2, color: '#352b1a', solid: true },
      { id: 'servers', kind: 'servers', name: 'Oráculo (IA)', action: 'Falar com Agente IA', x: 21, y: 26, w: 4, h: 2, glow: 'purple', npc: true, solid: true },
    ],
  },

  // ----------------------------------------------------------------- JARDIM
  // Médio-grande, ao ar livre — fonte, lago, árvores, flores, cercas, bancos.
  jardim: {
    id: 'jardim',
    name: 'Jardim',
    blurb: 'Jardim aberto com fonte, lago, árvores e canteiros de flores.',
    hours: 'tarde',
    label: 'outdoor',
    width: 36,
    height: 26,
    spawn: { x: 18, y: 20 },
    palette: {
      floor: ['#16301f', '#173420'],
      floorTrim: '#10240f',
      wall: '#0c1f12',
      wallTop: '#1f4a2e',
      accent: '#34d399',
    },
    objects: [
      // caminho central de pedra
      { id: 'path1', kind: 'path', x: 17, y: 8, w: 2, h: 12, color: 'rgba(120,110,90,0.5)' },
      { id: 'path2', kind: 'path', x: 8, y: 13, w: 20, h: 2, color: 'rgba(120,110,90,0.45)' },
      // fonte central (interativa, circular, sólida)
      { id: 'fountain', kind: 'fountain', name: 'Fonte', action: 'Fazer um pedido', x: 16, y: 10, w: 4, h: 4, shape: 'circle', color: '#2563a8', glow: 'cyan', solid: true },
      // lago no canto
      { id: 'pond', kind: 'water', x: 3, y: 3, w: 7, h: 5, color: 'rgba(37,99,168,0.7)' },
      { id: 'pond2', kind: 'water', x: 4, y: 2, w: 4, h: 2, color: 'rgba(37,99,168,0.55)' },
      // árvores (circulares, sólidas)
      { id: 't1', kind: 'tree', x: 6, y: 17, w: 3, h: 3, shape: 'circle', color: '#2f7d3a', solid: true },
      { id: 't2', kind: 'tree', x: 28, y: 5, w: 3, h: 3, shape: 'circle', color: '#2f7d3a', solid: true },
      { id: 't3', kind: 'tree', x: 30, y: 18, w: 3, h: 3, shape: 'circle', color: '#2f7d3a', solid: true },
      { id: 't4', kind: 'tree', x: 12, y: 21, w: 2, h: 2, shape: 'circle', color: '#34944a', solid: true },
      // canteiros de flores (cenário colorido)
      { id: 'f1', kind: 'flower', x: 21, y: 18, w: 3, h: 2, color: 'rgba(244,114,182,0.8)' },
      { id: 'f2', kind: 'flower', x: 25, y: 11, w: 2, h: 2, color: 'rgba(251,191,36,0.8)' },
      { id: 'f3', kind: 'flower', x: 11, y: 4, w: 2, h: 2, color: 'rgba(167,139,250,0.8)' },
      // cercas-vivas (sólidas) formando um recanto
      { id: 'h1', kind: 'hedge', x: 22, y: 16, w: 6, h: 1, color: '#1f5a2e', solid: true },
      { id: 'h2', kind: 'hedge', x: 27, y: 16, w: 1, h: 5, color: '#1f5a2e', solid: true },
      // bancos
      { id: 'b1', kind: 'bench', x: 14, y: 16, w: 2, h: 1, color: '#5a4a32', solid: true },
      { id: 'b2', kind: 'bench', x: 20, y: 7, w: 2, h: 1, color: '#5a4a32', solid: true },
      // mesa de piquenique (interativa)
      { id: 'picnic', kind: 'table', name: 'Mesa de Piquenique', action: 'Sentar', x: 22, y: 19, w: 3, h: 2, glow: 'green', solid: true },
      // postes de luz
      { id: 'lamp1', kind: 'lamp', x: 9, y: 11, w: 1, h: 1, color: 'rgba(251,191,36,0.85)' },
      { id: 'lamp2', kind: 'lamp', x: 26, y: 20, w: 1, h: 1, color: 'rgba(251,191,36,0.85)' },
    ],
  },
}

/** Objetos com os quais se pode interagir ([E]). */
export function interactableObjects(map: MapDef): MapObject[] {
  return map.objects.filter((o) => o.name)
}

/**
 * Colisão por tile. A borda do mapa é sempre sólida; objetos `solid` bloqueiam
 * suas células. Base do movimento com hitbox do Épico 2.
 */
export function isSolid(map: MapDef, x: number, y: number): boolean {
  if (x < 1 || y < 1 || x > map.width - 2 || y > map.height - 2) return true
  for (const o of map.objects) {
    if (o.solid && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) return true
  }
  return false
}
