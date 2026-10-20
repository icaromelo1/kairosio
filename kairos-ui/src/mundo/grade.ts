import { pecaDe, pegadaDe } from './mobilia'
import type { Area, Mapa, Sala } from './tipos'

export const CELULA = 0.25
export const ESPESSURA_PAREDE = 0.2
const RAIO_PESSOA = 0.22

interface Parede {
  horizontal: boolean
  linha: number
  inicio: number
  fim: number
  externa: boolean
}

type Intervalo = [number, number]

function unir(intervalos: Intervalo[]): Intervalo[] {
  const ordenados = [...intervalos].sort((a, b) => a[0] - b[0])
  const saida: Intervalo[] = []
  for (const [a, b] of ordenados) {
    const ultimo = saida[saida.length - 1]
    if (ultimo && a <= ultimo[1] + 1e-6) ultimo[1] = Math.max(ultimo[1], b)
    else saida.push([a, b])
  }
  return saida
}

function subtrair(base: Intervalo[], buracos: Intervalo[]): Intervalo[] {
  let atual = base
  for (const [ba, bb] of buracos) {
    const proximo: Intervalo[] = []
    for (const [a, b] of atual) {
      if (bb <= a || ba >= b) {
        proximo.push([a, b])
        continue
      }
      if (ba > a) proximo.push([a, ba])
      if (bb < b) proximo.push([bb, b])
    }
    atual = proximo
  }
  return atual.filter(([a, b]) => b - a > 0.05)
}

function bordasDe(sala: Sala) {
  const { x, y, largura: l, profundidade: p } = sala
  return [
    { horizontal: true, linha: y, inicio: x, fim: x + l, lado: 'norte' as const },
    { horizontal: true, linha: y + p, inicio: x, fim: x + l, lado: 'sul' as const },
    { horizontal: false, linha: x, inicio: y, fim: y + p, lado: 'oeste' as const },
    { horizontal: false, linha: x + l, inicio: y, fim: y + p, lado: 'leste' as const },
  ]
}

export interface PortaDoMapa {
  chave: string
  salaId: string
  horizontal: boolean
  linha: number
  centro: number
  largura: number
  dentro: 1 | -1
}

export function portasDe(mapa: Mapa): PortaDoMapa[] {
  const portas = new Map<string, PortaDoMapa>()
  for (const sala of mapa.salas) {
    if (sala.aberta && !sala.murada) continue
    for (const borda of bordasDe(sala)) {
      for (const porta of sala.portas) {
        if (porta.lado !== borda.lado) continue
        const centro = borda.inicio + porta.centro
        const chave = `${borda.horizontal ? 'h' : 'v'}:${borda.linha.toFixed(2)}:${centro.toFixed(2)}`
        if (portas.has(chave)) continue
        const dentro = borda.lado === 'norte' || borda.lado === 'oeste' ? 1 : -1
        portas.set(chave, { chave, salaId: sala.id, horizontal: borda.horizontal, linha: borda.linha, centro, largura: porta.largura, dentro })
      }
    }
  }
  return [...portas.values()]
}

export function paredesDe(mapa: Mapa): Parede[] {
  const linhas = new Map<string, { horizontal: boolean; linha: number; trechos: Intervalo[]; buracos: Intervalo[] }>()
  const chave = (horizontal: boolean, linha: number) => `${horizontal ? 'h' : 'v'}:${linha.toFixed(3)}`
  const pegar = (horizontal: boolean, linha: number) => {
    const k = chave(horizontal, linha)
    let item = linhas.get(k)
    if (!item) {
      item = { horizontal, linha, trechos: [], buracos: [] }
      linhas.set(k, item)
    }
    return item
  }
  const contorno: Sala = {
    id: '', nome: '', x: 0, y: 0, largura: mapa.largura, profundidade: mapa.profundidade, piso: '', portas: [],
  }
  for (const borda of bordasDe(contorno)) pegar(borda.horizontal, borda.linha).trechos.push([borda.inicio, borda.fim])
  for (const sala of mapa.salas) {
    if (sala.aberta && !sala.murada) continue
    for (const borda of bordasDe(sala)) {
      pegar(borda.horizontal, borda.linha).trechos.push([borda.inicio, borda.fim])
    }
  }
  for (const sala of mapa.salas) {
    for (const borda of bordasDe(sala)) {
      for (const porta of sala.portas) {
        if (porta.lado !== borda.lado) continue
        const centro = borda.inicio + porta.centro
        pegar(borda.horizontal, borda.linha).buracos.push([centro - porta.largura / 2, centro + porta.largura / 2])
      }
    }
  }
  const saida: Parede[] = []
  for (const item of linhas.values()) {
    if (!item.trechos.length) continue
    for (const [inicio, fim] of subtrair(unir(item.trechos), item.buracos)) {
      const externa = item.linha < 0.01 || Math.abs(item.linha - (item.horizontal ? mapa.profundidade : mapa.largura)) < 0.01
      saida.push({ horizontal: item.horizontal, linha: item.linha, inicio, fim, externa })
    }
  }
  return saida
}

