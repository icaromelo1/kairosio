// Mundos do kairos-api (fonte da verdade = banco). Leitura é pública; criar/editar/
// apagar passam pelo apiFetch (que injeta o JWT). O editor in-game usa create/save/remove.
import type { MapDef } from '@/game/maps'
import { apiFetch } from './http'

export interface NewMap {
  name: string
  width: number
  height: number
  blurb?: string
  palette?: MapDef['palette']
  spawn?: MapDef['spawn']
  objects?: MapDef['objects']
}

export async function fetchMaps(): Promise<MapDef[]> {
  const res = await apiFetch('/map')
  if (!res.ok) throw new Error(`Falha ao carregar mapas (${res.status})`)
  return res.json()
}

export async function fetchMap(id: string): Promise<MapDef> {
  const res = await apiFetch(`/map/${id}`)
  if (!res.ok) throw new Error(`Falha ao carregar mapa ${id} (${res.status})`)
  return res.json()
}

export async function createMap(data: NewMap): Promise<MapDef> {
  const res = await apiFetch('/map', { method: 'POST', body: JSON.stringify(data) })
  if (!res.ok) throw new Error(`Falha ao criar mundo (${res.status})`)
  return res.json()
}

export async function saveMap(id: string, patch: Partial<MapDef>): Promise<MapDef> {
  const res = await apiFetch(`/map/${id}`, { method: 'PUT', body: JSON.stringify(patch) })
  if (!res.ok) throw new Error(`Falha ao salvar mundo ${id} (${res.status})`)
  return res.json()
}

export async function deleteMap(id: string): Promise<void> {
  const res = await apiFetch(`/map/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Falha ao apagar mundo ${id} (${res.status})`)
}
