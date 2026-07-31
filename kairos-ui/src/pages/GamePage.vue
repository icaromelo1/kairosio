<template>
  <div class="gp-root" :class="{ 'gp-sidebar-open': gameStore.sidebarOpen }">
    <!-- Sidebar: servidores + mundos + pessoas (navegar não conecta) -->
    <aside class="gp-sidebar" :class="{ 'gp-sidebar-open': gameStore.sidebarOpen }">
      <ServerSidebar
        ref="sidebar"
        v-model:open="gameStore.sidebarOpen"
        :maps="maps"
        :current-map-id="currentId"
        :player-name="playerName"
        :look="look"
        :voice-on="voiceOn"
        :can-edit-current-world="!!currentMap && currentMap.ownerId === auth.userId"
        :is-guest="auth.isGuest"
        @select-world="selectMap"
        @server-changed="onServerChanged"
        @open-media="openMediaStage"
        @open-panel="openPanel"
        @open-friends="openFriends"
        @join-voice="joinVoice"
        @leave="leave"
      />
    </aside>

    <!-- Stage (PixiJS) -->
    <div class="gp-stage">
      <div
        ref="host" class="gp-canvas-host"
        :class="panMode ? (panDragging ? 'gp-cursor-grabbing' : 'gp-cursor-grab') : 'gp-cursor-default'"
        @wheel.prevent="onWheel"
        @pointerdown="onPanDown" @pointermove="onPanMove" @pointerup="onPanUp" @pointerleave="onPanUp"
        @contextmenu.prevent
      />
      <!-- HUD top-left -->
      <div class="gp-hud gp-hud-topleft row items-center q-gutter-sm">
        <div class="gp-avatar-box">
          <PixelAvatar :scale="1.6" v-bind="look" :shadow="false" />
        </div>
        <div class="column gp-hud-tight">
          <span class="gp-hud-name">{{ playerName }}</span>
          <span class="gp-hud-mapname">● {{ currentMap?.name || '…' }}</span>
        </div>
      </div>

      <!-- Proximidade + voz -->
      <div v-if="nearby" class="gp-hud gp-nearby">
        perto de <strong>{{ nearby }}</strong>
      </div>

      <!-- Aviso de transmissão: vive AQUI e não no MediaStage porque alcança
           todo mundo do mapa, inclusive quem nunca abriu a janela de voz. Sem
           pointer-events e sem nada focável — o WASD segue respondendo. -->
      <div v-if="screenNotices.length" class="gp-screen-notices" aria-live="polite">
        <span v-for="notice in screenNotices" :key="notice.id" class="gp-screen-notice">
          <PixelIcon name="monitor" size="0.75rem" />
          <b>{{ notice.name }}</b> começou a compartilhar a tela
        </span>
      </div>

      <!-- Chat -->
      <div class="gp-chat">
        <div v-if="messages.length" ref="chatLog" class="gp-chat-log" @scroll="onChatScroll">
          <div v-for="(m, i) in messages" :key="i" class="gp-chat-msg">
            <span class="gp-chat-name">{{ m.name }}:</span>
            <span class="gp-chat-text"> {{ m.text }}</span>
          </div>
        </div>
        <div class="gp-chat-field">
          <div class="gp-chat-foot">
            <button v-if="chatUnread" class="gp-chat-jump" @click="scrollChatToEnd">novas mensagens ↓</button>
            <span
              v-if="chatInput.length > CHAT_COUNT_FROM"
              class="gp-chat-count"
              :class="{ 'gp-chat-count-max': chatInput.length >= CHAT_MAX_LEN }"
            >{{ chatInput.length }}/{{ CHAT_MAX_LEN }}</span>
          </div>
          <input
            v-model="chatInput" :maxlength="CHAT_MAX_LEN" placeholder="Conversar… (Enter)"
            class="gp-chat-input"
            @keydown.enter="sendChat"
          />
          <span v-if="chatCooldown" class="gp-chat-cooldown" />
        </div>
      </div>

      <!-- HUD bottom -->
      <div class="gp-hud gp-hud-bottom row items-center q-gutter-md">
        <span class="row items-center q-gutter-xs"><span class="k-key">W</span><span class="k-key">A</span><span class="k-key">S</span><span class="k-key">D</span><span class="gp-hud-hint">mover</span></span>
        <span class="gp-hud-sep">·</span>
        <span class="row items-center q-gutter-xs"><span class="k-key">B</span><span class="gp-hud-hint">dançar</span></span>
        <span class="gp-hud-sep">·</span>
        <span class="row items-center q-gutter-xs"><span class="k-key">G</span><span class="gp-hud-hint">acenar</span></span>
        <span class="gp-hud-sep">·</span>
        <span class="row items-center q-gutter-xs"><span class="k-key">V</span><span class="gp-hud-hint">voz</span></span>
        <template v-if="activeZone">
          <span class="gp-hud-sep">·</span>
          <span class="row items-center q-gutter-xs"><span class="k-key">E</span><span class="gp-hud-action">{{ activeZone.action }}</span></span>
        </template>
      </div>

      <!-- Modal de interação -->
      <div v-if="gameStore.isModalOpen && activeModal" class="gp-modal-overlay" @click="closeModal">
        <div class="k-card gp-modal-card column q-gutter-md" @click.stop>
          <div class="row items-center justify-between">
            <span class="k-chip">interação</span>
            <button class="k-btn k-btn-ghost gp-modal-close" @click="closeModal">esc<PixelIcon name="close" size="0.75rem" /></button>
          </div>
          <div>
            <h2 class="gp-modal-title">{{ activeModal.name }}</h2>
            <p class="gp-modal-subtitle">{{ activeModal.action }}</p>
          </div>
          <div class="gp-modal-body">
            Em breve. Esta estação será conectada à sua ferramenta ({{ activeModal.kind }}).
          </div>
        </div>
      </div>

      <!-- Sala de voz/vídeo (janela flutuante sobre o mapa) -->
      <MediaStage
        v-if="mediaStageOpen"
        ref="mediaStage"
        :self-name="playerName"
        :self-look="look"
        :peer-looks="peerLooks"
        :mode="voiceMode"
        :connecting="voiceConnecting"
        @close="mediaStageOpen = false"
        @connect="joinVoice"
        @leave="leaveVoice"
        @reconnect="reconnectVoice"
        @set-mode="setVoiceModeUi"
      />

      <!-- Painel do jukebox -->
      <JukeboxPanel v-if="jukeboxOpen" @close="closeModal" />

      <TaskPanel v-if="taskOpen" :map-id="currentId" :object-id="taskObjectId" @close="closeModal" />
      <NotePanel v-if="noteOpen" :map-id="currentId" :object-id="noteObjectId" @close="closeModal" />
      <WhiteboardPanel v-if="boardOpen" :object-id="boardObjectId" @close="closeModal" />

      <!-- Telas que viraram painel: uma por vez, sempre sobre o mapa rodando -->
      <ServersPanel v-if="panel === 'servidores'" :invite="panelInvite" @close="closeModal" @server-changed="onServerChanged" />
      <CharacterPanel v-if="panel === 'personagem'" @close="closeModal" />
      <AdminPanel
        v-if="panel === 'admin'"
        @close="closeModal"
        @server-changed="onServerChanged"
        @open-servers="openPanel('servidores')"
      />
      <FeedbackPanel v-if="panel === 'feedback'" @close="closeModal" />
      <FriendsPanel
        v-if="friendsOpen"
        :maps="maps"
        @close="closeModal"
        @jump="jumpToFriend"
        @changed="sidebar?.reloadFriendRequests()"
      />

      <!-- Controles touch (mobile) -->
      <div class="touch-ctl gp-touch-ctl">
        <span></span>
        <button class="tbtn" aria-label="andar para cima" @pointerdown.prevent="pressKey('w')" @pointerup="releaseKey('w')" @pointerleave="releaseKey('w')"><PixelIcon name="chevron-up" size="1.25rem" /></button>
        <span></span>
        <button class="tbtn" aria-label="andar para a esquerda" @pointerdown.prevent="pressKey('a')" @pointerup="releaseKey('a')" @pointerleave="releaseKey('a')"><PixelIcon name="chevron-left" size="1.25rem" /></button>
        <button class="tbtn" aria-label="dançar" @pointerdown.prevent="dancing = !dancing"><PixelIcon name="music" size="1.25rem" /></button>
        <button class="tbtn" aria-label="andar para a direita" @pointerdown.prevent="pressKey('d')" @pointerup="releaseKey('d')" @pointerleave="releaseKey('d')"><PixelIcon name="chevron-right" size="1.25rem" /></button>
        <span></span>
        <button class="tbtn" aria-label="andar para baixo" @pointerdown.prevent="pressKey('s')" @pointerup="releaseKey('s')" @pointerleave="releaseKey('s')"><PixelIcon name="chevron-down" size="1.25rem" /></button>
        <button class="tbtn" aria-label="acenar" @pointerdown.prevent="emote()"><PixelIcon name="hand" size="1.25rem" /></button>
      </div>

      <div v-if="error" class="gp-error">{{ error }}</div>

      <!-- Sessão aberta em outra aba/dispositivo -->
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
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGameStore } from '@/stores/useGameStore'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { logoutApi } from '@/services/auth.api'
import { MapScene } from '@/game/pixi/scene'
import { AvatarPuppet, sanitizeLook, type AvatarLook, type Facing } from '@/game/pixi/avatar'
import { isSolid, interactableObjects, type MapDef, type MapObject } from '@/game/maps'
import { fetchMaps } from '@/services/maps.api'
import { getWorldState, saveWorldState } from '@/services/world.api'
import { connectPresence, disconnectPresence, emitMove, switchMap, remotePlayers, chatMessages, emitChat, jukeboxState, voiceMode, emitVoiceSetMode, emitScreenShare, onScreenShare, sessionKicked, type AvatarProps, type ScreenShareState } from '@/services/presence'
import { media } from '@/services/media'
import { jukeboxAudio } from '@/services/jukeboxAudio'
import { photoUrl } from '@/services/character.api'
import { panelFromQuery, type GamePanel } from '@/services/postAuth'
import PixelAvatar from '@/components/pixel/PixelAvatar.vue'
import JukeboxPanel from '@/components/JukeboxPanel.vue'
import MediaStage from '@/components/MediaStage.vue'
import ServerSidebar from '@/components/ServerSidebar.vue'
import PixelIcon from '@/components/PixelIcon.vue'
import TaskPanel from '@/components/TaskPanel.vue'
import NotePanel from '@/components/NotePanel.vue'
import WhiteboardPanel from '@/components/WhiteboardPanel.vue'
import ServersPanel from '@/components/ServersPanel.vue'
import CharacterPanel from '@/components/CharacterPanel.vue'
import AdminPanel from '@/components/AdminPanel.vue'
import FeedbackPanel from '@/components/FeedbackPanel.vue'
import FriendsPanel from '@/components/FriendsPanel.vue'

