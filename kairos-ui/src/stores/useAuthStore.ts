import { defineStore } from 'pinia'

const INITIAL_STATE = {
  token: null as string | null,
  userId: null as string | null,
  isGuest: false,
  isAuthenticated: false,
}

export const useAuthStore = defineStore('auth', {
  state: () => ({ ...INITIAL_STATE }),
})
