<template>
  <div :style="{
    height: '100vh', display: 'grid',
    gridTemplateColumns: gameStore.sidebarOpen ? '256px 1fr' : '56px 1fr',
    background: 'var(--bg-0)', overflow: 'hidden', transition: 'grid-template-columns 0.25s ease',
  }">
    <!-- Sidebar -->
    <aside :style="{
      background: 'var(--bg-2)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: '14px',
      padding: gameStore.sidebarOpen ? '16px' : '8px', overflow: 'hidden',
    }">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <Logo v-if="gameStore.sidebarOpen" :id="'monogram'" size="sm" primary="var(--primary-hi)" accent="var(--accent)" />
        <button @click="gameStore.sidebarOpen = !gameStore.sidebarOpen" :style="{
          appearance: 'none', background: 'transparent', border: '1px solid var(--border)',
          color: 'var(--text-2)', width: '28px', height: '28px', cursor: 'pointer',
          display: 'grid', placeItems: 'center', fontSize: '14px', flexShrink: 0,
        }">{{ gameStore.sidebarOpen ? '‹' : '›' }}</button>
      </div>

      <template v-if="gameStore.sidebarOpen">
        <!-- User card -->
        <div style="background:var(--bg-1);border:1px solid var(--border);padding:12px;display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;background:var(--bg-3);display:grid;place-items:center">
            <PixelAvatar :scale="1.6" v-bind="look" :shadow="false" />
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ playerName }}</div>
            <div style="font-size:10px;color:var(--ok);font-family:var(--f-mono);letter-spacing:0.1em;text-transform:uppercase">● online · {{ online }}</div>
          </div>
        </div>

        <!-- Mundos (vindos do banco) -->
        <div style="display:flex;flex-direction:column;gap:4px">
          <div style="font-size:10px;letter-spacing:0.18em;color:var(--text-3);text-transform:uppercase;font-weight:600;padding:4px 6px">Mundos</div>
          <button
            v-for="m in maps" :key="m.id" @click="selectMap(m.id)"
            :style="{
              appearance: 'none', textAlign: 'left',
              background: currentId === m.id ? 'rgba(124,58,237,0.12)' : 'transparent',
              border: currentId === m.id ? '1px solid rgba(124,58,237,0.32)' : '1px solid transparent',
              color: currentId === m.id ? 'var(--text)' : 'var(--text-2)',
              padding: '8px 10px', fontSize: '13px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'inherit',
            }">
            <span style="flex:1">{{ m.name }}</span>
            <span v-if="currentId === m.id" style="font-size:9px;color:var(--accent);letter-spacing:0.16em;text-transform:uppercase;font-weight:700">atual</span>
          </button>
        </div>

        <!-- Você -->
        <div style="display:flex;flex-direction:column;gap:4px">
          <div style="font-size:10px;letter-spacing:0.18em;color:var(--text-3);text-transform:uppercase;font-weight:600;padding:4px 6px">Você</div>
          <button class="k-btn k-btn-ghost" @click="router.push('/character')" style="width:100%;justify-content:flex-start">Editar avatar</button>
          <button v-if="!auth.isGuest" class="k-btn k-btn-ghost" @click="router.push('/editor/new')" style="width:100%;justify-content:flex-start">Criar mundo</button>
          <button v-if="currentMap && currentMap.ownerId === auth.userId" class="k-btn k-btn-ghost" @click="router.push(`/editor/${currentId}`)" style="width:100%;justify-content:flex-start">Editar este mundo</button>
          <button v-if="!auth.isGuest" class="k-btn k-btn-ghost" @click="router.push('/admin')" style="width:100%;justify-content:flex-start">Administração</button>
          <button class="k-btn k-btn-ghost" @click="router.push('/feedback')" style="width:100%;justify-content:flex-start">Feedback / Reportar bug</button>
          <button class="k-btn k-btn-ghost" @click="leave" style="width:100%;justify-content:flex-start">Sair</button>
        </div>
      </template>
    </aside>

    <!-- Stage (PixiJS) -->
    <div style="position:relative;overflow:hidden;background:var(--bg-0)">
      <div ref="host" style="position:absolute;inset:0" @wheel.prevent="onWheel"></div>

      <!-- Zoom -->
      <div style="position:absolute;top:64px;right:16px;z-index:10;display:flex;flex-direction:column;gap:4px">
        <button class="k-key" style="cursor:pointer;width:30px;height:30px;font-size:16px" @click="zoomBy(1.15)" title="Zoom +">+</button>
        <button class="k-key" style="cursor:pointer;width:30px;height:30px;font-size:16px" @click="zoomBy(0.87)" title="Zoom −">−</button>
        <button class="k-key" style="cursor:pointer;width:30px;height:30px;font-size:14px" @click="scene?.rotateBy(90)" title="Girar câmera 90°">↻</button>
      </div>

      <!-- HUD top-left -->
      <div style="position:absolute;top:16px;left:16px;display:inline-flex;align-items:center;gap:10px;background:rgba(13,13,20,0.78);border:1px solid var(--border-strong);backdrop-filter:blur(10px);padding:8px 12px 8px 8px;z-index:10">
        <div style="width:36px;height:36px;background:var(--bg-3);display:grid;place-items:center;overflow:hidden">
          <PixelAvatar :scale="1.6" v-bind="look" :shadow="false" />
        </div>
        <div style="display:flex;flex-direction:column;line-height:1.1">
          <span style="font-size:13px;font-weight:600">{{ playerName }}</span>
          <span style="font-size:10px;color:var(--text-3);font-family:var(--f-mono);letter-spacing:0.12em;text-transform:uppercase">● {{ currentMap?.name || '…' }}</span>
        </div>
      </div>

      <!-- HUD top-right: online + lista -->
      <div style="position:absolute;top:16px;right:16px;background:rgba(13,13,20,0.82);border:1px solid var(--border-strong);backdrop-filter:blur(10px);padding:8px 12px;z-index:10;min-width:140px">
        <div style="color:var(--accent);font-weight:600;font-family:var(--f-mono);font-size:12px;letter-spacing:0.08em;margin-bottom:6px">{{ online }} online</div>
        <div style="display:flex;flex-direction:column;gap:2px;font-size:12px">
          <span style="color:var(--text)">● {{ playerName }} <span style="color:var(--text-4)">(você)</span> <span v-if="voiceOn">🎙</span></span>
          <span v-for="p in roomPeers" :key="p.id" style="color:var(--text-2)">● {{ p.name }} <span v-if="voicePeers.includes(p.id)">🔊</span></span>
        </div>
      </div>

      <!-- Proximidade + voz -->
      <div v-if="nearby" style="position:absolute;top:16px;left:50%;transform:translateX(-50%);background:rgba(124,58,237,0.18);border:1px solid var(--primary-hi);backdrop-filter:blur(10px);padding:6px 14px;font-size:12px;color:var(--text);z-index:10">
        perto de <strong>{{ nearby }}</strong>
      </div>

      <!-- Botão de voz (claro: rótulo + estado) -->
      <div style="position:absolute;bottom:16px;right:24px;z-index:20;display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <button
          :title="voiceOn ? 'Microfone ligado — clique pra desligar' : 'Clique pra falar por voz com quem está perto'"
          @click="toggleVoice"
          :style="{
            display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
            padding: '9px 14px', borderRadius: '22px', fontSize: '13px', fontWeight: 600,
            border: '1px solid ' + (voiceOn ? 'var(--ok)' : 'var(--border-strong)'),
            background: voiceOn ? 'rgba(52,211,153,0.22)' : 'rgba(13,13,20,0.85)', color: 'var(--text)',
          }"
        >{{ voiceOn ? '🎙 Microfone ligado' : '🔇 Falar por voz' }}</button>
        <span v-if="!voiceOn" style="font-size:11px;color:var(--text-3);background:rgba(13,13,20,0.7);padding:2px 8px;border-radius:4px">aproxime-se de alguém pra conversar por voz</span>
        <button v-else style="font-size:11px;color:var(--text-2);background:rgba(13,13,20,0.7);border:1px solid var(--border);padding:2px 8px;border-radius:4px;cursor:pointer" @click="voice.reconnect()">↻ reconectar (se a voz travar)</button>
      </div>

      <!-- Chat -->
      <div style="position:absolute;bottom:16px;left:16px;width:280px;z-index:10">
        <div v-if="messages.length" style="max-height:180px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;margin-bottom:6px">
          <div v-for="(m, i) in messages" :key="i" style="background:rgba(13,13,20,0.82);border:1px solid var(--border);padding:5px 9px;font-size:12px;line-height:1.4">
            <span style="color:var(--accent);font-weight:600">{{ m.name }}:</span>
            <span style="color:var(--text)"> {{ m.text }}</span>
          </div>
        </div>
        <input
          v-model="chatInput" maxlength="300" placeholder="Conversar… (Enter)"
          style="width:100%;box-sizing:border-box;background:rgba(13,13,20,0.85);border:1px solid var(--border-strong);color:var(--text);padding:8px 10px;font-size:13px;font-family:inherit"
          @keydown.enter="sendChat"
        />
      </div>

      <!-- HUD bottom -->
      <div style="position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:inline-flex;align-items:center;gap:14px;background:rgba(13,13,20,0.78);border:1px solid var(--border-strong);backdrop-filter:blur(10px);padding:8px 14px;font-size:11px;color:var(--text-2);letter-spacing:0.06em;z-index:10">
        <span style="display:inline-flex;gap:6px;align-items:center"><span class="k-key">W</span><span class="k-key">A</span><span class="k-key">S</span><span class="k-key">D</span><span style="color:var(--text-3)">mover</span></span>
        <span style="color:var(--text-4)">·</span>
        <span style="display:inline-flex;gap:6px;align-items:center"><span class="k-key">B</span><span style="color:var(--text-3)">dançar</span></span>
        <span style="color:var(--text-4)">·</span>
        <span style="display:inline-flex;gap:6px;align-items:center"><span class="k-key">G</span><span style="color:var(--text-3)">acenar</span></span>
        <template v-if="activeZone">
          <span style="color:var(--text-4)">·</span>
          <span style="display:inline-flex;gap:6px;align-items:center"><span class="k-key">E</span><span style="color:var(--accent)">{{ activeZone.action }}</span></span>
        </template>
      </div>

      <!-- Modal de interação -->
      <div v-if="gameStore.isModalOpen && activeModal" style="position:absolute;inset:0;background:rgba(0,0,0,0.62);backdrop-filter:blur(6px);display:grid;place-items:center;z-index:50;padding:24px" @click="closeModal">
        <div class="k-card" style="padding:28px;width:min(520px,100%);display:flex;flex-direction:column;gap:14px" @click.stop>
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span class="k-chip">interação</span>
            <button class="k-btn k-btn-ghost" style="padding:6px 10px" @click="closeModal">esc ✕</button>
          </div>
          <div>
            <h2 style="margin:0 0 6px;font-size:24px;font-weight:600;letter-spacing:-0.02em">{{ activeModal.name }}</h2>
            <p style="margin:0;color:var(--text-3);font-size:14px">{{ activeModal.action }}</p>
          </div>
          <div style="background:var(--bg-1);border:1px solid var(--border);padding:16px;font-size:13px;color:var(--text-2);line-height:1.6">
            Em breve. Esta estação será conectada à sua ferramenta ({{ activeModal.kind }}).
          </div>
        </div>
      </div>

      <!-- Controles touch (mobile) -->
      <div class="touch-ctl" style="position:absolute;bottom:80px;right:24px;z-index:20;display:grid;grid-template-columns:repeat(3,44px);grid-template-rows:repeat(3,44px);gap:4px;touch-action:none;user-select:none">
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

      <div v-if="error" style="position:absolute;top:60px;left:50%;transform:translateX(-50%);color:#f87171;font-size:13px;z-index:10">{{ error }}</div>
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
import { connectPresence, disconnectPresence, emitMove, switchMap, remotePlayers, chatMessages, emitChat, socketId } from '@/services/presence'
import { VoiceChat } from '@/services/webrtc'
import PixelAvatar from '@/components/pixel/PixelAvatar.vue'
import Logo from '@/components/logos/Logo.vue'

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

