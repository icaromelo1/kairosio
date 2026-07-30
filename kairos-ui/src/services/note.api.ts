import { apiFetch } from './http'

export interface NoteItem {
  id: string
  mapId: string
  objectId: string
  body: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export async function listNotes(mapId: string, objectId: string): Promise<NoteItem[]> {
  const qs = `?mapId=${encodeURIComponent(mapId)}&objectId=${encodeURIComponent(objectId)}`
  const res = await apiFetch(`/note${qs}`)
  if (!res.ok) throw new Error(`Falha ao carregar notas (${res.status})`)
  return res.json()
}

export async function createNote(mapId: string, objectId: string, body: string): Promise<NoteItem> {
  const res = await apiFetch('/note', { method: 'POST', body: JSON.stringify({ mapId, objectId, body }) })
  if (!res.ok) {
    const parsed = await res.json().catch(() => null)
    throw new Error(parsed?.message || `Falha ao criar nota (${res.status})`)
  }
  return res.json()
}

export async function updateNote(id: string, body: string): Promise<NoteItem> {
  const res = await apiFetch(`/note/${id}`, { method: 'PATCH', body: JSON.stringify({ body }) })
  if (!res.ok) throw new Error(`Falha ao atualizar nota ${id} (${res.status})`)
  return res.json()
}

export async function deleteNote(id: string): Promise<void> {
  const res = await apiFetch(`/note/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Falha ao apagar nota ${id} (${res.status})`)
}
