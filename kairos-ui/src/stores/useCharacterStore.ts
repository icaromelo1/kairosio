import { defineStore } from 'pinia'

export type HairStyle = 'short' | 'curly' | 'ponytail' | 'mohawk' | 'helmet' | 'buzz' | 'long'
export type Accessory = 'none' | 'glasses' | 'hat'

const INITIAL_STATE = {
  name: '',
  hairStyle: 'short' as HairStyle,
  hairColor: '#3d2817',
  skin: '#e8b894',
  topColor: '#7c3aed',
  pantsColor: '#1f2937',
  accessory: 'none' as Accessory,
  photoFile: null as string | null,
}

export const useCharacterStore = defineStore('character', {
  state: () => ({ ...INITIAL_STATE }),
})
