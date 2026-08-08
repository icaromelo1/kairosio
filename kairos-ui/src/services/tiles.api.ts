import { apiFetch } from './http'

export interface TileRevisao {
  pack: string
  indice: number
  nome?: string | null
  cat?: string | null
  solido?: boolean | null
  serveComo?: string[] | null
  revisado: boolean
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`tiles: HTTP ${res.status}`)
  return (await res.json()) as T
}

export async function listarRevisoes(pack?: string): Promise<TileRevisao[]> {
  const q = pack ? `?pack=${encodeURIComponent(pack)}` : ''
  return json<TileRevisao[]>(await apiFetch(`/tiles/revisoes${q}`))
}

// grava no ato, um PUT por decisão: fechar a aba no tile 800 tem que retomar no
// 801, e isso só vale se cada decisão já estiver no servidor quando ela é tomada
export async function salvarRevisao(
  pack: string,
  indice: number,
  dados: Omit<TileRevisao, 'pack' | 'indice'>,
): Promise<TileRevisao> {
  return json<TileRevisao>(await apiFetch(`/tiles/${encodeURIComponent(pack)}/${indice}`, {
    method: 'PUT',
    body: JSON.stringify(dados),
  }))
}
