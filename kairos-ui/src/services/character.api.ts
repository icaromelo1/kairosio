// Persistência da customização do personagem no banco (cross-device). JWT via apiFetch.
import { apiFetch } from './http'
import type { HairStyle, Accessory } from '@/stores/useCharacterStore'

export interface CharacterData {
  hairStyle: HairStyle
  hairColor: string
  skin: string
  topColor: string
  pantsColor: string
  accessory: Accessory
  photoFile?: string | null
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

// URL pública da foto (mesma pra todo mundo — usada tanto na tela de perfil quanto no jogo)
export function photoUrl(fileName: string): string {
  const base = import.meta.env.VITE_API_URL || window.location.origin
  return `${base}/kairos-api/character/photo/${fileName}`
}

export async function uploadPhoto(file: File): Promise<{ ok: boolean; error?: string; photoFile?: string }> {
  const form = new FormData()
  form.append('photo', file)
  const res = await apiFetch('/character/photo', { method: 'POST', body: form })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    return { ok: false, error: body?.message || 'Falha ao enviar a foto' }
  }
  const data = await res.json()
  return { ok: true, photoFile: data.photoFile }
}

export async function removePhoto(): Promise<boolean> {
  const res = await apiFetch('/character/photo', { method: 'DELETE' })
  return res.ok
}
