// Inventário de restos de modelos antigos do Kairos.
//
// O Kairos já mudou de modelo algumas vezes e cada mudança deixou sedimento:
// arquivo que ninguém importa, símbolo exportado sem consumidor, comentário que
// promete um futuro que já chegou. Isso não é só feiura — o PixiAvatarPreview.vue
// órfão chegou a apontar um diagnóstico de bug para o componente errado.
//
// A saída é lista curta para olho humano decidir, nunca veredito automático.
// Mas cada categoria mede UMA coisa: misturar "código morto" com "export
// desnecessário" produz número grande e inútil que ninguém olha.
//
// Uso:
//   node scripts/restos.mjs <dir>              inventário legível
//   node scripts/restos.mjs <dir> --placar     só as contagens, em JSON
//   node scripts/restos.mjs --catraca          compara os dois projetos com a linha de base
//   node scripts/restos.mjs --autoteste        prova que cada detector sabe acusar e sabe calar
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join, relative, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const BASE = join(AQUI, 'restos.base.json')
const PROJETOS = [
  ['kairos-ui', join(AQUI, '..', 'kairos-ui/src')],
  ['kairos-api', join(AQUI, '..', 'kairos-api/src')],
]

const ehSpec = (p) => /\.(spec|test)\.ts$/.test(p)

function varrer(RAIZ) {
  const arquivos = []
  ;(function anda(d) {
    for (const n of readdirSync(d)) {
      if (['node_modules', 'dist', 'coverage'].includes(n) || n.startsWith('.')) continue
      const p = join(d, n)
      if (statSync(p).isDirectory()) anda(p)
      else if (/\.(ts|vue)$/.test(n)) arquivos.push(p)
    }
  })(RAIZ)

  const texto = new Map(arquivos.map((p) => [p, readFileSync(p, 'utf8')]))
  const rel = (p) => relative(RAIZ, p)
  const outros = (p) => arquivos.filter((o) => o !== p)
  // spec conta como USO — senão constante exportada só para o teste vira falso
  // morto — mas nunca como FONTE a auditar
  const fontes = arquivos.filter((p) => !ehSpec(p))

  // 1 · arquivo que ninguém importa
  const orfaos = fontes.filter((p) => {
    const nome = basename(p).replace(/\.(ts|vue)$/, '')
    if (/^(main|App|index)$/.test(nome) || /\.d\.ts$/.test(p)) return false
    const pasta = basename(dirname(p))
    const ext = p.endsWith('.vue') ? '.vue' : '.ts'
    return !outros(p).some((o) => {
      const t = texto.get(o)
      if (t.includes(`${nome}.vue`) || t.includes(`/${nome}'`) || t.includes(`/${nome}"`)) return true
      // só vale como uso por glob se o padrão mirar o mesmo tipo de arquivo;
      // casar só pelo nome da pasta esconde órfão de verdade
      return (t.match(/import\.meta\.glob\(['"][^'"]+['"]/g) || [])
        .some((g) => g.includes(pasta) && g.includes(ext))
    })
  }).map(rel)

  // 2 · exportado e sem nenhuma referência fora → candidato a morto
  // 3 · usado só dentro do próprio arquivo → o que sobra é o export
  // 5 · referenciado só por spec → o teste é a única coisa que o mantém vivo.
  //     Foi assim que o AppController, que não está em módulo nenhum, passou
  //     despercebido: contar spec como uso é certo para constante, e cega para isto.
  const mortos = [], exportDemais = [], sóTeste = []
  const RE = /^export\s+(?:async\s+)?(?:function|const|class|interface|type|enum)\s+(\w+)/gm
  for (const p of fontes) {
    const corpo = texto.get(p)
    for (const m of corpo.matchAll(RE)) {
      const nome = m[1]
      const re = new RegExp(`\\b${nome}\\b`)
      const usam = outros(p).filter((o) => re.test(texto.get(o)))
      if (usam.length && usam.every(ehSpec)) {
        sóTeste.push(`${rel(p)} → ${nome}`)
        continue
      }
      if (usam.length) continue
      const dentro = (corpo.match(new RegExp(`\\b${nome}\\b`, 'g')) || []).length
      ;(dentro > 1 ? exportDemais : mortos).push(`${rel(p)} → ${nome}`)
    }
  }

  // 4 · comentário que confessa provisório. TODO/FIXME casam com maiúscula e
  // limite de palavra: sem isso o "todo" do português ("todo mundo", "todos")
  // sozinho gera vinte falsos positivos e o relatório vira ruído
  const FRASES = [
    /\bTODO\b/, /\bFIXME\b/, /\bHACK\b/,
    /ainda n[ãa]o (existe|implementad|funciona)/i,
    /por enquanto/i, /provis[óo]ri/i, /tempor[áa]ri/i,
    /gambiarra/i, /(c[óo]digo|modelo|sistema) (antigo|legado)/i,
  ]
  const vencidos = []
  for (const p of fontes) {
    texto.get(p).split('\n').forEach((l, i) => {
      if (!/^\s*(\/\/|\*|\/\*)/.test(l)) return
      if (FRASES.some((f) => f.test(l))) vencidos.push(`${rel(p)}:${i + 1}  ${l.trim().slice(0, 92)}`)
    })
  }

  return {
    'arquivo-orfao': orfaos,
    'export-morto': mortos,
    'export-demais': exportDemais,
    'comentario-vencido': vencidos,
    'vivo-so-pelo-teste': sóTeste,
  }
}

const TITULOS = {
  'arquivo-orfao': 'ARQUIVO QUE NINGUÉM IMPORTA',
  'export-morto': 'SÍMBOLO EXPORTADO SEM NENHUMA REFERÊNCIA',
  'export-demais': 'EXPORTADO MAS USADO SÓ NO PRÓPRIO ARQUIVO',
  'comentario-vencido': 'COMENTÁRIO QUE CONFESSA PROVISÓRIO',
  'vivo-so-pelo-teste': 'VIVO SÓ PORQUE TEM TESTE (nada em produção usa)',
}

const contar = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.length]))

