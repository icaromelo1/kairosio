import { isSolid, type MapDef } from './maps'
import { salaDoPonto } from './salas'

export interface Ponto {
  x: number
  y: number
}

export interface OpcoesDeRota {
  trancadas?: Set<string>
  /** Sala de onde o movedor parte — quem está dentro pode sair de sala trancada. */
  salaDoMovedor?: string | null
  /** Teto de tiles visitados. Rede contra mapa gigante ou destino ilhado. */
  maxVisitados?: number
  /** Desliga a preferência por calçada. Existe para o teste conseguir comparar
   *  a rota com e sem — sem isso não há como afirmar que a preferência age. */
  preferirCaminho?: boolean
}

// Custo por tile. É daqui que sai "seguir pelos caminhos da cidade": a calçada
// é mais barata, então o A* prefere passar por ela — e corta pela grama quando
// o desvio não compensa. Uma regra dura de "andar só no path" produziria rota
// impossível para sala que não tem calçada até a porta.
const CUSTO_PADRAO = 1
const CUSTO_CAMINHO = 0.55
// água já reduz a velocidade pela metade no laço de movimento; encarecer aqui
// evita que a rota mande atravessar o lago achando que é atalho
const CUSTO_AGUA = 3

const VIZINHOS: ReadonlyArray<readonly [number, number]> = [
  [0, -1], [0, 1], [-1, 0], [1, 0],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
]

const MAX_VISITADOS = 20000

function terrenoDoTile(map: MapDef, x: number, y: number, preferir: boolean): number {
  let custo = CUSTO_PADRAO
  for (const o of map.objects) {
    if (x < o.x || x >= o.x + o.w || y < o.y || y >= o.y + o.h) continue
    if (o.kind === 'water') return CUSTO_AGUA
    if (o.kind === 'path' && preferir) custo = CUSTO_CAMINHO
  }
  return custo
}

function bloqueado(map: MapDef, x: number, y: number, op: OpcoesDeRota): boolean {
  return isSolid(map, x, y, op.trancadas, op.salaDoMovedor ?? null)
}

/**
 * Tile livre mais próximo de um alvo, em busca em espiral.
 *
 * O centro geométrico de uma sala mobiliada costuma cair em cima de uma mesa —
 * sem isto, sala cheia vira destino inalcançável.
 */
export function tileAndavelProximo(
  map: MapDef,
  alvo: Ponto,
  op: OpcoesDeRota = {},
  raioMax = 8,
): Ponto | null {
  const cx = Math.floor(alvo.x)
  const cy = Math.floor(alvo.y)
  if (!bloqueado(map, cx, cy, op)) return { x: cx, y: cy }
  for (let r = 1; r <= raioMax; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const x = cx + dx
        const y = cy + dy
        if (!bloqueado(map, x, y, op)) return { x, y }
      }
    }
  }
  return null
}

/** Dois pontos se enxergam sem sólido no meio? Amostra ao longo do segmento. */
export function temLinhaDeVisao(map: MapDef, a: Ponto, b: Ponto, op: OpcoesDeRota = {}): boolean {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const passos = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 2)
  if (passos === 0) return true
  for (let i = 1; i <= passos; i++) {
    const t = i / passos
    const x = Math.floor(a.x + dx * t)
    const y = Math.floor(a.y + dy * t)
    if (bloqueado(map, x, y, op)) return false
  }
  return true
}

/**
 * Descarta pontos intermediários enquanto o anterior e o seguinte se enxergam.
 * O A* devolve escadinha; é este passe que produz as linhas retas.
 */
export function simplificar(map: MapDef, pontos: Ponto[], op: OpcoesDeRota = {}): Ponto[] {
  if (pontos.length <= 2) return pontos.slice()
  const saida: Ponto[] = [pontos[0]]
  let ancora = 0
  while (ancora < pontos.length - 1) {
    let alcance = ancora + 1
    for (let i = pontos.length - 1; i > ancora; i--) {
      if (temLinhaDeVisao(map, pontos[ancora], pontos[i], op)) {
        alcance = i
        break
      }
    }
    saida.push(pontos[alcance])
    ancora = alcance
  }
  return saida
}

