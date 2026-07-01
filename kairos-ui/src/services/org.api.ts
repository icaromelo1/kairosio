// API da organização (multi-tenancy). JWT via apiFetch.
import { apiFetch } from './http'

export interface OrgMember {
  id: string
  email: string
  orgRole: 'admin' | 'member'
  createdAt: string
}

export interface Org {
  id: string
  name: string
  slug: string
  members?: OrgMember[]
}

async function jsonOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null
  const text = await res.text()
  return text ? (JSON.parse(text) as T) : null
}

export async function getMyOrg(): Promise<Org | null> {
  return jsonOrNull<Org>(await apiFetch('/org/me'))
}

export interface MyOrgSummary {
  id: string
  name: string
  slug: string
  role: 'admin' | 'member'
  active: boolean
}

// todas as orgs de que o usuário é membro — usada pra decidir se mostra a tela de escolha
export async function getMyOrgs(): Promise<MyOrgSummary[]> {
  const res = await apiFetch('/org/mine')
  if (!res.ok) return []
  return res.json()
}

export async function switchOrg(orgId: string): Promise<Org | null> {
  const res = await apiFetch(`/org/switch/${orgId}`, { method: 'POST' })
  if (!res.ok) throw new Error('Falha ao trocar de organização')
  return res.json()
}

export async function createOrg(name: string): Promise<Org> {
  const res = await apiFetch('/org', { method: 'POST', body: JSON.stringify({ name }) })
  if (!res.ok) throw new Error('Falha ao criar organização')
  return res.json()
}

export async function joinOrg(code: string): Promise<void> {
  const res = await apiFetch('/org/join', { method: 'POST', body: JSON.stringify({ code }) })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || 'Convite inválido')
  }
}

export async function createInvite(): Promise<{ code: string; expiresAt: string }> {
  const res = await apiFetch('/org/invite', { method: 'POST' })
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
  await apiFetch(`/org/member/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) })
}

export async function removeMember(id: string): Promise<void> {
  await apiFetch(`/org/member/${id}`, { method: 'DELETE' })
}

export async function updateOrg(name: string): Promise<void> {
  await apiFetch('/org', { method: 'PUT', body: JSON.stringify({ name }) })
}
