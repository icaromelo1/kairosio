import { defineStore } from 'pinia'

export const useGameStore = defineStore('game', {
  state: () => ({
    isModalOpen: false,
    sidebarOpen: true,
  }),
})
