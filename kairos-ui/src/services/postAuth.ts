import type { LocationQuery, RouteLocationRaw } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore'
import { getMyServers, consumePendingInvite } from './server.api'
import { buscarPersonagem } from './personagem.api'
import { me } from './auth.api'

const PANELS = ['personagem', 'servidores', 'admin', 'feedback'] as const

export type GamePanel = (typeof PANELS)[number]

export const PANEL_QUERY = 'abrir'

export function panelFromQuery(query: LocationQuery): GamePanel | null {
  const value = query[PANEL_QUERY]
  return PANELS.includes(value as GamePanel) ? (value as GamePanel) : null
}

export async function initialPanel(): Promise<GamePanel | null> {
  const auth = useAuthStore()
  if (await precisaCriarPersonagem()) return 'personagem'
  const servers = await getMyServers()
  if (!servers.length && !auth.isGuest) return 'servidores'
  return null
}

export async function precisaCriarPersonagem(): Promise<boolean> {
  const [personagem, perfil] = await Promise.all([buscarPersonagem(), me()])
  return !perfil.username || !personagem?.aparencia
}

export async function postAuthDest(): Promise<RouteLocationRaw> {
  const invite = consumePendingInvite()
  if (invite) return { path: '/game', query: { [PANEL_QUERY]: 'servidores', invite } }
  const panel = await initialPanel()
  return panel ? { path: '/game', query: { [PANEL_QUERY]: panel } } : { path: '/game' }
}
