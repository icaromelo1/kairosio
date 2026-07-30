import { apiFetch } from './http'

export interface TaskItem {
  id: string
  mapId: string
  objectId: string
  title: string
  done: boolean
  createdBy: string
  createdAt: string
}

export interface TaskPatch {
  title?: string
  done?: boolean
}

export async function listTasks(mapId: string, objectId: string): Promise<TaskItem[]> {
  const qs = `?mapId=${encodeURIComponent(mapId)}&objectId=${encodeURIComponent(objectId)}`
  const res = await apiFetch(`/task${qs}`)
  if (!res.ok) throw new Error(`Falha ao carregar tarefas (${res.status})`)
  return res.json()
}

export async function createTask(mapId: string, objectId: string, title: string): Promise<TaskItem> {
  const res = await apiFetch('/task', { method: 'POST', body: JSON.stringify({ mapId, objectId, title }) })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message || `Falha ao criar tarefa (${res.status})`)
  }
  return res.json()
}

export async function updateTask(id: string, patch: TaskPatch): Promise<TaskItem> {
  const res = await apiFetch(`/task/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  if (!res.ok) throw new Error(`Falha ao atualizar tarefa ${id} (${res.status})`)
  return res.json()
}

export async function deleteTask(id: string): Promise<void> {
  const res = await apiFetch(`/task/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Falha ao apagar tarefa ${id} (${res.status})`)
}
