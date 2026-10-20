import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.KAIROS_URL || 'http://localhost:4180'
const SAIDA = process.argv[2] || 'varredura'
const SO = process.argv[3] ? new RegExp(process.argv[3]) : null
const contas = JSON.parse(readFileSync(new URL('./contas-teste.local', import.meta.url), 'utf8'))

const mobilia = readFileSync(new URL('../kairos-ui/src/mundo/mobilia.ts', import.meta.url), 'utf8')
const interativas = new Map()
for (const linha of mobilia.split('\n')) {
  const m = linha.match(/^\s*([a-z_]+): \{.*?profundidade: ([\d.]+)/)
  if (!m) continue
  const tipo = /sentavel: true/.test(linha) ? 'sentar' : /estacao: '/.test(linha) ? 'estacao' : null
  if (tipo) interativas.set(m[1], { tipo, profundidade: Number(m[2]) })
}

const login = await fetch(`${BASE}/kairos-api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: contas.contas[0], password: contas.senha }),
}).then((r) => r.json())
const token = login.token
const mapa = await fetch(`${BASE}/kairos-api/map/escritorio`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())

mkdirSync(SAIDA, { recursive: true })
const navegador = await chromium.launch()
const pagina = await navegador.newPage({ viewport: { width: 1280, height: 800 } })
await pagina.addInitScript(`localStorage.setItem('kairos_token', ${JSON.stringify(token)}); localStorage.setItem('kairos_pixel', '1')`)
await pagina.goto(`${BASE}${process.env.KAIROS_BASE ?? ''}/game?varredura=1`, { waitUntil: 'domcontentloaded' })
await pagina.waitForSelector('.gp-tela', { timeout: 60000 })
await pagina.waitForTimeout(9000)
await pagina.evaluate(() => document.querySelector('.ss-toggle[aria-label="Recolher o menu"]')?.click())
for (let i = 0; i < 6; i++) await pagina.mouse.wheel(0, -400)

if (!(await pagina.evaluate(() => !!window.kairosVarredura))) {
  console.log('gancho kairosVarredura ausente: precisa de conta sudo e ?varredura na URL')
  process.exit(1)
}
const porPeca = new Map()
const LIMITE = Number(process.env.POR_PECA || 3)

const relatorio = []
let n = 0
for (const movel of mapa.mobilia) {
  const info = interativas.get(movel.peca)
  if (!info || (SO && !SO.test(movel.peca))) continue
  if ((porPeca.get(movel.peca) ?? 0) >= LIMITE) continue
  porPeca.set(movel.peca, (porPeca.get(movel.peca) ?? 0) + 1)
  let acao = null
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const recuo = info.profundidade / 2 + 0.55
    await pagina.evaluate(({ x, y }) => window.kairosVarredura.teleportar(x, y), { x: movel.x + dx * recuo, y: movel.y + dy * recuo })
    await pagina.waitForTimeout(500)
    acao = await pagina.evaluate(() => window.kairosVarredura.acao())
    if (acao) break
  }
  const nome = `${String(++n).padStart(3, '0')}-${movel.peca}-${movel.id}`
  if (acao) {
    await pagina.evaluate(() => window.kairosVarredura.interagir())
    await pagina.waitForTimeout(1300)
  }
  await pagina.screenshot({ path: join(SAIDA, `${nome}.png`), clip: { x: 390, y: 200, width: 500, height: 400 } })
  relatorio.push({ nome, peca: movel.peca, tipo: info.tipo, x: movel.x, y: movel.y, giro: movel.giro, acao })
  if (acao === 'sentar') await pagina.evaluate(() => window.kairosVarredura.interagir())
  else await pagina.evaluate(() => window.kairosVarredura.fechar())
  await pagina.waitForTimeout(300)
}
writeFileSync(join(SAIDA, 'relatorio.json'), JSON.stringify(relatorio, null, 1))
console.log(`VARREDURA ${relatorio.length} interacoes`)
await navegador.close()