const router = useRouter()
const route = useRoute()
const gameStore = useGameStore()
const characterStore = useCharacterStore()
const auth = useAuthStore()
// antes de qualquer filho montar: o rodapé da barra lateral desenha o estado do
// microfone já na primeira pintura, e o da conta anterior não vale pra esta
media.loadPrefs(auth.userId)
let stateTimer = 0

function persistState() {
  if (auth.isAuthenticated && currentId.value) {
    saveWorldState({ activeMap: currentId.value, playerX: pos.x, playerY: pos.y })
  }
}

const host = ref<HTMLElement | null>(null)
const sidebar = ref<InstanceType<typeof ServerSidebar> | null>(null)
const maps = ref<MapDef[]>([])
const currentId = ref('')
const error = ref('')
const activeZone = ref<MapObject | null>(null)
const activeModal = ref<MapObject | null>(null)
const jukeboxOpen = ref(false)
const taskOpen = ref(false)
const taskObjectId = ref('')
const noteOpen = ref(false)
const noteObjectId = ref('')
const boardOpen = ref(false)
const boardObjectId = ref('')
// telas que viraram painel (barra lateral / ?abrir=): uma por vez
const panel = ref<GamePanel | null>(null)
const panelInvite = ref('')
// amigos fica fora do GamePanel: nenhuma rota antiga leva a ele e a entrada nunca
// o escolhe sozinha, então não entra no vocabulário do ?abrir=
const friendsOpen = ref(false)
const JUKEBOX_RADIUS = 6 // tiles — alcance do modo "proximidade"

