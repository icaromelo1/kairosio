import { CELULA, Grade } from './grade'

interface Ponto {
  x: number
  y: number
}

class Fila {
  private readonly itens: { no: number; custo: number }[] = []

  get vazia() {
    return this.itens.length === 0
  }

  colocar(no: number, custo: number) {
    const itens = this.itens
    itens.push({ no, custo })
    let i = itens.length - 1
    while (i > 0) {
      const pai = (i - 1) >> 1
      if (itens[pai].custo <= itens[i].custo) break
      ;[itens[pai], itens[i]] = [itens[i], itens[pai]]
      i = pai
    }
  }

  tirar(): number {
    const itens = this.itens
    const topo = itens[0].no
    const ultimo = itens.pop()!
    if (itens.length) {
      itens[0] = ultimo
      let i = 0
      for (;;) {
        const e = i * 2 + 1
        const d = e + 1
        let menor = i
        if (e < itens.length && itens[e].custo < itens[menor].custo) menor = e
        if (d < itens.length && itens[d].custo < itens[menor].custo) menor = d
        if (menor === i) break
        ;[itens[menor], itens[i]] = [itens[i], itens[menor]]
        i = menor
      }
    }
    return topo
  }
}

const VIZINHOS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
]

function celulaMaisProxima(grade: Grade, c: number, l: number, bloqueado: (x: number, y: number) => boolean): [number, number] | null {
  for (let raio = 0; raio < 12; raio++) {
    for (let dl = -raio; dl <= raio; dl++) {
      for (let dc = -raio; dc <= raio; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dl)) !== raio) continue
        const cc = c + dc
        const ll = l + dl
        if (grade.celulaAndavel(cc, ll) && !bloqueado((cc + 0.5) * CELULA, (ll + 0.5) * CELULA)) return [cc, ll]
      }
    }
  }
  return null
}

function visivel(grade: Grade, a: Ponto, b: Ponto, bloqueado: (x: number, y: number) => boolean): boolean {
  const passos = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (CELULA / 2))
  for (let i = 1; i < passos; i++) {
    const t = i / passos
    const x = a.x + (b.x - a.x) * t
    const y = a.y + (b.y - a.y) * t
    if (grade.ocupado(x, y) || bloqueado(x, y)) return false
  }
  return true
}

export function calcularRota(grade: Grade, de: Ponto, para: Ponto, bloqueado: (x: number, y: number) => boolean = () => false): Ponto[] | null {
  const inicio = celulaMaisProxima(grade, Math.floor(de.x / CELULA), Math.floor(de.y / CELULA), () => false)
  const fim = celulaMaisProxima(grade, Math.floor(para.x / CELULA), Math.floor(para.y / CELULA), bloqueado)
  if (!inicio || !fim) return null
  const colunas = grade.colunas
  const indice = (c: number, l: number) => l * colunas + c
  const alvo = indice(fim[0], fim[1])
  const custo = new Float32Array(colunas * grade.linhas).fill(Infinity)
  const veio = new Int32Array(colunas * grade.linhas).fill(-1)
  const fila = new Fila()
  const origem = indice(inicio[0], inicio[1])
  custo[origem] = 0
  fila.colocar(origem, 0)
  let visitados = 0
  while (!fila.vazia && visitados < 120000) {
    const atual = fila.tirar()
    visitados++
    if (atual === alvo) break
    const c = atual % colunas
    const l = Math.floor(atual / colunas)
    for (const [dc, dl, peso] of VIZINHOS) {
      const cc = c + dc
      const ll = l + dl
      if (!grade.celulaAndavel(cc, ll)) continue
      if (dc && dl && (!grade.celulaAndavel(c + dc, l) || !grade.celulaAndavel(c, l + dl))) continue
      if (bloqueado((cc + 0.5) * CELULA, (ll + 0.5) * CELULA)) continue
      const proximo = indice(cc, ll)
      const novo = custo[atual] + peso
      if (novo >= custo[proximo]) continue
      custo[proximo] = novo
      veio[proximo] = atual
      fila.colocar(proximo, novo + Math.hypot(fim[0] - cc, fim[1] - ll))
    }
  }
  if (veio[alvo] === -1 && alvo !== origem) return null
  const caminho: Ponto[] = []
  for (let no = alvo; no !== -1; no = veio[no]) {
    caminho.push({ x: ((no % colunas) + 0.5) * CELULA, y: (Math.floor(no / colunas) + 0.5) * CELULA })
    if (no === origem) break
  }
  caminho.reverse()
  const suave: Ponto[] = []
  let ancora: Ponto = de
  for (let i = 1; i < caminho.length; i++) {
    if (!visivel(grade, ancora, caminho[i], bloqueado)) {
      suave.push(caminho[i - 1])
      ancora = caminho[i - 1]
    }
  }
  suave.push(caminho[caminho.length - 1])
  return suave
}
