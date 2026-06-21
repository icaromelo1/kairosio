// Motor de mapa — formato de dados próprio do Kairos (Épico 1a).
//
// Um mapa é orientado a DADOS: dimensões próprias, paleta visual, ponto de spawn
// e uma lista única de `objects` (interativos + cenário). Cada objeto pode ser
// `solid` (entra na colisão/hitbox — Épico 2). Esse mesmo formato será lido e
// escrito pelo editor de mapa in-game (Épico 1e), por isso é simples e explícito.

export const TILE = 32

export interface MapPalette {
  floor: [string, string]
  floorTrim: string
  wall: string
  wallTop: string
  accent: string
}

// Interativos (abrem algo) + cenário/estrutura (decoração e paredes internas).
export type ObjectKind =
  | 'desk'
  | 'board'
  | 'jukebox'
  | 'servers'
  | 'shelf'
  | 'rug'
  | 'panel'
  | 'grass'

export interface MapObject {
  id: string
  kind: ObjectKind
  x: number
  y: number
  w: number
  h: number
  /** Bloqueia o movimento (hitbox). Ausente = atravessável. */
  solid?: boolean
  /** Cor de override para cenário (rug/panel/grass). */
  color?: string
  // Campos de interativo (quando o objeto abre algo ao apertar [E]):
  name?: string
  action?: string
  glow?: 'purple' | 'cyan' | 'gold'
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

export type MapId = 'studio' | 'athenaeum' | 'agora'

// Objetos interativos — hoje compartilhados pelos três mundos (paridade com o
// formato antigo). Com o novo schema, cada mapa pode divergir quando quisermos.
function interactables(): MapObject[] {
  return [
    { id: 'desk', kind: 'desk', name: 'Mesa de Trabalho', action: 'Abrir Workspace', x: 14, y: 10, w: 4, h: 2, glow: 'purple' },
    { id: 'board', kind: 'board', name: 'Lousa Estratégica', action: 'Brainstorm / Whiteboard', x: 22, y: 2, w: 5, h: 1, glow: 'cyan' },
    { id: 'jukebox', kind: 'jukebox', name: 'Rádio / Jukebox', action: 'Tocar playlist', x: 3, y: 16, w: 2, h: 2, glow: 'purple' },
    { id: 'servers', kind: 'servers', name: 'Sala de Servidores', action: 'Falar com Agente IA', x: 2, y: 2, w: 4, h: 3, glow: 'purple', npc: true },
    { id: 'shelf', kind: 'shelf', name: 'Estante de Notas', action: 'Abrir notas', x: 24, y: 16, w: 4, h: 2, glow: 'gold' },
  ]
}

export const MAPS: Record<MapId, MapDef> = {
  studio: {
    id: 'studio',
    name: 'Studio Tech',
    blurb: 'Escritório dark com lousa, jukebox e sala de servidores.',
    hours: '24/7',
    label: 'default',
    width: 30,
    height: 20,
    spawn: { x: 15, y: 12 },
    palette: {
      floor: ['#1a1a26', '#1d1d2a'],
      floorTrim: '#15151f',
      wall: '#0d0d14',
      wallTop: '#252535',
      accent: 'var(--primary)',
    },
    objects: [
      { id: 'rug', kind: 'rug', x: 12, y: 9, w: 6, h: 4, color: 'rgba(124,58,237,0.18)' },
      { id: 'panel-top', kind: 'panel', x: 10, y: 1, w: 10, h: 1, color: 'rgba(34, 211, 238, 0.18)' },
      ...interactables(),
    ],
  },
  athenaeum: {
    id: 'athenaeum',
    name: 'Athenaeum',
    blurb: 'Biblioteca grega com colunas, mosaicos e luz dourada.',
    hours: 'alvorada',
    label: 'greek',
    width: 30,
    height: 20,
    spawn: { x: 15, y: 12 },
    palette: {
      floor: ['#1f1a14', '#241e16'],
      floorTrim: '#1a1510',
      wall: '#0e0a06',
      wallTop: '#3a2e1e',
      accent: 'var(--accent)',
    },
    objects: [
      { id: 'rug', kind: 'rug', x: 12, y: 9, w: 6, h: 4, color: 'rgba(251,191,36,0.14)' },
      { id: 'col-left', kind: 'panel', x: 6, y: 6, w: 1, h: 9, color: 'rgba(251,191,36,0.1)' },
      { id: 'col-right', kind: 'panel', x: 23, y: 6, w: 1, h: 9, color: 'rgba(251,191,36,0.1)' },
      ...interactables(),
    ],
  },
  agora: {
    id: 'agora',
    name: 'Agora',
    blurb: 'Jardim aberto com fonte central e canteiros — modo focado.',
    hours: 'tarde',
    label: 'outdoor',
    width: 30,
    height: 20,
    spawn: { x: 15, y: 12 },
    palette: {
      floor: ['#152018', '#172418'],
      floorTrim: '#101810',
      wall: '#070d08',
      wallTop: '#1f3024',
      accent: '#34d399',
    },
    objects: [
      { id: 'rug', kind: 'rug', x: 13, y: 9, w: 4, h: 4, color: 'rgba(34, 211, 238, 0.18)' },
      { id: 'grass-left', kind: 'grass', x: 2, y: 10, w: 4, h: 8, color: 'rgba(52,211,153,0.16)' },
      { id: 'grass-right', kind: 'grass', x: 24, y: 10, w: 4, h: 8, color: 'rgba(52,211,153,0.16)' },
      ...interactables(),
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
