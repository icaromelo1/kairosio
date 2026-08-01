import type { LocationQuery, RouteLocationRaw } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore'
import { getCharacter } from './character.api'
import { getMyServers, consumePendingInvite } from './server.api'

const PANELS = ['personagem', 'servidores', 'admin', 'feedback'] as const

export type GamePanel = (typeof PANELS)[number]

export const PANEL_QUERY = 'abrir'

export function panelFromQuery(query: LocationQuery): GamePanel | null {
  const value = query[PANEL_QUERY]
  return PANELS.includes(value as GamePanel) ? (value as GamePanel) : null
}

export async function initialPanel(): Promise<GamePanel | null> {
  const auth = useAuthStore()
  const [character, servers] = await Promise.all([getCharacter(), getMyServers()])
  if (!character) return 'personagem'
  if (!servers.length && !auth.isGuest) return 'servidores'
  return null
}

export async function postAuthDest(): Promise<RouteLocationRaw> {
  const invite = consumePendingInvite()
  if (invite) return { path: '/game', query: { [PANEL_QUERY]: 'servidores', invite } }
  const panel = await initialPanel()
  return panel ? { path: '/game', query: { [PANEL_QUERY]: panel } } : { path: '/game' }
}