const look = computed<AvatarLook>(() => ({
  hairStyle: characterStore.hairStyle,
  hairColor: characterStore.hairColor,
  skin: characterStore.skin,
  topColor: characterStore.topColor,
  pantsColor: characterStore.pantsColor,
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
const lastSent = { facing: 'down' as Facing, pose: 'idle' as 'idle' | 'walk' | 'dance' | 'wave' | 'sit' }
// ids dos avatares remotos presentes na cena
const peerIds = new Set<string>()

function onKeyDown(e: KeyboardEvent) {
  // digitando no chat/inputs → não mexe no jogo
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  const k = e.key.toLowerCase()
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
function onKeyUp(e: KeyboardEvent) { keys.delete(e.key.toLowerCase()) }

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
  activeModal.value = z
  gameStore.isModalOpen = true
}
function closeModal() {
  gameStore.isModalOpen = false
  activeModal.value = null
}

function selectMap(id: string) {
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
    if (!gameStore.isModalOpen) {
      const sp = 5 * dt * (onWater(map, pos.x, pos.y) ? 0.5 : 1)
      if (keys.has('w') || keys.has('arrowup')) dy -= sp
      if (keys.has('s') || keys.has('arrowdown')) dy += sp
      if (keys.has('a') || keys.has('arrowleft')) dx -= sp
      if (keys.has('d') || keys.has('arrowright')) dx += sp
    }
    const moving = dx !== 0 || dy !== 0
    if (moving) sitting = false // mover levanta
    if (moving) {
      // facing pela direção na TELA; movimento remapeado pela rotação da câmera
      facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down')
      const rot = scene.getRotation()
      if (rot) {
        const c = Math.cos(-rot), s = Math.sin(-rot)
        const rdx = dx * c - dy * s, rdy = dx * s + dy * c
        dx = rdx; dy = rdy
      }
      const nx = pos.x + dx
      const ny = pos.y + dy
      if (!isSolid(map, Math.floor(nx), Math.floor(pos.y)) && !peerBlocks(nx, pos.y, pos.x, pos.y)) pos.x = nx
      if (!isSolid(map, Math.floor(pos.x), Math.floor(ny)) && !peerBlocks(pos.x, ny, pos.x, pos.y)) pos.y = ny
    }
    const emoting = Date.now() < emoteUntil
    const pose: 'idle' | 'walk' | 'dance' | 'wave' | 'sit' = sitting ? 'sit' : moving ? 'walk' : emoting ? 'wave' : dancing ? 'dance' : 'idle'
    // emite estado quando se move ou quando pose/direção mudam (dança parado conta)
    if (moving || pose !== lastSent.pose || facing !== lastSent.facing) {
      emitMove(pos.x, pos.y, facing, pose)
      lastSent.pose = pose
      lastSent.facing = facing
    }
    detectZone(map)

    const me = scene.avatar('me')
    if (me) {
      me.setFacing(facing)
      me.setPose(pose)
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
  router.push('/login')
}

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  clearInterval(stateTimer)
  persistState()
  voice.disable()
  disconnectPresence()
  scene?.destroy()
  scene = null
})
</script>

<style scoped>
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
