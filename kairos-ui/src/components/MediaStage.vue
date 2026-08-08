<template>
  <div
    ref="root"
    class="ms-window"
    :class="{ 'ms-window-hidden': minimized, 'ms-window-fs': fullscreen }"
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
      <div class="ms-tiles" :class="{ 'ms-tiles-foco': emFoco }">
        <template v-for="tile in tiles" :key="tile.key">
          <button
            v-if="tile.kind === 'person'"
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

          <!-- transmissão vira um tile PRÓPRIO, ao lado do tile de pessoa: quem
               compartilha aparece duas vezes, como no Discord. Não pode ser um
               <button> porque carrega botões próprios (assistir / tela cheia). -->
          <div
            v-else
            :ref="(el) => setTileEl(tile.key, el)"
            class="ms-tile ms-tile-screen"
            :class="{ 'ms-tile-far': tile.far }"
          >
            <span :ref="(el) => setHost(tile.key, el)" class="ms-tile-video" />

            <span v-if="!tile.video" class="ms-screen-idle">
              <PixelIcon name="monitor" size="1.75rem" />
              <span v-if="tile.far" class="ms-screen-hint">aproxime-se para assistir</span>
              <span v-else-if="tile.self" class="ms-screen-hint">sua transmissão</span>
              <button
                v-else
                type="button"
                class="k-btn k-btn-primary k-btn-xs"
                :title="`Assistir a transmissão de ${tile.name} — o vídeo só começa a baixar agora`"
                @click="setWatching(tile, true)"
              >
                <PixelIcon name="share" size="0.75rem" />assistir
              </button>
            </span>

            <span class="ms-live">
              <span class="ms-live-tag">ao vivo</span>
              <span v-if="statsLabel(tile)" class="ms-live-stats">{{ statsLabel(tile) }}</span>
            </span>

            <span class="ms-screen-acts">
              <button
                v-if="tile.video"
                type="button"
                class="ms-wbtn"
                title="Tela cheia"
                @click="tileFullscreen(tile.key)"
              ><PixelIcon name="expand" size="0.75rem" /></button>

              <button
                v-if="tile.watching"
                type="button"
                class="ms-wbtn"
                title="Parar de assistir — libera a banda"
                @click="setWatching(tile, false)"
              ><PixelIcon name="close" size="0.75rem" /></button>
            </span>

            <span class="ms-tile-label">
              <PixelIcon name="monitor" size="0.75rem" />
              <span class="ellipsis">{{ tile.name }}</span>
              <span class="ms-tile-you">tela</span>
            </span>
          </div>
        </template>
      </div>

      <div v-if="screenError" class="ms-screen-error">{{ screenError }}</div>

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

          <!-- desligar o som é geral e vive aqui e no rodapé da barra lateral;
               silenciar uma pessoa só continua sendo o clique no tile dela -->
          <button
            type="button"
            class="ms-ctrl"
            :class="deafened ? 'ms-ctrl-deaf' : 'ms-ctrl-off'"
            :title="deafened ? 'Ligar o som de todo mundo' : 'Desligar o som de todo mundo'"
            @click="toggleSound"
          ><PixelIcon name="volume-2" :off="deafened" size="1rem" /></button>

          <button
            type="button"
            class="ms-ctrl"
            :class="cameraOn ? 'ms-ctrl-on' : 'ms-ctrl-off'"
            :title="cameraOn ? 'Desligar sua câmera' : 'Ligar sua câmera'"
            @click="toggleCamera"
          ><PixelIcon name="video" :off="!cameraOn" size="1rem" /></button>

          <span ref="screenWrap" class="ms-screen-ctrl">
            <button
              type="button"
              class="ms-ctrl"
              :class="screenOn ? 'ms-ctrl-on' : 'ms-ctrl-off'"
              :disabled="screenBusy"
              :title="screenTitle"
              @click="onScreenClick"
            >
              <!-- o pixelarticons não tem ícone de compartilhar tela: monitor +
                   share juntos, com a barra diagonal quando está desligado -->
              <span class="ms-screen-icon">
                <PixelIcon name="monitor" :off="!screenOn" size="1rem" />
                <PixelIcon name="share" size="0.5rem" class="ms-screen-badge" />
              </span>
            </button>

            <span v-if="qualityOpen" class="ms-qmenu">
              <span class="ms-qmenu-title">compartilhar tela</span>

              <button type="button" class="ms-qopt" @click="share('detail')">
                <span class="ms-qopt-name">nitidez</span>
                <span class="ms-qopt-desc">texto e código legíveis · 720p a 30fps</span>
              </button>

              <button type="button" class="ms-qopt" @click="share('motion')">
                <span class="ms-qopt-name">fluidez</span>
                <span class="ms-qopt-desc">jogo e vídeo sem engasgo · 720p a 60fps</span>
              </button>

              <span class="ms-qmenu-note">
                o som só vem se você escolher <b>aba do navegador</b> na janela
                seguinte — tela inteira não captura áudio, e nem todo navegador
                oferece a opção
              </span>
            </span>
          </span>

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
          title="Entrar na voz deste mundo"
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
import { media, SELF_KEY, type ScreenMode, type ScreenStats } from '@/services/media'
import { sanitizeLook, type AvatarLook } from '@/game/pixi/avatar'
import PixelAvatar from '@/components/pixel/PixelAvatar.vue'
import PixelIcon from '@/components/PixelIcon.vue'

