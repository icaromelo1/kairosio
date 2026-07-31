// Para onde vai quem acabou de entrar: sempre o jogo. O que muda é qual painel abre
// por cima dele. A decisão viaja na query (?abrir=) porque precisa sobreviver a um
// recarregamento da página — estado em memória se perderia.
import type { LocationQuery, RouteLocationRaw } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore'
import { getCharacter } from './character.api'
import { getMyServers, consumePendingInvite } from './server.api'

// personagem/servidores são os dois que a entrada escolhe sozinha; admin e feedback
// entram no vocabulário porque as rotas antigas (/admin, /feedback) redirecionam pra cá
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
  // convidado não cria servidor e já enxerga os mundos abertos: abrir o painel pra ele
  // seria oferecer uma porta sem chave
  if (!servers.length && !auth.isGuest) return 'servidores'
  return null
}

export async function postAuthDest(): Promise<RouteLocationRaw> {
  const invite = consumePendingInvite()
  if (invite) return { path: '/game', query: { [PANEL_QUERY]: 'servidores', invite } }
  const panel = await initialPanel()
  return panel ? { path: '/game', query: { [PANEL_QUERY]: panel } } : { path: '/game' }
}
