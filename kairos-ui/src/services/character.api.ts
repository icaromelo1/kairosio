// Persistência da customização do personagem no banco (cross-device). JWT via apiFetch.
import { apiFetch } from './http'

export interface CharacterData {
  name: string
  hairStyle: string
  hairColor: string
  skin: string
  topColor: string
  pantsColor: string
}

export async function getCharacter(): Promise<CharacterData | null> {
  const res = await apiFetch('/character')
  if (!res.ok) return null
  // usuário sem personagem salvo → 200 com corpo VAZIO; evita "Unexpected end of JSON input"
  const text = await res.text()
  return text ? (JSON.parse(text) as CharacterData) : null
}

export async function saveCharacter(data: CharacterData): Promise<boolean> {
  const res = await apiFetch('/character', { method: 'PUT', body: JSON.stringify(data) })
  return res.ok
}
