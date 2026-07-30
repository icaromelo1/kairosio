<template>
  <div
    ref="root"
    class="ms-window"
    :class="{ 'ms-window-min': minimized, 'ms-window-fs': fullscreen }"
    :style="frameStyle"
  >
    <div
      class="ms-bar"
      @pointerdown="onDragStart"
      @pointermove="onDragMove"
      @pointerup="onDragEnd"
      @pointercancel="onDragEnd"
      @lostpointercapture="onDragEnd"
    >
      <span class="ms-title">sala de voz</span>

      <span v-if="minimized" class="ms-strip ellipsis">{{ stripLabel }}</span>

      <span class="ms-bar-acts">
        <button
          type="button"
          class="ms-mode"
          :class="{ 'ms-mode-room': mode === 'room' }"
          :title="mode === 'room' ? 'Voz alcança a sala inteira — clique pra voltar à proximidade' : 'Voz alcança quem está perto — clique pra falar com a sala toda'"
          @click="emit('setMode', mode === 'room' ? 'proximity' : 'room')"
        >{{ mode === 'room' ? 'sala' : 'perto' }}</button>

        <button
          v-if="connected"
          type="button"
          class="ms-wbtn"
          title="Reconectar (se a voz travar)"
          @click="emit('reconnect')"
        ><PixelIcon name="reload" size="0.75rem" /></button>

        <button
          type="button"
          class="ms-wbtn"
          :title="minimized ? 'Expandir' : 'Minimizar'"
          @click="toggleMinimized"
        ><PixelIcon :name="minimized ? 'chevron-up' : 'minus'" size="0.75rem" /></button>

        <button
          v-if="!minimized"
          type="button"
          class="ms-wbtn"
          :title="fullscreen ? 'Sair da tela cheia' : 'Tela cheia'"
          @click="toggleFullscreen"
        ><PixelIcon name="expand" size="0.75rem" /></button>

        <button
          v-if="!connected"
          type="button"
          class="ms-wbtn"
          title="Fechar"
          @click="emit('close')"
        ><PixelIcon name="close" size="0.75rem" /></button>
      </span>
    </div>

    <template v-if="!minimized">
      <div class="ms-tiles">
        <button
          v-for="tile in tiles"
          :key="tile.key"
          type="button"
          class="ms-tile"
          :class="{
            'ms-tile-speaking': tile.speaking,
            'ms-tile-far': tile.far,
            'ms-tile-self': tile.self,
          }"
          :title="tileTitle(tile)"
          @click="onTileClick(tile)"
        >
          <span :ref="(el) => setHost(tile.key, el)" class="ms-tile-video" />

          <PixelAvatar v-if="!tile.video" :scale="3" v-bind="tile.look" :shadow="false" />

          <span v-if="tile.far" class="ms-tile-far-hint">aproxime-se</span>

          <!-- canto oposto ao nome de propósito: "eu silenciei" é ação minha,
               "está mudo" é estado dele — a posição separa os dois sem legenda -->
          <span v-if="tile.mutedByMe" class="ms-tile-silenced">
            <PixelIcon name="volume" :off="true" size="0.75rem" />
          </span>

          <span class="ms-tile-label">
            <PixelIcon v-if="tile.micOff" name="mic" :off="true" size="0.75rem" class="ms-tile-mic-off" />
            <span class="ellipsis">{{ tile.name }}</span>
            <span v-if="tile.self" class="ms-tile-you">você</span>
          </span>
        </button>
      </div>

      <div class="ms-ctrls">
        <template v-if="connected">
          <button
            type="button"
            class="ms-ctrl"
            :class="micMuted ? 'ms-ctrl-off' : 'ms-ctrl-on'"
            :disabled="!micAvailable"
            :title="micTitle"
            @click="toggleMic"
          ><PixelIcon :name="micMuted ? 'mic-off' : 'mic'" size="1rem" /></button>

          <button
            type="button"
            class="ms-ctrl"
            :class="cameraOn ? 'ms-ctrl-on' : 'ms-ctrl-off'"
            :title="cameraOn ? 'Desligar sua câmera' : 'Ligar sua câmera'"
            @click="toggleCamera"
          ><PixelIcon name="video" :off="!cameraOn" size="1rem" /></button>

          <button
            type="button"
            class="ms-ctrl ms-ctrl-leave"
            title="Sair da chamada"
            @click="emit('leave')"
          ><PixelIcon name="close" size="1rem" /></button>
        </template>

        <button
          v-else
          type="button"
          class="k-btn k-btn-primary k-btn-sm ms-join"
          :disabled="connecting"
          title="Entrar na voz — o microfone começa desligado"
          @click="emit('connect')"
        >
          <PixelIcon name="headphone" size="0.875rem" />
          {{ connecting ? 'conectando…' : 'entrar na voz' }}
        </button>
      </div>

      <div
        v-if="!fullscreen"
        class="ms-resize"
        title="Redimensionar"
        @pointerdown="onResizeStart"
        @pointermove="onResizeMove"
        @pointerup="onResizeEnd"
        @pointercancel="onResizeEnd"
        @lostpointercapture="onResizeEnd"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { media } from '@/services/media'
