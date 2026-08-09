import { defineStore } from 'pinia'
import { AVATAR_PRESETS } from '@/game/pixi/avatar'

export type HairStyle = string
export type Accessory = 'none' | 'glasses' | 'hat'

const DEFAULT_PRESET = AVATAR_PRESETS[0]?.id ?? 'ruivo-verde'

const INITIAL_STATE = {
  hairStyle: DEFAULT_PRESET as HairStyle,
  hairColor: '#3d2817',
  skin: '#e8b894',
  topColor: '#2c7441',
  pantsColor: '#1f2937',
  accessory: 'none' as Accessory,
  photoFile: null as string | null,
  // qual avatar do acervo está vestido; nulo = personagem anterior ao acervo
  avatarId: null as string | null,
}

export const useCharacterStore = defineStore('character', {
  state: () => ({ ...INITIAL_STATE }),
})