interface PeerLook {
  name: string
  look: AvatarLook
}

interface StageTile {
  key: string
  kind: 'person' | 'screen'
  // identity do dono (SELF_KEY quando sou eu) — o key ganha prefixo no tile de tela
  owner: string
  name: string
  look: AvatarLook
  self: boolean
  speaking: boolean
  micOff: boolean
  mutedByMe: boolean
  video: boolean
  far: boolean
  watching: boolean
  stats: ScreenStats | null
}

const props = defineProps<{
  selfName: string
  selfLook: AvatarLook
  peerLooks: Record<string, PeerLook>
  connecting?: boolean
}>()

const emit = defineEmits<{
  close: []
  connect: []
  leave: []
  reconnect: []
}>()

const STORAGE_KEY = 'kairos_media_stage'
const SCREEN_PREFIX = 'screen:'
const MIN_W = 260
const MIN_H = 220
const EDGE = 8
const DEFAULT_LOOK = sanitizeLook(null)

const root = ref<HTMLElement | null>(null)
const screenWrap = ref<HTMLElement | null>(null)
const minimized = ref(false)
const fullscreen = ref(false)
const qualityOpen = ref(false)
const frame = reactive({ x: 0, y: 0, w: 0, h: 0 })

const connected = computed(() => media.state.connected)
const micMuted = computed(() => media.state.micMuted)
const micAvailable = computed(() => media.state.micAvailable)
const cameraOn = computed(() => media.state.cameraOn)
const screenOn = computed(() => media.state.screenOn)
const screenBusy = computed(() => media.state.screenBusy)
const screenError = computed(() => media.state.screenError)
const deafened = computed(() => media.state.deafened)

const micTitle = computed(() => {
  if (!micAvailable.value) return 'Sem acesso ao microfone — você só consegue ouvir'
  return micMuted.value ? 'Ligar seu microfone' : 'Desligar seu microfone'
})

const screenTitle = computed(() => {
  if (screenBusy.value) return 'Aguardando você escolher a tela…'
  return screenOn.value ? 'Parar de compartilhar a tela' : 'Compartilhar sua tela'
})

function personTile(over: Partial<StageTile> & Pick<StageTile, 'key' | 'owner' | 'name' | 'look'>): StageTile {
  return {
    kind: 'person',
    self: false,
    speaking: false,
    micOff: false,
    mutedByMe: false,
    video: false,
    far: false,
    watching: false,
    stats: null,
    ...over,
  }
}

function screenTile(owner: string, name: string, self: boolean, far: boolean, watching: boolean): StageTile {
  const key = SCREEN_PREFIX + owner
  return {
    key,
    kind: 'screen',
    owner,
    name,
    look: DEFAULT_LOOK,
    self,
    speaking: false,
    micOff: false,
    mutedByMe: false,
    video: !!videoFor(key),
    far,
    watching,
    stats: media.screenStats.get(owner) || null,
  }
}

const tiles = computed<StageTile[]>(() => {
  const list: StageTile[] = [personTile({
    key: SELF_KEY,
    owner: SELF_KEY,
    name: props.selfName,
    look: props.selfLook,
    self: true,
    speaking: media.state.selfSpeaking,
    micOff: micMuted.value || !micAvailable.value,
    video: !!media.selfVideoElement.value,
  })]
  if (!connected.value) return list
  // watching=false na minha própria tela: "parar de assistir" não faz sentido em
  // quem publica — quem para é o botão da barra de controles
  if (screenOn.value) list.push(screenTile(SELF_KEY, props.selfName, true, false, false))
  for (const peer of media.peers.values()) {
    const presence = props.peerLooks[peer.identity]
    const name = presence?.name || peer.name || 'convidado'
    list.push(personTile({
      key: peer.identity,
      owner: peer.identity,
      name,
      look: presence?.look || DEFAULT_LOOK,
      speaking: peer.speaking,
      micOff: peer.micOff,
      mutedByMe: peer.mutedByMe,
      video: media.videoElements.value.has(peer.identity),
      far: !peer.subscribed,
    }))
    if (peer.screen) list.push(screenTile(peer.identity, name, false, !peer.videoWanted, peer.watching))
  }
  return list
})

