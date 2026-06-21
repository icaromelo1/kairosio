import { defineStore } from 'pinia'

const INITIAL_STATE = {
  activeMap: 'studio' as string,
  playerX: 15,
  playerY: 12,
  activeZoneId: null as string | null,
  isModalOpen: false,
  activeModalZoneId: null as string | null,
  sidebarOpen: true,
  activeLogo: 'monogram',
  greekMode: 'medium' as 'none' | 'medium',
}

export const useGameStore = defineStore('game', {
  state: () => ({ ...INITIAL_STATE }),
})
