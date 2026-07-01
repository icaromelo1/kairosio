<template>
  <div class="gp-root" :class="{ 'gp-sidebar-open': gameStore.sidebarOpen }">
    <!-- Sidebar -->
    <aside class="gp-sidebar" :class="{ 'gp-sidebar-open': gameStore.sidebarOpen }">
      <div class="row items-center justify-between q-gutter-sm">
        <Logo v-if="gameStore.sidebarOpen" :id="'monogram'" size="sm" primary="var(--primary-hi)" accent="var(--accent)" />
        <button class="gp-sidebar-toggle" @click="gameStore.sidebarOpen = !gameStore.sidebarOpen">{{ gameStore.sidebarOpen ? '‹' : '›' }}</button>
      </div>

      <template v-if="gameStore.sidebarOpen">
        <!-- User card -->
        <div class="gp-user-card row items-center q-gutter-sm">
          <div class="gp-avatar-box">
            <PixelAvatar :scale="1.6" v-bind="look" :shadow="false" />
          </div>
          <div class="gp-user-info">
            <div class="ellipsis gp-user-name">{{ playerName }}</div>
            <div class="gp-user-status">● online · {{ online }}</div>
          </div>
        </div>

        <!-- Mundos (vindos do banco) -->
        <div class="column q-gutter-xs">
          <div class="gp-section-label">Mundos</div>
          <button
            v-for="m in maps" :key="m.id" @click="selectMap(m.id)"
            class="gp-map-btn row items-center q-gutter-sm"
            :class="{ 'gp-map-btn-active': currentId === m.id }"
          >
            <span class="col">{{ m.name }}</span>
            <span v-if="currentId === m.id" class="gp-map-current">atual</span>
          </button>
        </div>

        <!-- Você -->
        <div class="column q-gutter-xs">
          <div class="gp-section-label">Você</div>
          <button class="k-btn k-btn-ghost menu-act" @click="router.push('/character')">Editar avatar</button>
          <button v-if="!auth.isGuest" class="k-btn k-btn-ghost menu-act" @click="router.push('/editor/new')">Criar mundo</button>
          <button v-if="currentMap && currentMap.ownerId === auth.userId" class="k-btn k-btn-ghost menu-act" @click="router.push(`/editor/${currentId}`)">Editar este mundo</button>
          <button v-if="!auth.isGuest" class="k-btn k-btn-ghost menu-act" @click="router.push('/admin')">Administração</button>
          <button class="k-btn k-btn-ghost menu-act" @click="router.push('/feedback')">Feedback / Reportar</button>
          <button class="k-btn k-btn-ghost menu-act" @click="leave">Sair</button>
        </div>
      </template>
    </aside>

    <!-- Stage (PixiJS) -->
    <div class="gp-stage">
      <div
        ref="host" class="gp-canvas-host"
        :class="panMode ? (panDragging ? 'gp-cursor-grabbing' : 'gp-cursor-grab') : 'gp-cursor-default'"
        @wheel.prevent="onWheel"
        @pointerdown="onPanDown" @pointermove="onPanMove" @pointerup="onPanUp" @pointerleave="onPanUp"
      ></div>

      <!-- Zoom -->
      <div class="gp-zoom column q-gutter-xs">
        <button class="k-key gp-zoom-btn" @click="zoomBy(1.15)" title="Zoom +">+</button>
        <button class="k-key gp-zoom-btn" @click="zoomBy(0.87)" title="Zoom −">−</button>
      </div>

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

      <!-- HUD top-right: online + lista -->
      <div class="gp-hud gp-hud-topright">
        <div class="gp-online-count">{{ online }} online</div>
        <div class="column gp-online-list">
          <span class="gp-peer-you">● {{ playerName }} <span class="gp-peer-you-tag">(você)</span> <span v-if="voiceOn">🎙</span></span>
          <span v-for="p in roomPeers" :key="p.id" class="gp-peer">● {{ p.name }} <span v-if="voicePeers.includes(p.id)">🔊</span></span>
        </div>
      </div>

      <!-- Proximidade + voz -->
      <div v-if="nearby" class="gp-hud gp-nearby">
        perto de <strong>{{ nearby }}</strong>
      </div>

      <!-- Botão de voz (claro: rótulo + estado) -->
      <div class="gp-voice-wrap column items-end q-gutter-xs">
        <button
          :title="voiceOn ? 'Microfone ligado — clique pra desligar' : 'Clique pra falar por voz com quem está perto'"
          class="gp-voice-btn"
          :class="{ 'gp-voice-btn-on': voiceOn }"
          @click="toggleVoice"
        >{{ voiceOn ? '🎙 Microfone ligado' : '🔇 Falar por voz' }}</button>
        <span v-if="!voiceOn" class="gp-voice-hint">aproxime-se de alguém pra conversar por voz</span>
        <button v-else class="gp-voice-reconnect" @click="voice.reconnect()">↻ reconectar (se a voz travar)</button>
      </div>

      <!-- Chat -->
      <div class="gp-chat">
        <div v-if="messages.length" class="column q-gutter-xs gp-chat-log">
          <div v-for="(m, i) in messages" :key="i" class="gp-chat-msg">
            <span class="gp-chat-name">{{ m.name }}:</span>
            <span class="gp-chat-text"> {{ m.text }}</span>
          </div>
        </div>
        <input
          v-model="chatInput" maxlength="300" placeholder="Conversar… (Enter)"
          class="gp-chat-input"
          @keydown.enter="sendChat"
        />
      </div>

      <!-- HUD bottom -->
      <div class="gp-hud gp-hud-bottom row items-center q-gutter-md">
        <span class="row items-center q-gutter-xs"><span class="k-key">W</span><span class="k-key">A</span><span class="k-key">S</span><span class="k-key">D</span><span class="gp-hud-hint">mover</span></span>
        <span class="gp-hud-sep">·</span>
        <span class="row items-center q-gutter-xs"><span class="k-key">B</span><span class="gp-hud-hint">dançar</span></span>
        <span class="gp-hud-sep">·</span>
        <span class="row items-center q-gutter-xs"><span class="k-key">G</span><span class="gp-hud-hint">acenar</span></span>
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
            <button class="k-btn k-btn-ghost gp-modal-close" @click="closeModal">esc ✕</button>
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

      <!-- Painel do jukebox -->
      <JukeboxPanel v-if="jukeboxOpen" @close="closeModal" />

      <!-- Controles touch (mobile) -->
      <div class="touch-ctl gp-touch-ctl">
        <span></span>
        <button class="tbtn" @pointerdown.prevent="pressKey('w')" @pointerup="releaseKey('w')" @pointerleave="releaseKey('w')">▲</button>
        <span></span>
        <button class="tbtn" @pointerdown.prevent="pressKey('a')" @pointerup="releaseKey('a')" @pointerleave="releaseKey('a')">◀</button>
        <button class="tbtn" @pointerdown.prevent="dancing = !dancing">♪</button>
        <button class="tbtn" @pointerdown.prevent="pressKey('d')" @pointerup="releaseKey('d')" @pointerleave="releaseKey('d')">▶</button>
        <span></span>
        <button class="tbtn" @pointerdown.prevent="pressKey('s')" @pointerup="releaseKey('s')" @pointerleave="releaseKey('s')">▼</button>
        <button class="tbtn" @pointerdown.prevent="emote()">👋</button>
      </div>

      <div v-if="error" class="gp-error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/useGameStore'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { MapScene } from '@/game/pixi/scene'