import { sanitizeLook, type AvatarLook } from '@/game/pixi/avatar'
import PixelAvatar from '@/components/pixel/PixelAvatar.vue'
import PixelIcon from '@/components/PixelIcon.vue'

interface PeerLook {
  name: string
  look: AvatarLook
}

interface StageTile {
  key: string
  name: string
  look: AvatarLook
  self: boolean
  speaking: boolean
  micOff: boolean
  mutedByMe: boolean
  video: boolean
  far: boolean
}

const props = defineProps<{
  selfName: string
  selfLook: AvatarLook
  peerLooks: Record<string, PeerLook>
  mode: 'proximity' | 'room'
  connecting?: boolean
}>()

const emit = defineEmits<{
  close: []
  connect: []
  leave: []
  reconnect: []
  setMode: [mode: 'proximity' | 'room']
}>()

const SELF_KEY = '@self'
const STORAGE_KEY = 'kairos_media_stage'
const MIN_W = 260
const MIN_H = 220
const EDGE = 8
const DEFAULT_LOOK = sanitizeLook(null)

const root = ref<HTMLElement | null>(null)
const minimized = ref(false)
const fullscreen = ref(false)
const frame = reactive({ x: 0, y: 0, w: 0, h: 0 })

const connected = computed(() => media.state.connected)
const micMuted = computed(() => media.state.micMuted)
const micAvailable = computed(() => media.state.micAvailable)
const cameraOn = computed(() => media.state.cameraOn)

const micTitle = computed(() => {
  if (!micAvailable.value) return 'Sem acesso ao microfone — você só consegue ouvir'
  return micMuted.value ? 'Ligar seu microfone' : 'Desligar seu microfone'
})

const tiles = computed<StageTile[]>(() => {
  const list: StageTile[] = [{
    key: SELF_KEY,
    name: props.selfName,
    look: props.selfLook,
    self: true,
    speaking: media.state.selfSpeaking,
    micOff: micMuted.value || !micAvailable.value,
    mutedByMe: false,
    video: !!media.selfVideoElement.value,
    far: false,
  }]
  if (!connected.value) return list
  for (const peer of media.peers.values()) {
    const presence = props.peerLooks[peer.identity]
    list.push({
      key: peer.identity,
      name: presence?.name || peer.name || 'convidado',
      look: presence?.look || DEFAULT_LOOK,
      self: false,
      speaking: peer.speaking,
      micOff: peer.micOff,
      mutedByMe: peer.mutedByMe,
      video: media.videoElements.value.has(peer.identity),
      far: !peer.subscribed,
    })
  }
  return list
})

const stripLabel = computed(() => {
  const speaking = tiles.value.filter((t) => t.speaking).map((t) => (t.self ? 'você' : t.name))
  if (speaking.length) return speaking.join(', ')
  if (!connected.value) return 'fora da chamada'
  return `${tiles.value.length} na chamada`
})

const frameStyle = computed(() => {
  if (fullscreen.value) return undefined
  return {
    left: `${frame.x}px`,
    top: `${frame.y}px`,
    width: `${frame.w}px`,
    height: minimized.value ? undefined : `${frame.h}px`,
  }
})

