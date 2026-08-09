// Prova que o contorno acompanha a cor da região que ele toca.
//
// 28% dos pixels visíveis do boneco são contorno. Enquanto eles ficavam de fora da
// recoloração, quem escolhesse cabelo branco e roupa preta continuava com uma aresta
// marrom (#8d5243) em volta do corpo inteiro — a arte original do Kenney varia isso,
// usando #373733 em volta de roupa escura e #5c6278 em volta de roupa azul.
//
// Roda o núcleo de verdade (recolorir.core.ts, transpilado pelo esbuild), não uma
// reimplementação — reimplementar seria recriar a divergência que este trabalho
// acabou de eliminar.
//
// Contraprova obrigatória: repete tudo com o contorno deixado como estava, e EXIGE
// que isso reprove. Se os dois passarem, o teste não mede nada.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const UI = join(AQUI, '..', 'kairos-ui')
const ARTE = join(UI, 'src/game/furniture/avatar')
const MASCARAS = join(UI, 'src/game/furniture/avatar-mascaras')

const tmp = mkdtempSync(join(tmpdir(), 'prova-contorno-'))
const saida = join(tmp, 'core.mjs')
execFileSync(
  join(UI, 'node_modules/.bin/esbuild'),
  [join(UI, 'src/game/recolorir.core.ts'), '--format=esm', `--outfile=${saida}`],
  { stdio: 'pipe' },
)
const { aplicarCores, luminancia } = await import(saida)

// decodifica com o Pillow, que os outros scripts já usam: não vale acrescentar
// dependência de PNG ao projeto só para este teste
function lerPng(caminho) {
  const cru = join(tmp, `${Buffer.from(caminho).toString('hex').slice(-24)}.raw`)
  execFileSync('python3', [
    '-c',
    `from PIL import Image;import sys
im=Image.open(sys.argv[1]).convert('RGBA')
open(sys.argv[2],'wb').write(im.tobytes())
print(f"{im.width} {im.height}")`,
    caminho, cru,
  ], { stdio: 'pipe' })
  const dim = execFileSync('python3', ['-c', 'from PIL import Image;import sys;im=Image.open(sys.argv[1]);print(im.width,im.height)', caminho])
    .toString().trim().split(' ').map(Number)
  return { data: Uint8ClampedArray.from(readFileSync(cru)), width: dim[0], height: dim[1] }
}

function regiaoDaMascara(m) {
  return (p) => {
    const i = p * 4
    if (m.data[i + 3] < 128) return null
    const r = m.data[i], g = m.data[i + 1], b = m.data[i + 2]
    if (r > 200 && g > 200 && b > 200) return 'contorno'
    if (r > 200) return 'pele'
    if (g > 200) return 'cabelo'
    if (b > 200) return 'roupa'
    return null
  }
}

const CABELO_CLARO = '#e3e3e3'
const ROUPA_ESCURA = '#241c15'
const PRESET = 'ruivo-verde'
const QUADRO = 'baixo-0'

const arte = lerPng(join(ARTE, PRESET, `${QUADRO}.png`))
const mascara = lerPng(join(MASCARAS, PRESET, `${QUADRO}.png`))
const regiao = regiaoDaMascara(mascara)

// separa os pixels de contorno por vizinha dominante, ANTES de pintar
const VIZ = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]
const porVizinha = { cabelo: [], roupa: [] }
for (let p = 0; p < arte.width * arte.height; p++) {
  if (arte.data[p * 4 + 3] < 128 || regiao(p) !== 'contorno') continue
  const x = p % arte.width, y = (p / arte.width) | 0
  const votos = {}
  for (const [dx, dy] of VIZ) {
    const vx = x + dx, vy = y + dy
    if (vx < 0 || vy < 0 || vx >= arte.width || vy >= arte.height) continue
    const vp = vy * arte.width + vx
    if (arte.data[vp * 4 + 3] < 128) continue
    const r = regiao(vp)
    if (r === 'cabelo' || r === 'roupa') votos[r] = (votos[r] ?? 0) + 1
  }
  const venc = Object.keys(votos).sort((a, b) => votos[b] - votos[a])[0]
  if (venc && porVizinha[venc]) porVizinha[venc].push(p)
}

function medir(pintado) {
  const media = (ps) =>
    ps.reduce((n, p) => n + luminancia(pintado.data[p * 4], pintado.data[p * 4 + 1], pintado.data[p * 4 + 2]), 0) /
    (ps.length || 1)
  return { cabelo: media(porVizinha.cabelo), roupa: media(porVizinha.roupa) }
}

const pintado = { data: Uint8ClampedArray.from(arte.data), width: arte.width, height: arte.height }
aplicarCores(pintado, regiao, { cabelo: CABELO_CLARO, roupa: ROUPA_ESCURA })
const agora = medir(pintado)

// contraprova: o comportamento antigo era não tocar no contorno
const antigo = { data: Uint8ClampedArray.from(arte.data), width: arte.width, height: arte.height }
aplicarCores(antigo, (p) => (regiao(p) === 'contorno' ? null : regiao(p)), { cabelo: CABELO_CLARO, roupa: ROUPA_ESCURA })
const antes = medir(antigo)

console.log(`  contorno junto ao cabelo (branco): luminância ${antes.cabelo.toFixed(3)} -> ${agora.cabelo.toFixed(3)}`)
console.log(`  contorno junto à roupa  (preta):   luminância ${antes.roupa.toFixed(3)} -> ${agora.roupa.toFixed(3)}`)
console.log(`  pixels medidos: ${porVizinha.cabelo.length} no cabelo, ${porVizinha.roupa.length} na roupa`)

const falhas = []
// o que se quer: contorno do cabelo branco fica mais claro que o da roupa preta
if (!(agora.cabelo > agora.roupa + 0.08)) {
  falhas.push(`o contorno não separou cabelo de roupa (${agora.cabelo.toFixed(3)} vs ${agora.roupa.toFixed(3)})`)
}
// e mudou de verdade em relação ao marrom fixo
if (Math.abs(agora.cabelo - antes.cabelo) < 0.02) falhas.push('o contorno do cabelo não mudou')
if (Math.abs(agora.roupa - antes.roupa) < 0.02) falhas.push('o contorno da roupa não mudou')
// contraprova: no comportamento antigo os dois têm que ser praticamente iguais
if (Math.abs(antes.cabelo - antes.roupa) > 0.02) {
  falhas.push('contraprova inválida: o contorno antigo já variava, então o teste não mede a correção')
}
if (!porVizinha.cabelo.length || !porVizinha.roupa.length) {
  falhas.push('não havia pixel de contorno suficiente para medir')
}

rmSync(tmp, { recursive: true, force: true })

if (falhas.length) {
  console.log('\nFALHOU:')
  for (const f of falhas) console.log(`  - ${f}`)
  process.exit(1)
}
console.log('\nO contorno segue a região vizinha, e o comportamento antigo é rejeitado.')
