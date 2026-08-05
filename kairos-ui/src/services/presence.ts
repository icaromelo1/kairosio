import { computed, reactive, ref } from 'vue'
import { io, type Socket } from 'socket.io-client'
import type { DmMensagem, DmPerfil } from './dm.api'
import { ESCALA_PADRAO } from '@/game/escala-avatar'

export type Facing = 'down' | 'up' | 'left' | 'right'
export type Pose = 'idle' | 'walk' | 'dance' | 'wave' | 'sit' | 'giro' | 'pulo' | 'robo'

export interface ChatMessage {
  id: string
  userId?: string
  name: string
  text: string
  ts: number
}

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
  areaId: string | null
  alcanceGlobal: boolean
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

// Uma pessoa na lista de presença de um servidor (barra lateral). Chave = id
// (socket.id), o mesmo de RemotePlayer — a mesma conta em outro dispositivo não
// existe (sessão única), então id e userId andam juntos.
export interface PresencePerson {
  id: string
  userId: string
  name: string
  map: string
  micMuted: boolean
  sharingScreen: boolean
}

export type PresenceDelta =
  | { serverId: string; type: 'join' | 'update'; person: PresencePerson }
  | { serverId: string; type: 'leave'; id: string }

export interface FriendPresence {
  userId: string
  online: boolean
  serverId?: string
  map?: string
  micMuted?: boolean
  sharingScreen?: boolean
}

export interface DmEntrega {
  conversaId: string
  de: DmPerfil | null
  naoLidas: number
  mensagem: DmMensagem
}

export interface AvatarProps {
  escala?: number
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
  name?: string
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
// Estado de cada jukebox do mapa atual (fila/faixa tocando/área/alcance), por jukeboxId
export const jukeboxStates = reactive(new Map<string, JukeboxState>())
export const jukeboxError = ref('')
// Salas (áreas) trancadas do mapa atual — ids de área, alimentado pelo evento 'salaEstado'
export const salasTrancadas = ref<Set<string>>(new Set())
// hora forcada do mundo (0-24); null = segue a hora real
export const horaDoMundo = ref<number | null>(null)
// true quando esta aba foi derrubada por outra sessão da MESMA conta (login em
// outro lugar) — a tela mostra um aviso em vez de deixar a conexão travada
export const sessionKicked = ref(false)
// poderes do sudo — invisível também vai pro servidor (emitSudoInvisivel); os
// outros três são puramente locais (escala trafega pelo canal de avatar)
export const sudoInvisivel = ref(false)
export const sudoNoclip = ref(false)
export const sudoEspectador = ref(false)
export const sudoEscala = ref(ESCALA_PADRAO)
// Quem está online em cada servidor OBSERVADO: serverId → (socket.id → pessoa).
// Só aparece aqui servidor de que o usuário é membro — o backend recusa o resto
// em silêncio. A barra lateral lê isto direto; agrupar por mundo é com quem
// desenha (peopleInWorld ajuda).
export const presenceByServer = reactive(new Map<string, Map<string, PresencePerson>>())
export const friendPresence = reactive(new Map<string, FriendPresence>())
export const dmUnread = reactive(new Map<string, number>())
export const dmUnreadTotal = computed(() => {
  let total = 0
  for (const n of dmUnread.values()) total += n
  return total
})

let socket: Socket | null = null
let lastEmit = 0
let pending: { x: number; y: number; facing: Facing; pose: Pose; boost: boolean } | null = null
// estado ATUAL do join — atualizado em switchMap/emitMove; a reconexão automática
// do socket.io re-emite este (re-join com os opts originais devolvia o player
// pro mapa antigo depois de um blip de rede)
let currentJoin: JoinOptions | null = null

// servidores que esta aba pediu pra observar — reemitidos a cada (re)conexão,
// porque a sala de presença vive no socket e some junto com ele
let watchedServerIds: string[] = []

let watchingFriends = false

let currentBoardId: string | null = null
const boardStateListeners = new Set<(strokes: Stroke[]) => void>()
const boardStrokeListeners = new Set<(stroke: Stroke) => void>()
const boardClearListeners = new Set<() => void>()
const screenShareListeners = new Set<(state: ScreenShareState) => void>()
const dmListeners = new Set<(entrega: DmEntrega) => void>()
const volumeTodosListeners = new Set<(volume: number) => void>()
const puxadoListeners = new Set<(p: { x: number; y: number }) => void>()
const festaListeners = new Set<() => void>()

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
    if (watchedServerIds.length) socket?.emit('presenceWatch', { serverIds: watchedServerIds })
    if (watchingFriends) socket?.emit('friendPresenceWatch')
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