function heuristica(a: Ponto, b: Ponto): number {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  // distância de octile: coerente com vizinhança de 8, nunca superestima
  return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy)
}

/**
 * Caminho de `origem` a `destino` em tiles, já simplificado.
 * Devolve null quando não há rota — destino ilhado, sala trancada, ou teto de
 * visitados estourado.
 */
export function calcularRota(
  map: MapDef,
  origem: Ponto,
  destino: Ponto,
  op: OpcoesDeRota = {},
): Ponto[] | null {
  const inicio = { x: Math.floor(origem.x), y: Math.floor(origem.y) }
  const fim = tileAndavelProximo(map, destino, op)
  if (!fim) return null
  if (inicio.x === fim.x && inicio.y === fim.y) return []

  const teto = op.maxVisitados ?? MAX_VISITADOS
  const chave = (x: number, y: number) => y * map.width + x

  const custoAte = new Map<number, number>()
  const veioDe = new Map<number, number>()
  const abertos: { x: number; y: number; f: number }[] = []

  custoAte.set(chave(inicio.x, inicio.y), 0)
  abertos.push({ ...inicio, f: heuristica(inicio, fim) })

  let visitados = 0
  while (abertos.length) {
    // fila de prioridade simples: o mapa é pequeno e a rota só é calculada no
    // clique, então varrer o array custa menos que manter um heap
    let melhor = 0
    for (let i = 1; i < abertos.length; i++) if (abertos[i].f < abertos[melhor].f) melhor = i
    const atual = abertos.splice(melhor, 1)[0]
    const kAtual = chave(atual.x, atual.y)

    if (atual.x === fim.x && atual.y === fim.y) {
      const bruto: Ponto[] = []
      let k: number | undefined = kAtual
      while (k !== undefined) {
        bruto.push({ x: k % map.width, y: Math.floor(k / map.width) })
        k = veioDe.get(k)
      }
      bruto.reverse()
      return simplificar(map, bruto, op)
    }

    if (++visitados > teto) return null

    for (const [dx, dy] of VIZINHOS) {
      const nx = atual.x + dx
      const ny = atual.y + dy
      if (bloqueado(map, nx, ny, op)) continue
      // diagonal só passa se os dois ortogonais estiverem livres, senão a rota
      // corta quina de parede — que o movimento, colidindo por eixo, não faz
      if (dx !== 0 && dy !== 0) {
        if (bloqueado(map, atual.x + dx, atual.y, op)) continue
        if (bloqueado(map, atual.x, atual.y + dy, op)) continue
      }
      const passo = (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1) * terrenoDoTile(map, nx, ny, op.preferirCaminho !== false)
      const novo = (custoAte.get(kAtual) ?? Infinity) + passo
      const kViz = chave(nx, ny)
      if (novo >= (custoAte.get(kViz) ?? Infinity)) continue
      custoAte.set(kViz, novo)
      veioDe.set(kViz, kAtual)
      const jaAberto = abertos.find((n) => n.x === nx && n.y === ny)
      const f = novo + heuristica({ x: nx, y: ny }, fim)
      if (jaAberto) jaAberto.f = f
      else abertos.push({ x: nx, y: ny, f })
    }
  }
  return null
}

/** Rota até o centro andável de uma sala, pelo id da área. */
export function rotaParaSala(
  map: MapDef,
  origem: Ponto,
  salaId: string,
  op: OpcoesDeRota = {},
): Ponto[] | null {
  const area = map.objects.find((o) => o.kind === 'area' && o.id === salaId)
  if (!area) return null
  const alvo = { x: area.x + area.w / 2, y: area.y + area.h / 2 }
  return calcularRota(map, origem, alvo, {
    ...op,
    salaDoMovedor: op.salaDoMovedor ?? salaDoPonto(map, origem.x, origem.y),
  })
}
