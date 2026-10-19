import { apiFetch } from './http'
import type { Aparencia } from '@/mundo/personagem/catalogo'

export interface Personagem {
  aparencia: unknown | null
  photoFile: string | null
}

export async function buscarPersonagem(): Promise<Personagem | null> {
  const res = await apiFetch('/character')
  if (!res.ok) return null
  const texto = await res.text()
  return texto ? (JSON.parse(texto) as Personagem) : null
}

export async function salvarAparencia(aparencia: Aparencia): Promise<void> {
  const res = await apiFetch('/character/aparencia', { method: 'PUT', body: JSON.stringify({ aparencia }) })
  if (!res.ok) throw new Error('Não deu pra salvar o personagem.')
}
