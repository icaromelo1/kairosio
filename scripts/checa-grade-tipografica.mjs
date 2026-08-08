import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// A Silkscreen é desenhada numa grade de 8px: em 9, 10, 11 ou 13px os pixels da
// fonte deixam de cair na grade e borram — o oposto do que pixel art promete.
// Só 8/16/24px (0.5/1/1.5rem) são fiéis. Texto que precisa ser menor ou
// intermediário vai para Nunito, que aguenta 12–14px com dignidade.
const PERMITIDOS = new Set(['0.5rem', '1rem', '1.5rem'])
const FONTE_PIXEL = /var\(--f-pixel\)|var\(--f-mono\)/
const RAIZ = new URL('../kairos-ui/src', import.meta.url).pathname
const IGNORAR = new Set(['node_modules', 'dist'])

function arquivos(dir) {
  const saida = []
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) saida.push(...arquivos(caminho))
    else if (/\.(vue|css)$/.test(nome)) saida.push(caminho)
  }
  return saida
}

// uma "regra" é o trecho entre chaves; a fonte e o tamanho precisam conviver na
// mesma regra para o par valer
function regras(css) {
  return css.split('}').map((bloco) => bloco.slice(bloco.lastIndexOf('{') + 1))
}

const faltas = []
for (const caminho of arquivos(RAIZ)) {
  const texto = readFileSync(caminho, 'utf8')
  for (const regra of regras(texto)) {
    if (!FONTE_PIXEL.test(regra)) continue
    const tamanho = regra.match(/font-size:\s*([^;]+);/)
    if (!tamanho) continue
    const valor = tamanho[1].trim()
    if (PERMITIDOS.has(valor)) continue
    faltas.push({ arquivo: caminho.replace(RAIZ + '/', ''), valor })
  }
}

if (!faltas.length) {
  console.log('ok: toda Silkscreen está na grade de 8 (0.5 / 1 / 1.5rem)')
  process.exit(0)
}

console.log(`${faltas.length} declaração(ões) de fonte pixel fora da grade de 8:\n`)
for (const f of faltas) console.log(`  ${f.arquivo}  →  font-size: ${f.valor}`)
process.exit(1)
