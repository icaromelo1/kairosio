// Motor de gestos: coreografias como sequência fixa de quadros do sprite.
//
// Um gesto é uma partitura tocada em loop — cada passo diz qual direção/quadro
// mostrar, por quanto tempo, e quanto pular no eixo Y (em pixels do sprite,
// não da tela). Pensado para caber a dança atual e gestos futuros (ex: aceno)
// assim que existirem os quadros correspondentes — hoje só a dança tem quadros
// suficientes (4 direções × 3 poses) para formar uma coreografia.

export type DirecaoGesto = 'baixo' | 'cima' | 'esquerda' | 'direita'

export interface QuadroDeGesto {
  direcao: DirecaoGesto
  quadro: 0 | 1 | 2
  duracaoMs: number
  /** Deslocamento vertical em pixels do sprite (positivo = sobe). Escala do avatar é aplicada por quem renderiza. */
  offsetY: number
}

export type Gesto = readonly QuadroDeGesto[]

/**
 * Partitura da dança: alterna frente↔lados no ritmo de 140ms, com salto de
 * 2px nos tempos fortes. Sem rotação, sem escala — só troca de quadro.
 */
export const GESTO_DANCA: Gesto = [
  { direcao: 'baixo', quadro: 0, duracaoMs: 140, offsetY: 0 },
  { direcao: 'baixo', quadro: 1, duracaoMs: 140, offsetY: 2 },
  { direcao: 'esquerda', quadro: 0, duracaoMs: 140, offsetY: 0 },
  { direcao: 'esquerda', quadro: 1, duracaoMs: 140, offsetY: 2 },
  { direcao: 'baixo', quadro: 0, duracaoMs: 140, offsetY: 0 },
  { direcao: 'baixo', quadro: 2, duracaoMs: 140, offsetY: 2 },
  { direcao: 'direita', quadro: 0, duracaoMs: 140, offsetY: 0 },
  { direcao: 'direita', quadro: 1, duracaoMs: 140, offsetY: 2 },
]

export function duracaoTotalMs(gesto: Gesto): number {
  return gesto.reduce((total, passo) => total + passo.duracaoMs, 0)
}

/** Resolve qual passo da partitura toca no instante `tMs`, em loop. */
export function quadroEm(gesto: Gesto, tMs: number): QuadroDeGesto {
  const total = duracaoTotalMs(gesto)
  const primeiro = gesto[0]
  if (total <= 0 || !primeiro) {
    return primeiro ?? { direcao: 'baixo', quadro: 0, duracaoMs: 140, offsetY: 0 }
  }
  let t = tMs % total
  if (t < 0) t += total
  for (const passo of gesto) {
    if (t < passo.duracaoMs) return passo
    t -= passo.duracaoMs
  }
  return gesto[gesto.length - 1] ?? primeiro
}