  socket.on('playerAvatar', ({ id, avatar, name }: { id: string; avatar: AvatarProps; name?: string }) => {
    const p = remotePlayers.get(id)
    if (!p) return
    p.avatar = avatar
    if (name) p.name = name
  })
  socket.on('chatMessage', (m: ChatMessage) => {
    chatMessages.push(m)
    if (chatMessages.length > 50) chatMessages.splice(0, chatMessages.length - 50)
  })

  socket.on('jukeboxState', (s: JukeboxState & { jukeboxId: string }) => {
    jukeboxStates.set(s.jukeboxId, {
      areaId: s.areaId,
      alcanceGlobal: s.alcanceGlobal,
      queue: s.queue,
      current: s.current,
      startedAt: s.startedAt,
      status: s.status,
    })
  })
  socket.on('horaDoMundo', ({ hora }: { hora: number | null }) => {
    horaDoMundo.value = hora
  })
  socket.on('jukeboxVolumeTodos', ({ volume }: { volume: number }) => {
    for (const fn of volumeTodosListeners) fn(volume)
  })
  socket.on('jukeboxError', ({ message }: { message: string }) => {
    jukeboxError.value = message
  })

  socket.on('salaEstado', ({ trancadas }: { trancadas: string[] }) => {
    salasTrancadas.value = new Set(trancadas)
  })

  socket.on('screenShareState', (state: ScreenShareState) => {
    for (const cb of screenShareListeners) cb(state)
  })

  // lista cheia: chega uma vez por servidor, quando esta aba passa a observá-lo
  socket.on('presenceState', ({ serverId, people }: { serverId: string; people: PresencePerson[] }) => {
    const byId = new Map<string, PresencePerson>()
    for (const person of people) byId.set(person.id, person)
    presenceByServer.set(serverId, byId)
  })

  // daí em diante só delta. Servidor não observado é ignorado — sem criar entrada
  // nova, senão um evento perdido viraria lista fantasma na barra lateral
  socket.on('presenceDelta', (delta: PresenceDelta) => {
    const byId = presenceByServer.get(delta.serverId)
    if (!byId) return
    if (delta.type === 'leave') byId.delete(delta.id)
    else byId.set(delta.person.id, delta.person)
  })

  socket.on('friendPresenceState', ({ friends }: { friends: FriendPresence[] }) => {
    friendPresence.clear()
    for (const friend of friends) friendPresence.set(friend.userId, friend)
  })

  socket.on('friendPresenceDelta', ({ friend }: { friend: FriendPresence }) => {
    if (friend.online) friendPresence.set(friend.userId, friend)
    else friendPresence.delete(friend.userId)
  })

  socket.on('dmMessage', (entrega: DmEntrega) => {
    setDmUnread(entrega.conversaId, entrega.naoLidas)
    for (const cb of dmListeners) cb(entrega)
  })