// Vocabulário de corpos: a API grava `base` e o front é quem tem os sprites e as
// máscaras. Um id que exista só de um lado vira boneco sem arte — foi assim que o
// hairStyle 'short' sobreviveu apontando para um corpo que não existia mais.
//
// Não é catraca: divergência aqui nunca é aceitável, então reprova sempre.
export function compararVocabulario(daApi, doFront) {
  const api = new Set(daApi)
  const front = new Set(doFront)
  return {
    soNaApi: [...api].filter((id) => !front.has(id)),
    soNoFront: [...front].filter((id) => !api.has(id)),
  }
}

function vocabulario() {
  const api = readFileSync(join(AQUI, '..', 'kairos-api/src/avatar/avatar.presets.ts'), 'utf8')
  const front = readFileSync(
    join(AQUI, '..', 'kairos-ui/src/game/furniture/avatar/presets.json'),
    'utf8',
  )
  const daApi = [...api.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1])
  const doFront = JSON.parse(front).map((c) => c.id)
  if (!daApi.length || !doFront.length) {
    return { soNaApi: [], soNoFront: [], vazio: true }
  }
  return compararVocabulario(daApi, doFront)
}

function autoteste() {
  const dir = join(AQUI, '..', '.restos-autoteste')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(join(dir, 'sub'), { recursive: true })
  writeFileSync(join(dir, 'usado.ts'), 'export const VIVO = 1\nexport const SO_AQUI = 2\nexport function f() { return SO_AQUI }\n')
  writeFileSync(join(dir, 'consumidor.ts'), "import { VIVO } from './usado'\nconsole.log(VIVO)\n")
  writeFileSync(join(dir, 'sub', 'ninguem.ts'), 'export const NADA = 3\n')
  // isca: "todo mundo" em português NÃO pode virar achado
  writeFileSync(join(dir, 'isca.ts'), "// vale para todo mundo, todos os casos\nimport { VIVO } from './usado'\nexport const X = VIVO\n")
  writeFileSync(join(dir, 'consumidor2.ts'), "import { X } from './isca'\n// TODO: isto sim tem que aparecer\nconsole.log(X)\n")
  writeFileSync(join(dir, 'zumbi.ts'), 'export class Zumbi {}\n')
  writeFileSync(join(dir, 'zumbi.spec.ts'), "import { Zumbi } from './zumbi'\nnew Zumbi()\n")

  const r = varrer(dir)
  const casos = [
    ['acha arquivo órfão', r['arquivo-orfao'].includes(join('sub', 'ninguem.ts'))],
    ['acha export sem referência', r['export-morto'].some((x) => x.includes('NADA'))],
    ['separa export usado só no próprio arquivo', r['export-demais'].some((x) => x.includes('SO_AQUI'))],
    ['acha TODO de verdade', r['comentario-vencido'].some((x) => x.includes('isto sim'))],
    ['NÃO confunde "todo mundo" com TODO', !r['comentario-vencido'].some((x) => x.includes('todo mundo'))],
    ['NÃO acusa arquivo importado', !r['arquivo-orfao'].includes('usado.ts')],
    ['acha o que só o teste mantém vivo', r['vivo-so-pelo-teste'].some((x) => x.includes('Zumbi'))],
    ['NÃO chama de morto o que o teste usa junto com produção', !r['export-morto'].some((x) => x.includes('VIVO'))],
    ['acha corpo que só existe na API', compararVocabulario(['a', 'b'], ['a']).soNaApi.length === 1],
    ['acha corpo que só existe no front', compararVocabulario(['a'], ['a', 'b']).soNoFront.length === 1],
    ['NÃO acusa vocabulários iguais fora de ordem',
      compararVocabulario(['a', 'b'], ['b', 'a']).soNaApi.length === 0 &&
      compararVocabulario(['a', 'b'], ['b', 'a']).soNoFront.length === 0],
  ]
  rmSync(dir, { recursive: true, force: true })

  let ok = true
  for (const [nome, passou] of casos) {
    console.log(`  ${passou ? 'ok  ' : 'FALHOU'}  ${nome}`)
    if (!passou) ok = false
  }
  return ok ? 0 : 1
}