const look = computed<AvatarLook>(() => ({
  hairStyle: characterStore.hairStyle,
  hairColor: characterStore.hairColor,
  skin: characterStore.skin,
  topColor: characterStore.topColor,
  pantsColor: characterStore.pantsColor,
  accessory: characterStore.accessory,
}))
// URL pública da foto (mesma pra todo mundo) — vai junto no avatar broadcast pro resto da sala
const myPhotoUrl = computed(() => (characterStore.photoFile ? photoUrl(characterStore.photoFile) : null))
const joinAvatarPayload = computed(() => ({ ...look.value, photoUrl: myPhotoUrl.value }))
const playerName = computed(() => characterStore.name || 'Convidado')
const currentMap = computed(() => maps.value.find((m) => m.id === currentId.value))
const roomPeers = computed(() => [...remotePlayers.values()].filter((p) => !p.map || p.map === currentId.value))

let scene: MapScene | null = null
const pos = reactive({ x: 11, y: 9 })
let facing: Facing = 'down'
let dancing = false as boolean
let sitting = false
let preSit: { x: number; y: number } | null = null
const keys = new Set<string>()
const chatInput = ref('')
const nearby = ref<string | null>(null)
let emoteUntil = 0
const messages = chatMessages
const CHAT_MAX_LEN = 255
const CHAT_COUNT_FROM = 200
const CHAT_COOLDOWN_MS = 500
const CHAT_BOTTOM_SLACK = 24
const chatLog = ref<HTMLElement | null>(null)
const chatCooldown = ref(false)
const chatUnread = ref(false)
let chatCooldownTimer = 0
const voiceOn = computed(() => media.state.connected)
const voiceConnecting = computed(() => media.state.connecting)
// "estou sendo ouvido de verdade" — nem estar na sala nem a preferência bastam
const mediaStageOpen = ref(false)
const mediaStage = ref<InstanceType<typeof MediaStage> | null>(null)
// tudo daqui pra baixo que fala com a mídia é chaveado por userId (identity do
// LiveKit), nunca por socket.id — este continua sendo a chave de avatar/posição
// look dos participantes vem da presença (o LiveKit só conhece identity e nome)
const peerLooks = computed(() => {
  const out: Record<string, { name: string; look: AvatarLook }> = {}
  for (const p of roomPeers.value) {
    if (!p.userId) continue
    out[p.userId] = { name: p.name, look: sanitizeLook(p.avatar) }
  }
  return out
})

// ---- aviso de transmissão de tela (socket, não LiveKit) ----
const SCREEN_NOTICE_MS = 6000
const screenNotices = ref<{ id: number; userId: string; name: string }[]>([])
const screenNoticeTimers = new Set<number>()
let screenNoticeSeq = 0
let offScreenShare: (() => void) | null = null

function dropScreenNotice(id: number) {
  const index = screenNotices.value.findIndex((n) => n.id === id)
  if (index >= 0) screenNotices.value.splice(index, 1)
}

function onScreenShareState(state: ScreenShareState) {
  // o próprio anúncio volta pelo broadcast da sala: quem compartilhou já sabe
  if (state.userId && state.userId === auth.userId) return
  if (!state.on) {
    // parou antes do aviso expirar — some agora em vez de seguir mentindo
    for (const notice of screenNotices.value.filter((n) => n.userId === state.userId)) dropScreenNotice(notice.id)
    return
  }
  const id = ++screenNoticeSeq
  screenNotices.value.push({ id, userId: state.userId, name: state.name || 'alguém' })
  const timer = window.setTimeout(() => {
    screenNoticeTimers.delete(timer)
    dropScreenNotice(id)
  }, SCREEN_NOTICE_MS)
  screenNoticeTimers.add(timer)
}

// uma fonte só pro anúncio: a transição de screenOn cobre parar pela UI, parar
// pela barra do navegador e cair a conexão
watch(() => media.state.screenOn, (on) => emitScreenShare(on))

function openMediaStage() {
  mediaStageOpen.value = true
  void nextTick(() => mediaStage.value?.restore())
}

// fechar a janela em chamada esconderia um microfone aberto: com voz ativa o
// atalho minimiza (a tira segue mostrando quem fala) e só fecha desconectado
function toggleMediaStage() {
  if (!mediaStageOpen.value) {
    openMediaStage()
    return
  }
  if (voiceOn.value) {
    mediaStage.value?.toggleMinimized()
    return
  }
  mediaStageOpen.value = false
}

// sair da chamada é uma decisão explícita: vale até a pessoa pedir a voz de
// volta, senão a próxima troca de mundo a reconectaria sozinha
let voiceOptOut = false

// Mídia NUNCA segura a entrada no mundo: microfone negado, token recusado ou
// rede fora do ar só mudam o que o rodapé da barra lateral mostra. Por isso
// nada aqui escreve em `error`, que é o aviso do meio da tela.
async function enterVoice(mapId: string, serverChanged = false): Promise<void> {
  if (!mapId || voiceOptOut) return
  // trocar de servidor sem trocar de mundo mantém o mapId e muda a sala (o nome
  // dela é `${serverId}:${mapId}`): só o reconnect explícito tira da sala velha
  // — inclusive quando a conexão com o servidor anterior ainda está subindo
  if (serverChanged && (media.state.connected || media.state.connecting)) {
    await media.reconnect(mapId)
    return
  }
  await media.connect(mapId)
}

