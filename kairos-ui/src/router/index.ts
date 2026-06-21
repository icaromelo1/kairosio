import { createRouter, createWebHistory } from 'vue-router'
import LandingPage from '@/pages/LandingPage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import CharacterPage from '@/pages/CharacterPage.vue'
import MapSelectPage from '@/pages/MapSelectPage.vue'
import GamePage from '@/pages/GamePage.vue'
import LabPage from '@/pages/LabPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: LandingPage },
    { path: '/login', component: LoginPage },
    { path: '/character', component: CharacterPage },
    { path: '/map-select', component: MapSelectPage },
    { path: '/game', component: GamePage },
    { path: '/lab', component: LabPage },
  ],
})

export default router