function tileTitle(tile: StageTile): string {
  if (tile.self) return micTitle.value
  const parts: string[] = []
  if (tile.micOff) parts.push(`${tile.name} está com o microfone desligado`)
  if (tile.far) parts.push('fora do alcance — aproxime-se pra ouvir')
  parts.push(tile.mutedByMe ? 'silenciado por você — clique pra voltar a ouvir' : `clique pra silenciar ${tile.name}`)
  return parts.join(' · ')
}

function toggleMic() {
  if (!micAvailable.value) return
  void media.setMicMuted(!micMuted.value)
}

function toggleCamera() {
  void media.setCameraEnabled(!cameraOn.value)
}

function onTileClick(tile: StageTile) {
  if (tile.self) {
    toggleMic()
    return
  }
  media.setPeerMuted(tile.key, !tile.mutedByMe)
}

// ---- elementos de vídeo (criados pelo LiveKit, anexados na mão) ----
const hosts = new Map<string, HTMLElement>()
let syncQueued = false

function videoFor(key: string): HTMLVideoElement | null {
  if (key === SELF_KEY) return media.selfVideoElement.value
  return media.videoElements.value.get(key) || null
}

function clearHost(host: HTMLElement) {
  while (host.firstChild) host.removeChild(host.firstChild)
}

function syncVideos() {
  for (const [key, host] of hosts) {
    const video = videoFor(key)
    for (const child of Array.from(host.children)) {
      if (child !== video) host.removeChild(child)
    }
    if (!video || video.parentElement === host) continue
    video.classList.add('ms-video')
    if (key === SELF_KEY) video.classList.add('ms-video-self')
    host.appendChild(video)
  }
}

function queueSync() {
  if (syncQueued) return
  syncQueued = true
  void nextTick(() => {
    syncQueued = false
    syncVideos()
  })
}

function setHost(key: string, el: unknown) {
  if (el instanceof HTMLElement) {
    hosts.set(key, el)
    queueSync()
    return
  }
  const old = hosts.get(key)
  if (old) clearHost(old)
  hosts.delete(key)
}

watch(
  [() => media.videoElements.value, () => media.selfVideoElement.value, () => tiles.value.map((t) => t.key).join('|')],
  queueSync,
)

// ---- janela: posição, tamanho, minimizar, tela cheia ----
function clampFrame() {
  const maxW = Math.max(MIN_W, window.innerWidth - EDGE * 2)
  const maxH = Math.max(MIN_H, window.innerHeight - EDGE * 2)
  frame.w = Math.min(Math.max(frame.w, MIN_W), maxW)
  frame.h = Math.min(Math.max(frame.h, MIN_H), maxH)
  const visibleH = minimized.value ? 40 : frame.h
  frame.x = Math.min(Math.max(frame.x, 0), Math.max(0, window.innerWidth - frame.w))
  frame.y = Math.min(Math.max(frame.y, 0), Math.max(0, window.innerHeight - visibleH))
}

function defaultFrame() {
  frame.w = Math.min(560, window.innerWidth - EDGE * 2)
  frame.h = Math.min(420, window.innerHeight - EDGE * 2)
  frame.x = window.innerWidth - frame.w - 24
  frame.y = Math.max(EDGE, (window.innerHeight - frame.h) / 2)
}

function restoreFrame() {
  defaultFrame()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as Partial<Record<'x' | 'y' | 'w' | 'h', number>> & { minimized?: boolean }
    for (const key of ['x', 'y', 'w', 'h'] as const) {
      const value = saved[key]
      if (typeof value === 'number' && Number.isFinite(value)) frame[key] = value
    }
    minimized.value = !!saved.minimized
  } catch {
    // preferência corrompida no localStorage nunca impede a janela de abrir
  }
}

function persistFrame() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...frame, minimized: minimized.value }))
  } catch {
    // storage cheio/bloqueado não pode derrubar a janela
  }
}

function toggleMinimized() {
  minimized.value = !minimized.value
  clampFrame()
  persistFrame()
}

function restore() {
  if (!minimized.value) return
  toggleMinimized()
}

