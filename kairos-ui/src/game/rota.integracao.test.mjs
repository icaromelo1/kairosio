import { CIDADE } from '../../../kairos-api/src/map/cidade.ts'
import { isSolid } from './maps.ts'
import { calcularRota, rotaParaSala, simplificar, tileAndavelProximo, temLinhaDeVisao } from './rota.ts'

const map = CIDADE
let falhas = 0

function checa(nome, ok, detalhe) {
  if (ok) console.log(`ok: ${nome}`)
  else {
    falhas += 1
    console.log(`FALHOU: ${nome}${detalhe ? ' — ' + detalhe : ''}`)
  }
}

const areas = map.objects.filter((o) => o.kind === 'area')
const fechadas = areas.filter((a) => !a.aberta)
const centro = (a) => ({ x: a.x + a.w / 2, y: a.y + a.h / 2 })

// o segmento inteiro é livre? é o que o movimento vai de fato percorrer
function trechoLivre(a, b, trancadas) {
  const passos = Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 4)
  for (let i = 0; i <= passos; i++) {
    const t = passos === 0 ? 0 : i / passos
    const x = Math.floor(a.x + (b.x - a.x) * t)
    const y = Math.floor(a.y + (b.y - a.y) * t)
    if (isSolid(map, x, y, trancadas, null)) return { ok: false, x, y }
  }
  return { ok: true }
}

function rotaLivre(pontos, origem, trancadas) {
  let anterior = origem
  for (const p of pontos) {
    const r = trechoLivre(anterior, p, trancadas)
    if (!r.ok) return r
    anterior = p
  }
  return { ok: true }
}

const spawn = { x: map.spawn.x, y: map.spawn.y }

// --- rota existe e não atravessa sólido ---
const longe = fechadas[fechadas.length - 1]
const rota = rotaParaSala(map, spawn, longe.id)
checa('existe rota do spawn até uma sala distante', Array.isArray(rota) && rota.length > 0, `sala ${longe.id}`)
if (rota) {
  const r = rotaLivre(rota, spawn, undefined)
  checa('nenhum trecho da rota atravessa sólido', r.ok, r.ok ? '' : `bate em ${r.x},${r.y}`)
  checa('a rota termina dentro da sala pedida', (() => {
    const f = rota[rota.length - 1]
    return f.x >= longe.x && f.x < longe.x + longe.w && f.y >= longe.y && f.y < longe.y + longe.h
  })(), JSON.stringify(rota[rota.length - 1]))
}

// --- simplificação reduz pontos e continua válida ---
const bruta = []
{
  // reconstrói uma rota bruta ligando ponto a ponto em passos de 1 tile
  let cur = { ...spawn }
  const alvo = tileAndavelProximo(map, centro(longe)) ?? spawn
  let guarda = 0
  while ((cur.x !== alvo.x || cur.y !== alvo.y) && guarda++ < 500) {
    if (cur.x !== alvo.x) cur = { ...cur, x: cur.x + Math.sign(alvo.x - cur.x) }
    else cur = { ...cur, y: cur.y + Math.sign(alvo.y - cur.y) }
    bruta.push({ ...cur })
  }
}
const simples = simplificar(map, bruta)
checa('simplificar reduz a contagem de pontos', simples.length < bruta.length, `${bruta.length} -> ${simples.length}`)

// --- preferência por calçada: a rota tem que DESVIAR pra pegar a calçada ---
{
  const paths = map.objects.filter((o) => o.kind === 'path')
  const naCalcada = (p) => paths.some((o) => p.x >= o.x && p.x < o.x + o.w && p.y >= o.y && p.y < o.y + o.h)
  // pontos dos dois lados de uma avenida vertical, deslocados no eixo Y: a reta
  // entre eles cruza a calçada de raspão; preferindo, a rota anda POR ela
  const via = paths.find((o) => o.h > o.w)
  const a = { x: via.x - 6, y: via.y + 20 }
  const b = { x: via.x + via.w + 6, y: via.y + 60 }
  const com = calcularRota(map, a, b)
  const sem = calcularRota(map, a, b, { preferirCaminho: false })
  checa('há rota nos dois modos', !!com && !!sem)
  if (com && sem) {
    const conta = (r) => {
      let n = 0, ant = a
      for (const p of r) {
        const passos = Math.ceil(Math.max(Math.abs(p.x - ant.x), Math.abs(p.y - ant.y)))
        for (let i = 1; i <= passos; i++) {
          const t = i / passos
          if (naCalcada({ x: Math.floor(ant.x + (p.x - ant.x) * t), y: Math.floor(ant.y + (p.y - ant.y) * t) })) n++
        }
        ant = p
      }
      return n
    }
    const nCom = conta(com)
    const nSem = conta(sem)
    checa('preferir calçada aumenta o trecho sobre ela', nCom > nSem, `com=${nCom} tiles, sem=${nSem}`)
  }
}

// --- sala trancada não tem rota ---
{
  const alvo = fechadas.find((a) => a.id !== longe.id) ?? fechadas[0]
  const trancadas = new Set([alvo.id])
  const r = rotaParaSala(map, spawn, alvo.id, { trancadas })
  checa('sala trancada não tem rota', r === null, r ? `devolveu ${r.length} pontos` : '')
  const rDestrancada = rotaParaSala(map, spawn, alvo.id)
  checa('a mesma sala destrancada tem rota', Array.isArray(rDestrancada) && rDestrancada.length > 0)
}

// --- alvo sobre móvel resolve pro tile livre ao lado ---
{
  const solido = map.objects.find((o) => o.solid && o.kind !== 'wall')
  const dentro = { x: Math.floor(solido.x), y: Math.floor(solido.y) }
  checa('o centro escolhido é sólido de propósito', isSolid(map, dentro.x, dentro.y))
  const livre = tileAndavelProximo(map, dentro)
  checa('tileAndavelProximo devolve tile livre', !!livre && !isSolid(map, livre.x, livre.y), JSON.stringify(livre))
}

// --- linha de visão não atravessa parede ---
{
  const parede = map.objects.find((o) => o.kind === 'wall' && o.w >= 6)
  const a = { x: parede.x + 2, y: parede.y - 2 }
  const b = { x: parede.x + 2, y: parede.y + 3 }
  checa('linha de visão enxerga o vizinho livre', temLinhaDeVisao(map, a, { x: a.x + 1, y: a.y }))
  checa('linha de visão não atravessa parede', !temLinhaDeVisao(map, a, b))
}

// --- determinismo ---
{
  const um = JSON.stringify(rotaParaSala(map, spawn, longe.id))
  const dois = JSON.stringify(rotaParaSala(map, spawn, longe.id))
  checa('a rota é determinística', um === dois)
}

console.log(`\n${falhas === 0 ? 'todos os testes passaram' : falhas + ' teste(s) falharam'}`)
console.log(`mapa ${map.id} | ${fechadas.length} salas fechadas | ${map.objects.filter((o) => o.kind === 'path').length} calçadas`)
process.exit(falhas === 0 ? 0 : 1)
