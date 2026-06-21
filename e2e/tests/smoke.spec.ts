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

test('feedback carrega', async ({ page }) => {
  await page.goto('/feedback')
  await expect(page.locator('text=Feedback').first()).toBeVisible()
})

test('rota interna sem sessao redireciona pro login', async ({ page }) => {
  await page.context().clearCookies()
  await page.goto('/game')
  await expect(page).toHaveURL(/\/login$/)
})

test('fluxo convidado: login -> personagem -> mundos -> jogo', async ({ page }) => {
  await page.goto('/login')
  await page.locator('text=Continuar como convidado').click()
  await expect(page).toHaveURL(/\/character$/)

  await page.locator('text=Entrar no Kairos').click()
  await expect(page).toHaveURL(/\/map-select$/)

  // entra no primeiro mundo
  await page.locator('text=Entrar →').first().click()
  await expect(page).toHaveURL(/\/game$/)
  await expect(page.locator('text=online')).toBeVisible()
})
