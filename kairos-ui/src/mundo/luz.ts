type Periodo = 'madrugada' | 'amanhecer' | 'dia' | 'tarde' | 'entardecer' | 'noite'

interface Luz {
  ceu: string
  chao: string
  sol: string
  fundo: string
  intensidadeCeu: number
  intensidadeSol: number
}

const MARCOS: { hora: number; periodo: Periodo; luz: Luz }[] = [
  { hora: 0, periodo: 'madrugada', luz: { ceu: '#5a6aa8', chao: '#2a2c40', sol: '#8fa4ff', fundo: '#3b4d3a', intensidadeCeu: 0.42, intensidadeSol: 0.18 } },
  { hora: 5.5, periodo: 'amanhecer', luz: { ceu: '#ffc79a', chao: '#6a5848', sol: '#ffb070', fundo: '#7da35e', intensidadeCeu: 0.55, intensidadeSol: 0.4 } },
  { hora: 8, periodo: 'dia', luz: { ceu: '#fff6e6', chao: '#8a7a66', sol: '#fff1d6', fundo: '#7fb35c', intensidadeCeu: 0.62, intensidadeSol: 0.55 } },
  { hora: 15, periodo: 'tarde', luz: { ceu: '#ffeccc', chao: '#8a7660', sol: '#ffdca0', fundo: '#7fb35c', intensidadeCeu: 0.62, intensidadeSol: 0.55 } },
  { hora: 18, periodo: 'entardecer', luz: { ceu: '#ffa878', chao: '#5a4038', sol: '#ff8a50', fundo: '#6f8f4e', intensidadeCeu: 0.5, intensidadeSol: 0.42 } },
  { hora: 20, periodo: 'noite', luz: { ceu: '#5a6aa8', chao: '#2a2c40', sol: '#8fa4ff', fundo: '#3b4d3a', intensidadeCeu: 0.42, intensidadeSol: 0.18 } },
  { hora: 24, periodo: 'madrugada', luz: { ceu: '#5a6aa8', chao: '#2a2c40', sol: '#8fa4ff', fundo: '#3b4d3a', intensidadeCeu: 0.42, intensidadeSol: 0.18 } },
]

function misturar(a: string, b: string, t: number): string {
  const ca = parseInt(a.slice(1), 16)
  const cb = parseInt(b.slice(1), 16)
  const canal = (deslocamento: number) => {
    const x = (ca >> deslocamento) & 255
    const y = (cb >> deslocamento) & 255
    return Math.round(x + (y - x) * t)
  }
  return `#${[16, 8, 0].map((d) => canal(d).toString(16).padStart(2, '0')).join('')}`
}

export function luzDaHora(hora: number): Luz {
  const h = ((hora % 24) + 24) % 24
  const i = MARCOS.findIndex((m, k) => h >= m.hora && h < MARCOS[k + 1].hora)
  const a = MARCOS[i]
  const b = MARCOS[i + 1]
  const t = (h - a.hora) / (b.hora - a.hora)
  return {
    ceu: misturar(a.luz.ceu, b.luz.ceu, t),
    chao: misturar(a.luz.chao, b.luz.chao, t),
    sol: misturar(a.luz.sol, b.luz.sol, t),
    fundo: misturar(a.luz.fundo, b.luz.fundo, t),
    intensidadeCeu: a.luz.intensidadeCeu + (b.luz.intensidadeCeu - a.luz.intensidadeCeu) * t,
    intensidadeSol: a.luz.intensidadeSol + (b.luz.intensidadeSol - a.luz.intensidadeSol) * t,
  }
}

export function periodoDaHora(hora: number): Periodo {
  const h = ((hora % 24) + 24) % 24
  return [...MARCOS].reverse().find((m) => h >= m.hora)?.periodo ?? 'dia'
}

export function horaDeSaoPaulo(agora = new Date()): number {
  const partes = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(agora)
  const h = Number(partes.find((p) => p.type === 'hour')?.value ?? 0)
  const m = Number(partes.find((p) => p.type === 'minute')?.value ?? 0)
  return h + m / 60
}