import { AvatarPuppet, type AvatarLook, type Facing } from '@/game/pixi/avatar'
import { isSolid, interactableObjects, type MapDef, type MapObject } from '@/game/maps'
import { fetchMaps } from '@/services/maps.api'
import { getWorldState, saveWorldState } from '@/services/world.api'
import { connectPresence, disconnectPresence, emitMove, switchMap, remotePlayers, chatMessages, emitChat, socketId, jukeboxState } from '@/services/presence'
import { VoiceChat } from '@/services/webrtc'
import { jukeboxAudio } from '@/services/jukeboxAudio'
import PixelAvatar from '@/components/pixel/PixelAvatar.vue'
import Logo from '@/components/logos/Logo.vue'
import JukeboxPanel from '@/components/JukeboxPanel.vue'

const router = useRouter()
const gameStore = useGameStore()
const characterStore = useCharacterStore()
const auth = useAuthStore()
let stateTimer = 0

function persistState() {
  if (auth.isAuthenticated && currentId.value) {
    saveWorldState({ activeMap: currentId.value, playerX: pos.x, playerY: pos.y })
  }
}

const host = ref<HTMLElement | null>(null)
const maps = ref<MapDef[]>([])
const currentId = ref('')
const error = ref('')
const activeZone = ref<MapObject | null>(null)
const activeModal = ref<MapObject | null>(null)
const jukeboxOpen = ref(false)
const JUKEBOX_RADIUS = 6 // tiles — alcance do modo "proximidade"

