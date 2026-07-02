import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue({ template: { transformAssetUrls } }),
    quasar({ sassVariables: false }),
  ],
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
