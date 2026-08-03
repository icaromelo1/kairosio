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
  | 'wall'
  | 'area'
  | 'door'
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
  sittable?: boolean
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
  serverId?: string | null
  isTemplate?: boolean
}

/** Objetos com os quais se pode interagir ([E]). */
export function interactableObjects(map: MapDef): MapObject[] {
  return map.objects.filter((o) => o.name)
}

function tocaOuSobrepoe(a: MapObject, b: MapObject, tolerancia: number): boolean {
  return (
    a.x < b.x + b.w + tolerancia &&
    a.x + a.w + tolerancia > b.x &&
    a.y < b.y + b.h + tolerancia &&
    a.y + a.h + tolerancia > b.y
  )
}

function salaDaPorta(map: MapDef, porta: MapObject): MapObject | undefined {
  return map.objects.find((o) => o.kind === 'area' && tocaOuSobrepoe(porta, o, 1))
}

/**
 * Colisão por tile. A borda do mapa é sempre sólida; objetos `solid` bloqueiam
 * suas células. Base do movimento com hitbox do Épico 2.
 * Se `trancadas` marca a sala de uma porta como trancada, a porta vira sólida
 * para quem não está em `salaDoMovedor` (quem já está dentro continua saindo).
 */
export function isSolid(
  map: MapDef,
  x: number,
  y: number,
  trancadas?: Set<string>,
  salaDoMovedor?: string | null,
): boolean {
  if (x < 1 || y < 1 || x > map.width - 2 || y > map.height - 2) return true
  for (const o of map.objects) {
    if (o.solid && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) return true
  }
  if (trancadas) {
    for (const o of map.objects) {
      if (o.kind !== 'door') continue
      if (!(x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h)) continue
      const sala = salaDaPorta(map, o)
      if (sala?.id && trancadas.has(sala.id) && salaDoMovedor !== sala.id) return true
    }
  }
  return false
}
