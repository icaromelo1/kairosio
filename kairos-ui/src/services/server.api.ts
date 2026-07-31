// API do servidor (multi-tenancy). JWT via apiFetch.
import { apiFetch } from './http'

export interface ServerMember {
  id: string
  email: string
  serverRole: 'admin' | 'member'
  createdAt: string
  // opcionais: /server/me monta a lista a partir de users.serverId e ainda não devolve
  // nem o nome do personagem nem o joinedAt (que vive em server_memberships)
  name?: string
  joinedAt?: string
}

export interface Server {
  id: string
  name: string
  slug: string
  ownerId: string
  archivedAt: string | null
  members?: ServerMember[]
}

export interface ServerInvite {
  code: string
  uses: number
}

async function jsonOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null
  const text = await res.text()
  return text ? (JSON.parse(text) as T) : null
}

// o back manda mensagens específicas ("Você é o último administrador deste servidor…"),
// então a mensagem dele vale mais que qualquer texto genérico daqui;
// o ValidationPipe do Nest devolve message como array
async function apiError(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
  const message = Array.isArray(body.message) ? body.message.join(' ') : body.message
  return new Error(message || fallback)
}

export async function getMyServer(): Promise<Server | null> {
  return jsonOrNull<Server>(await apiFetch('/server/me'))
}

export interface MyServerSummary {
  id: string
  name: string
  slug: string
  role: 'admin' | 'member'
  active: boolean
  archived: boolean
}

// todos os servidores de que o usuário é membro — usada pra decidir se mostra a tela de escolha
export async function getMyServers(): Promise<MyServerSummary[]> {
  const res = await apiFetch('/server/mine')
  if (!res.ok) return []
  return res.json()
}

export async function getArchivedServers(): Promise<MyServerSummary[]> {
  const res = await apiFetch('/server/mine?archived=true')
  if (!res.ok) return []
  return res.json()
}

export async function switchServer(serverId: string): Promise<Server | null> {
  const res = await apiFetch(`/server/switch/${serverId}`, { method: 'POST' })
  if (!res.ok) throw await apiError(res, 'Falha ao trocar de servidor')
  return res.json()
}

export async function createServer(name: string): Promise<Server> {
  const res = await apiFetch('/server', { method: 'POST', body: JSON.stringify({ name }) })
  if (!res.ok) throw await apiError(res, 'Falha ao criar servidor')
  return res.json()
}

export async function joinServer(code: string): Promise<void> {
  const res = await apiFetch('/server/join', { method: 'POST', body: JSON.stringify({ code }) })
  if (!res.ok) throw await apiError(res, 'Convite inválido')
}

// ---- convite: link fixo, um por servidor ----
export async function getInvite(serverId: string): Promise<ServerInvite> {
  const res = await apiFetch(`/server/${serverId}/invite`)
  if (!res.ok) throw await apiError(res, 'Falha ao carregar o link de convite')
  return res.json()
}

export async function revokeInvite(serverId: string): Promise<ServerInvite> {
  const res = await apiFetch(`/server/${serverId}/invite/revoke`, { method: 'POST' })
  if (!res.ok) throw await apiError(res, 'Falha ao revogar o link de convite')
  return res.json()
}

// monta a URL completa que cai em /join/<code>; respeita o base do app (/kairos/)
export function inviteLink(code: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${window.location.origin}${base}/join/${code}`
}

// guarda/recupera um convite que veio pelo link mas precisa esperar o login
const PENDING_INVITE_KEY = 'kairos_pending_invite'
export function setPendingInvite(code: string): void {
  if (code) localStorage.setItem(PENDING_INVITE_KEY, code)
}
export function consumePendingInvite(): string | null {
  const code = localStorage.getItem(PENDING_INVITE_KEY)
  if (code) localStorage.removeItem(PENDING_INVITE_KEY)
  return code
}

// ---- ações sobre um servidor específico ----
export async function leaveServer(serverId: string): Promise<void> {
  const res = await apiFetch(`/server/${serverId}/leave`, { method: 'POST' })
  if (!res.ok) throw await apiError(res, 'Falha ao sair do servidor')
}

export async function transferServer(serverId: string, userId: string): Promise<void> {
  const res = await apiFetch(`/server/${serverId}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
  if (!res.ok) throw await apiError(res, 'Falha ao transferir a posse')
}

export async function archiveServer(serverId: string): Promise<void> {
  const res = await apiFetch(`/server/${serverId}/archive`, { method: 'POST' })
  if (!res.ok) throw await apiError(res, 'Falha ao arquivar o servidor')
}

export async function restoreServer(serverId: string): Promise<void> {
  const res = await apiFetch(`/server/${serverId}/restore`, { method: 'POST' })
  if (!res.ok) throw await apiError(res, 'Falha ao restaurar o servidor')
}

// ---- admin do servidor ativo ----
export async function setMemberRole(id: string, role: 'admin' | 'member'): Promise<void> {
  const res = await apiFetch(`/server/member/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) })
  if (!res.ok) throw await apiError(res, 'Falha ao alterar o papel do membro')
}

export async function removeMember(id: string): Promise<void> {
  const res = await apiFetch(`/server/member/${id}`, { method: 'DELETE' })
  if (!res.ok) throw await apiError(res, 'Falha ao remover o membro')
}

export async function updateServer(name: string): Promise<void> {
  const res = await apiFetch('/server', { method: 'PUT', body: JSON.stringify({ name }) })
  if (!res.ok) throw await apiError(res, 'Falha ao renomear o servidor')
}
