import { defineStore } from 'pinia'

const TOKEN_KEY = 'kairos_token'

interface JwtPayload {
  sub?: string
  email?: string
  isGuest?: boolean
  exp?: number
}

function decode(token: string): JwtPayload | null {
  try {
    return JSON.parse(atob(token.split('.')[1])) as JwtPayload
  } catch {
    return null
  }
}

// sessão vencida com token ainda no localStorage passava na guarda de rota e caía
// numa tela onde toda chamada dá 401 — sem login, sem saída. Aqui ela já nasce sem sessão.
function restore(): { token: string | null; payload: JwtPayload | null } {
  const stored = localStorage.getItem(TOKEN_KEY)
  if (!stored) return { token: null, payload: null }
  const payload = decode(stored)
  if (!payload || (payload.exp && payload.exp * 1000 <= Date.now())) {
    localStorage.removeItem(TOKEN_KEY)
    return { token: null, payload: null }
  }
  return { token: stored, payload }
}

export const useAuthStore = defineStore('auth', {
  state: () => {
    const { token, payload: p } = restore()
    return {
      token,
      userId: p?.sub ?? null,
      email: p?.email ?? null,
      isGuest: !!p?.isGuest,
      isAuthenticated: !!token,
    }
  },
  actions: {
    // chamado pelo fluxo de login (Etapa 1) ao receber o JWT do /auth
    setToken(token: string) {
      localStorage.setItem(TOKEN_KEY, token)
      const p = decode(token)
      this.token = token
      this.userId = p?.sub ?? null
      this.email = p?.email ?? null
      this.isGuest = !!p?.isGuest
      this.isAuthenticated = true
    },
    logout() {
      localStorage.removeItem(TOKEN_KEY)
      // não vazar nome/avatar pra próxima conta no mesmo navegador
      localStorage.removeItem('kairos_character')
      this.token = null
      this.userId = null
      this.email = null
      this.isGuest = false
      this.isAuthenticated = false
    },
  },
})
