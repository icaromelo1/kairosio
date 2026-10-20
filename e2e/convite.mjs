import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.KAIROS_URL || 'http://localhost:4180'
const SAIDA = process.argv[2] || 'convite'
const contas = JSON.parse(readFileSync(new URL('./contas-teste.local', import.meta.url), 'utf8'))
mkdirSync(SAIDA, { recursive: true })

const api = (caminho, token, corpo) => fetch(`${BASE}/kairos-api${caminho}`, {
  method: corpo ? 'POST' : 'GET',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: corpo ? JSON.stringify(corpo) : undefined,
}).then(async (r) => ({ status: r.status, corpo: await r.json().catch(() => null) }))

const dono = (await api('/auth/login', null, { email: contas.contas[0], password: contas.senha })).corpo.token
const servidor = (await api('/server/me', dono)).corpo
const { code } = (await api(`/server/${servidor.id}/invite`, dono)).corpo
console.log(`servidor do convite: ${servidor.name}`)

const resultados = []
const navegador = await chromium.launch()

async function ativoDe(pagina) {
  const token = await pagina.evaluate(() => localStorage.getItem('kairos_token'))
  return token ? (await api('/server/me', token)).corpo?.id ?? null : null
}

async function cenarioContaNova() {
  const pagina = await navegador.newPage({ viewport: { width: 1280, height: 800 } })
  const sufixo = Date.now().toString(36)
  await pagina.goto(`${BASE}/join/${code}`)
  await pagina.waitForTimeout(1500)
  const aposLink = new URL(pagina.url()).pathname
  await pagina.screenshot({ path: join(SAIDA, '1-link-sem-conta.png') })
  await pagina.click('.create-account-link')
  await pagina.fill('#reg-email', `convite.${sufixo}@refactor.test`)
  await pagina.fill('#reg-username', `convidado${sufixo.slice(-5)}`)
  await pagina.fill('#reg-password', 'SenhaConvite123')
  await pagina.fill('#reg-confirm', 'SenhaConvite123')
  await pagina.check('.reg-aceite input')
  await pagina.waitForTimeout(800)
  await pagina.click('.reg-submit')
  await pagina.waitForURL(/\/game/, { timeout: 30000 })
  await pagina.waitForTimeout(6000)
  await pagina.screenshot({ path: join(SAIDA, '2-depois-do-cadastro.png') })
  const botao = pagina.getByRole('button', { name: /entrar no escritório/i })
  if (await botao.isVisible().catch(() => false)) await botao.click()
  await pagina.waitForTimeout(5000)
  await pagina.screenshot({ path: join(SAIDA, '3-depois-do-personagem.png') })
  const ativo = await ativoDe(pagina)
  resultados.push({ cenario: 'conta nova pelo link', aposLink, entrouNoServidor: ativo === servidor.id })
  await pagina.close()
}

async function cenarioMembroDeOutro() {
  const segundo = (await api('/auth/login', null, { email: contas.contas[1], password: contas.senha })).corpo.token
  const antes = (await api('/server/mine', segundo)).corpo
  const jaMembro = antes.some((s) => s.id === servidor.id)
  const pagina = await navegador.newPage({ viewport: { width: 1280, height: 800 } })
  await pagina.addInitScript(`localStorage.setItem('kairos_token', ${JSON.stringify(segundo)})`)
  await pagina.goto(`${BASE}/join/${code}`)
  await pagina.waitForTimeout(9000)
  await pagina.screenshot({ path: join(SAIDA, `4-logado-${jaMembro ? 'ja-membro' : 'outro-servidor'}.png`) })
  const ativo = await ativoDe(pagina)
  const painelAberto = await pagina.evaluate(() => !!document.querySelector('.ps-card'))
  resultados.push({ cenario: jaMembro ? 'logado e já membro' : 'logado sem esse servidor', entrouNoServidor: ativo === servidor.id, painelAindaAberto: painelAberto })
  await pagina.close()
}

async function cenarioOutroServidor() {
  const sufixo = Date.now().toString(36)
  const token = (await api('/auth/register', null, { email: `outro.${sufixo}@refactor.test`, password: 'SenhaConvite123', username: `outro${sufixo.slice(-5)}`, aceitouTermos: true })).corpo.token
  const salvou = await fetch(`${BASE}/kairos-api/character/aparencia`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ aparencia: { v: 1, pele: '#e8b894', corCabelo: '#3d2817', pecas: { cabelo: { id: 'curto', cor: '#3d2817' }, chapeu: { id: 'nenhum', cor: '#c0392b' }, rosto: { id: 'nenhum', cor: '#26262b' }, cima: { id: 'camiseta', cor: '#2c7441' }, baixo: { id: 'calca', cor: '#2f3d5c' }, sapato: { id: 'tenis', cor: '#f0eee8' }, acessorio: { id: 'nenhum', cor: '#d9a441' } } } }) }).then((r) => r.status)
  await api('/server', token, { name: `Outro ${sufixo}` })
  const antes = (await api('/server/me', token)).corpo?.id
  const pagina = await navegador.newPage({ viewport: { width: 1280, height: 800 } })
  await pagina.addInitScript(`localStorage.setItem('kairos_token', ${JSON.stringify(token)})`)
  await pagina.goto(`${BASE}/join/${code}`)
  await pagina.waitForTimeout(9000)
  await pagina.screenshot({ path: join(SAIDA, '5-logado-em-outro-servidor.png') })
  const ativo = await ativoDe(pagina)
  const painelAberto = await pagina.evaluate(() => !!document.querySelector('.ps-card'))
  resultados.push({ cenario: 'logado em outro servidor', estavaEmOutro: !!antes && antes !== servidor.id, entrouNoServidor: ativo === servidor.id, painelAindaAberto: painelAberto, salvou })
  await pagina.close()
}

await cenarioContaNova()
await cenarioMembroDeOutro()
await cenarioOutroServidor()
await navegador.close()
console.log(JSON.stringify(resultados, null, 1))
