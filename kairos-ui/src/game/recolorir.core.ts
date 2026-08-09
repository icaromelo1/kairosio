// Núcleo da recoloração por região, sem Pixi e sem canvas — só aritmética sobre
// pixels. Fica separado para que o motor do jogo e o preview do editor de máscara
// usem a MESMA conta: a regra duplicada em dois arquivos já divergiu antes.
// Sem dependência de navegador, também dá para provar fora dele.

export type Regiao = 'pele' | 'cabelo' | 'roupa' | 'contorno'

export interface CoresAlvo {
  pele?: string | null
  cabelo?: string | null
  roupa?: string | null
}

/** ImageData, ou qualquer coisa com a mesma forma — é o que permite testar em Node. */
export interface Pixels {
  data: Uint8ClampedArray
  width: number
  height: number
}

export function luminancia(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

export function hexParaRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbParaHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return [h, s, l]
}

export function hslParaRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const canal = (t: number) => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return [
    Math.round(canal(h + 1 / 3) * 255),
    Math.round(canal(h) * 255),
    Math.round(canal(h - 1 / 3) * 255),
  ]
}

// a rampa abre em torno da luminância da cor pedida: dá espaço para sombra e luz
// sem estourar nem apagar
const RAMPA_BAIXO = 0.55
const RAMPA_CIMA = 1.35

// o contorno fica abaixo do tom mais escuro da região, mas não some no preto —
// é o que o Kenney faz na arte original, onde o contorno de roupa escura é #373733
// e o de roupa azul é #5c6278, em vez de um marrom fixo em tudo
const RAMPA_CONTORNO = 0.45
const CONTORNO_MINIMO = 0.06

const VIZINHOS: [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
]

/**
 * Recolore a arte no lugar.
 *
 * `regiaoEm` recebe o índice do PIXEL (não do byte) e diz a que região ele pertence
 * — é o que permite ler a máscara do PNG em disco ou da string em edição sem
 * duplicar o resto da conta.
 *
 * O contorno não é mais deixado como está. Ele é 28% dos pixels visíveis do boneco,
 * e mantê-lo fixo fazia quem escolhesse cabelo branco e roupa preta continuar com uma
 * aresta marrom em volta do corpo inteiro. Agora cada pixel de contorno pega a cor
 * da região que ele mais toca, escurecida — só continua original quando a região
 * vizinha também não foi trocada.
 */
export function aplicarCores(
  arte: Pixels,
  regiaoEm: (pixel: number) => Regiao | null,
  cores: CoresAlvo,
): void {
  const alvo: Record<string, [number, number, number] | null> = {
    pele: cores.pele ? hexParaRgb(cores.pele) : null,
    cabelo: cores.cabelo ? hexParaRgb(cores.cabelo) : null,
    roupa: cores.roupa ? hexParaRgb(cores.roupa) : null,
  }

  const opaco = (p: number) => arte.data[p * 4 + 3] >= 128

  // 1 · faixa de luminância que cada região ocupa hoje, para o remapeamento
  // respeitar a proporção original de sombra e luz
  const faixa: Record<string, { min: number; max: number }> = {}
  for (let p = 0; p < arte.width * arte.height; p++) {
    if (!opaco(p)) continue
    const regiao = regiaoEm(p)
    if (!regiao || regiao === 'contorno' || !alvo[regiao]) continue
    const i = p * 4
    const l = luminancia(arte.data[i], arte.data[i + 1], arte.data[i + 2])
    const f = faixa[regiao] ?? { min: 1, max: 0 }
    f.min = Math.min(f.min, l)
    f.max = Math.max(f.max, l)
    faixa[regiao] = f
  }

  // 2 · as regiões, na rampa
  for (let p = 0; p < arte.width * arte.height; p++) {
    if (!opaco(p)) continue
    const regiao = regiaoEm(p)
    if (!regiao || regiao === 'contorno') continue
    const cor = alvo[regiao]
    const f = faixa[regiao]
    if (!cor || !f) continue
    const i = p * 4
    const [h0, s0, l0] = rgbParaHsl(cor[0], cor[1], cor[2])
    const l = luminancia(arte.data[i], arte.data[i + 1], arte.data[i + 2])
    // região de tom único não tem proporção a preservar: vai direto na cor
    const proporcao = f.max > f.min ? (l - f.min) / (f.max - f.min) : 0.5
    const baixo = l0 * RAMPA_BAIXO
    const cima = Math.min(1, l0 * RAMPA_CIMA)
    const [r, g, b] = hslParaRgb(h0, s0, baixo + proporcao * (cima - baixo))
    arte.data[i] = r
    arte.data[i + 1] = g
    arte.data[i + 2] = b
  }

  // 3 · o contorno segue a vizinhança. Roda depois, e lendo a REGIÃO dos vizinhos
  // pela máscara e não pela cor já pintada, para a ordem de varredura não influir
  // no resultado
  for (let p = 0; p < arte.width * arte.height; p++) {
    if (!opaco(p) || regiaoEm(p) !== 'contorno') continue
    const x = p % arte.width
    const y = (p / arte.width) | 0

    const votos: Record<string, number> = {}
    for (const [dx, dy] of VIZINHOS) {
      const vx = x + dx
      const vy = y + dy
      if (vx < 0 || vy < 0 || vx >= arte.width || vy >= arte.height) continue
      const vp = vy * arte.width + vx
      if (!opaco(vp)) continue
      const r = regiaoEm(vp)
      if (!r || r === 'contorno' || !alvo[r]) continue
      votos[r] = (votos[r] ?? 0) + 1
    }

    let vencedora: string | null = null
    for (const r of Object.keys(votos)) {
      if (!vencedora || votos[r] > votos[vencedora]) vencedora = r
    }
    // nenhuma região trocada em volta: o contorno original ainda é o certo
    if (!vencedora) continue

    const cor = alvo[vencedora]
    if (!cor) continue
    const [h0, s0, l0] = rgbParaHsl(cor[0], cor[1], cor[2])
    const [r, g, b] = hslParaRgb(h0, s0, Math.max(CONTORNO_MINIMO, l0 * RAMPA_CONTORNO))
    const i = p * 4
    arte.data[i] = r
    arte.data[i + 1] = g
    arte.data[i + 2] = b
  }
}
