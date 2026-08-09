// Regras puras da máscara de avatar: 16x16 pixels, um caractere por pixel, em
// ordem de leitura (linha 0 da esquerda pra direita, depois linha 1...). É o
// mesmo alfabeto que o kairos-api valida (/^[.pcro]{256}$/) e a mesma ordem do
// confianca.json — conferido pixel a pixel nos 72 quadros.
//
// Nada aqui toca DOM nem rede: o mapeamento clique -> índice mora neste arquivo
// justamente pra poder ser provado fora do navegador.

export type Regiao = 'pele' | 'cabelo' | 'roupa' | 'contorno'
export type Direcao = 'baixo' | 'cima' | 'esquerda' | 'direita'

export const LADO = 16
export const PIXELS = LADO * LADO
export const VAZIO = '.'
export const MASCARA_VAZIA = VAZIO.repeat(PIXELS)

export const REGIOES: Regiao[] = ['pele', 'cabelo', 'roupa', 'contorno']
// contorno não recolore por definição — não faz sentido cobrar sua presença
// como se fosse defeito de swatch
export const RECOLORIVEIS: Regiao[] = ['pele', 'cabelo', 'roupa']

export const CODIGO: Record<Regiao, string> = {
  pele: 'p',
  cabelo: 'c',
  roupa: 'r',
  contorno: 'o',
}

const REGIAO_POR_CODIGO: Record<string, Regiao> = {
  p: 'pele',
  c: 'cabelo',
  r: 'roupa',
  o: 'contorno',
}

export function regiaoDoCodigo(codigo: string): Regiao | null {
  return REGIAO_POR_CODIGO[codigo] ?? null
}

export const COR_REGIAO: Record<Regiao, string> = {
  pele: '#B03A3A',
  cabelo: '#8C4C10',
  roupa: '#2A4D8F',
  contorno: '#241C15',
}

export const NOME_REGIAO: Record<Regiao, string> = {
  pele: 'pele',
  cabelo: 'cabelo',
  roupa: 'roupa',
  contorno: 'contorno',
}

export const DIRECOES: Direcao[] = ['baixo', 'cima', 'esquerda', 'direita']
export const PASSOS = [0, 1, 2] as const
export const QUADROS: string[] = DIRECOES.flatMap((d) => PASSOS.map((p) => `${d}-${p}`))

export function chaveDe(preset: string, quadro: string): string {
  return `${preset}/${quadro}`
}

export function direcaoDe(quadro: string): Direcao {
  const d = quadro.split('-')[0] as Direcao
  return DIRECOES.includes(d) ? d : 'baixo'
}

export function passoDe(quadro: string): 0 | 1 | 2 {
  const n = Number(quadro.split('-')[1])
  return n === 1 || n === 2 ? n : 0
}

// o ciclo de caminhada é a direção inteira: propagar entre eles é legítimo,
// entre vistas nunca (costas não tem rosto)
export function quadrosDoCiclo(quadro: string): string[] {
  const d = direcaoDe(quadro)
  return PASSOS.map((p) => `${d}-${p}`)
}