const look = computed<AvatarLook>(() => ({
  hairStyle: characterStore.hairStyle,
  hairColor: characterStore.hairColor,
  skin: characterStore.skin,
  topColor: characterStore.topColor,
  pantsColor: characterStore.pantsColor,
  accessory: characterStore.accessory,
}))
const playerName = computed(() => characterStore.name || 'Convidado')
const currentMap = computed(() => maps.value.find((m) => m.id === currentId.value))
const roomPeers = computed(() => [...remotePlayers.values()].filter((p) => !p.map || p.map === currentId.value))
const online = computed(() => roomPeers.value.length + 1)

let scene: MapScene | null = null
const pos = reactive({ x: 11, y: 9 })
let facing: Facing = 'down'
let dancing = false
let sitting = false
const keys = new Set<string>()
const chatInput = ref('')
const nearby = ref<string | null>(null)
let emoteUntil = 0
const messages = chatMessages
const voice = new VoiceChat()
const voiceOn = ref(false)
const voicePeers = ref<string[]>([])

async function toggleVoice() {
  if (voiceOn.value) {
    voice.disable()
    voiceOn.value = false
    voicePeers.value = []
    return
  }
  voice.setSelf(socketId() || '')
  const ok = await voice.enable()
  voiceOn.value = ok
  if (!ok) error.value = 'Microfone bloqueado. Permita o acesso para usar a voz.'
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
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'e', 'b', 'g', 'escape'].includes(k)) e.preventDefault()
  if (k === 'e') { tryInteract(); return }
  if (k === 'b') { dancing = !dancing; return }
  if (k === 'g') { emote(); return }
  if (k === 'escape') { closeModal(); return }
  keys.add(k)
}

function emote() {
  emoteUntil = Date.now() + 2500
}

function sendChat() {
  const t = chatInput.value.trim()
  if (!t) return
  emitChat(t)
  chatInput.value = ''
}

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
  // cadeira/sofá → sentar (em vez de modal)
  if (z.kind === 'chair' || z.kind === 'sofa') {
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
  activeModal.value = z
  gameStore.isModalOpen = true
}
function closeModal() {
  gameStore.isModalOpen = false
  activeModal.value = null
  jukeboxOpen.value = false
}