const emFoco = computed(() => tiles.value.some((t) => t.kind === 'screen' && t.video))

watch(emFoco, (agora, antes) => {
  if (agora && !antes) minimized.value = false
})

const stripLabel = computed(() => {
  const speaking = tiles.value.filter((t) => t.speaking).map((t) => (t.self ? 'você' : t.name))
  if (speaking.length) return speaking.join(', ')
  if (!connected.value) return 'fora da chamada'
  return `${tiles.value.filter((t) => t.kind === 'person').length} na chamada`
})

// mostra o MEDIDO, não o configurado: se a rede derrubar a camada do simulcast,
// o badge cai junto em vez de mentir a qualidade escolhida
function statsLabel(tile: StageTile): string {
  const stats = tile.stats
  if (!stats?.width || !stats.height) return ''
  const size = `${stats.width}×${stats.height}`
  return stats.fps > 0 ? `${size} · ${stats.fps}fps` : size
}

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
  // sem isto, quem está com o som geral desligado clicaria em "voltar a ouvir"
  // e seguiria sem ouvir nada, sem entender por quê
  if (deafened.value) parts.push('seu som está desligado')
  parts.push(tile.mutedByMe ? 'silenciado por você — clique pra voltar a ouvir' : `clique pra silenciar ${tile.name}`)
  return parts.join(' · ')
}

function toggleMic() {
  if (!micAvailable.value) return
  void media.setMicMuted(!micMuted.value)
}

function toggleSound() {
  media.setDeafened(!deafened.value)
}

function toggleCamera() {
  void media.setCameraEnabled(!cameraOn.value)
}

function onTileClick(tile: StageTile) {
  if (tile.self) {
    toggleMic()
    return
  }
  media.setPeerMuted(tile.owner, !tile.mutedByMe)
}

// ---- compartilhar tela ----
function onScreenClick() {
  if (screenOn.value) {
    qualityOpen.value = false
    void media.stopScreenShare()
    return
  }
  qualityOpen.value = !qualityOpen.value
}

function share(mode: ScreenMode) {
  qualityOpen.value = false
  void media.startScreenShare(mode)
}

// nada de vídeo desce antes deste clique: é o opt-in que mantém a banda
// proporcional ao interesse real
function setWatching(tile: StageTile, on: boolean) {
  media.setWatching(tile.owner, on)
}

// ---- elementos de vídeo (criados pelo LiveKit, anexados na mão) ----
const hosts = new Map<string, HTMLElement>()
let syncQueued = false