// o GamePage usa isto pro atalho da voz: em chamada a janela minimiza em vez de
// fechar, senão o microfone segue aberto sem nada na tela dizendo isso
defineExpose({ toggleMinimized, restore })

interface WebkitFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => void
}
interface WebkitFullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => void
}

function isFullscreen(): boolean {
  const doc = document as WebkitFullscreenDocument
  return !!(document.fullscreenElement || doc.webkitFullscreenElement)
}

function toggleFullscreen() {
  const node = root.value as WebkitFullscreenElement | null
  if (!node) return
  if (isFullscreen()) {
    const doc = document as WebkitFullscreenDocument
    if (document.exitFullscreen) void document.exitFullscreen().catch(() => {})
    else doc.webkitExitFullscreen?.()
    return
  }
  if (node.requestFullscreen) void node.requestFullscreen().catch(() => {})
  else node.webkitRequestFullscreen?.()
}

function onFullscreenChange() {
  const doc = document as WebkitFullscreenDocument
  fullscreen.value = document.fullscreenElement === root.value || doc.webkitFullscreenElement === root.value
}

// ---- arrastar / redimensionar (pointer capture: zero listener global) ----
let dragPointer = -1
let dragDX = 0
let dragDY = 0
let resizePointer = -1
let resizeX = 0
let resizeY = 0
let resizeW = 0
let resizeH = 0

// a captura vem ANTES de armar o estado: se ela falhar (ponteiro já encerrado),
// o drag nem começa em vez de ficar armado sem receber o pointerup
function onDragStart(e: PointerEvent) {
  if (fullscreen.value || e.button !== 0) return
  if ((e.target as HTMLElement).closest('button')) return
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  dragPointer = e.pointerId
  dragDX = e.clientX - frame.x
  dragDY = e.clientY - frame.y
}

function onDragMove(e: PointerEvent) {
  if (e.pointerId !== dragPointer) return
  frame.x = e.clientX - dragDX
  frame.y = e.clientY - dragDY
  clampFrame()
}

// pointerup e lostpointercapture chegam os dois: o guard do pointerId faz o
// segundo virar no-op (a captura é liberada pelo próprio navegador no pointerup)
function onDragEnd(e: PointerEvent) {
  if (e.pointerId !== dragPointer) return
  dragPointer = -1
  persistFrame()
}

function onResizeStart(e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  resizePointer = e.pointerId
  resizeX = e.clientX
  resizeY = e.clientY
  resizeW = frame.w
  resizeH = frame.h
}

// o teto é a borda da viewport a partir de onde a janela JÁ está: sem isso,
// crescer encostado na direita empurrava a janela pra esquerda em vez de parar
function onResizeMove(e: PointerEvent) {
  if (e.pointerId !== resizePointer) return
  frame.w = Math.min(resizeW + (e.clientX - resizeX), window.innerWidth - frame.x)
  frame.h = Math.min(resizeH + (e.clientY - resizeY), window.innerHeight - frame.y)
  clampFrame()
}

function onResizeEnd(e: PointerEvent) {
  if (e.pointerId !== resizePointer) return
  resizePointer = -1
  persistFrame()
}

function onViewportResize() {
  clampFrame()
}

onMounted(() => {
  restoreFrame()
  clampFrame()
  window.addEventListener('resize', onViewportResize)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onFullscreenChange)
  queueSync()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onViewportResize)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
  // os <video> pertencem ao media.ts (que reanexa no próximo mount): só saem
  // daqui do DOM, sem parar a track
  for (const host of hosts.values()) clearHost(host)
  hosts.clear()
})
</script>

<style scoped>
.ms-window {
  position: fixed;
  z-index: 60;
  display: flex;
  flex-direction: column;
  background: var(--bg-2);
  border: 0.125rem solid var(--border-strong);
  box-shadow: var(--ui-shadow);
  overflow: hidden;
}

.ms-window-fs {
  width: 100%;
  height: 100%;
  border: 0;
  box-shadow: none;
}

.ms-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  background: var(--bg-3);
  border-bottom: 0.0625rem solid var(--border);
  cursor: grab;
  touch-action: none;
  user-select: none;
  flex: none;
}
.ms-window-fs .ms-bar { cursor: default; }

