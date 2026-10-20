import { apiFetch } from './http'
import type { Mapa } from '@/mundo/tipos'

export const MAPA_ATUAL = 'escritorio'

export async function buscarMapa(id: string): Promise<Mapa> {
  const res = await apiFetch(`/map/${id}`)
  if (!res.ok) throw new Error(`Falha ao carregar o mapa ${id} (${res.status})`)
  return res.json()
}
