import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Quasar } from 'quasar'
import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/src/css/index.sass'
import '@/assets/styles/tokens.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(Quasar, { plugins: {} })
app.mount('#app')

// B1: depois de clicar num botão com o mouse, tira o foco dele.
// Sem isso o botão fica focado e um Enter logo depois reativa a ação sem querer.
document.addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'mouse') return
  const btn = (e.target as HTMLElement | null)?.closest('button')
  if (!btn) return
  // espera o clique resolver antes de remover o foco
  setTimeout(() => {
    if (document.activeElement === btn) btn.blur()
  }, 0)
})
