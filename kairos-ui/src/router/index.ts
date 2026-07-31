import { createRouter, createWebHistory } from 'vue-router'
import LandingPage from '@/pages/LandingPage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import RegisterPage from '@/pages/RegisterPage.vue'
import GamePage from '@/pages/GamePage.vue'
import EditorPage from '@/pages/EditorPage.vue'
import { useAuthStore } from '@/stores/useAuthStore'
import { setPendingInvite } from '@/services/server.api'
import { PANEL_QUERY, type GamePanel } from '@/services/postAuth'

// servidores, personagem, administração e feedback viraram painel sobre o jogo.
// As rotas antigas sobrevivem como atalho (favorito, link velho) e chegam no jogo
// já com o painel aberto.
function gameWithPanel(panel: GamePanel, invite?: string) {
  return { path: '/game', query: { [PANEL_QUERY]: panel, ...(invite ? { invite } : {}) } }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // quem já tem sessão nunca chega a ver a landing: o jogo é a tela única
    {
      path: '/',
      component: LandingPage,
      beforeEnter: () => (useAuthStore().isAuthenticated ? { path: '/game' } : true),
    },
    { path: '/login', component: LoginPage },
    { path: '/register', component: RegisterPage },
    // link de convite: guarda o código (sobrevive ao login e ao cadastro) e encaminha
    {
      path: '/join/:code',
      redirect: (to) => {
        const code = String(to.params.code || '')
        setPendingInvite(code)
        if (!useAuthStore().isAuthenticated) return { path: '/login' }
        return gameWithPanel('servidores', code)
      },
    },
    {
      path: '/onboarding',
      redirect: (to) => gameWithPanel('servidores', typeof to.query.invite === 'string' ? to.query.invite : undefined),
    },
    { path: '/character', redirect: () => gameWithPanel('personagem') },
    { path: '/admin', redirect: () => gameWithPanel('admin') },
    { path: '/feedback', redirect: () => gameWithPanel('feedback') },
    // a escolha de mundo virou a barra lateral do jogo — a rota sobrevive só pra não
    // quebrar link salvo no favorito de quem usava
    { path: '/map-select', redirect: '/game' },
    { path: '/game', component: GamePage, meta: { requiresAuth: true } },
    { path: '/editor/:id', component: EditorPage, meta: { requiresAuth: true } },
    // rota morta (o /lab saiu daqui) não pode virar tela em branco: cai na raiz, que decide
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// telas internas exigem sessão (login ou convidado)
router.beforeEach((to) => {
  if (to.meta.requiresAuth && !useAuthStore().isAuthenticated) {
    return { path: '/login' }
  }
  return true
})

export default router
