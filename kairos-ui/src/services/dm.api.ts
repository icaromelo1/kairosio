import { apiFetch } from './http'

export interface DmPerfil {
  id: string
  username: string | null
  nome: string | null
}

export interface DmMensagem {
  id: string
  conversaId: string
  autorId: string
  minha: boolean
  texto: string
  enviadaEm: string
}

export interface DmPrevia {
  texto: string
  autorId: string | null
  minha: boolean
  enviadaEm: string
}

export interface DmConversa {
  id: string
  usuario: DmPerfil | null
  ultimaMensagem: DmPrevia | null
  naoLidas: number
  lidoEm: string | null
  // quando o OUTRO leu — sustenta o "vista às hh:mm"; null = ainda não leu
  lidoPeloOutroEm: string | null
  criadoEm: string | null
}

export interface DmHistorico {
  conversaId: string
  mensagens: DmMensagem[]
  proximoCursor: string | null
}

export interface DmLeitura {
  ok: boolean
  conversaId: string
  naoLidas: number
}

export const DM_TEXTO_MAX = 2000
export const DM_CONTADOR_A_PARTIR = 1800
export const DM_INTERVALO_MIN_MS = 500

export class DmError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

async function fail(res: Response, fallback: string): Promise<DmError> {
  const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string | string[] }
  const message = Array.isArray(body.message) ? body.message.join(' ') : body.message
  return new DmError(message || fallback, body.code || '')
}

async function send<T>(path: string, fallback: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init)
  if (!res.ok) throw await fail(res, fallback)
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

export function listConversas(): Promise<DmConversa[]> {
  return send('/dm', 'Falha ao carregar suas conversas')
}

export function dmHistory(conversaId: string, before?: string | null): Promise<DmHistorico> {
  const query = before ? `?before=${encodeURIComponent(before)}` : ''
  return send(`/dm/${conversaId}/messages${query}`, 'Falha ao carregar as mensagens')
}

export function sendDm(amigoUserId: string, texto: string): Promise<DmMensagem> {
  return send(`/dm/${amigoUserId}/messages`, 'Falha ao enviar a mensagem', {
    method: 'POST',
    body: JSON.stringify({ text: texto }),
  })
}

export function markDmRead(conversaId: string): Promise<DmLeitura> {
  return send(`/dm/${conversaId}/read`, 'Falha ao marcar como lida', { method: 'POST' })
}
