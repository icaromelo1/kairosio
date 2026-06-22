// Motor de mapa — tipos do formato de dados + helpers de colisão (Épico 1a).
//
// Os DADOS dos mapas NÃO vivem mais aqui: são servidos pelo kairos-api
// (`GET /kairos-api/map`) a partir do banco, então o editor in-game (Épico 1e)
// pode alterar tamanho e itens de cada mundo só salvando o registro.
// Ver `services/maps.api.ts`.

export const TILE = 32

export interface MapPalette {
  floor: [string, string]
  floorTrim: string
  wall: string
  wallTop: string
  accent: string
}

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
  | 'chair'
  | 'sofa'
  | 'custom'

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
  /** Rotação visual em graus (0/90/180/270). */
  rotation?: number
  /** Cor de override (cenário). Aceita hex ou rgba(). */
  color?: string
  /** Arte de pixel do objeto customizado (matriz de cores; null = transparente). */
  pixels?: (string | null)[][]
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
  // multi-tenancy (vêm da API; opcionais no front)
  ownerId?: string | null
  organizationId?: string | null
  isTemplate?: boolean
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
