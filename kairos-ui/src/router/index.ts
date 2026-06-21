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

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: LandingPage },
    { path: '/login', component: LoginPage },
    { path: '/register', component: RegisterPage },
    { path: '/character', component: CharacterPage },
    { path: '/map-select', component: MapSelectPage },
    { path: '/game', component: GamePage },
    { path: '/lab', component: LabPage },
    { path: '/feedback', component: FeedbackPage },
    { path: '/editor/:id', component: EditorPage },
  ],
})

export default router
