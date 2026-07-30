import { reactive, ref } from 'vue'
import { io, type Socket } from 'socket.io-client'

export type Facing = 'down' | 'up' | 'left' | 'right'
export type Pose = 'idle' | 'walk' | 'dance' | 'wave' | 'sit'

export interface ChatMessage {
  id: string
  name: string
  text: string
  ts: number
}

export type JukeboxMode = 'proximity' | 'room'
export type VoiceMode = 'proximity' | 'room'

export interface Stroke {
  id: string
  color: string
  points: { x: number; y: number }[]
}

export interface JukeboxQueueItem {
  trackId: string
  youtubeId: string
  title: string
  durationSec: number
  addedByName: string
}

export interface JukeboxState {
  mode: JukeboxMode
  queue: JukeboxQueueItem[]
  current: JukeboxQueueItem | null
  startedAt: number | null
  status: string | null
}

export interface RemotePlayer {
  id: string
  // uuid do usuário — é a identity do participante no LiveKit, o que liga o
  // avatar (identificado por socket.id) à mídia sem handshake próprio
  userId: string
  name: string
  avatar: AvatarProps
  map: string
  x: number
  y: number
  facing: Facing
  pose: Pose
  boost?: boolean
}

// Aviso de transmissão de tela — vem pelo socket, não pelo LiveKit, porque
// alcança TODO MUNDO do mapa, inclusive quem nunca entrou na voz
export interface ScreenShareState {
  id: string
  userId: string
  name: string
  on: boolean
}

export interface AvatarProps {
  hairStyle?: string | null
  hairColor?: string | null
  skin?: string | null
  topColor?: string | null
  pantsColor?: string | null
  accessory?: string | null
  // URL pública da foto de perfil — quando presente, o cliente mostra o círculo em vez do sprite
  photoUrl?: string | null
}

interface JoinOptions {
  name: string
  avatar: AvatarProps
  map: string
  x: number
  y: number
}

// API publicada atrás do Traefik com stripprefix /kairos-api → socket.io vê /socket.io
const API_URL = import.meta.env.VITE_API_URL || window.location.origin
const SOCKET_PATH = '/kairos-api/socket.io'

// Move emitido no máximo a ~12Hz e só quando a posição muda
const MOVE_INTERVAL = 80

// Mapa reativo de quem mais está na sala — consumido direto pelo GamePage
export const remotePlayers = reactive(new Map<string, RemotePlayer>())
// Histórico recente de chat da sala (cap 50)
export const chatMessages = reactive<ChatMessage[]>([])
// Estado do jukebox da sala atual (fila/faixa tocando/modo)
export const jukeboxState = reactive<JukeboxState>({ mode: 'proximity', queue: [], current: null, startedAt: null, status: null })
export const jukeboxError = ref('')
// Modo de voz da sala atual (proximidade ou sala inteira) — qualquer membro pode alternar
export const voiceMode = ref<VoiceMode>('proximity')
// true quando esta aba foi derrubada por outra sessão da MESMA conta (login em
// outro lugar) — a tela mostra um aviso em vez de deixar a conexão travada
export const sessionKicked = ref(false)

let socket: Socket | null = null
let lastEmit = 0
let pending: { x: number; y: number; facing: Facing; pose: Pose; boost: boolean } | null = null
// estado ATUAL do join — atualizado em switchMap/emitMove; a reconexão automática
// do socket.io re-emite este (re-join com os opts originais devolvia o player
// pro mapa antigo depois de um blip de rede)
let currentJoin: JoinOptions | null = null

let currentBoardId: string | null = null
const boardStateListeners = new Set<(strokes: Stroke[]) => void>()
const boardStrokeListeners = new Set<(stroke: Stroke) => void>()
const boardClearListeners = new Set<() => void>()
const screenShareListeners = new Set<(state: ScreenShareState) => void>()

