// API do servidor (multi-tenancy). JWT via apiFetch.
import { apiFetch } from './http'

export interface ServerMember {
  id: string
  email: string
  serverRole: 'admin' | 'member'
  createdAt: string
}

export interface Server {
  id: string
  name: string
  slug: string
  members?: ServerMember[]
}

async function jsonOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null
  const text = await res.text()
  return text ? (JSON.parse(text) as T) : null
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
}

// todos os servidores de que o usuário é membro — usada pra decidir se mostra a tela de escolha
export async function getMyServers(): Promise<MyServerSummary[]> {
  const res = await apiFetch('/server/mine')
  if (!res.ok) return []
  return res.json()
}

export async function switchServer(serverId: string): Promise<Server | null> {
  const res = await apiFetch(`/server/switch/${serverId}`, { method: 'POST' })
  if (!res.ok) throw new Error('Falha ao trocar de servidor')
  return res.json()
}

export async function createServer(name: string): Promise<Server> {
  const res = await apiFetch('/server', { method: 'POST', body: JSON.stringify({ name }) })
  if (!res.ok) throw new Error('Falha ao criar servidor')
  return res.json()
}

export async function joinServer(code: string): Promise<void> {
  const res = await apiFetch('/server/join', { method: 'POST', body: JSON.stringify({ code }) })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || 'Convite inválido')
  }
}

export async function createInvite(): Promise<{ code: string; expiresAt: string }> {
  const res = await apiFetch('/server/invite', { method: 'POST' })
  if (!res.ok) throw new Error('Falha ao gerar convite')
  return res.json()
}

// ---- link de convite (em vez de só o código) ----
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

export async function setMemberRole(id: string, role: 'admin' | 'member'): Promise<void> {
  await apiFetch(`/server/member/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) })
}

export async function removeMember(id: string): Promise<void> {
  await apiFetch(`/server/member/${id}`, { method: 'DELETE' })
}

export async function updateServer(name: string): Promise<void> {
  await apiFetch('/server', { method: 'PUT', body: JSON.stringify({ name }) })
}
