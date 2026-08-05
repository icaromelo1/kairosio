import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const API = process.env.KAIROS_API || 'https://icaromelodev.com.br/kairos-api'
const APP = process.env.KAIROS_URL || 'https://icaromelodev.com.br/kairos'

const SENHA = 'e2e-midia-9f3a1c'

interface Conta {
  email: string
  username: string
  token: string
}

async function criarConta(sufixo: string): Promise<Conta> {
  const marca = `${Date.now().toString(36)}${sufixo}`
  const email = `midia.${marca}@e2e.local`
  const username = `midia${marca}`

  const registro = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: SENHA, username }),
  })
  if (!registro.ok) throw new Error(`registro falhou (${registro.status}): ${await registro.text()}`)
  const { token } = (await registro.json()) as { token: string }

  const personagem = await fetch(`${API}/character`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: username }),
  })
  if (!personagem.ok) throw new Error(`personagem falhou (${personagem.status}): ${await personagem.text()}`)

  return { email, username, token }
}

async function espionarWebrtc(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const original = window.RTCPeerConnection
    const coletadas: RTCPeerConnection[] = []
    ;(window as unknown as { __pcs: RTCPeerConnection[] }).__pcs = coletadas
    class Espiao extends original {
      constructor(...args: ConstructorParameters<typeof RTCPeerConnection>) {
        super(...args)
        coletadas.push(this)
      }
    }
    window.RTCPeerConnection = Espiao as unknown as typeof RTCPeerConnection
  })
}

async function entrar(page: Page, conta: Conta): Promise<void> {
  await page.addInitScript((token) => localStorage.setItem('kairos_token', token), conta.token)
  await page.goto(`${APP}/game`)
  await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 })
}

interface Fluxo {
  entrada: number
  saida: number
  candidatoAtivo: boolean
  conexoes: number
}

async function medirFluxo(page: Page): Promise<Fluxo> {
  return await page.evaluate(async () => {
    const pcs = (window as unknown as { __pcs?: RTCPeerConnection[] }).__pcs || []
    let entrada = 0
    let saida = 0
    let candidatoAtivo = false
    for (const pc of pcs) {
      const stats = await pc.getStats()
      stats.forEach((s: Record<string, unknown>) => {
        if (s.type === 'inbound-rtp' && s.kind === 'audio') entrada += (s.bytesReceived as number) || 0
        if (s.type === 'outbound-rtp' && s.kind === 'audio') saida += (s.bytesSent as number) || 0
        if (s.type === 'candidate-pair' && s.state === 'succeeded') candidatoAtivo = true
      })
    }
    return { entrada, saida, candidatoAtivo, conexoes: pcs.length }
  })
}

async function aguardar<T>(ler: () => Promise<T>, pronto: (v: T) => boolean, limiteMs: number): Promise<T> {
  const fim = Date.now() + limiteMs
  let ultimo = await ler()
  while (Date.now() < fim) {
    if (pronto(ultimo)) return ultimo
    await new Promise((r) => setTimeout(r, 1000))
    ultimo = await ler()
  }
  return ultimo
}

async function vozNoAr(page: Page): Promise<boolean> {
  const voz = page.locator('.ss-voice')
  if (!(await voz.count())) return false
  return await voz.evaluate((el) => !el.classList.contains('ss-voice-down'))
}

async function abrirMicrofone(page: Page): Promise<void> {
  const botaoEntrar = page.locator('.ss-voice-join')
  if (await botaoEntrar.count()) await botaoEntrar.click()
  await aguardar(() => vozNoAr(page), (v) => v, 30000)
  const mic = page.locator('.ss-foot-ctrls .ss-ctrl').first()
  if (await mic.evaluate((el) => el.classList.contains('ss-ctrl-off'))) await mic.click()
}

test.describe('sessão de mídia entre dois navegadores', () => {
  test.describe.configure({ mode: 'serial' })

  let alice: Conta
  let bob: Conta

  test.beforeAll(async () => {
    alice = await criarConta('a')
    bob = await criarConta('b')
  })

  test('dois clientes no mesmo mundo trocam áudio de verdade pelo SFU', async ({ browser }, info) => {
    test.setTimeout(180000)
    const solo = process.env.KAIROS_E2E_SOLO === '1'

    const ctxA = await browser.newContext({ permissions: ['microphone'] })
    const ctxB = await browser.newContext({ permissions: ['microphone'] })
    await espionarWebrtc(ctxA)
    await espionarWebrtc(ctxB)

    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    try {
      await entrar(pageA, alice)
      await entrar(pageB, bob)

      await abrirMicrofone(pageA)
      if (!solo) await abrirMicrofone(pageB)

      expect(await vozNoAr(pageA), 'voz do cliente A no ar').toBe(true)
      if (!solo) expect(await vozNoAr(pageB), 'voz do cliente B no ar').toBe(true)

      const fluxoA = await aguardar(() => medirFluxo(pageA), (f) => f.entrada > 0 && f.saida > 0, 60000)
      const fluxoB = await medirFluxo(pageB)

      await info.attach('fluxo-medido.json', {
        contentType: 'application/json',
        body: Buffer.from(JSON.stringify({ solo, a: fluxoA, b: fluxoB }, null, 2)),
      })

      expect(fluxoA.conexoes, 'A abriu conexão WebRTC').toBeGreaterThan(0)
      expect(fluxoA.candidatoAtivo, 'A negociou par de candidatos ICE').toBe(true)
      expect(fluxoB.candidatoAtivo, 'B negociou par de candidatos ICE').toBe(true)
      expect(fluxoA.saida, 'A publicou áudio').toBeGreaterThan(0)
      expect(fluxoB.saida, 'B publicou áudio').toBeGreaterThan(0)
      expect(fluxoA.entrada, 'A recebeu áudio do SFU').toBeGreaterThan(0)
      expect(fluxoB.entrada, 'B recebeu áudio do SFU').toBeGreaterThan(0)
    } finally {
      await ctxA.close()
      await ctxB.close()
    }
  })
})