function joinVoice() {
  voiceOptOut = false
  void enterVoice(currentId.value)
}

async function leaveVoice() {
  voiceOptOut = true
  await media.disconnect()
}

async function reconnectVoice() {
  if (voiceConnecting.value) return
  voiceOptOut = false
  await media.reconnect(currentId.value)
}

function setVoiceModeUi(mode: 'proximity' | 'room') {
  emitVoiceSetMode(mode)
}
const lastSent = { facing: 'down' as Facing, pose: 'idle' as 'idle' | 'walk' | 'dance' | 'wave' | 'sit', boost: false }
// ids dos avatares remotos presentes na cena
const peerIds = new Set<string>()

function onKeyDown(e: KeyboardEvent) {
  // digitando no chat/inputs → não mexe no jogo
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  const k = e.key.toLowerCase()
  if (e.key === ' ' || e.code === 'Space') {
    // Espaço entra no modo olhar (pan) — não rola a página nem reativa botão
    e.preventDefault()
    panMode.value = true
    return
  }
  // atalho da sala de voz não pode engolir Cmd/Ctrl+V (colar) nem Alt+V
  const voiceKey = k === 'v' && !e.ctrlKey && !e.metaKey && !e.altKey
  if (voiceKey || ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'e', 'b', 'g', 'escape'].includes(k)) e.preventDefault()
  if (k === 'e') { tryInteract(); return }
  if (k === 'b') { dancing = !dancing; return }
  if (k === 'g') { emote(); return }
  if (voiceKey) { toggleMediaStage(); return }
  if (k === 'escape') { closeModal(); return }
  keys.add(k)
}

// zera todas as teclas de movimento seguras — evita "andar sozinho pra sempre"
// quando o keyup nunca chega (janela perde foco: clique direito abrindo o menu
// de contexto do navegador, alt-tab, devtools, etc.)
function clearKeys() {
  keys.clear()
  panMode.value = false
  panDragging = false
  scene?.resetPan()
}

function emote() {
  emoteUntil = Date.now() + 2500
}

function sendChat() {
  if (chatCooldown.value) return
  const t = chatInput.value.trim()
  if (!t) return
  emitChat(t)
  chatInput.value = ''
  chatCooldown.value = true
  chatCooldownTimer = window.setTimeout(() => { chatCooldown.value = false }, CHAT_COOLDOWN_MS)
}

function atChatBottom() {
  const el = chatLog.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight <= CHAT_BOTTOM_SLACK
}

function scrollChatToEnd() {
  const el = chatLog.value
  if (el) el.scrollTop = el.scrollHeight
  chatUnread.value = false
}

function onChatScroll() {
  if (atChatBottom()) chatUnread.value = false
}

// mede o scroll ANTES da mensagem entrar no DOM (watcher pre-flush) e só decide
// depois do nextTick, quando a altura nova já foi calculada; sem isso a medida
// diria "está no fim" sempre. Watcher no array inteiro, não em .length: a lista
// é capada em 50 no presence.ts e o length para de mudar depois disso.
watch(messages, async () => {
  const stick = atChatBottom()
  await nextTick()
  if (stick) scrollChatToEnd()
  else chatUnread.value = true
})

// controles touch (mobile)
function pressKey(k: string) { keys.add(k) }
function releaseKey(k: string) { keys.delete(k) }

// zoom da câmera (+ persistir)
function zoomBy(factor: number) {
  if (!scene) return
  scene.setZoom(scene.getZoom() * factor)
  localStorage.setItem('kairos_zoom', String(scene.getZoom()))
}
function onWheel(e: WheelEvent) {
  zoomBy(e.deltaY < 0 ? 1.1 : 0.9)
}
function onKeyUp(e: KeyboardEvent) {
  if (e.key === ' ' || e.code === 'Space') {
    // soltou o Espaço → sai do modo olhar e recentra no personagem
    panMode.value = false
    panDragging = false
    scene?.resetPan()
    return
  }
  keys.delete(e.key.toLowerCase())
}

// ---- pan da câmera (B3.3): Espaço + arrastar com o botão esquerdo ----
const panMode = ref(false) // Espaço pressionado = "modo olhar"
let panDragging = false
let panLastX = 0
let panLastY = 0
function onPanDown(e: PointerEvent) {
  if (!panMode.value || e.button !== 0) return
  panDragging = true
  panLastX = e.clientX
  panLastY = e.clientY
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
}
function onPanMove(e: PointerEvent) {
  if (!panDragging) return
  scene?.panBy(e.clientX - panLastX, e.clientY - panLastY)
  panLastX = e.clientX
  panLastY = e.clientY
}
function onPanUp() {
  panDragging = false
}

function tryInteract() {
  const z = activeZone.value
  if (!z || gameStore.isModalOpen) return
  // cadeira/sofá → sentar (em vez de modal); guarda de onde veio pra voltar
  // ao levantar — o objeto costuma ser sólido, levantar "dentro" dele travava
  if (z.sittable || z.kind === 'chair' || z.kind === 'sofa') {
    if (!sitting) preSit = { x: pos.x, y: pos.y }
    sitting = true
    pos.x = z.x + z.w / 2
    pos.y = z.y + z.h / 2
    return
  }
  if (z.kind === 'jukebox') {
    jukeboxOpen.value = true
    gameStore.isModalOpen = true
    return
  }
  if (z.kind === 'desk') {
    taskObjectId.value = z.id
    taskOpen.value = true
    gameStore.isModalOpen = true
    return
  }
  if (z.kind === 'shelf') {
    noteObjectId.value = z.id
    noteOpen.value = true
    gameStore.isModalOpen = true
    return
  }
  if (z.kind === 'board') {
    boardObjectId.value = z.id
    boardOpen.value = true
    gameStore.isModalOpen = true
    return
  }
  activeModal.value = z
  gameStore.isModalOpen = true
}
function closeModal() {
  gameStore.isModalOpen = false
  activeModal.value = null
  jukeboxOpen.value = false
  taskOpen.value = false
  noteOpen.value = false
  boardOpen.value = false
  panel.value = null
  panelInvite.value = ''
  friendsOpen.value = false
}

