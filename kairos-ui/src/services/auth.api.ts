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

export async function register(email: string, password: string): Promise<TokenResponse> {
  const res = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (res.status === 409) throw new Error('email-exists')
  if (res.status === 400) throw new Error('invalid-input')
  if (!res.ok) throw new Error('register-failed')
  return res.json()
}

export async function guest(): Promise<TokenResponse> {
  const res = await apiFetch('/auth/guest', { method: 'POST' })
  if (!res.ok) throw new Error('guest-failed')
  return res.json()
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
