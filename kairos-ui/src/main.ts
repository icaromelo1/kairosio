import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Quasar } from 'quasar'
import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/src/css/index.sass'
import '@/assets/styles/tokens.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)

const pinia = createPinia()
// persiste a customização do personagem no localStorage (sobrevive a reload)
pinia.use(({ store }) => {
  if (store.$id !== 'character') return
  const saved = localStorage.getItem('kairos_character')
  if (saved) {
    try {
      store.$patch(JSON.parse(saved))
    } catch {
      // ignora json inválido
    }
  }
  store.$subscribe((_mutation, state) => {
    localStorage.setItem('kairos_character', JSON.stringify(state))
  })
})
app.use(pinia)
app.use(router)
app.use(Quasar, { plugins: {} })
app.mount('#app')
