// Canal de feedback (bugs / melhorias) — fala com o kairos-api.
import { apiFetch } from './http'

const API_URL = import.meta.env.VITE_API_URL || window.location.origin

export type FeedbackKind = 'bug' | 'melhoria'
export type FeedbackStatus = 'aberto' | 'em_andamento' | 'resolvido' | 'recusado'

export interface Feedback {
  id: string
  kind: FeedbackKind
  title: string
  message: string
  status: FeedbackStatus
  authorEmail: string
  createdAt: string
  updatedAt?: string
  resolvedAt?: string | null
}

export interface NewFeedback {
  kind: FeedbackKind
  title: string
  message: string
}

// o autor sai do JWT no servidor — mandar email no corpo não teria efeito
export async function createFeedback(data: NewFeedback): Promise<Feedback> {
  const res = await apiFetch('/feedback', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `Falha ao enviar (${res.status})`)
  }
  return res.json()
}

export async function fetchFeedback(): Promise<Feedback[]> {
  const res = await fetch(`${API_URL}/kairos-api/feedback`)
  if (!res.ok) throw new Error(`Falha ao carregar feedback (${res.status})`)
  return res.json()
}
