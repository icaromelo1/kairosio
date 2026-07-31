export const DM_TEXTO_MAX = 2000
// mesmo freio do chat de mundo (CHAT_MIN_INTERVAL_MS no presence.gateway)
export const DM_INTERVALO_MIN_MS = 500
export const DM_PAGINA_PADRAO = 30
export const DM_PAGINA_MAX = 50
export const DM_PREVIA_MAX = 160

const CURSOR_SEP = '_'

export interface DmCursor {
  enviadaEm: Date
  id: string
}

// o cursor leva data E id: duas mensagens gravadas no mesmo milissegundo empatam na
// data, e um cursor só de data faria a página seguinte repetir ou pular uma delas.
// A data vai em milissegundos (não em ISO) pra nenhum caractere precisar de escape na
// query string — ':' do ISO sai como %3A.
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
