import { apiFetch } from './http'

export interface MascaraRevisao {
  preset: string
  quadro: string
  pixels?: string | null
  intencional?: string[] | null
  revisado: boolean
  duvida: boolean
}

export interface MascaraEnvio {
  pixels?: string
  intencional?: string[]
  duvida?: boolean
  revisado: boolean
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`mascaras: HTTP ${res.status}`)
  return (await res.json()) as T
}

export async function listarMascaras(): Promise<MascaraRevisao[]> {
  return json<MascaraRevisao[]>(await apiFetch('/mascaras'))
}

// grava no ato, um PUT por pincelada: fechar a aba no quadro 22 tem que
// retomar no 22, e isso só vale se a correção já estiver no servidor quando a
// mão sai do mouse
export async function salvarMascara(
  preset: string,
  quadro: string,
  dados: MascaraEnvio,
): Promise<MascaraRevisao> {
  const rota = `/mascaras/${encodeURIComponent(preset)}/${encodeURIComponent(quadro)}`
  return json<MascaraRevisao>(await apiFetch(rota, { method: 'PUT', body: JSON.stringify(dados) }))
}