.ms-title {
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--primary-hi);
  white-space: nowrap;
}

.ms-strip {
  flex: 1;
  min-width: 0;
  font-family: var(--f-mono);
  font-size: 0.6875rem;
  color: var(--text-2);
}

.ms-bar-acts {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: none;
}

.ms-mode {
  appearance: none;
  font-family: var(--f-pixel);
  font-size: 0.4375rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-2);
  background: var(--bg-4);
  border: 0.0625rem solid var(--border-strong);
  padding: 0.25rem 0.375rem;
  cursor: pointer;
}
.ms-mode-room {
  color: var(--accent);
  border-color: var(--accent-lo);
}

.ms-wbtn {
  appearance: none;
  width: 1.25rem;
  height: 1.25rem;
  display: grid;
  place-items: center;
  padding: 0;
  color: var(--text-2);
  background: var(--bg-4);
  border: 0.0625rem solid var(--border-strong);
  cursor: pointer;
}
.ms-wbtn:hover {
  color: var(--text);
  border-color: var(--primary-hi);
}

.ms-tiles {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
  align-content: start;
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--bg-0);
}

.ms-tile {
  appearance: none;
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 16 / 10;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  background: var(--bg-1);
  border: 0.125rem solid var(--border);
  color: var(--text);
  font-family: inherit;
  cursor: pointer;
}
.ms-tile-self { border-color: var(--border-strong); }
.ms-tile-speaking { border-color: var(--ok); }
.ms-tile-far { opacity: 0.42; }

.ms-tile-video {
  position: absolute;
  inset: 0;
}
.ms-tile-video :deep(.ms-video) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: var(--bg-0);
}
.ms-tile-video :deep(.ms-video-self) {
  transform: scaleX(-1);
}

.ms-tile-far-hint {
  position: absolute;
  top: 0.25rem;
  left: 0.25rem;
  font-family: var(--f-pixel);
  font-size: 0.4375rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent);
  background: var(--bg-0);
  padding: 0.125rem 0.25rem;
}

.ms-tile-label {
  position: absolute;
  left: 0.25rem;
  right: 0.25rem;
  bottom: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
  font-family: var(--f-mono);
  font-size: 0.6875rem;
  color: var(--text);
  background: var(--bg-0);
  padding: 0.0625rem 0.25rem;
}

.ms-tile-mic-off { color: var(--err); }

.ms-tile-silenced {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  display: grid;
  place-items: center;
  padding: 0.125rem;
  color: var(--text-3);
  background: var(--bg-0);
  border: 0.0625rem solid var(--border-strong);
}

.ms-tile-you {
  margin-left: auto;
  flex: none;
  font-size: 0.5625rem;
  color: var(--text-4);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.ms-ctrls {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem;
  background: var(--bg-3);
  border-top: 0.0625rem solid var(--border);
}

.ms-ctrl {
  appearance: none;
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  padding: 0;
  color: var(--text);
  background: var(--bg-4);
  border: 0.0625rem solid var(--border-strong);
  cursor: pointer;
}
.ms-ctrl:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.ms-ctrl-on {
  background: var(--primary);
  border-color: var(--primary-hi);
  color: var(--text);
}
.ms-ctrl-off {
  background: var(--bg-4);
  border-color: var(--border-strong);
  color: var(--text-2);
}
.ms-ctrl-leave {
  background: var(--err);
  border-color: var(--err);
  color: var(--bg-0);
}

.ms-join { width: 100%; }

.ms-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 1rem;
  height: 1rem;
  cursor: nwse-resize;
  touch-action: none;
  background-image: repeating-linear-gradient(
    -45deg,
    var(--border-strong) 0 0.125rem,
    transparent 0.125rem 0.25rem
  );
}

@media (prefers-reduced-motion: no-preference) {
  .ms-tile-speaking {
    animation: msSpeak 1.2s steps(2, jump-none) infinite;
  }
  @keyframes msSpeak {
    0%, 100% { box-shadow: inset 0 0 0 0.0625rem var(--ok); }
    50% { box-shadow: inset 0 0 0 0.0625rem transparent; }
  }
}
</style>
