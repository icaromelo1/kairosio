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

// Grade pré-computada. Sem isto, cada tile visitado varria os 661 objetos da
// Cidade — medido: 356ms de média e 2,6s no pior caso, o que aparece como
// "demora pra começar a andar". Uma passada pelos objetos no início troca isso
// por consulta O(1).
interface Grade {
  solido: Uint8Array
  custo: Float32Array
  custoSemPreferencia: Float32Array
  w: number
  h: number
  /** quantos objetos o mapa tinha quando a grade foi montada — spawnar um móvel
   *  muda a colisão, e uma grade velha mandaria a rota atravessar o que acabou
   *  de aparecer */
  objetos: number
}

const gradeCache = new WeakMap<MapDef, Grade>()

function gradeDoMapa(map: MapDef): Grade {
  const cache = gradeCache.get(map)
  if (cache && cache.objetos === map.objects.length) return cache

  const w = map.width
  const h = map.height
  const solido = new Uint8Array(w * h)
  const custo = new Float32Array(w * h).fill(CUSTO_PADRAO)
  const custoSemPreferencia = new Float32Array(w * h).fill(CUSTO_PADRAO)

  // borda do mapa, mesma regra do isSolid
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) solido[y * w + x] = 1
    solido[x] = 1
  }
  for (let y = 0; y < h; y++) {
    solido[y * w] = 1
    solido[y * w + w - 1] = 1
  }

  for (const o of map.objects) {
    // isSolid testa `x >= o.x` com x INTEIRO, ou seja ceil(o.x) — usar floor aqui
    // engordava cada objeto em um tile e fechava 460 passagens, deixando salas
    // inteiras sem rota
    const x0 = Math.max(0, Math.ceil(o.x))
    const y0 = Math.max(0, Math.ceil(o.y))
    const x1 = Math.min(w - 1, Math.ceil(o.x + o.w) - 1)
    const y1 = Math.min(h - 1, Math.ceil(o.y + o.h) - 1)
    if (x1 < x0 || y1 < y0) continue
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x
        if (o.solid) solido[i] = 1
        if (o.kind === 'water') {
          custo[i] = CUSTO_AGUA
          custoSemPreferencia[i] = CUSTO_AGUA
        } else if (o.kind === 'path' && custo[i] !== CUSTO_AGUA) {
          custo[i] = CUSTO_CAMINHO
        }
      }
    }
  }

  const g = { solido, custo, custoSemPreferencia, w, h, objetos: map.objects.length }
  gradeCache.set(map, g)
  return g
}

/** Exportada pro teste conseguir comparar a grade com o isSolid do jogo. */
export function bloqueado(map: MapDef, x: number, y: number, op: OpcoesDeRota = {}): boolean {
  const g = gradeDoMapa(map)
  if (x < 1 || y < 1 || x > g.w - 2 || y > g.h - 2) return true
  if (g.solido[y * g.w + x]) return true
  // porta de sala trancada é dinâmica e são poucas: fica fora da grade
  if (op.trancadas && op.trancadas.size) {
    return isSolid(map, x, y, op.trancadas, op.salaDoMovedor ?? null)
  }
  return false
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

/**
 * O corpo consegue percorrer o segmento reto de `a` a `b`?
 *
 * Não basta a linha estar livre: o movimento resolve colisão POR EIXO — tenta X
 * com o Y antigo, depois Y com o X novo. Entre dois sólidos na diagonal existe
 * uma fresta que um ponto na reta atravessa e o corpo não. O A* já evita cortar
 * quina; era a simplificação que reintroduzia isso, e o resultado era o
 * personagem empurrando a parede até o detector de travado desistir.
 *
 * Então este teste anda o segmento do mesmo jeito que o jogo anda.
 */
export function temLinhaDeVisao(map: MapDef, a: Ponto, b: Ponto, op: OpcoesDeRota = {}): boolean {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const passos = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 4)
  if (passos === 0) return true
  let px = a.x
  let py = a.y
  for (let i = 1; i <= passos; i++) {
    const t = i / passos
    const nx = a.x + dx * t
    const ny = a.y + dy * t
    // mesma ordem do laço de movimento
    if (!bloqueado(map, Math.floor(nx), Math.floor(py), op)) px = nx
    if (!bloqueado(map, Math.floor(px), Math.floor(ny), op)) py = ny
    // se um dos eixos não avançou, o corpo ficaria raspando a parede aqui
    if (Math.abs(px - nx) > 1e-6 || Math.abs(py - ny) > 1e-6) return false
  }
  return true
}

/**
 * Descarta pontos intermediários enquanto o anterior e o seguinte se enxergam.
 * O A* devolve escadinha; é este passe que produz as linhas retas.
 */
// Segmento longo é frágil: o corpo colide por eixo, raspa a parede, desvia da
// reta, e a partir daí "ir em linha reta pro alvo" aponta pra dentro de um
// sólido. Medido: um trecho de 24 tiles fazia o boneco chegar 2 tiles fora da
// linha e travar. Re-mirar a cada poucos tiles impede o desvio de acumular.
const SEGMENTO_MAX = 6

export function simplificar(map: MapDef, pontos: Ponto[], op: OpcoesDeRota = {}): Ponto[] {
  if (pontos.length <= 2) return pontos.slice()
  const saida: Ponto[] = [pontos[0]]
  let ancora = 0
  while (ancora < pontos.length - 1) {
    let alcance = ancora + 1
    for (let i = pontos.length - 1; i > ancora; i--) {
      const p = pontos[i]
      const a = pontos[ancora]
      if (Math.max(Math.abs(p.x - a.x), Math.abs(p.y - a.y)) > SEGMENTO_MAX) continue
      if (temLinhaDeVisao(map, a, p, op)) {
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
  const grade = gradeDoMapa(map)
  const tabelaCusto = op.preferirCaminho === false ? grade.custoSemPreferencia : grade.custo
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
      const passo = (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1) * tabelaCusto[ny * grade.w + nx]
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
