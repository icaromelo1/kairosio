export const TILE = 32
export const MAP_W = 30
export const MAP_H = 20

export const MAP_THEMES = {
  studio: {
    id: 'studio',
    name: 'Studio Tech',
    blurb: 'Escritório dark com lousa, jukebox e sala de servidores.',
    floor: ['#1a1a26', '#1d1d2a'],
    floorTrim: '#15151f',
    wall: '#0d0d14',
    wallTop: '#252535',
    accent: 'var(--primary)',
    label: 'default',
    hours: '24/7',
    decor: [
      { type: 'rug', x: 12, y: 9, w: 6, h: 4, color: 'rgba(124,58,237,0.18)' },
      { type: 'panel', x: 10, y: 1, w: 10, h: 1, color: 'rgba(34, 211, 238, 0.18)' },
    ],
  },
  athenaeum: {
    id: 'athenaeum',
    name: 'Athenaeum',
    blurb: 'Biblioteca grega com colunas, mosaicos e luz dourada.',
    floor: ['#1f1a14', '#241e16'],
    floorTrim: '#1a1510',
    wall: '#0e0a06',
    wallTop: '#3a2e1e',
    accent: 'var(--accent)',
    label: 'greek',
    hours: 'alvorada',
    decor: [
      { type: 'rug', x: 12, y: 9, w: 6, h: 4, color: 'rgba(251,191,36,0.14)' },
      { type: 'panel', x: 6, y: 6, w: 1, h: 9, color: 'rgba(251,191,36,0.1)' },
      { type: 'panel', x: 23, y: 6, w: 1, h: 9, color: 'rgba(251,191,36,0.1)' },
    ],
  },
  agora: {
    id: 'agora',
    name: 'Agora',
    blurb: 'Jardim aberto com fonte central e canteiros — modo focado.',
    floor: ['#152018', '#172418'],
    floorTrim: '#101810',
    wall: '#070d08',
    wallTop: '#1f3024',
    accent: '#34d399',
    label: 'outdoor',
    hours: 'tarde',
    decor: [
      { type: 'rug', x: 13, y: 9, w: 4, h: 4, color: 'rgba(34, 211, 238, 0.18)' },
      { type: 'grass', x: 2, y: 10, w: 4, h: 8, color: 'rgba(52,211,153,0.16)' },
      { type: 'grass', x: 24, y: 10, w: 4, h: 8, color: 'rgba(52,211,153,0.16)' },
    ],
  },
} as const

export type MapThemeId = keyof typeof MAP_THEMES

export const MAP_ZONES = [
  { id: 'desk', name: 'Mesa de Trabalho', action: 'Abrir Workspace', x: 14, y: 10, w: 4, h: 2, glow: 'purple', spawn: true },
  { id: 'board', name: 'Lousa Estratégica', action: 'Brainstorm / Whiteboard', x: 22, y: 2, w: 5, h: 1, glow: 'cyan' },
  { id: 'jukebox', name: 'Rádio / Jukebox', action: 'Tocar playlist', x: 3, y: 16, w: 2, h: 2, glow: 'purple' },
  { id: 'servers', name: 'Sala de Servidores', action: 'Falar com Agente IA', x: 2, y: 2, w: 4, h: 3, glow: 'purple', npc: true },
  { id: 'shelf', name: 'Estante de Notas', action: 'Abrir notas', x: 24, y: 16, w: 4, h: 2, glow: 'gold' },
]

export type MapZone = typeof MAP_ZONES[number]