function videoFor(key: string): HTMLVideoElement | null {
  if (key === SELF_KEY) return media.selfVideoElement.value
  if (key === SCREEN_PREFIX + SELF_KEY) return media.selfScreenElement.value
  if (key.startsWith(SCREEN_PREFIX)) return media.screenElements.value.get(key.slice(SCREEN_PREFIX.length)) || null
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
    // tela compartilhada é recortada por 'cover': código nas bordas sumiria
    if (key.startsWith(SCREEN_PREFIX)) video.classList.add('ms-video-screen')
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

// só os tiles de transmissão guardam o elemento: é neles que a tela cheia é pedida
const tileEls = new Map<string, HTMLElement>()

function setTileEl(key: string, el: unknown) {
  if (el instanceof HTMLElement) tileEls.set(key, el)
  else tileEls.delete(key)
}

watch(
  [
    () => media.videoElements.value,
    () => media.selfVideoElement.value,
    () => media.screenElements.value,
    () => media.selfScreenElement.value,
    () => tiles.value.map((t) => t.key).join('|'),
  ],
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

function enterFullscreen(node: WebkitFullscreenElement) {
  if (node.requestFullscreen) void node.requestFullscreen().catch(() => {})
  else node.webkitRequestFullscreen?.()
}

function exitFullscreen() {
  const doc = document as WebkitFullscreenDocument
  if (document.exitFullscreen) void document.exitFullscreen().catch(() => {})
  else doc.webkitExitFullscreen?.()
}

function toggleFullscreen() {
  const node = root.value as WebkitFullscreenElement | null
  if (!node) return
  if (isFullscreen()) {
    exitFullscreen()
    return
  }
  enterFullscreen(node)
}

// tela cheia no TILE, não na janela: o onFullscreenChange compara com o root e
// segue dizendo que a janela não está em tela cheia, então o layout não muda
function tileFullscreen(key: string) {
  if (isFullscreen()) {
    exitFullscreen()
    return
  }
  const node = tileEls.get(key) as WebkitFullscreenElement | undefined
  if (node) enterFullscreen(node)
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

// listener único e simétrico (registra no mount, remove no unmount) em vez de um
// por abertura do menu: fase de captura pra rodar antes do clique do próprio botão
function onDocumentPointerDown(e: PointerEvent) {
  if (!qualityOpen.value) return
  const wrap = screenWrap.value
  if (wrap && e.target instanceof Node && wrap.contains(e.target)) return
  qualityOpen.value = false
}

onMounted(() => {
  restoreFrame()
  clampFrame()
  window.addEventListener('resize', onViewportResize)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onFullscreenChange)
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  queueSync()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onViewportResize)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  // os <video> pertencem ao media.ts (que reanexa no próximo mount): só saem
  // daqui do DOM, sem parar a track
  for (const host of hosts.values()) clearHost(host)
  hosts.clear()
  tileEls.clear()
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

.ms-window-hidden {
  display: none;
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
  font-family: var(--f-sans);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-2);
}

.ms-bar-acts {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: none;
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
.ms-tile-video :deep(.ms-video-screen) {
  object-fit: contain;
}

.ms-tile-screen {
  border-color: var(--accent-lo);
  background: var(--bg-0);
}

.ms-tiles-foco {
  grid-template-columns: repeat(auto-fit, minmax(5rem, 1fr));
}
.ms-tiles-foco .ms-tile-screen {
  grid-column: 1 / -1;
  aspect-ratio: 16 / 9;
  max-height: 62vh;
  border-color:var(--accent-texto);
  border-width: 0.1875rem;
  order: -1;
}
.ms-tiles-foco .ms-tile-screen .ms-tile-video :deep(.ms-video-screen) {
  object-fit: contain;
}
.ms-tile-screen:fullscreen {
  aspect-ratio: auto;
  width: 100%;
  height: 100%;
  border: 0;
}

.ms-screen-idle {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  color: var(--text-3);
}

.ms-screen-hint {
  font-family: var(--f-sans);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-3);
  text-align: center;
}

.ms-live {
  position: absolute;
  top: 0.25rem;
  left: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  max-width: calc(100% - 0.5rem);
  padding: 0.125rem 0.25rem;
  background: var(--bg-0);
  border: 0.0625rem solid var(--accent-lo);
}

.ms-live-tag {
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--err);
  white-space: nowrap;
}

.ms-live-stats {
  font-family: var(--f-num);
  font-size: 0.75rem;
  color: var(--text-2);
  white-space: nowrap;
}

.ms-screen-acts {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  display: flex;
  gap: 0.25rem;
}

.ms-tile-far-hint {
  position: absolute;
  top: 0.25rem;
  left: 0.25rem;
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent-texto);
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
  font-family: var(--f-sans);
  font-size: 0.75rem;
  font-weight: 600;
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
.ms-ctrl-deaf {
  background: var(--bg-4);
  border-color: var(--err);
  color: var(--err);
}
.ms-ctrl-leave {
  background: var(--err);
  border-color: var(--err);
  color: var(--bg-0);
}

.ms-join { width: 100%; }

.ms-screen-ctrl {
  position: relative;
  display: inline-flex;
}

.ms-screen-icon {
  position: relative;
  display: inline-flex;
}
.ms-screen-badge {
  position: absolute;
  right: -0.1875rem;
  bottom: -0.1875rem;
  color: var(--accent-texto);
}

.ms-qmenu {
  position: absolute;
  bottom: calc(100% + 0.375rem);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  display: grid;
  gap: 0.25rem;
  width: 15rem;
  padding: 0.5rem;
  background: var(--bg-2);
  border: 0.125rem solid var(--border-strong);
  box-shadow: var(--ui-shadow);
}

.ms-qmenu-title {
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--primary-hi);
}

.ms-qmenu-note {
  font-family: var(--f-sans);
  font-size: 0.6875rem;
  line-height: 1.4;
  color: var(--text-3);
}
.ms-qmenu-note b { color: var(--text-2); }

.ms-qopt {
  appearance: none;
  display: grid;
  gap: 0.125rem;
  text-align: left;
  padding: 0.375rem 0.5rem;
  background: var(--bg-4);
  border: 0.0625rem solid var(--border-strong);
  color: var(--text);
  font-family: inherit;
  cursor: pointer;
}
.ms-qopt:hover { border-color: var(--primary-hi); }

.ms-qopt-name {
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent-texto);
}

.ms-qopt-desc {
  font-family: var(--f-sans);
  font-size: 0.6875rem;
  color: var(--text-3);
}

.ms-screen-error {
  flex: none;
  padding: 0.375rem 0.5rem;
  background: var(--bg-3);
  border-top: 0.0625rem solid var(--err);
  font-family: var(--f-sans);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--err);
}


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

  .ms-live-tag {
    animation: msLive 1.6s steps(2, jump-none) infinite;
  }
  @keyframes msLive {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }

}
</style>
