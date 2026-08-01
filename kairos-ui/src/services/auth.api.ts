// Autenticação real contra o /auth do kairos-api (JWT).
import { apiFetch } from './http'

interface TokenResponse {
  token: string
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (res.status === 401) throw new Error('invalid-credentials')
  if (!res.ok) throw new Error('login-failed')
  return res.json()
}

export async function register(email: string, password: string, username: string): Promise<TokenResponse> {
  const res = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, username }),
  })
  if (!res.ok) throw new Error(await failureCode(res))
  return res.json()
}

export type UsernameReason = 'formato' | 'reservado' | 'em-uso'

export interface UsernameStatus {
  disponivel: boolean
  motivo?: UsernameReason
}

export async function checkUsername(username: string): Promise<UsernameStatus> {
  const res = await apiFetch(`/auth/username-disponivel?u=${encodeURIComponent(username)}`)
  if (res.status === 429) throw new Error('rate-limited')
  if (!res.ok) throw new Error('check-failed')
  return res.json()
}

export interface Me {
  id: string
  email: string | null
  username: string | null
  usernameChangedAt: string | null
  isGuest: boolean
  isAdmin: boolean
  serverId: string | null
  serverRole: 'admin' | 'member'
  createdAt: string
}

export async function me(): Promise<Me> {
  const res = await apiFetch('/auth/me')
  if (!res.ok) throw new Error('me-failed')
  return res.json()
}

export interface UsernameView {
  username: string | null
  usernameChangedAt: string | null
  proximaTrocaEm: string | null
}

export class UsernameError extends Error {
  constructor(public code: string, message: string, public proximaTrocaEm: string | null = null) {
    super(message)
  }
}

export async function changeUsername(username: string): Promise<UsernameView> {
  const res = await apiFetch('/auth/username', {
    method: 'PATCH',
    body: JSON.stringify({ username }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { code?: string; message?: string; proximaTrocaEm?: string }
      | null
    throw new UsernameError(
      body?.code ?? 'username-failed',
      body?.message ?? 'Não deu pra trocar o nome de usuário.',
      body?.proximaTrocaEm ?? null,
    )
  }
  return res.json()
}

async function failureCode(res: Response): Promise<string> {
  const body = await res.json().catch(() => null)
  const code = (body as { code?: unknown } | null)?.code
  if (typeof code === 'string') return code
  return res.status === 400 ? 'invalid-input' : 'register-failed'
}

// avisa o backend antes de limpar o token local — se for conta de convidado,
// apaga tudo no backend (personagem/mundo salvo/vínculos de servidor). Best-effort:
// falha de rede aqui não deve impedir o usuário de sair da tela.
export async function logoutApi(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST' })
  } catch {
    // ignora — o logout local (limpar token) acontece de qualquer forma
  }
}
