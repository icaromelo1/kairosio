import { test, expect } from '@playwright/test'

// Smoke: cada rota principal carrega e o fluxo de convidado leva ao jogo.

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

test('cadastro carrega', async ({ page }) => {
  await page.goto('/register')
  await expect(page.locator('text=Cadastrar')).toBeVisible()
  await expect(page.locator('input[type="email"]')).toBeVisible()
})

test('feedback virou painel: a rota antiga cai no jogo com ele aberto', async ({ page }) => {
  await page.goto('/login')
  await page.locator('text=Continuar como convidado').click()
  await expect(page).toHaveURL(/\/game(\?.*)?$/)

  await page.goto('/feedback')
  await expect(page).toHaveURL(/\/game(\?.*)?$/)
  await expect(page.locator('text=Relatar bug ou pedir melhoria')).toBeVisible()
})

test('rota interna sem sessao redireciona pro login', async ({ page }) => {
  await page.context().clearCookies()
  await page.goto('/game')
  await expect(page).toHaveURL(/\/login$/)
})

test('fluxo convidado: login -> jogo direto', async ({ page }) => {
  await page.goto('/login')
  await page.locator('text=Continuar como convidado').click()

  // o convidado vai direto ao jogo: não passa mais por escolha de servidor nem
  // de mundo. Sem personagem salvo, o painel de personagem abre junto
  await expect(page).toHaveURL(/\/game(\?.*)?$/)
})

test('raiz com sessao cai no jogo, sem passar pela landing', async ({ page }) => {
  await page.goto('/login')
  await page.locator('text=Continuar como convidado').click()
  await expect(page).toHaveURL(/\/game(\?.*)?$/)

  await page.goto('/')
  await expect(page).toHaveURL(/\/game(\?.*)?$/)
})

test('rotas removidas nao quebram', async ({ page }) => {
  await page.goto('/login')
  await page.locator('text=Continuar como convidado').click()
  await expect(page).toHaveURL(/\/game(\?.*)?$/)

  await page.goto('/map-select')
  await expect(page).toHaveURL(/\/game(\?.*)?$/)
})
