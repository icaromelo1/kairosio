import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '@/pages/LoginPage.vue'
import CharacterPage from '@/pages/CharacterPage.vue'
import MapSelectPage from '@/pages/MapSelectPage.vue'
import GamePage from '@/pages/GamePage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/login' },
    { path: '/login', component: LoginPage },
    { path: '/character', component: CharacterPage },
    { path: '/map-select', component: MapSelectPage },
    { path: '/game', component: GamePage },
  ],
})

export default router
