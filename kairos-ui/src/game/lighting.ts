export type Horario = 'amanhecer' | 'dia' | 'tarde' | 'entardecer' | 'noite'

export interface PresetLuz {
  tint: number
  alpha: number
  raioLuz: number
}

export const PRESETS: Record<Horario, PresetLuz> = {
  amanhecer: { tint: 0xffc896, alpha: 0.3, raioLuz: 0 },
  dia: { tint: 0xffffff, alpha: 0.0, raioLuz: 0 },
  tarde: { tint: 0xffe1b4, alpha: 0.14, raioLuz: 0 },
  entardecer: { tint: 0xc1592f, alpha: 0.36, raioLuz: 0.35 },
  noite: { tint: 0x141c3c, alpha: 0.74, raioLuz: 1 },
}

const ORDEM: { hora: number; estagio: Horario }[] = [
  { hora: 0, estagio: 'noite' },
  { hora: 4, estagio: 'noite' },
  { hora: 6, estagio: 'amanhecer' },
  { hora: 8, estagio: 'dia' },
  { hora: 15, estagio: 'tarde' },
  { hora: 18, estagio: 'entardecer' },
  { hora: 20, estagio: 'noite' },
  { hora: 24, estagio: 'noite' },
]

const FUSO_CANONICO = 'America/Sao_Paulo'

export function horaCanonica(agora = new Date()): number {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_CANONICO,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  })
  const partes = fmt.formatToParts(agora)
  const h = Number(partes.find((p) => p.type === 'hour')?.value ?? 0)
  const m = Number(partes.find((p) => p.type === 'minute')?.value ?? 0)
  return h + m / 60
}

function lerpCor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff
  const ag = (a >> 8) & 0xff
  const ab = a & 0xff
  const br = (b >> 16) & 0xff
  const bg = (b >> 8) & 0xff
  const bb = b & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (g << 8) | bl
}

export interface EstadoLuz {
  tint: number
  alpha: number
  raioLuz: number
  estagio: Horario
}

export function estadoDeLuz(hora = horaCanonica()): EstadoLuz {
  let i = 0
  while (i < ORDEM.length - 1 && hora >= ORDEM[i + 1].hora) i += 1
  const atual = ORDEM[i]
  const proximo = ORDEM[Math.min(i + 1, ORDEM.length - 1)]

  const span = proximo.hora - atual.hora
  const t = span > 0 ? Math.min(1, Math.max(0, (hora - atual.hora) / span)) : 0

  const a = PRESETS[atual.estagio]
  const b = PRESETS[proximo.estagio]

  return {
    tint: lerpCor(a.tint, b.tint, t),
    alpha: a.alpha + (b.alpha - a.alpha) * t,
    raioLuz: a.raioLuz + (b.raioLuz - a.raioLuz) * t,
    estagio: t < 0.5 ? atual.estagio : proximo.estagio,
  }
}
