import { reactive } from 'vue'
import { io, type Socket } from 'socket.io-client'

export type Facing = 'down' | 'up' | 'left' | 'right'
export type Pose = 'idle' | 'walk' | 'dance' | 'wave' | 'sit'

export interface ChatMessage {
  id: string
  name: string
  text: string
  ts: number
}

export interface RemotePlayer {
  id: string
  name: string
  avatar: AvatarProps
  map: string
  x: number
  y: number
  facing: Facing
  pose: Pose
}

export interface AvatarProps {
  hairStyle?: string | null
  hairColor?: string | null
  skin?: string | null
  topColor?: string | null
  pantsColor?: string | null
  accessory?: string | null
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

let socket: Socket | null = null
let lastEmit = 0
let pending: { x: number; y: number; facing: Facing; pose: Pose } | null = null

export function connectPresence(opts: JoinOptions) {
  if (socket) return

  // o token vai no handshake → o gateway deriva a org (isolamento de salas por org)
  const token = localStorage.getItem('kairos_token') || undefined
  socket = io(API_URL, { path: SOCKET_PATH, transports: ['websocket'], auth: { token } })

  // garante desconexão ao fechar/atualizar a aba (evita fantasma)
  window.addEventListener('beforeunload', disconnectPresence, { once: true })

  socket.on('connect', () => {
    socket?.emit('join', opts)
  })

  socket.on('players', (peers: RemotePlayer[]) => {
    remotePlayers.clear()
    for (const p of peers) remotePlayers.set(p.id, p)
  })

  socket.on('playerJoined', (p: RemotePlayer) => {
    remotePlayers.set(p.id, p)
  })

  socket.on('playerMoved', ({ id, x, y, facing, pose }: { id: string; x: number; y: number; facing: Facing; pose: Pose }) => {
    const p = remotePlayers.get(id)
    if (p) { p.x = x; p.y = y; if (facing) p.facing = facing; if (pose) p.pose = pose }
  })

  socket.on('playerLeft', ({ id }: { id: string }) => {
    remotePlayers.delete(id)
  })

  socket.on('chatMessage', (m: ChatMessage) => {
    chatMessages.push(m)
    if (chatMessages.length > 50) chatMessages.splice(0, chatMessages.length - 50)
  })

  socket.on('rtc-signal', ({ from, signal }: { from: string; signal: unknown }) => {
    rtcHandler?.(from, signal)
  })

  socket.on('disconnect', () => {
    remotePlayers.clear()
  })
}

export function emitChat(text: string) {
  socket?.emit('chat', { text })
}

// ---- sinalização WebRTC (voz por proximidade) ----
let rtcHandler: ((from: string, signal: unknown) => void) | null = null

export function socketId(): string | undefined {
  return socket?.id
}
export function sendRtcSignal(to: string, signal: unknown) {
  socket?.emit('rtc-signal', { to, signal })
}
export function setRtcHandler(cb: ((from: string, signal: unknown) => void) | null) {
  rtcHandler = cb
}

export function emitMove(x: number, y: number, facing: Facing, pose: Pose) {
  if (!socket) return
  const now = Date.now()
  if (now - lastEmit >= MOVE_INTERVAL) {
    lastEmit = now
    socket.emit('move', { x, y, facing, pose })
    pending = null
  } else {
    // garante que o último estado seja enviado mesmo parando de mexer
    pending = { x, y, facing, pose }
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

export function switchMap(map: string) {
  socket?.emit('switchMap', { map })
  remotePlayers.clear()
  chatMessages.splice(0)
}

export function disconnectPresence() {
  socket?.disconnect()
  socket = null
  remotePlayers.clear()
}