function selectMap(id: string) {
  // B2: já estou neste mundo → no-op. Re-entrar recriava a sessão (switchMap limpa
  // os peers e re-join), me deixando "sozinho" e exigindo F5 pra voltar.
  if (id === currentId.value) return
  const map = maps.value.find((m) => m.id === id)
  if (!scene || !map) return
  currentId.value = id
  gameStore.activeMap = id
  scene.setMap(map)
  pos.x = map.spawn.x
  pos.y = map.spawn.y
  switchMap(id)
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
  scene = new MapScene()
  await scene.init(host.value!)
  const savedZoom = parseFloat(localStorage.getItem('kairos_zoom') || '')
  if (savedZoom) scene.setZoom(savedZoom)
  scene.addAvatar('me', new AvatarPuppet(look.value))

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
    connectPresence({ name: playerName.value, avatar: look.value, map: first.id, x: pos.x, y: pos.y })
  } catch (e) {
    error.value = (e as Error).message
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
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
    // Espaço (modo olhar/pan) congela o personagem — só a câmera se move
    if (!gameStore.isModalOpen && !panMode.value) {
      const sp = 5 * dt * (onWater(map, pos.x, pos.y) ? 0.5 : 1) * (boosting ? 1.8 : 1)
      if (keys.has('w') || keys.has('arrowup')) dy -= sp
      if (keys.has('s') || keys.has('arrowdown')) dy += sp
      if (keys.has('a') || keys.has('arrowleft')) dx -= sp
      if (keys.has('d') || keys.has('arrowright')) dx += sp
    }
    const moving = dx !== 0 || dy !== 0
    if (moving) sitting = false // mover levanta
    if (moving) {
      facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down')
      const nx = pos.x + dx
      const ny = pos.y + dy
      if (!isSolid(map, Math.floor(nx), Math.floor(pos.y)) && !peerBlocks(nx, pos.y, pos.x, pos.y)) pos.x = nx
      if (!isSolid(map, Math.floor(pos.x), Math.floor(ny)) && !peerBlocks(pos.x, ny, pos.x, pos.y)) pos.y = ny
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

    // ---- avatares remotos ----
    syncRemotes(dt, map)
    scene.sortAvatars()

    // ---- proximidade: indicador + voz por proximidade ----
    let near: string | null = null
    let best = 3
    const voiceIds: string[] = []
    for (const peer of remotePlayers.values()) {
      if (peer.map && peer.map !== map.id) continue
      const d = Math.hypot(peer.x - pos.x, peer.y - pos.y)
      if (d < best) { best = d; near = peer.name }
      if (d <= 4) voiceIds.push(peer.id)
    }
    nearby.value = near
    if (voiceOn.value) {
      voice.sync(voiceIds)
      voicePeers.value = voice.activePeers()
    }

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
      p = new AvatarPuppet(peer.avatar as AvatarLook)
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

function leave() {
  disconnectPresence()
  useAuthStore().logout()
  characterStore.$reset() // limpa nome/avatar em memória (não vaza pra próxima conta)
  jukeboxAudio.stop()
  router.push('/login')
}

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  clearInterval(stateTimer)
  persistState()
  voice.disable()
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
  grid-template-columns: 56px 1fr;
  background: var(--bg-0);
  overflow: hidden;
  transition: grid-template-columns 0.25s ease;
}
.gp-root.gp-sidebar-open {
  grid-template-columns: 256px 1fr;
}

.gp-sidebar {
  background: var(--bg-2);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 8px;
  overflow: hidden;
}
.gp-sidebar.gp-sidebar-open {
  padding: 16px;
}

.gp-sidebar-toggle {
  appearance: none;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-2);
  width: 28px;
  height: 28px;
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 14px;
  flex-shrink: 0;
}

.gp-user-card {
  background: var(--bg-1);
  border: 1px solid var(--border);
  padding: 12px;
}

.gp-avatar-box {
  width: 36px;
  height: 36px;
  background: var(--bg-3);
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
}

.gp-user-info { flex: 1; min-width: 0; }
.gp-user-name { font-size: 13px; font-weight: 600; }
.gp-user-status {
  font-size: 10px;
  color: var(--ok);
  font-family: var(--f-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.gp-section-label {
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--text-3);
  text-transform: uppercase;
  font-weight: 600;
  padding: 4px 6px;
}

.gp-map-btn {
  appearance: none;
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-2);
  padding: 8px 10px;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}
.gp-map-btn-active {
  background: rgba(124, 58, 237, 0.12);
  border-color: rgba(124, 58, 237, 0.32);
  color: var(--text);
}

.gp-map-current {
  font-size: 9px;
  color: var(--accent);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 700;
}

/* botões do menu lateral: ocupam a largura toda e QUEBRAM linha em vez de estourar
   a sidebar (rótulos longos como "Feedback / Reportar" não vazam mais). */
.menu-act {
  width: 100%;
  justify-content: flex-start;
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.25;
  min-width: 0;
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
  top: 64px;
  right: 16px;
  z-index: 10;
}
.gp-zoom-btn {
  cursor: pointer;
  width: 30px;
  height: 30px;
  font-size: 16px;
}

.gp-hud {
  position: absolute;
  z-index: 10;
}

