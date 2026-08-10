import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue({ template: { transformAssetUrls } }),
    quasar({ sassVariables: false }),
  ],
  build: {
    // O Pixi carrega os sprites por URL e infere o formato pela extensão. Asset
    // inlinado vira data URI sem extensão, o loader devolve undefined e o
    // Assets.load estoura com "reading 'source'" — derrubando o carregamento
    // inteiro e deixando o mundo sem nenhuma textura. Zero desliga o inline.
    assetsInlineLimit: 0,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // dev local: em produção o Traefik faz esse stripprefix na frente do kairos-api real
    proxy: {
      '/kairos-api': {
        target: 'http://localhost:3100',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/kairos-api/, ''),
      },
    },
  },
})
