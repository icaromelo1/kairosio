import { test, expect, type Page } from '@playwright/test'

// Smoke: cada rota principal carrega e o cadastro leva ao jogo.

async function entrarComContaNova(page: Page) {
  const sufixo = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  await page.goto('/register')
  await page.locator('input[type="email"]').fill(`e2e-${sufixo}@teste.dev`)
  await page.locator('input.reg-user-input').fill(`e2e${sufixo}`)
  const senhas = page.locator('input[type="password"]')
  await senhas.nth(0).fill('segredo123')
  await senhas.nth(1).fill('segredo123')
  await page.locator('button:has-text("Cadastrar")').click()
  await expect(page).toHaveURL(/\/game(\?.*)?$/)
}

test('landing carrega', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('text=Kairos').first()).toBeVisible()
})

test('login tem email, senha e criar conta', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
  await expect(page.locator('text=Criar conta')).toBeVisible()
})

test('login nao oferece mais entrar como convidado', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('text=convidado')).toHaveCount(0)
})

test('cadastro carrega', async ({ page }) => {
  await page.goto('/register')
  await expect(page.locator('text=Cadastrar')).toBeVisible()
  await expect(page.locator('input[type="email"]')).toBeVisible()
})

test('feedback virou painel: a rota antiga cai no jogo com ele aberto', async ({ page }) => {
  await entrarComContaNova(page)

  await page.goto('/feedback')
  await expect(page).toHaveURL(/\/game(\?.*)?$/)
  await expect(page.locator('text=Relatar bug ou pedir melhoria')).toBeVisible()
})

test('rota interna sem sessao redireciona pro login', async ({ page }) => {
  await page.context().clearCookies()
  await page.goto('/game')
  await expect(page).toHaveURL(/\/login$/)
})

test('cadastro leva direto ao jogo', async ({ page }) => {
  await entrarComContaNova(page)
})

test('raiz com sessao cai no jogo, sem passar pela landing', async ({ page }) => {
  await entrarComContaNova(page)

  await page.goto('/')
  await expect(page).toHaveURL(/\/game(\?.*)?$/)
})

test('rotas removidas nao quebram', async ({ page }) => {
  await entrarComContaNova(page)

  await page.goto('/map-select')
  await expect(page).toHaveURL(/\/game(\?.*)?$/)
})
