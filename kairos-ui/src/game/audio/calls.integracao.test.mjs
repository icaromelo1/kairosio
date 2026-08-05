import { CIDADE } from '../../../../kairos-api/src/map/cidade.ts'
import { callsDoMapa, historeseMidia } from './calls.ts'
import { ganhoDoPeer } from './espacial.ts'

const map = CIDADE
const areas = map.objects.filter((o) => o.kind === 'area')
const salas = areas.filter((a) => !a.aberta)
const pracas = areas.filter((a) => a.aberta)

let falhas = 0
function checa(nome, condicao, detalhe) {
  if (condicao) {
    console.log(`ok: ${nome}`)
  } else {
    falhas += 1
    console.log(`FALHOU: ${nome}${detalhe ? ' — ' + detalhe : ''}`)
  }
}

function centro(a) {
  return { x: a.x + a.w / 2, y: a.y + a.h / 2 }
}

const salaA = salas[0]
const salaB = salas.find((s) => s.id !== salaA.id)
const praca = pracas[0]

const cA = centro(salaA)
const dentroA1 = { id: 'p1', x: salaA.x + 2, y: salaA.y + 2 }
const dentroA2 = { id: 'p2', x: salaA.x + salaA.w - 3, y: salaA.y + salaA.h - 3 }

const calls1 = callsDoMapa(map, [dentroA1, dentroA2])
checa(
  'dois na mesma sala compartilham a call',
  calls1.get('p1') && calls1.get('p1') === calls1.get('p2'),
  `${calls1.get('p1')} vs ${calls1.get('p2')}`,
)

const distDentro = Math.hypot(dentroA1.x - dentroA2.x, dentroA1.y - dentroA2.y)
const ganhoDentro = ganhoDoPeer({
  map,
  falante: dentroA1,
  ouvinte: dentroA2,
  trancadas: new Set(),
  callFalante: calls1.get('p1'),
  callOuvinte: calls1.get('p2'),
})
checa(
  'na mesma sala o volume e cheio mesmo em cantos opostos',
  ganhoDentro === 1,
  `distancia ${distDentro.toFixed(1)} tiles, ganho ${ganhoDentro.toFixed(2)}`,
)

const cB = centro(salaB)
const emB = { id: 'p3', x: cB.x, y: cB.y }
const calls2 = callsDoMapa(map, [dentroA1, emB])
checa(
  'salas diferentes nao compartilham call',
  calls2.get('p1') !== calls2.get('p3'),
  `${calls2.get('p1')} vs ${calls2.get('p3')}`,
)

const ganhoEntreSalas = ganhoDoPeer({
  map,
  falante: dentroA1,
  ouvinte: emB,
  trancadas: new Set(),
  callFalante: calls2.get('p1'),
  callOuvinte: calls2.get('p3'),
})
checa(
  'entre salas o volume nao e cheio',
  ganhoEntreSalas < 1,
  `ganho ${ganhoEntreSalas.toFixed(3)}`,
)

const cP = centro(praca)
const naPraca1 = { id: 'q1', x: cP.x, y: cP.y }
const naPraca2 = { id: 'q2', x: cP.x + 3, y: cP.y }
const naPraca3 = { id: 'q3', x: cP.x + 30, y: cP.y }
const calls3 = callsDoMapa(map, [naPraca1, naPraca2, naPraca3])
checa(
  'dois perto na praca formam bolha',
  calls3.get('q1') && calls3.get('q1') === calls3.get('q2'),
  `${calls3.get('q1')} vs ${calls3.get('q2')}`,
)
checa(
  'quem esta longe na praca fica fora da bolha',
  calls3.get('q3') !== calls3.get('q1'),
)

const trancada = new Set([salaA.id])
const ganhoTrancada = ganhoDoPeer({
  map,
  falante: dentroA1,
  ouvinte: emB,
  trancadas: trancada,
  callFalante: calls2.get('p1'),
  callOuvinte: calls2.get('p3'),
})
checa(
  'sala trancada nao aumenta o vazamento de audio',
  ganhoTrancada <= ganhoEntreSalas,
  `${ganhoTrancada.toFixed(3)} vs ${ganhoEntreSalas.toFixed(3)}`,
)

checa('midia entra a 5 tiles', historeseMidia(false, 5) === true)
checa('midia continua dentro a 7 tiles', historeseMidia(true, 7) === true)
checa('midia sai a 9 tiles', historeseMidia(true, 9) === false)
checa('midia nao entra a 6 tiles', historeseMidia(false, 6) === false)

const repetido = callsDoMapa(map, [dentroA1, dentroA2, emB, naPraca1])
const repetido2 = callsDoMapa(map, [dentroA1, dentroA2, emB, naPraca1])
checa(
  'resultado e deterministico sobre o mapa real',
  JSON.stringify([...repetido]) === JSON.stringify([...repetido2]),
)

console.log(`\n${falhas === 0 ? 'todos os testes passaram' : falhas + ' teste(s) falharam'}`)
console.log(`mapa: ${map.id} | ${salas.length} salas fechadas | ${pracas.length} areas abertas`)
process.exit(falhas === 0 ? 0 : 1)
