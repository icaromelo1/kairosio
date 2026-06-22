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

export async function setMemberRole(id: string, role: 'admin' | 'member'): Promise<void> {
  await apiFetch(`/org/member/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) })
}

export async function removeMember(id: string): Promise<void> {
  await apiFetch(`/org/member/${id}`, { method: 'DELETE' })
}

export async function updateOrg(name: string): Promise<void> {
  await apiFetch('/org', { method: 'PUT', body: JSON.stringify({ name }) })
}
