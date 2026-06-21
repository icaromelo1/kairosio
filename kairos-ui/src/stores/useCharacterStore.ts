import { defineStore } from 'pinia'

const INITIAL_STATE = {
  name: '',
  hairStyle: 'short' as 'short' | 'curly' | 'ponytail' | 'mohawk' | 'helmet' | 'buzz' | 'long',
  hairColor: '#3d2817',
  skin: '#e8b894',
  topColor: '#7c3aed',
  pantsColor: '#1f2937',
}

export const useCharacterStore = defineStore('character', {
  state: () => ({ ...INITIAL_STATE }),
})