export interface Caixa {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Converte um ponto de tela (clientX/clientY) no índice 0..255 do pixel.
 * Divide pela caixa medida, não pelo zoom presumido: se o rem do usuário for
 * maior, o canvas cresce junto e a conta continua valendo. Fora da caixa: null.
 */
export function indiceDoPonto(caixa: Caixa, clienteX: number, clienteY: number): number | null {
  if (caixa.width <= 0 || caixa.height <= 0) return null
  const coluna = Math.floor(((clienteX - caixa.left) / caixa.width) * LADO)
  const linha = Math.floor(((clienteY - caixa.top) / caixa.height) * LADO)
  if (coluna < 0 || coluna >= LADO || linha < 0 || linha >= LADO) return null
  return linha * LADO + coluna
}

export function colunaDe(indice: number): number {
  return indice % LADO
}

export function linhaDe(indice: number): number {
  return Math.floor(indice / LADO)
}

export function trocarPixel(pixels: string, indice: number, codigo: string): string {
  if (indice < 0 || indice >= PIXELS) return pixels
  if (pixels[indice] === codigo) return pixels
  return pixels.slice(0, indice) + codigo + pixels.slice(indice + 1)
}

// contorno é travado nos dois sentidos: nem se pinta por cima dele, nem se
// pinta ele. A região existe pro overlay dizer "isto nunca recolore".
export function podeEscrever(
  pixels: string,
  indice: number,
  codigo: string,
  contornoDestravado: boolean,
): boolean {
  if (contornoDestravado) return true
  return pixels[indice] !== CODIGO.contorno && codigo !== CODIGO.contorno
}

export function pintar(
  pixels: string,
  indice: number,
  codigo: string,
  contornoDestravado: boolean,
): string {
  if (indice < 0 || indice >= PIXELS) return pixels
  if (!podeEscrever(pixels, indice, codigo, contornoDestravado)) return pixels
  return trocarPixel(pixels, indice, codigo)
}

export function balde(
  pixels: string,
  indice: number,
  codigo: string,
  contornoDestravado: boolean,
): string {
  if (indice < 0 || indice >= PIXELS) return pixels
  const alvo = pixels[indice]
  if (alvo === codigo) return pixels
  if (!podeEscrever(pixels, indice, codigo, contornoDestravado)) return pixels

  const saida = pixels.split('')
  const pilha = [indice]
  while (pilha.length) {
    const i = pilha.pop() as number
    if (saida[i] !== alvo) continue
    saida[i] = codigo
    const coluna = colunaDe(i)
    if (coluna > 0) pilha.push(i - 1)
    if (coluna < LADO - 1) pilha.push(i + 1)
    if (i - LADO >= 0) pilha.push(i - LADO)
    if (i + LADO < PIXELS) pilha.push(i + LADO)
  }
  return saida.join('')
}

/**
 * Copia UMA região de um quadro para outro do mesmo ciclo de caminhada. Só
 * acrescenta: onde o quadro de destino é transparente na sua própria máscara de
 * origem não existe pixel para pintar (as pernas mudam de lugar entre quadros),
 * e contorno continua travado.
 */
export function propagarRegiao(
  origem: string,
  destino: string,
  baseDoDestino: string,
  codigo: string,
  contornoDestravado: boolean,
): string {
  let saida = destino
  for (let i = 0; i < PIXELS; i++) {
    if (origem[i] !== codigo) continue
    if (baseDoDestino[i] === VAZIO) continue
    if (!podeEscrever(saida, i, codigo, contornoDestravado)) continue
    saida = trocarPixel(saida, i, codigo)
  }
  return saida
}

export function regioesPresentes(pixels: string): Set<Regiao> {
  const presentes = new Set<Regiao>()
  for (const ch of pixels) {
    const r = regiaoDoCodigo(ch)
    if (r) presentes.add(r)
  }
  return presentes
}

export function contarRegiao(pixels: string, regiao: Regiao): number {
  const codigo = CODIGO[regiao]
  let n = 0
  for (const ch of pixels) if (ch === codigo) n++
  return n
}

export function regioesAusentes(pixels: string): Regiao[] {
  const presentes = regioesPresentes(pixels)
  return RECOLORIVEIS.filter((r) => !presentes.has(r))
}

// ausência decidida (marcada intencional) não é pendência: costas sem pele é
// correto, idoso sem cabelo é defeito — quem separa os dois é a marca humana
export function ausenciasPendentes(pixels: string, intencional: string[]): Regiao[] {
  return regioesAusentes(pixels).filter((r) => !intencional.includes(r))
}

// 'c' = decidido pela cor; 'v' vizinhança e 'f' só faixa = palpite do bootstrap
export function percentualVizinhanca(confianca: string): number {
  let decididos = 0
  let palpite = 0
  for (const ch of confianca) {
    if (ch === VAZIO) continue
    decididos++
    if (ch === 'v' || ch === 'f') palpite++
  }
  return decididos ? (palpite / decididos) * 100 : 0
}

export const LIMITE_VIZINHANCA = 40

export interface ItemFila {
  chave: string
  preset: string
  quadro: string
  ausentes: Regiao[]
  vizinhanca: number
  revisado: boolean
  duvida: boolean
}

// pior confiança primeiro: ausência não decidida, depois vizinhança acima do
// limite, depois o resto em vizinhança decrescente
export function classeDaFila(item: { ausentes: Regiao[]; vizinhanca: number }): number {
  if (item.ausentes.length) return 0
  if (item.vizinhanca > LIMITE_VIZINHANCA) return 1
  return 2
}

export function ordenarFila<T extends { chave: string; ausentes: Regiao[]; vizinhanca: number }>(
  itens: T[],
): T[] {
  return [...itens].sort(
    (a, b) =>
      classeDaFila(a) - classeDaFila(b) ||
      b.vizinhanca - a.vizinhanca ||
      a.chave.localeCompare(b.chave),
  )
}
