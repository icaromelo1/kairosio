import { defineStore } from 'pinia'

const TOKEN_KEY = 'kairos_token'

interface JwtPayload {
  sub?: string
  email?: string
  isGuest?: boolean
}

function decode(token: string): JwtPayload | null {
  try {
    return JSON.parse(atob(token.split('.')[1])) as JwtPayload
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => {
    const token = localStorage.getItem(TOKEN_KEY)
    const p = token ? decode(token) : null
    return {
      token: token as string | null,
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
