export const DM_TEXTO_MAX = 2000
export const DM_INTERVALO_MIN_MS = 500
export const DM_PAGINA_PADRAO = 30
export const DM_PAGINA_MAX = 50
export const DM_PREVIA_MAX = 160

const CURSOR_SEP = '_'

export interface DmCursor {
  enviadaEm: Date
  id: string
}

export function encodeCursor(enviadaEm: Date, id: string): string {
  return `${new Date(enviadaEm).getTime()}${CURSOR_SEP}${id}`
}

export function decodeCursor(raw: unknown): DmCursor | null {
  const bruto = String(raw ?? '')
  const corte = bruto.indexOf(CURSOR_SEP)
  if (corte <= 0) return null
  const ms = Number(bruto.slice(0, corte))
  const id = bruto.slice(corte + 1)
  if (!id || !Number.isSafeInteger(ms)) return null
  return { enviadaEm: new Date(ms), id }
}

export function normalizeTexto(raw: unknown): string {
  return String(raw ?? '').trim()
}

export function previa(texto: string): string {
  return texto.slice(0, DM_PREVIA_MAX)
}