function catraca() {
  const v = vocabulario()
  if (v.vazio) {
    console.log('  vocabulário: não deu para ler os dois lados — checagem pulada')
  } else if (v.soNaApi.length || v.soNoFront.length) {
    console.log('Vocabulário de corpos divergente entre API e front:')
    if (v.soNaApi.length) console.log(`  só na API:   ${v.soNaApi.join(', ')}`)
    if (v.soNoFront.length) console.log(`  só no front: ${v.soNoFront.join(', ')}`)
    console.log('\nAvatar com base sem arte correspondente vira boneco vazio.')
    return 1
  } else {
    console.log('  vocabulário de corpos: API e front batem')
  }

  const base = existsSync(BASE) ? JSON.parse(readFileSync(BASE, 'utf8')) : null
  const agora = Object.fromEntries(PROJETOS.map(([n, d]) => [n, contar(varrer(d))]))
  if (!base) {
    writeFileSync(BASE, JSON.stringify(agora, null, 1) + '\n')
    console.log(`linha de base gravada em ${relative(process.cwd(), BASE)}:`)
    console.log(JSON.stringify(agora, null, 1))
    return 0
  }
  const piorou = [], melhorou = []
  for (const [proj, cats] of Object.entries(agora)) {
    for (const [cat, n] of Object.entries(cats)) {
      const antes = base[proj]?.[cat] ?? 0
      if (n > antes) piorou.push(`${proj}/${cat}: ${antes} → ${n}`)
      else if (n < antes) melhorou.push(`${proj}/${cat}: ${antes} → ${n}`)
    }
  }
  melhorou.forEach((m) => console.log(`  ↓ ${m}`))
  if (piorou.length) {
    console.log('\nA catraca só anda para trás. Cresceu:')
    piorou.forEach((p) => console.log(`  ↑ ${p}`))
    console.log('\nLimpe o que você acrescentou, ou atualize a base de propósito e diga por quê no commit.')
    return 1
  }
  if (melhorou.length) {
    writeFileSync(BASE, JSON.stringify(agora, null, 1) + '\n')
    console.log('\nBase atualizada — a catraca não deixa voltar.')
  } else {
    console.log('  nada mudou')
  }
  return 0
}

const args = process.argv.slice(2)
if (args.includes('--autoteste')) process.exit(autoteste())
else if (args.includes('--catraca')) process.exit(catraca())
else {
  const alvo = args.find((a) => !a.startsWith('--'))
  const r = varrer(alvo)
  if (args.includes('--placar')) console.log(JSON.stringify(contar(r), null, 1))
  else {
    for (const [cat, xs] of Object.entries(r)) {
      console.log(`\n${TITULOS[cat]} — ${xs.length}`)
      xs.slice(0, 25).forEach((x) => console.log('  ' + x))
      if (xs.length > 25) console.log(`  … e mais ${xs.length - 25}`)
    }
  }
}
