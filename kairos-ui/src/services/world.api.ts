// Persistência do estado de mundo do jogador (último mundo + posição). JWT via apiFetch.
import { apiFetch } from './http'

export interface WorldState {
  activeMap: string
  playerX: number
  playerY: number
}

export async function getWorldState(): Promise<WorldState | null> {
  const res = await apiFetch('/world/state')
  if (!res.ok) return null
  // usuário sem estado salvo → 200 com corpo VAZIO; não dá pra fazer .json() direto
  const text = await res.text()
  return text ? (JSON.parse(text) as WorldState) : null
}

export async function saveWorldState(data: WorldState): Promise<boolean> {
  const res = await apiFetch('/world/state', { method: 'PUT', body: JSON.stringify(data) })
  return res.ok
}
