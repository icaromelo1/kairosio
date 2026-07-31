// API de amizade (/friend). Toda rota é autenticada e recusa convidado com 403
// `guest-no-friends` — a tela confere isso antes de chamar.
import { apiFetch } from './http'

export interface FriendUser {
  id: string
  username: string | null
  nome: string | null
}

export type FriendStatus = 'pendente' | 'aceita' | 'bloqueada'

export interface FriendView {
  id: string
  status: FriendStatus
  pedidoFeitoPorMim: boolean
  desde: string | null
  criadoEm: string | null
  usuario: FriendUser | null
}

export interface PendingFriends {
  recebidos: FriendView[]
  enviados: FriendView[]
}

export interface FriendServerInvite {
  id: string
  serverId: string
  servidor: string | null
  status: 'pendente' | 'aceito' | 'recusado'
  criadoEm: string | null
  de?: FriendUser | null
}

// o `code` do corpo é o que separa "não existe" de "já são amigos" e de "você
// bloqueou"; a mensagem do back entra só como texto de reserva
export class FriendError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

async function fail(res: Response, fallback: string): Promise<FriendError> {
  const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string | string[] }
  const message = Array.isArray(body.message) ? body.message.join(' ') : body.message
  return new FriendError(message || fallback, body.code || '')
}

async function send<T>(path: string, fallback: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init)
  if (!res.ok) throw await fail(res, fallback)
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

export function listFriends(): Promise<FriendView[]> {
  return send('/friend', 'Falha ao carregar seus amigos')
}

export function pendingFriends(): Promise<PendingFriends> {
  return send('/friend/pending', 'Falha ao carregar os pedidos de amizade')
}

export function blockedFriends(): Promise<FriendView[]> {
  return send('/friend/blocked', 'Falha ao carregar quem você bloqueou')
}

export function receivedServerInvites(): Promise<FriendServerInvite[]> {
  return send('/friend/invites', 'Falha ao carregar os convites de servidor')
}

// o "@" é enfeite da interface: o back tira sozinho, mas mandar sem ele evita
// depender disso
export function requestFriend(username: string): Promise<FriendView> {
  return send('/friend/request', 'Falha ao enviar o pedido', {
    method: 'POST',
    body: JSON.stringify({ username: username.replace(/^@+/, '') }),
  })
}

export function acceptFriend(id: string): Promise<FriendView> {
  return send(`/friend/${id}/accept`, 'Falha ao aceitar o pedido', { method: 'POST' })
}

export function rejectFriend(id: string): Promise<void> {
  return send(`/friend/${id}/reject`, 'Falha ao recusar o pedido', { method: 'POST' })
}

export function removeFriend(id: string): Promise<void> {
  return send(`/friend/${id}`, 'Falha ao remover', { method: 'DELETE' })
}

export function blockFriend(id: string): Promise<FriendView> {
  return send(`/friend/${id}/block`, 'Falha ao bloquear', { method: 'POST' })
}

export function unblockFriend(id: string): Promise<void> {
  return send(`/friend/${id}/unblock`, 'Falha ao desbloquear', { method: 'POST' })
}

export function inviteFriendToServer(id: string, serverId: string): Promise<FriendServerInvite> {
  return send(`/friend/${id}/invite-server`, 'Falha ao convidar', {
    method: 'POST',
    body: JSON.stringify({ serverId }),
  })
}
