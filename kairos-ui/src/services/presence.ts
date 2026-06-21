import { reactive } from 'vue'
import { io, type Socket } from 'socket.io-client'

export interface RemotePlayer {
  id: string
  name: string
  avatar: AvatarProps
  map: string
  x: number
  y: number
}

export interface AvatarProps {
  hairStyle?: string | null
  hairColor?: string | null
  skin?: string | null
  topColor?: string | null
  pantsColor?: string | null
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

let socket: Socket | null = null
let lastEmit = 0
let pending: { x: number; y: number } | null = null

export function connectPresence(opts: JoinOptions) {
  if (socket) return

  socket = io(API_URL, { path: SOCKET_PATH, transports: ['websocket'] })

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

  socket.on('playerMoved', ({ id, x, y }: { id: string; x: number; y: number }) => {
    const p = remotePlayers.get(id)
    if (p) { p.x = x; p.y = y }
  })

  socket.on('playerLeft', ({ id }: { id: string }) => {
    remotePlayers.delete(id)
  })

  socket.on('disconnect', () => {
    remotePlayers.clear()
  })
}

export function emitMove(x: number, y: number) {
  if (!socket) return
  const now = Date.now()
  if (now - lastEmit >= MOVE_INTERVAL) {
    lastEmit = now
    socket.emit('move', { x, y })
    pending = null
  } else {
    // garante que a última posição seja enviada mesmo parando de mexer
    pending = { x, y }
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
}

export function disconnectPresence() {
  socket?.disconnect()
  socket = null
  remotePlayers.clear()
}
