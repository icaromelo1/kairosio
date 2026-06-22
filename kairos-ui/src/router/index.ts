import { createRouter, createWebHistory } from 'vue-router'
import LandingPage from '@/pages/LandingPage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import RegisterPage from '@/pages/RegisterPage.vue'
import CharacterPage from '@/pages/CharacterPage.vue'
import MapSelectPage from '@/pages/MapSelectPage.vue'
import GamePage from '@/pages/GamePage.vue'
import LabPage from '@/pages/LabPage.vue'
import FeedbackPage from '@/pages/FeedbackPage.vue'
import EditorPage from '@/pages/EditorPage.vue'
import OnboardingPage from '@/pages/OnboardingPage.vue'
import AdminPage from '@/pages/AdminPage.vue'
import { useAuthStore } from '@/stores/useAuthStore'
import { setPendingInvite } from '@/services/org.api'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: LandingPage },
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
    { path: '/map-select', component: MapSelectPage, meta: { requiresAuth: true } },
    { path: '/game', component: GamePage, meta: { requiresAuth: true } },
    { path: '/editor/:id', component: EditorPage, meta: { requiresAuth: true } },
    { path: '/lab', component: LabPage },
    { path: '/feedback', component: FeedbackPage },
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
