<template>
  <div class="gp-root" :class="{ 'gp-sidebar-open': gameStore.sidebarOpen }">
    <aside class="gp-sidebar" :class="{ 'gp-sidebar-open': gameStore.sidebarOpen }">
      <ServerSidebar
        ref="sidebar"
        v-model:open="gameStore.sidebarOpen"
        :maps="mundos"
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
      <canvas ref="tela" class="gp-tela" />
      <div ref="camadaNomes" class="gp-nomes" />

      <div v-if="carregando" class="gp-aviso-centro k-card">
        <span class="k-chip">carregando</span>
        <p class="gp-aviso-texto">Montando o escritório…</p>
      </div>
      <div v-else-if="erroMundo" class="gp-aviso-centro k-card">
        <span class="k-chip">erro</span>
        <p class="gp-aviso-texto">{{ erroMundo }}</p>
      </div>

      <div v-if="salaAtual" class="gp-hud gp-sala">{{ salaAtual }}</div>

      <div v-if="interacao" class="gp-hud gp-agir">
        <span class="gp-agir-txt">aperte</span>
        <span class="k-key">E</span>
        <span class="gp-agir-txt gp-agir-acao">para {{ interacao.acao }}</span>
      </div>

      <div class="gp-canto-esq">
        <ChatHud />
      </div>

      <JukeboxPanel v-if="estacaoAberta?.estacao === 'jukebox'" :area-atual="salaAtualId" :jukebox-id="estacaoAberta.id" @close="closeModal" />
      <TaskPanel v-if="estacaoAberta?.estacao === 'tarefas'" :map-id="MAPA_ATUAL" :object-id="estacaoAberta.id" @close="closeModal" />
      <NotePanel v-if="estacaoAberta?.estacao === 'notas'" :map-id="MAPA_ATUAL" :object-id="estacaoAberta.id" @close="closeModal" />
      <WhiteboardPanel v-if="estacaoAberta?.estacao === 'lousa'" :object-id="estacaoAberta.id" @close="closeModal" />

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
        :maps="mundos"
        @close="closeModal"
        @jump="jumpToFriend"
        @changed="sidebar?.reloadFriendRequests()"
        @dm="openDm"
      />

      <div class="touch-ctl gp-touch">
        <span />
        <button class="tbtn" aria-label="andar para cima" @pointerdown.prevent="tocar('w')" @pointerup="soltar('w')" @pointerleave="soltar('w')"><PixelIcon name="chevron-up" size="1.25rem" /></button>
        <button class="tbtn" aria-label="interagir" @pointerdown.prevent="mundo?.interagir()">E</button>
        <button class="tbtn" aria-label="andar para a esquerda" @pointerdown.prevent="tocar('a')" @pointerup="soltar('a')" @pointerleave="soltar('a')"><PixelIcon name="chevron-left" size="1.25rem" /></button>
        <button class="tbtn" aria-label="acenar" @pointerdown.prevent="mundo?.gesto('acenar')"><PixelIcon name="hand" size="1.25rem" /></button>
        <button class="tbtn" aria-label="andar para a direita" @pointerdown.prevent="tocar('d')" @pointerup="soltar('d')" @pointerleave="soltar('d')"><PixelIcon name="chevron-right" size="1.25rem" /></button>
        <span />
        <button class="tbtn" aria-label="andar para baixo" @pointerdown.prevent="tocar('s')" @pointerup="soltar('s')" @pointerleave="soltar('s')"><PixelIcon name="chevron-down" size="1.25rem" /></button>
        <button class="tbtn" aria-label="dançar" @pointerdown.prevent="mundo?.gesto('dancar')"><PixelIcon name="music" size="1.25rem" /></button>
      </div>

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
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
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
import { MAPA_ATUAL, buscarMapa } from '@/services/mapa.api'
import { panelFromQuery, type GamePanel } from '@/services/postAuth'
import type { Mundo, Interacao } from '@/mundo/Mundo'
import type { Entrada } from '@/mundo/entrada'
import type { Estacao } from '@/mundo/tipos'
import ServerSidebar from '@/components/ServerSidebar.vue'
import ChatHud from '@/components/ChatHud.vue'
import PixelIcon from '@/components/PixelIcon.vue'
import ServersPanel from '@/components/ServersPanel.vue'
import AdminPanel from '@/components/AdminPanel.vue'
import FeedbackPanel from '@/components/FeedbackPanel.vue'
import FriendsPanel from '@/components/FriendsPanel.vue'
import JukeboxPanel from '@/components/JukeboxPanel.vue'
import TaskPanel from '@/components/TaskPanel.vue'
import NotePanel from '@/components/NotePanel.vue'
import WhiteboardPanel from '@/components/WhiteboardPanel.vue'

const router = useRouter()
const route = useRoute()
const gameStore = useGameStore()
const auth = useAuthStore()
media.loadPrefs(auth.userId)

const tela = ref<HTMLCanvasElement | null>(null)
const camadaNomes = ref<HTMLElement | null>(null)
const sidebar = ref<InstanceType<typeof ServerSidebar> | null>(null)
const mundo = shallowRef<Mundo | null>(null)
let entrada: Entrada | null = null

const panel = ref<GamePanel | null>(null)
const panelInvite = ref('')
const friendsOpen = ref(false)
const carregando = ref(true)
const erroMundo = ref('')
const mundos = ref<{ id: string; name: string }[]>([])
const interacao = ref<Interacao | null>(null)
const salaAtual = ref('')
const salaAtualId = ref<string | null>(null)
const estacaoAberta = ref<{ id: string; estacao: Estacao } | null>(null)
const playerName = computed(() => auth.username || 'Sem nome')

