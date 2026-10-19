<template>
  <div class="gp-root" :class="{ 'gp-sidebar-open': gameStore.sidebarOpen }">
    <aside class="gp-sidebar" :class="{ 'gp-sidebar-open': gameStore.sidebarOpen }">
      <ServerSidebar
        ref="sidebar"
        v-model:open="gameStore.sidebarOpen"
        :maps="[]"
        :current-map-id="MAPA_ATUAL"
        :player-name="playerName"
        :voice-on="false"
        :is-guest="auth.isGuest"
        @server-changed="onServerChanged"
        @open-panel="openPanel"
        @open-friends="openFriends"
        @open-dm="openDm()"
        @leave="leave"
      />
    </aside>

    <div class="gp-stage">
      <div class="gp-vazio k-card">
        <span class="k-chip">em reconstrução</span>
        <p class="gp-vazio-texto">O mundo está sendo refeito em Babylon.js. Conversas, amigos e servidores continuam funcionando.</p>
      </div>

      <div class="gp-canto-esq">
        <ChatHud />
      </div>

      <ServersPanel v-if="panel === 'servidores'" :invite="panelInvite" @close="closeModal" @server-changed="onServerChanged" />
      <AdminPanel
        v-if="panel === 'admin'"
        @close="closeModal"
        @server-changed="onServerChanged"
        @open-servers="openPanel('servidores')"
      />
      <FeedbackPanel v-if="panel === 'feedback'" @close="closeModal" />
      <FriendsPanel
        v-if="friendsOpen"
        :maps="[]"
        @close="closeModal"
        @jump="jumpToFriend"
        @changed="sidebar?.reloadFriendRequests()"
        @dm="openDm"
      />

      <div v-if="sessionKicked" class="gp-modal-overlay">
        <div class="k-card gp-modal-card column q-gutter-md">
          <div class="row items-center justify-between">
            <span class="k-chip">sessão encerrada</span>
          </div>
          <div>
            <h2 class="gp-modal-title">Você entrou em outro lugar</h2>
            <p class="gp-modal-subtitle">Sua conta só pode ficar ativa numa aba/dispositivo por vez.</p>
          </div>
          <button class="k-btn k-btn-primary full-width" @click="router.go(0)">Recarregar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '@/stores/useGameStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { logoutApi, me } from '@/services/auth.api'
import {
  chatMundo, chatSala, connectPresence, disconnectPresence, sessionKicked, syncDmUnread,
} from '@/services/presence'
import { media } from '@/services/media'
import { jukeboxAudio } from '@/services/jukeboxAudio'
import { getMyServers } from '@/services/server.api'
import { mostrarAviso } from '@/services/avisos'
import { panelFromQuery, type GamePanel } from '@/services/postAuth'
import ServerSidebar from '@/components/ServerSidebar.vue'
import ChatHud from '@/components/ChatHud.vue'
import ServersPanel from '@/components/ServersPanel.vue'
import AdminPanel from '@/components/AdminPanel.vue'
import FeedbackPanel from '@/components/FeedbackPanel.vue'
import FriendsPanel from '@/components/FriendsPanel.vue'

const MAPA_ATUAL = 'escritorio'

const router = useRouter()
const route = useRoute()
const gameStore = useGameStore()
const auth = useAuthStore()
media.loadPrefs(auth.userId)

const sidebar = ref<InstanceType<typeof ServerSidebar> | null>(null)
const panel = ref<GamePanel | null>(null)
const panelInvite = ref('')
const friendsOpen = ref(false)
const playerName = computed(() => auth.username || 'Sem nome')

function closeModal() {
  gameStore.isModalOpen = false
  panel.value = null
  panelInvite.value = ''
  friendsOpen.value = false
}

function openPanel(next: GamePanel, invite = '') {
  closeModal()
  panel.value = next
  panelInvite.value = invite
  gameStore.isModalOpen = true
}

function openFriends() {
  closeModal()
  friendsOpen.value = true
  gameStore.isModalOpen = true
}

function openDm(friendId = '') {
  closeModal()
  gameStore.sidebarOpen = true
  void sidebar.value?.abrirConversas(friendId || undefined)
}

function jumpToFriend(serverId: string, mapId: string) {
  closeModal()
  void sidebar.value?.jumpTo(serverId, mapId)
}

function entrar() {
  connectPresence({ avatar: {}, map: MAPA_ATUAL, x: 0, y: 0 })
  sidebar.value?.syncPresence()
}

function onServerChanged() {
  disconnectPresence()
  chatMundo.splice(0)
  chatSala.splice(0)
  entrar()
  void sidebar.value?.reloadServers()
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeModal()
}

async function leave() {
  disconnectPresence()
  await logoutApi()
  auth.logout()
  syncDmUnread([])
  jukeboxAudio.stop()
  router.push('/login')
}

onMounted(() => {
  const asked = panelFromQuery(route.query)
  const invite = route.query.invite
  if (asked) openPanel(asked, typeof invite === 'string' ? invite : '')
  if (asked || invite) void router.replace({ path: '/game' })

  me()
    .then((perfil) => {
      auth.setUsername(perfil.username ?? null)
      return getMyServers()
    })
    .then((lista) => {
      if (lista.length === 0 && !asked) openPanel('servidores')
    })
    .catch(() => mostrarAviso('Não deu pra carregar seus servidores. Recarregue a página.'))

  entrar()
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  void media.disconnect()
  disconnectPresence()
  jukeboxAudio.stop()
})
</script>

<style scoped>
.gp-root {
  --barra-larg: 3.5rem;
  height: 100vh;
  position: relative;
  background: var(--bg-0);
  overflow: hidden;
}

.gp-sidebar {
  position: absolute;
  left: 0.875rem;
  top: 0.875rem;
  bottom: 0.875rem;
  width: 3.5rem;
  z-index: 20;
  display: flex;
  min-width: 0;
  overflow: hidden;
  background: var(--bg-1);
  border: var(--ui-border-style);
  box-shadow: var(--contorno-duplo), var(--sombra-solida);
}

.gp-root.gp-sidebar-open { --barra-larg: 18rem; }
.gp-sidebar.gp-sidebar-open { width: 18rem; }

.gp-stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--bg-0);
}

.gp-vazio {
  position: absolute;
  top: 50%;
  left: calc(50% + var(--barra-larg) / 2);
  transform: translate(-50%, -50%);
  width: min(24rem, calc(100% - 2rem));
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.625rem;
}

.gp-vazio-texto {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-2);
  line-height: 1.5;
}

.gp-canto-esq {
  position: absolute;
  bottom: 0.875rem;
  left: calc(0.875rem + var(--barra-larg, 3.5rem) + 0.75rem);
  transition: left 0.2s ease;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  max-width: calc(100% - 2rem);
}

.gp-modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(0.375rem);
  display: grid;
  place-items: center;
  z-index: 50;
  padding: 1.5rem;
}

.gp-modal-card {
  padding: 1.75rem;
  width: min(32.5rem, 100%);
}

.gp-modal-title {
  margin: 0 0 0.375rem;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.gp-modal-subtitle {
  margin: 0;
  color: var(--text-3);
  font-size: 0.875rem;
}

@media (max-width: 48rem) {
  .gp-sidebar.gp-sidebar-open {
    left: 0;
    top: 0;
    bottom: 0;
    width: min(18rem, 80vw);
    z-index: 100;
    box-shadow: 0.5rem 0 1.5rem rgba(0, 0, 0, 0.5);
  }

  .gp-vazio { left: 50%; }
}
</style>