// abrir um painel fecha o que estiver aberto (inclusive uma estação): nada empilha,
// e o isModalOpen congela o personagem enquanto o painel estiver na frente
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

// pular até o amigo é a troca que a barra lateral já sabe fazer: ela decide entre
// só mudar de mundo e entrar noutro servidor antes
function jumpToFriend(serverId: string, mapId: string) {
  closeModal()
  void sidebar.value?.jumpTo(serverId, mapId)
}

// o painel do personagem edita o avatar com o jogo rodando atrás; o AvatarPuppet
// nasce com o look e não troca de peça, então o boneco é remontado no lugar
watch([look, myPhotoUrl], () => {
  // antes do onMounted montar o boneco não há o que trocar: ele já nasce com o look atual
  if (!scene?.avatar('me')) return
  scene.removeAvatar('me')
  const puppet = new AvatarPuppet(look.value)
  scene.addAvatar('me', puppet)
  puppet.setPhoto(myPhotoUrl.value)
  scene.placeAvatar('me', pos.x, pos.y)
})

function applyMap(map: MapDef) {
  currentId.value = map.id
  gameStore.activeMap = map.id
  scene?.setMap(map)
  pos.x = map.spawn.x
  pos.y = map.spawn.y
}

function selectMap(id: string) {
  // B2: já estou neste mundo → no-op. Re-entrar recriava a sessão (switchMap limpa
  // os peers e re-join), me deixando "sozinho" e exigindo F5 pra voltar.
  if (id === currentId.value) return
  const map = maps.value.find((m) => m.id === id)
  if (!scene || !map) return
  applyMap(map)
  switchMap(id)
  // entrar num mundo é entrar na conversa dele: sem voz ainda, conecta; com voz,
  // troca de sala (o media.ts compara o mundo e reconecta sozinho)
  void enterVoice(id)
}

// o servidor ativo já mudou no backend (a barra lateral chamou switchServer):
// aqui recarregam os mundos e a sessão. O socket lê o servidor no handshake e
// não tem como atualizá-lo, então tem de reconectar — sem isso o avatar
// continuaria na sala do servidor anterior.
// mapId chega quando a troca veio de um "pular até o amigo": cair direto no mundo
// dele evita entrar no mundo anterior e só então trocar de novo
async function onServerChanged(_serverId?: string, mapId?: string) {
  error.value = ''
  try {
    maps.value = await fetchMaps()
    const target = maps.value.find((m) => m.id === mapId)
      || maps.value.find((m) => m.id === currentId.value)
      || maps.value[0]
    if (!target) { error.value = 'Nenhum mundo disponível'; return }
    if (target.id !== currentId.value) applyMap(target)
    disconnectPresence()
    // o histórico é da sala do servidor anterior
    messages.splice(0)
    connectPresence({ name: playerName.value, avatar: joinAvatarPayload.value, map: target.id, x: pos.x, y: pos.y })
    // connectPresence nasce sem servidor observado nenhum; a lista da barra também
    // envelheceu (criar/entrar/sair de servidor vem do painel, sem remontar nada) e o
    // reload termina em syncPresence — o gateway só aceita um presenceWatch por vez
    void sidebar.value?.reloadServers()
    void enterVoice(target.id, true)
  } catch (e) {
    error.value = (e as Error).message
  }
}

// foto de peer vem da rede — só carrega se for o caminho canônico da nossa API,
// nunca uma URL externa arbitrária
const PEER_PHOTO_RE = /\/kairos-api\/character\/photo\/([a-f0-9-]+\.(?:jpg|png|webp))$/
function safePeerPhotoUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || raw.length > 300) return null
  const m = PEER_PHOTO_RE.exec(raw)
  return m ? photoUrl(m[1]) : null
}

// colisão entre personagens: bloqueia só se o movimento APROXIMA de quem já está perto
// (assim nunca "trava" dentro de outro — sempre dá pra se afastar/deslizar)
function peerBlocks(nx: number, ny: number, cx: number, cy: number): boolean {
  for (const peer of remotePlayers.values()) {
    if (peer.map && peer.map !== currentId.value) continue
    const dNew = Math.hypot(peer.x - nx, peer.y - ny)
    if (dNew < 0.7 && dNew < Math.hypot(peer.x - cx, peer.y - cy)) return true
  }
  return false
}

// água atravessável deixa o movimento mais lento
function onWater(map: MapDef, x: number, y: number): boolean {
  return map.objects.some((o) => o.kind === 'water' && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h)
}

function detectZone(map: MapDef) {
  let nearest: MapObject | null = null
  let best = 2.6
  for (const o of interactableObjects(map)) {
    const cx = o.x + o.w / 2
    const cy = o.y + o.h / 2
    const d = Math.hypot(cx - pos.x, cy - pos.y)
    if (d < best) { best = d; nearest = o }
  }
  activeZone.value = nearest
}

