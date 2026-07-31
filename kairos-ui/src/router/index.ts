import { createRouter, createWebHistory } from 'vue-router'
import LandingPage from '@/pages/LandingPage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import RegisterPage from '@/pages/RegisterPage.vue'
import CharacterPage from '@/pages/CharacterPage.vue'
import GamePage from '@/pages/GamePage.vue'
import FeedbackPage from '@/pages/FeedbackPage.vue'
import EditorPage from '@/pages/EditorPage.vue'
import OnboardingPage from '@/pages/OnboardingPage.vue'
import AdminPage from '@/pages/AdminPage.vue'
import { useAuthStore } from '@/stores/useAuthStore'
import { setPendingInvite } from '@/services/server.api'

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
    // link de convite: guarda o código e encaminha (já logado → onboarding; senão → login)
    {
      path: '/join/:code',
      beforeEnter: (to) => {
        const code = String(to.params.code || '')
        setPendingInvite(code)
        if (useAuthStore().isAuthenticated) return { path: '/onboarding', query: { invite: code } }
        return { path: '/login' }
      },
      // componente nunca renderiza (sempre redireciona), mas a rota exige um
      component: OnboardingPage,
    },
    { path: '/onboarding', component: OnboardingPage, meta: { requiresAuth: true } },
    { path: '/admin', component: AdminPage, meta: { requiresAuth: true } },
    { path: '/character', component: CharacterPage, meta: { requiresAuth: true } },
    // a escolha de mundo virou a barra lateral do jogo — a rota sobrevive só pra não
    // quebrar link salvo no favorito de quem usava
    { path: '/map-select', redirect: '/game' },
    { path: '/game', component: GamePage, meta: { requiresAuth: true } },
    { path: '/editor/:id', component: EditorPage, meta: { requiresAuth: true } },
    { path: '/feedback', component: FeedbackPage },
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
