// Mapas oficiais semeados no banco na primeira subida (ownerId = null).
// A partir daqui o banco é a fonte da verdade; o editor in-game só edita registros.

import { CIDADE } from './cidade'
import { TESTE_ARTE } from './teste-arte'

export const SEED_MAPS = [
  {
    id: 'studio',
    name: 'Studio Tech',
    blurb: 'Escritório compacto com lousa, jukebox e sala de servidores.',
    hours: '24/7',
    label: 'default',
    width: 22,
    height: 15,
    spawn: { x: 11, y: 9 },
    palette: { floor: ['#1a1a26', '#1d1d2a'], floorTrim: '#15151f', wall: '#0d0d14', wallTop: '#252535', accent: '#7c3aed' },
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
  CIDADE,
  TESTE_ARTE,
]