  // perdeu a membership com o servidor observado (saiu ou foi removido)
  socket.on('presenceRevoked', ({ serverId }: { serverId: string }) => {
    presenceByServer.delete(serverId)
    watchedServerIds = watchedServerIds.filter((id) => id !== serverId)
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

  socket.on('puxado', (p: { x: number; y: number }) => {
    for (const cb of puxadoListeners) cb(p)
  })
  socket.on('festa', () => {
    for (const cb of festaListeners) cb()
  })

  socket.on('disconnect', () => {
    remotePlayers.clear()
    // a lista some enquanto está fora do ar em vez de mentir; o 'connect'
    // reemite o watch e o snapshot volta inteiro
    presenceByServer.clear()
    friendPresence.clear()
  })
}

// ---- presença por servidor (barra lateral) ----

// Passa a observar exatamente estes servidores (substitui a lista anterior).
// O backend descarta em silêncio os que não são do usuário.
export function watchServerPresence(serverIds: string[]) {
  watchedServerIds = [...new Set(serverIds)]
  for (const serverId of [...presenceByServer.keys()]) {
    if (!watchedServerIds.includes(serverId)) presenceByServer.delete(serverId)
  }
  socket?.emit('presenceWatch', { serverIds: watchedServerIds })
}

export function watchFriendPresence() {
  watchingFriends = true
  socket?.emit('friendPresenceWatch')
}

export function unwatchFriendPresence() {
  watchingFriends = false
  friendPresence.clear()
  socket?.emit('friendPresenceUnwatch')
}

export function isFriendOnline(userId: string): boolean {
  return friendPresence.has(userId)
}

export function friendLocation(userId: string): { serverId: string; map: string } | null {
  const friend = friendPresence.get(userId)
  if (!friend?.serverId || !friend.map) return null
  return { serverId: friend.serverId, map: friend.map }
}

export function onDmMessage(cb: (entrega: DmEntrega) => void) {
  dmListeners.add(cb)
  return () => dmListeners.delete(cb)
}

export function syncDmUnread(conversas: { id: string; naoLidas: number }[]) {
  dmUnread.clear()
  for (const conversa of conversas) {
    if (conversa.naoLidas > 0) dmUnread.set(conversa.id, conversa.naoLidas)
  }
}

export function setDmUnread(conversaId: string, naoLidas: number) {
  if (naoLidas > 0) dmUnread.set(conversaId, naoLidas)
  else dmUnread.delete(conversaId)
}

// microfone aberto/fechado do PRÓPRIO usuário — o indicador ao lado do nome não
// vem do LiveKit, que só alcança quem está na mesma sala de mídia
export function emitMicState(muted: boolean) {
  socket?.emit('micState', { muted })
}

export function peopleInWorld(serverId: string, mapId: string): PresencePerson[] {
  const byId = presenceByServer.get(serverId)
  if (!byId) return []
  return [...byId.values()]
    .filter((person) => person.map === mapId)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function serverOnlineCount(serverId: string): number {
  return presenceByServer.get(serverId)?.size ?? 0
}

// ---- jukebox ----
export function emitJukeboxAdd(input: string, areaId: string | null, jukeboxId: string) {
  socket?.emit('jukeboxAdd', { input, areaId, jukeboxId })
}
export function emitJukeboxSkip(jukeboxId: string) {
  socket?.emit('jukeboxSkip', { jukeboxId })
}
export function emitDefinirHora(hora: number | null) {
  socket?.emit('definirHora', { hora })
}

export function emitJukeboxVolumeTodos(volume: number) {
  socket?.emit('jukeboxVolumeTodos', { volume })
}

export function emitJukeboxAlcanceGlobal(v: boolean, jukeboxId: string) {
  socket?.emit('jukeboxAlcanceGlobal', { value: v, jukeboxId })
}

export function estadoDoJukebox(id: string | null): JukeboxState | null {
  return id ? jukeboxStates.get(id) ?? null : null
}

// ---- salas trancadas ----
export function emitSalaTrancar(areaId: string, trancada: boolean): void {
  socket?.emit('salaTrancar', { areaId, trancada })
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

export function emitAvatarUpdate(avatar: AvatarProps) {
  if (currentJoin) currentJoin.avatar = avatar
  socket?.emit('avatarUpdate', { avatar })
}

export function emitNomeAtualizado() {
  socket?.emit('nomeAtualizado')
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
  watchedServerIds = []
  socket?.disconnect()
  socket = null
  remotePlayers.clear()
  presenceByServer.clear()
  friendPresence.clear()
}

export function onJukeboxVolumeTodos(fn: (volume: number) => void): () => void {
  volumeTodosListeners.add(fn)
  return () => volumeTodosListeners.delete(fn)
}

// ---- poderes do sudo ----
export function emitSudoInvisivel(on: boolean): void {
  socket?.emit('sudoInvisivel', { on })
}
export function emitSudoPuxar(alvoId: string): void {
  socket?.emit('sudoPuxar', { alvoId })
}
export function emitSudoFesta(): void {
  socket?.emit('sudoFesta', {})
}
export function emitSudoTeleporte(x: number, y: number): void {
  socket?.emit('sudoTeleporte', { x, y })
}

export function onPuxado(fn: (p: { x: number; y: number }) => void): () => void {
  puxadoListeners.add(fn)
  return () => puxadoListeners.delete(fn)
}
export function onFesta(fn: () => void): () => void {
  festaListeners.add(fn)
  return () => festaListeners.delete(fn)
}
