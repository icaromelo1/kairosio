import { apiFetch } from './http'

type OrigemAvatar = 'base' | 'sudo' | 'usuario'

export interface Avatar {
  id: string
  base: string
  pele: string | null
  cabelo: string | null
  roupa: string | null
  acessorios: string[]
  origem: OrigemAvatar
}

export interface AvatarDoAcervo extends Avatar {
  criadoEm: string
  autor: string | null
  // quantas pessoas estão vestindo — zero é o que libera a exclusão
  emUso: number
}

interface NovoAvatar {
  base: string
  pele?: string | null
  cabelo?: string | null
  roupa?: string | null
  acessorios?: string[]
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`avatares: HTTP ${res.status}`)
  return (await res.json()) as T
}

/** O que se oferece na criação de personagem: base e sudo. Avatar de usuário não entra. */
export async function catalogo(): Promise<Avatar[]> {
  return json<Avatar[]>(await apiFetch('/avatares'))
}

/** Tudo, com autor e contagem de uso — só sudo. */
export async function acervo(): Promise<AvatarDoAcervo[]> {
  return json<AvatarDoAcervo[]>(await apiFetch('/avatares/acervo'))
}

/** Sorteia entre TODOS, inclusive os criados por usuários. */
export async function aleatorio(): Promise<Avatar | null> {
  const res = await apiFetch('/avatares/aleatorio')
  if (!res.ok) throw new Error(`avatares: HTTP ${res.status}`)
  const texto = await res.text()
  return texto ? (JSON.parse(texto) as Avatar) : null
}

export async function criar(dados: NovoAvatar): Promise<Avatar> {
  return json<Avatar>(await apiFetch('/avatares', { method: 'POST', body: JSON.stringify(dados) }))
}

export async function atualizar(id: string, dados: NovoAvatar): Promise<Avatar> {
  return json<Avatar>(await apiFetch(`/avatares/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }))
}

/**
 * O 409 não é erro de rede: é o banco recusando apagar avatar que alguém veste.
 * Devolver a contagem deixa a tela dizer "3 pessoas estão usando" em vez de
 * "não foi possível excluir".
 *
 * O corpo vem no primeiro nível: passando um objeto ao ConflictException, o Nest
 * usa esse objeto como resposta em vez de embrulhá-lo em `message`.
 */
export async function excluir(id: string): Promise<{ ok: true } | { ok: false; emUso: number }> {
  const res = await apiFetch(`/avatares/${id}`, { method: 'DELETE' })
  if (res.ok) return { ok: true }
  if (res.status === 409) {
    const corpo = (await res.json().catch(() => null)) as { emUso?: number } | null
    return { ok: false, emUso: corpo?.emUso ?? 0 }
  }
  throw new Error(`avatares: HTTP ${res.status}`)
}

export async function promover(id: string, origem: OrigemAvatar): Promise<Avatar> {
  return json<Avatar>(await apiFetch(`/avatares/${id}/origem`, {
    method: 'PATCH',
    body: JSON.stringify({ origem }),
  }))
}