.gp-hud-topleft {
  top: 16px;
  left: 16px;
  display: inline-flex;
  background: rgba(13, 13, 20, 0.78);
  border: 1px solid var(--border-strong);
  backdrop-filter: blur(10px);
  padding: 8px 12px 8px 8px;
}

.gp-hud-tight { line-height: 1.1; }
.gp-hud-name { font-size: 13px; font-weight: 600; }
.gp-hud-mapname {
  font-size: 10px;
  color: var(--text-3);
  font-family: var(--f-mono);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.gp-hud-topright {
  top: 16px;
  right: 16px;
  background: rgba(13, 13, 20, 0.82);
  border: 1px solid var(--border-strong);
  backdrop-filter: blur(10px);
  padding: 8px 12px;
  min-width: 140px;
}

.gp-online-count {
  color: var(--accent);
  font-weight: 600;
  font-family: var(--f-mono);
  font-size: 12px;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
}

.gp-online-list { gap: 2px; font-size: 12px; }
.gp-peer-you { color: var(--text); }
.gp-peer-you-tag { color: var(--text-4); }
.gp-peer { color: var(--text-2); }

.gp-nearby {
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(124, 58, 237, 0.18);
  border: 1px solid var(--primary-hi);
  backdrop-filter: blur(10px);
  padding: 6px 14px;
  font-size: 12px;
  color: var(--text);
}

.gp-voice-wrap {
  position: absolute;
  bottom: 16px;
  right: 24px;
  z-index: 20;
}

.gp-voice-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 9px 14px;
  border-radius: 22px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid var(--border-strong);
  background: rgba(13, 13, 20, 0.85);
  color: var(--text);
}
.gp-voice-btn-on {
  border-color: var(--ok);
  background: rgba(52, 211, 153, 0.22);
}

.gp-voice-hint {
  font-size: 11px;
  color: var(--text-3);
  background: rgba(13, 13, 20, 0.7);
  padding: 2px 8px;
  border-radius: 4px;
}

.gp-voice-reconnect {
  font-size: 11px;
  color: var(--text-2);
  background: rgba(13, 13, 20, 0.7);
  border: 1px solid var(--border);
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.gp-chat {
  position: absolute;
  bottom: 16px;
  left: 16px;
  width: 280px;
  z-index: 10;
}

.gp-chat-log {
  max-height: 180px;
  overflow-y: auto;
  margin-bottom: 6px;
}

.gp-chat-msg {
  background: rgba(13, 13, 20, 0.82);
  border: 1px solid var(--border);
  padding: 5px 9px;
  font-size: 12px;
  line-height: 1.4;
}
.gp-chat-name { color: var(--accent); font-weight: 600; }
.gp-chat-text { color: var(--text); }

.gp-chat-input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(13, 13, 20, 0.85);
  border: 1px solid var(--border-strong);
  color: var(--text);
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
}

.gp-hud-bottom {
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  background: rgba(13, 13, 20, 0.78);
  border: 1px solid var(--border-strong);
  backdrop-filter: blur(10px);
  padding: 8px 14px;
  font-size: 11px;
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
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  z-index: 50;
  padding: 24px;
}

.gp-modal-card {
  padding: 28px;
  width: min(520px, 100%);
}

.gp-modal-close { padding: 6px 10px; }

.gp-modal-title {
  margin: 0 0 6px;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.gp-modal-subtitle {
  margin: 0;
  color: var(--text-3);
  font-size: 14px;
}

.gp-modal-body {
  background: var(--bg-1);
  border: 1px solid var(--border);
  padding: 16px;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.6;
}

.gp-touch-ctl {
  position: absolute;
  bottom: 80px;
  right: 24px;
  z-index: 20;
  display: grid;
  grid-template-columns: repeat(3, 44px);
  grid-template-rows: repeat(3, 44px);
  gap: 4px;
  touch-action: none;
  user-select: none;
}

.gp-error {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  color: #f87171;
  font-size: 13px;
  z-index: 10;
}

.tbtn {
  background: rgba(13, 13, 20, 0.8);
  border: 1px solid var(--border-strong);
  color: var(--text);
  font-size: 18px;
  display: grid;
  place-items: center;
  cursor: pointer;
  border-radius: 6px;
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
</style>