onMounted(async () => {
  // ?abrir= diz qual painel a entrada (ou uma rota antiga) pediu; a query é
  // consumida na hora pra um F5 não reabrir o painel eternamente
  const asked = panelFromQuery(route.query)
  const invite = route.query.invite
  if (asked) openPanel(asked, typeof invite === 'string' ? invite : '')
  if (asked || invite) void router.replace({ path: '/game' })

  scene = new MapScene()
  await scene.init(host.value!)
  const savedZoom = parseFloat(localStorage.getItem('kairos_zoom') || '')
  if (savedZoom) scene.setZoom(savedZoom)
  scene.addAvatar('me', new AvatarPuppet(look.value))
  scene.avatar('me')?.setPhoto(myPhotoUrl.value)

  try {
    maps.value = await fetchMaps()
    // retoma último mundo + posição salvos (se logado)
    let startId = gameStore.activeMap
    let savedPos: { x: number; y: number } | null = null
    if (auth.isAuthenticated) {
      try {
        const st = await getWorldState()
        if (st && maps.value.find((m) => m.id === st.activeMap)) {
          startId = st.activeMap
          savedPos = { x: st.playerX, y: st.playerY }
        }
      } catch {
        // falha ao carregar estado salvo nunca bloqueia a entrada na sala
      }
    }
    const first = maps.value.find((m) => m.id === startId) || maps.value[0]
    if (!first) { error.value = 'Nenhum mundo disponível'; return }
    selectMap(first.id)
    if (savedPos) { pos.x = savedPos.x; pos.y = savedPos.y }
    connectPresence({ name: playerName.value, avatar: joinAvatarPayload.value, map: first.id, x: pos.x, y: pos.y })
    // a barra lateral já montou (e já pediu a lista de servidores) antes do
    // socket existir: o observador de presença só cola agora
    sidebar.value?.syncPresence()
  } catch (e) {
    error.value = (e as Error).message
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', clearKeys)
  offScreenShare = onScreenShare(onScreenShareState)
  stateTimer = window.setInterval(persistState, 15000)

  scene.app.ticker.add((ticker) => {
    if (!scene) return
    const map = currentMap.value
    if (!map) return
    const dt = Math.min(ticker.deltaMS / 1000, 0.05)

    // ---- movimento local (com colisão) ----
    let dx = 0, dy = 0
    // boost (M2): Shift acelera ~1.8x — carrinho aparece sob o boneco enquanto anda
    const boosting = keys.has('shift')
    // Espaço (modo olhar/pan) congela o personagem — só a câmera se move.
    // Sessão derrubada (aberta em outro lugar) também congela — não faz
    // sentido continuar "andando" localmente já desconectado da sala.
    if (!gameStore.isModalOpen && !panMode.value && !sessionKicked.value) {
      const sp = 5 * dt * (onWater(map, pos.x, pos.y) ? 0.5 : 1) * (boosting ? 1.8 : 1)
      if (keys.has('w') || keys.has('arrowup')) dy -= sp
      if (keys.has('s') || keys.has('arrowdown')) dy += sp
      if (keys.has('a') || keys.has('arrowleft')) dx -= sp
      if (keys.has('d') || keys.has('arrowright')) dx += sp
    }
    const moving = dx !== 0 || dy !== 0
    if (moving && sitting) {
      // levantar devolve pra onde estava antes de sentar (senão fica dentro do sólido)
      sitting = false
      if (preSit) {
        pos.x = preSit.x
        pos.y = preSit.y
        preSit = null
      }
    }
    if (moving) {
      facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down')
      const nx = pos.x + dx
      const ny = pos.y + dy
      // escape: se o tile ATUAL já é sólido (sentou/spawnou dentro), libera o
      // movimento — regra anti-travamento, nunca deixa o personagem preso
      const stuck = isSolid(map, Math.floor(pos.x), Math.floor(pos.y))
      if ((stuck || !isSolid(map, Math.floor(nx), Math.floor(pos.y))) && !peerBlocks(nx, pos.y, pos.x, pos.y)) pos.x = nx
      if ((stuck || !isSolid(map, Math.floor(pos.x), Math.floor(ny))) && !peerBlocks(pos.x, ny, pos.x, pos.y)) pos.y = ny
    }
    const onCart = boosting && moving
    const emoting = Date.now() < emoteUntil
    const pose: 'idle' | 'walk' | 'dance' | 'wave' | 'sit' = sitting ? 'sit' : moving ? 'walk' : emoting ? 'wave' : dancing ? 'dance' : 'idle'
    // emite estado quando se move ou quando pose/direção/boost mudam (dança parado conta)
    if (moving || pose !== lastSent.pose || facing !== lastSent.facing || onCart !== lastSent.boost) {
      emitMove(pos.x, pos.y, facing, pose, onCart)
      lastSent.pose = pose
      lastSent.facing = facing
      lastSent.boost = onCart
    }
    detectZone(map)

    const me = scene.avatar('me')
    if (me) {
      me.setFacing(facing)
      me.setPose(pose)
      me.setBoost(onCart)
      me.update(dt)
    }
    scene.placeAvatar('me', pos.x, pos.y)
    scene.follow(pos.x, pos.y)
    scene.cull()

    // ---- avatares remotos ----
    syncRemotes(dt, map)
    scene.sortAvatars()

    // ---- proximidade: indicador + voz por proximidade ----
    let near: string | null = null
    let best = 3
    const voiceIds: string[] = []
    const voiceLive = media.state.connected
    for (const peer of remotePlayers.values()) {
      if (peer.map && peer.map !== map.id) continue
      const d = Math.hypot(peer.x - pos.x, peer.y - pos.y)
      if (d < best) { best = d; near = peer.name }
      const inRange = d <= 4 // raio de comunicação — mesmo alcance usado pra voz por proximidade
      // histerese na voz: assina a ≤4, mas quem já está assinado só cai a >5 —
      // sem isso, dançar na borda do raio gera assina/desassina em loop
      const keepConnected = voiceLive && media.isSubscribed(peer.userId) && d <= 5
      // no modo "sala", a voz alcança todo mundo — o raio some, só regula nomes flutuantes
      // (userId vazio não deveria acontecer — o gateway recusa socket sem usuário —
      // mas se acontecer o peer só fica sem mídia, sem quebrar o frame)
      if (peer.userId && (voiceMode.value === 'room' || inRange || keepConnected)) voiceIds.push(peer.userId)
      scene.avatar(peer.id)?.setNameVisible(inRange)
    }
    nearby.value = near
    if (voiceLive) media.syncSubscriptions(voiceIds)

    // ---- jukebox: toca sincronizado, volume por distância (modo proximidade) ----
    jukeboxAudio.sync()
    scene.setJukeboxPlaying(!!jukeboxState.current)
    if (jukeboxState.current) {
      if (jukeboxState.mode === 'room') {
        jukeboxAudio.setVolume(1)
      } else {
        let nearestBox = Infinity
        for (const o of map.objects) {
          if (o.kind !== 'jukebox') continue
          const d = Math.hypot(o.x + o.w / 2 - pos.x, o.y + o.h / 2 - pos.y)
          if (d < nearestBox) nearestBox = d
        }
        jukeboxAudio.setVolume(Math.max(0, 1 - nearestBox / JUKEBOX_RADIUS))
      }
    }
  })
})

function syncRemotes(dt: number, map: MapDef) {
  if (!scene) return
  const seen = new Set<string>()
  for (const peer of remotePlayers.values()) {
    if (peer.map && peer.map !== map.id) continue
    seen.add(peer.id)
    let p = scene.avatar(peer.id)
    if (!p) {
      p = new AvatarPuppet(sanitizeLook(peer.avatar))
      p.setName(peer.name)
      p.setPhoto(safePeerPhotoUrl((peer.avatar as AvatarProps)?.photoUrl))
      scene.addAvatar(peer.id, p)
      peerIds.add(peer.id)
    }
    // pose e direção agora vêm sincronizadas da rede
    p.setFacing(peer.facing || 'down')
    p.setPose(peer.pose || 'idle')
    p.setBoost(!!peer.boost)
    p.update(dt)
    scene.placeAvatar(peer.id, peer.x, peer.y)
  }
  // remove quem saiu / mudou de mapa
  for (const id of [...peerIds]) {
    if (!seen.has(id)) { scene.removeAvatar(id); peerIds.delete(id) }
  }
}

async function leave() {
  disconnectPresence()
  // precisa vir ANTES do logout() local — esse ainda usa o token pra avisar o
  // backend (se for convidado, apaga a conta inteira); depois de limpar o
  // token não teria mais como autenticar essa chamada
  await logoutApi()
  useAuthStore().logout()
  characterStore.$reset() // limpa nome/avatar em memória (não vaza pra próxima conta)
  jukeboxAudio.stop()
  router.push('/login')
}

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', clearKeys)
  clearInterval(stateTimer)
  clearTimeout(chatCooldownTimer)
  offScreenShare?.()
  offScreenShare = null
  for (const timer of screenNoticeTimers) clearTimeout(timer)
  screenNoticeTimers.clear()
  persistState()
  // Room vazada = microfone continua ligado depois de sair da tela
  void media.disconnect()
  disconnectPresence()
  jukeboxAudio.stop()
  scene?.destroy()
  scene = null
})
</script>