export class Grade {
  readonly colunas: number
  readonly linhas: number
  private readonly solido: Uint8Array

  constructor(private readonly mapa: Mapa) {
    this.colunas = Math.ceil(mapa.largura / CELULA)
    this.linhas = Math.ceil(mapa.profundidade / CELULA)
    this.solido = new Uint8Array(this.colunas * this.linhas)
    const meia = ESPESSURA_PAREDE / 2
    for (const parede of paredesDe(mapa)) {
      if (parede.horizontal) this.marcar(parede.inicio - meia, parede.linha - meia, parede.fim + meia, parede.linha + meia)
      else this.marcar(parede.linha - meia, parede.inicio - meia, parede.linha + meia, parede.fim + meia)
    }
    for (const movel of mapa.mobilia) {
      if (!pecaDe(movel)?.solida) continue
      const { largura, profundidade } = pegadaDe(movel)
      const folga = 0.04
      this.marcar(movel.x - largura / 2 + folga, movel.y - profundidade / 2 + folga, movel.x + largura / 2 - folga, movel.y + profundidade / 2 - folga)
    }
  }

  private marcar(x1: number, y1: number, x2: number, y2: number) {
    const c1 = Math.max(0, Math.floor(x1 / CELULA))
    const c2 = Math.min(this.colunas - 1, Math.floor((x2 - 1e-6) / CELULA))
    const l1 = Math.max(0, Math.floor(y1 / CELULA))
    const l2 = Math.min(this.linhas - 1, Math.floor((y2 - 1e-6) / CELULA))
    for (let l = l1; l <= l2; l++) {
      for (let c = c1; c <= c2; c++) this.solido[l * this.colunas + c] = 1
    }
  }

  private andavel: Uint8Array | null = null

  celulaAndavel(c: number, l: number): boolean {
    if (c < 0 || l < 0 || c >= this.colunas || l >= this.linhas) return false
    if (!this.andavel) {
      this.andavel = new Uint8Array(this.colunas * this.linhas)
      for (let ll = 0; ll < this.linhas; ll++) {
        for (let cc = 0; cc < this.colunas; cc++) {
          this.andavel[ll * this.colunas + cc] = this.ocupado((cc + 0.5) * CELULA, (ll + 0.5) * CELULA) ? 0 : 1
        }
      }
    }
    return this.andavel[l * this.colunas + c] === 1
  }

  ocupado(x: number, y: number, raio = RAIO_PESSOA): boolean {
    if (x - raio < 0 || y - raio < 0 || x + raio > this.mapa.largura || y + raio > this.mapa.profundidade) return true
    const c1 = Math.floor((x - raio) / CELULA)
    const c2 = Math.floor((x + raio - 1e-6) / CELULA)
    const l1 = Math.floor((y - raio) / CELULA)
    const l2 = Math.floor((y + raio - 1e-6) / CELULA)
    for (let l = l1; l <= l2; l++) {
      for (let c = c1; c <= c2; c++) {
        if (this.solido[l * this.colunas + c]) return true
      }
    }
    return false
  }
}

export function areaDoPonto(mapa: Mapa, x: number, y: number): Area | null {
  for (const area of mapa.areas ?? []) {
    if (area.forma === 'circulo') {
      const rx = area.largura / 2
      const ry = area.profundidade / 2
      const dx = (x - area.x) / rx
      const dy = (y - area.y) / ry
      if (dx * dx + dy * dy <= 1) return area
    } else if (Math.abs(x - area.x) <= area.largura / 2 && Math.abs(y - area.y) <= area.profundidade / 2) {
      return area
    }
  }
  return null
}

export function salaDoPonto(mapa: Mapa, x: number, y: number): Sala | null {
  let melhor: Sala | null = null
  for (const sala of mapa.salas) {
    if (x < sala.x || y < sala.y || x > sala.x + sala.largura || y > sala.y + sala.profundidade) continue
    if (!melhor || sala.largura * sala.profundidade < melhor.largura * melhor.profundidade) melhor = sala
  }
  return melhor
}