function pausarMundo(pausado: boolean) {
  if (entrada) entrada.pausada = pausado
}

function closeModal() {
  gameStore.isModalOpen = false
  panel.value = null
  panelInvite.value = ''
  friendsOpen.value = false
  estacaoAberta.value = null
  pausarMundo(false)
}

function openPanel(next: GamePanel, invite = '') {
  closeModal()
  panel.value = next
  panelInvite.value = invite
  gameStore.isModalOpen = true
  pausarMundo(true)
}

function openFriends() {
  closeModal()
  friendsOpen.value = true
  gameStore.isModalOpen = true
  pausarMundo(true)
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

function interagir() {
  const alvo = interacao.value
  if (alvo?.estacao) {
    closeModal()
    estacaoAberta.value = { id: alvo.movel.id, estacao: alvo.estacao }
    gameStore.isModalOpen = true
    pausarMundo(true)
    return
  }
  mundo.value?.interagir()
}

function tocar(tecla: string) {
  entrada?.apertar(tecla)
}

function soltar(tecla: string) {
  entrada?.soltar(tecla)
}

function entrarNaPresenca() {
  const local = mundo.value?.local
  connectPresence({ avatar: {}, map: MAPA_ATUAL, x: local?.x ?? 0, y: local?.y ?? 0 })
  sidebar.value?.syncPresence()
}

function onServerChanged() {
  disconnectPresence()
  chatMundo.splice(0)
  chatSala.splice(0)
  entrarNaPresenca()
  void sidebar.value?.reloadServers()
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeModal()
}

async function montarMundo() {
  if (!tela.value || !camadaNomes.value) return
  try {
    const [{ Mundo: ClasseMundo }, { Entrada: ClasseEntrada }, { AvatarCapsula }, mapa] = await Promise.all([
      import('@/mundo/Mundo'),
      import('@/mundo/entrada'),
      import('@/mundo/avatar'),
      buscarMapa(MAPA_ATUAL),
    ])
    mundos.value = [{ id: mapa.id, name: mapa.name }]
    entrada = new ClasseEntrada()
    const instancia = new ClasseMundo(tela.value, camadaNomes.value, {
      aoMudarInteracao: (alvo) => { interacao.value = alvo },
      aoMudarSala: (sala) => {
        salaAtual.value = sala && !sala.aberta ? sala.nome : ''
        salaAtualId.value = sala?.id ?? null
      },
    })
    instancia.direcaoDesejada = () => entrada!.direcao()
    entrada.aoTeclar('e', interagir)
    entrada.aoTeclar('g', () => instancia.gesto('acenar'))
    entrada.aoTeclar('b', () => instancia.gesto('dancar'))
    mundo.value = instancia
    await instancia.definirMapa(mapa)
    instancia.adicionarPessoa('eu', new AvatarCapsula(instancia.cena), playerName.value, instancia.local.x, instancia.local.y)
    entrarNaPresenca()
  } catch {
    erroMundo.value = 'Não deu pra montar o escritório. Recarregue a página.'
  } finally {
    carregando.value = false
  }
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

  void montarMundo()
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  entrada?.destruir()
  entrada = null
  mundo.value?.destruir()
  mundo.value = null
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

.gp-tela {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  outline: none;
  touch-action: none;
}

.gp-nomes {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.gp-nomes :deep(.mundo-nome) {
  position: absolute;
  left: 0;
  top: 0;
  padding: 0.125rem 0.375rem;
  background: var(--bg-2);
  border: 0.125rem solid var(--tinta);
  color: var(--text);
  font-size: 0.6875rem;
  font-weight: 700;
  white-space: nowrap;
  will-change: transform;
}

.gp-aviso-centro {
  position: absolute;
  top: 50%;
  left: calc(50% + var(--barra-larg) / 2);
  transform: translate(-50%, -50%);
  width: min(22rem, calc(100% - 2rem));
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.625rem;
  z-index: 5;
}

.gp-aviso-texto {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-2);
}

.gp-hud {
  position: absolute;
  z-index: 10;
}

.gp-sala {
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.375rem 0.75rem;
  background: var(--bg-1);
  border: 0.125rem solid var(--tinta);
  box-shadow: var(--ui-shadow);
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.gp-agir {
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-1);
  border: 0.125rem solid var(--tinta);
  box-shadow: var(--ui-shadow);
}

.gp-agir-txt {
  font-size: 0.8125rem;
  color: var(--text-2);
}

.gp-agir-acao { color: var(--accent-texto); font-weight: 700; }

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

.gp-touch {
  position: absolute;
  bottom: 5rem;
  right: 1.5rem;
  z-index: 20;
  display: grid;
  grid-template-columns: repeat(3, 2.75rem);
  grid-template-rows: repeat(3, 2.75rem);
  gap: 0.25rem;
  touch-action: none;
  user-select: none;
}

.tbtn {
  background: var(--bg-1);
  border: 0.125rem solid var(--tinta);
  color: var(--text);
  font-size: 1rem;
  font-weight: 700;
  display: grid;
  place-items: center;
  cursor: pointer;
  border-radius: 0.375rem;
  touch-action: none;
}

.tbtn:active { background: rgba(44, 116, 65, 0.32); }

@media (hover: hover) and (pointer: fine) {
  .touch-ctl { display: none !important; }
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

  .gp-aviso-centro { left: 50%; }
}
</style>
