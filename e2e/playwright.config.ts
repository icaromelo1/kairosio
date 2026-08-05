import { defineConfig, devices } from '@playwright/test'

// Roda contra o ambiente publicado por padrão; sobrescreva com KAIROS_URL.
const baseURL = process.env.KAIROS_URL || 'https://icaromelodev.com.br/kairos'

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 8000 },
  retries: 1,
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
      },
    },
  ],
})
