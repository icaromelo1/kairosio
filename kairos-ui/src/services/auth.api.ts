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
