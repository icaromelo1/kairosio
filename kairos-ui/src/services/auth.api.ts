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
  if (!res.ok) throw new Error('login-failed')
  return res.json()
}

export async function register(email: string, password: string): Promise<TokenResponse> {
  const res = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error('register-failed')
  return res.json()
}

export async function guest(): Promise<TokenResponse> {
  const res = await apiFetch('/auth/guest', { method: 'POST' })
  if (!res.ok) throw new Error('guest-failed')
  return res.json()
}
