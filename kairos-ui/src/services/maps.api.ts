// Busca os mundos do kairos-api (fonte da verdade = banco). Mesmo padrão de URL
// da presença: API atrás do Traefik com stripprefix /kairos-api.
import type { MapDef } from '@/game/maps'

const API_URL = import.meta.env.VITE_API_URL || window.location.origin

export async function fetchMaps(): Promise<MapDef[]> {
  const res = await fetch(`${API_URL}/kairos-api/map`)
  if (!res.ok) throw new Error(`Falha ao carregar mapas (${res.status})`)
  return res.json()
}

export async function fetchMap(id: string): Promise<MapDef> {
  const res = await fetch(`${API_URL}/kairos-api/map/${id}`)
  if (!res.ok) throw new Error(`Falha ao carregar mapa ${id} (${res.status})`)
  return res.json()
}

// usado pelo editor in-game (futuro) pra salvar tamanho/itens de um mundo
export async function saveMap(id: string, patch: Partial<MapDef>): Promise<MapDef> {
  const res = await fetch(`${API_URL}/kairos-api/map/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`Falha ao salvar mapa ${id} (${res.status})`)
  return res.json()
}
