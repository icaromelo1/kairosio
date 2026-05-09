import { defineStore } from 'pinia'

const INITIAL_STATE = {
  activeMap: 'studio' as 'studio' | 'athenaeum' | 'agora',
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
