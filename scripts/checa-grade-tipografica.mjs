import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// A Silkscreen é desenhada numa grade de 8px: em 9, 10, 11 ou 13px os pixels da
// fonte deixam de cair na grade e borram — o oposto do que pixel art promete.
// Só 8/16/24px (0.5/1/1.5rem) são fiéis.
//
// Mas estar na grade não basta: a fonte pixel é de RÓTULO — eyebrow, badge, chip,
// aba, tecla, título. Item de lista, nome, prévia e horário são TEXTO e vão para
// Nunito, por mais que 8px esteja na grade. A primeira versão deste portão só
// checava o tamanho e por isso aprovou o nome de sala em Silkscreen 8px, que o
// desenho manda ser Nunito 13.
const PERMITIDOS = new Set(['0.5rem', '1rem', '1.5rem'])

// Classificar pelo NOME do seletor é frágil nos dois sentidos: ".cp-eyebrow" é
// rótulo e casava com "row" de uma lista de palavras de texto. O sinal confiável
// está DENTRO da regra — todo rótulo deste sistema é caps com espaçamento de
// letra, e frase corrida nunca é. É a mesma definição que o desenho usa:
// "rótulo curto e eyebrow — nunca frase corrida nem lista".
const CAPS = /text-transform:\s*uppercase/
const ESPACADO = /letter-spacing:/
// exceção estreita e nomeada: conteúdo de poucos caracteres não tem caps nem
// espaçamento a exibir, mas é fonte pixel por direito — o número do badge, o
// glifo da tecla e o "olá!" do balão da landing
const CURTO = /(badge|key|tecla|bubble)/i
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

// o seletor é a última linha não vazia antes da chave que abre a regra
function seletorDa(regra, bloco) {
  const antes = bloco.slice(0, bloco.length - regra.length - 1)
  return antes.split('\n').filter((l) => l.trim()).pop()?.trim() ?? '?'
}

const faltas = []
for (const caminho of arquivos(RAIZ)) {
  const texto = readFileSync(caminho, 'utf8')
  for (const bloco of texto.split('}')) {
    const i = bloco.lastIndexOf('{')
    if (i < 0) continue
    const regra = bloco.slice(i + 1)
    if (!FONTE_PIXEL.test(regra)) continue
    const tamanho = regra.match(/font-size:\s*([^;]+);/)
    if (!tamanho) continue
    const valor = tamanho[1].trim()
    const seletor = seletorDa(regra, bloco)
    const ehRotulo = CAPS.test(regra) || ESPACADO.test(regra) || CURTO.test(seletor)

    if (!ehRotulo) {
      faltas.push({
        arquivo: caminho.replace(RAIZ + '/', ''), seletor, valor,
        motivo: 'fonte pixel sem caps nem espaçamento — se é frase ou lista, vai para --f-sans',
      })
      continue
    }
    if (!PERMITIDOS.has(valor)) {
      faltas.push({ arquivo: caminho.replace(RAIZ + '/', ''), seletor, valor, motivo: 'rótulo fora da grade de 8' })
    }
  }
}

if (!faltas.length) {
  console.log('ok: a fonte pixel só aparece em rótulo, e sempre na grade de 8')
  process.exit(0)
}

console.log(`${faltas.length} uso(s) indevido(s) de fonte pixel:\n`)
for (const f of faltas) console.log(`  ${f.arquivo}  ${f.seletor}  →  ${f.valor}  (${f.motivo})`)
process.exit(1)