export function connectPresence(opts: JoinOptions) {
  if (socket) return
  sessionKicked.value = false
  currentJoin = { ...opts }

  // o token vai no handshake → o gateway deriva o servidor (isolamento de salas por servidor)
  const token = localStorage.getItem('kairos_token') || undefined
  socket = io(API_URL, { path: SOCKET_PATH, transports: ['websocket'], auth: { token } })

  // garante desconexão ao fechar/atualizar a aba (evita fantasma)
  window.addEventListener('beforeunload', disconnectPresence, { once: true })

  socket.on('connect', () => {
    if (currentJoin) socket?.emit('join', currentJoin)
  })

  socket.on('players', (peers: RemotePlayer[]) => {
    remotePlayers.clear()
    for (const p of peers) remotePlayers.set(p.id, p)
  })

  socket.on('playerJoined', (p: RemotePlayer) => {
    remotePlayers.set(p.id, p)
  })

  socket.on('playerMoved', ({ id, x, y, facing, pose, boost }: { id: string; x: number; y: number; facing: Facing; pose: Pose; boost?: boolean }) => {
    const p = remotePlayers.get(id)
    if (p) { p.x = x; p.y = y; if (facing) p.facing = facing; if (pose) p.pose = pose; p.boost = !!boost }
  })

  socket.on('playerLeft', ({ id }: { id: string }) => {
    remotePlayers.delete(id)
  })

  socket.on('chatMessage', (m: ChatMessage) => {
    chatMessages.push(m)
    if (chatMessages.length > 50) chatMessages.splice(0, chatMessages.length - 50)
  })

  socket.on('jukeboxState', (s: JukeboxState) => {
    jukeboxState.mode = s.mode
    jukeboxState.queue = s.queue
    jukeboxState.current = s.current
    jukeboxState.startedAt = s.startedAt
    jukeboxState.status = s.status
  })
  socket.on('jukeboxError', ({ message }: { message: string }) => {
    jukeboxError.value = message
  })

  socket.on('voiceState', ({ mode }: { mode: VoiceMode }) => {
    voiceMode.value = mode
  })

  socket.on('screenShareState', (state: ScreenShareState) => {
    for (const cb of screenShareListeners) cb(state)
  })

  socket.on('boardState', ({ objectId, strokes }: { objectId: string; strokes: Stroke[] }) => {
    if (objectId !== currentBoardId) return
    for (const cb of boardStateListeners) cb(strokes)
  })
  socket.on('boardStroke', ({ objectId, stroke }: { objectId: string; stroke: Stroke }) => {
    if (objectId !== currentBoardId) return
    for (const cb of boardStrokeListeners) cb(stroke)
  })
  socket.on('boardClear', ({ objectId }: { objectId: string }) => {
    if (objectId !== currentBoardId) return
    for (const cb of boardClearListeners) cb()
  })

  // servidor derrubou esta aba pq a mesma conta conectou em outro lugar —
  // desconexão iniciada pelo servidor não reconecta sozinha (comportamento
  // padrão do socket.io), então só precisamos avisar a tela
  socket.on('sessionKicked', () => {
    sessionKicked.value = true
  })

  socket.on('disconnect', () => {
    remotePlayers.clear()
  })
}

// ---- jukebox ----
export function emitJukeboxAdd(input: string) {
  socket?.emit('jukeboxAdd', { input })
}
export function emitJukeboxSkip() {
  socket?.emit('jukeboxSkip')
}
export function emitJukeboxSetMode(mode: JukeboxMode) {
  socket?.emit('jukeboxSetMode', { mode })
}

export function emitVoiceSetMode(mode: VoiceMode) {
  socket?.emit('voiceSetMode', { mode })
}

export function emitScreenShare(on: boolean) {
  socket?.emit('screenShare', { on })
}
export function onScreenShare(cb: (state: ScreenShareState) => void) {
  screenShareListeners.add(cb)
  return () => screenShareListeners.delete(cb)
}

export function emitChat(text: string) {
  socket?.emit('chat', { text })
}

export function emitMove(x: number, y: number, facing: Facing, pose: Pose, boost = false) {
  if (!socket) return
  if (currentJoin) {
    currentJoin.x = x
    currentJoin.y = y
  }
  const now = Date.now()
  if (now - lastEmit >= MOVE_INTERVAL) {
    lastEmit = now
    socket.emit('move', { x, y, facing, pose, boost })
    pending = null
  } else {
    // garante que o último estado seja enviado mesmo parando de mexer
    pending = { x, y, facing, pose, boost }
    setTimeout(flushPending, MOVE_INTERVAL)
  }
}

function flushPending() {
  if (!socket || !pending) return
  const now = Date.now()
  if (now - lastEmit >= MOVE_INTERVAL) {
    lastEmit = now
    socket.emit('move', pending)
    pending = null
  }
}

export function joinBoard(objectId: string) {
  currentBoardId = objectId
  socket?.emit('boardJoin', { objectId })
}
export function sendStroke(objectId: string, stroke: Stroke) {
  socket?.emit('boardStroke', { objectId, stroke })
}
export function clearBoard(objectId: string) {
  socket?.emit('boardClear', { objectId })
}
export function onBoardState(cb: (strokes: Stroke[]) => void) {
  boardStateListeners.add(cb)
  return () => boardStateListeners.delete(cb)
}
export function onBoardStroke(cb: (stroke: Stroke) => void) {
  boardStrokeListeners.add(cb)
  return () => boardStrokeListeners.delete(cb)
}
export function onBoardClear(cb: () => void) {
  boardClearListeners.add(cb)
  return () => boardClearListeners.delete(cb)
}

export function switchMap(map: string) {
  if (currentJoin) currentJoin.map = map
  socket?.emit('switchMap', { map })
  remotePlayers.clear()
  chatMessages.splice(0)
}

export function disconnectPresence() {
  currentJoin = null
  socket?.disconnect()
  socket = null
  remotePlayers.clear()
}