<style scoped>
.gp-root {
  height: 100vh;
  display: grid;
  grid-template-columns: 3.5rem 1fr;
  background: var(--bg-0);
  overflow: hidden;
  transition: grid-template-columns 0.25s ease;
}
.gp-root.gp-sidebar-open {
  grid-template-columns: 18rem 1fr;
}

.gp-sidebar {
  background: var(--bg-2);
  border-right: 0.0625rem solid var(--border);
  display: flex;
  min-width: 0;
  overflow: hidden;
}

.gp-avatar-box {
  width: 2.25rem;
  height: 2.25rem;
  background: var(--bg-3);
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
}

.gp-stage {
  position: relative;
  overflow: hidden;
  background: var(--bg-0);
}

.gp-canvas-host {
  position: absolute;
  inset: 0;
}
.gp-cursor-default { cursor: default; }
.gp-cursor-grab { cursor: grab; }
.gp-cursor-grabbing { cursor: grabbing; }

.gp-zoom {
  position: absolute;
  top: 4rem;
  right: 1rem;
  z-index: 10;
}
.gp-zoom-btn {
  cursor: pointer;
  width: 1.875rem;
  height: 1.875rem;
  font-size: 1rem;
}

.gp-hud {
  position: absolute;
  z-index: 10;
}

.gp-hud-topleft {
  top: 1rem;
  left: 1rem;
  display: inline-flex;
  background: rgba(13, 13, 20, 0.78);
  border: 0.0625rem solid var(--border-strong);
  backdrop-filter: blur(0.625rem);
  padding: 0.5rem 0.75rem 0.5rem 0.5rem;
}

.gp-hud-tight { line-height: 1.1; }
.gp-hud-name { font-size: 0.8125rem; font-weight: 600; }
.gp-hud-mapname {
  font-size: 0.625rem;
  color: var(--text-3);
  font-family: var(--f-mono);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}




.gp-nearby {
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(124, 58, 237, 0.18);
  border: 0.0625rem solid var(--primary-hi);
  backdrop-filter: blur(0.625rem);
  padding: 0.375rem 0.875rem;
  font-size: 0.75rem;
  color: var(--text);
}

/* abaixo do "perto de X" pra não brigar pelo topo-centro */
.gp-screen-notices {
  position: absolute;
  top: 3.75rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: grid;
  justify-items: center;
  gap: 0.25rem;
  max-width: min(26rem, calc(100% - 2rem));
  /* não captura clique nem foco: o jogo segue respondendo ao teclado embaixo */
  pointer-events: none;
}

.gp-screen-notice {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: var(--bg-2);
  border: 0.125rem solid var(--accent-lo);
  box-shadow: var(--ui-shadow);
  font-size: 0.75rem;
  color: var(--text-2);
}
.gp-screen-notice b { color: var(--accent); }

@media (prefers-reduced-motion: no-preference) {
  .gp-screen-notice {
    animation: gpScreenNotice 0.18s steps(3, jump-none) both;
  }
  @keyframes gpScreenNotice {
    from { opacity: 0; transform: translateY(-0.5rem); }
    to { opacity: 1; transform: translateY(0); }
  }
}

.gp-chat {
  position: absolute;
  bottom: 1rem;
  left: 1rem;
  width: min(17.5rem, calc(100vw - 2rem));
  z-index: 10;
}

.gp-chat-log {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 11.25rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin-bottom: 0.375rem;
  padding: 0.4375rem 0.5rem;
  background: var(--bg-1);
  background: color-mix(in srgb, var(--bg-1) 55%, transparent);
  border: 0.0625rem solid var(--border);
  backdrop-filter: blur(0.1875rem);
  -webkit-backdrop-filter: blur(0.1875rem);
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
}
.gp-chat-log::-webkit-scrollbar { width: 0.375rem; }
.gp-chat-log::-webkit-scrollbar-track { background: transparent; }
.gp-chat-log::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: var(--r-sm); }
.gp-chat-log::-webkit-scrollbar-thumb:hover { background: var(--text-4); }

.gp-chat-msg {
  font-size: 0.75rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
  text-shadow: 0 0.0625rem 0.125rem var(--bg-0);
}
.gp-chat-name { color: var(--accent); font-weight: 600; }
.gp-chat-text { color: var(--text); }

.gp-chat-field {
  position: relative;
}

.gp-chat-foot {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 0.25rem);
  display: flex;
  align-items: flex-end;
  gap: 0.375rem;
  pointer-events: none;
}

.gp-chat-jump {
  pointer-events: auto;
  cursor: pointer;
  font-family: var(--f-pixel);
  font-size: 0.5625rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--bg-0);
  background: var(--primary-hi);
  border: 0.0625rem solid var(--primary-hi);
  border-radius: var(--r-sm);
  padding: 0.25rem 0.375rem;
}
.gp-chat-jump:hover { background: var(--accent-hi); border-color: var(--accent-hi); }

.gp-chat-count {
  margin-left: auto;
  font-family: var(--f-mono);
  font-size: 0.625rem;
  color: var(--text-3);
  background: var(--bg-1);
  background: color-mix(in srgb, var(--bg-1) 70%, transparent);
  padding: 0.125rem 0.25rem;
}
.gp-chat-count-max { color: var(--warn); }

.gp-chat-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--bg-1);
  background: color-mix(in srgb, var(--bg-1) 72%, transparent);
  backdrop-filter: blur(0.1875rem);
  -webkit-backdrop-filter: blur(0.1875rem);
  border: 0.0625rem solid var(--border-strong);
  color: var(--text);
  padding: 0.5rem 0.625rem;
  font-size: 0.8125rem;
  font-family: inherit;
}
.gp-chat-input:focus { outline: none; border-color: var(--primary-hi); }

.gp-chat-cooldown {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 0.125rem;
  background: var(--primary-hi);
  transform-origin: left center;
  pointer-events: none;
  /* duração casada com CHAT_COOLDOWN_MS no script */
  animation: gpChatCooldown 0.5s linear forwards;
}
@keyframes gpChatCooldown {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

.gp-hud-bottom {
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  background: rgba(13, 13, 20, 0.78);
  border: 0.0625rem solid var(--border-strong);
  backdrop-filter: blur(0.625rem);
  padding: 0.5rem 0.875rem;
  font-size: 0.6875rem;
  color: var(--text-2);
  letter-spacing: 0.06em;
}
.gp-hud-hint { color: var(--text-3); }
.gp-hud-sep { color: var(--text-4); }
.gp-hud-action { color: var(--accent); }

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

.gp-modal-close { padding: 0.375rem 0.625rem; gap: 0.375rem; }

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

.gp-modal-body {
  background: var(--bg-1);
  border: 0.0625rem solid var(--border);
  padding: 1rem;
  font-size: 0.8125rem;
  color: var(--text-2);
  line-height: 1.6;
}

.gp-touch-ctl {
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

.gp-error {
  position: absolute;
  top: 3.75rem;
  left: 50%;
  transform: translateX(-50%);
  color: #f87171;
  font-size: 0.8125rem;
  z-index: 10;
}

.tbtn {
  background: rgba(13, 13, 20, 0.8);
  border: 0.0625rem solid var(--border-strong);
  color: var(--text);
  font-size: 1.125rem;
  display: grid;
  place-items: center;
  cursor: pointer;
  border-radius: 0.375rem;
  touch-action: none;
}
.tbtn:active {
  background: rgba(124, 58, 237, 0.3);
}
/* esconde os controles touch em dispositivos com mouse (desktop) */
@media (hover: hover) and (pointer: fine) {
  .touch-ctl {
    display: none !important;
  }
}

/* Telas estreitas (ou zoom alto do navegador, que reduz os mesmos px de CSS):
   a sidebar aberta virava um grid-column de 18rem e sobrava quase nada pro palco.
   Vira overlay flutuante em vez de empurrar o grid — o palco sempre ocupa o resto. */
@media (max-width: 48rem) {
  .gp-root.gp-sidebar-open {
    grid-template-columns: 3.5rem 1fr;
  }
  .gp-sidebar.gp-sidebar-open {
    position: fixed;
    top: 0;
    left: 0;
    width: min(18rem, 80vw);
    height: 100vh;
    z-index: 100;
    box-shadow: 0.5rem 0 1.5rem rgba(0, 0, 0, 0.5);
  }

  /* HUD: lista de quem está online ocupava um card próprio no topo-direita —
     em telas estreitas colide com o card do topo-esquerda. Esconde os nomes,
     mantém só a contagem (mais compacta). */

  .gp-chat {
    bottom: 0.75rem;
    left: 0.75rem;
  }
}

/* Muito estreito (celular em pé): dica de teclas (WASD/B/G) é redundante com
   os controles touch e brigava por espaço com chat/voz na mesma faixa vertical. */
@media (max-width: 30rem) {
  .gp-hud-bottom {
    display: none;
  }
}
</style>
