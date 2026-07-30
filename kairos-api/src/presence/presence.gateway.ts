import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Server, Socket } from 'socket.io'
import { User } from '../user/user.entity'
import { JukeboxService } from '../jukebox/jukebox.service'
import { jwtSecret } from '../auth/jwt-secret'

type MapId = string
type Facing = 'down' | 'up' | 'left' | 'right'
type Pose = 'idle' | 'walk' | 'dance' | 'wave' | 'sit'
type JukeboxMode = 'proximity' | 'room'
type VoiceMode = 'proximity' | 'room'

interface JukeboxQueueItem {
  trackId: string
  youtubeId: string
  title: string
  durationSec: number
  addedByName: string
}

interface JukeboxRoomState {
  mode: JukeboxMode
  queue: JukeboxQueueItem[]
  current: JukeboxQueueItem | null
  startedAt: number | null
  timer: ReturnType<typeof setTimeout> | null
  status: string | null
}

interface Player {
  id: string
  name: string
  avatar: unknown
  map: MapId
  org: string | null // org derivada do TOKEN (não do cliente) — isola as salas
  x: number
  y: number
  facing: Facing
  pose: Pose
  boost: boolean
}

interface JoinPayload {
  name: string
  avatar: unknown
  map: MapId
  x: number
  y: number
}

interface Stroke {
  id: string
  color: string
  points: { x: number; y: number }[]
}

interface WhiteboardState {
  strokes: Stroke[]
}

const MOVE_MIN_INTERVAL_MS = 50
const BOARD_MAX_POINTS_PER_STROKE = 500
const BOARD_MAX_STROKES = 300
const BOARD_MAX_PER_ROOM = 50
const NAME_MAX = 40
const AVATAR_MAX_JSON = 2048
const COORD_LIMIT = 100000
const JUKEBOX_ADD_COOLDOWN_MS = 5000
const JUKEBOX_MAX_QUEUE = 50
const FACING_VALUES: Facing[] = ['down', 'up', 'left', 'right']
const POSE_VALUES: Pose[] = ['idle', 'walk', 'dance', 'wave', 'sit']
const HAIR_STYLES = new Set(['short', 'curly', 'ponytail', 'mohawk', 'helmet', 'buzz', 'long'])
const ACCESSORIES = new Set(['none', 'glasses', 'hat'])
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/
const PHOTO_PATH = /\/kairos-api\/character\/photo\/([a-f0-9-]+\.(?:jpg|png|webp))$/

function sanitizeName(raw: unknown): string {
  const name = String(raw ?? '').trim().slice(0, NAME_MAX)
  return name || 'Convidado'
}

function sanitizeCoord(raw: unknown, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) && Math.abs(n) <= COORD_LIMIT ? n : fallback
}

// só os campos conhecidos do look, cada um validado — e a foto vira o caminho
// CANÔNICO relativo (/kairos-api/character/photo/<arquivo>), nunca uma URL
// externa arbitrária repassada pra todo mundo carregar
function sanitizeAvatar(raw: unknown): Record<string, string | null> {
  if (!raw || typeof raw !== 'object' || JSON.stringify(raw).length > AVATAR_MAX_JSON) return {}
  const a = raw as Record<string, unknown>
  const out: Record<string, string | null> = {}
  if (HAIR_STYLES.has(String(a.hairStyle))) out.hairStyle = String(a.hairStyle)
  if (ACCESSORIES.has(String(a.accessory))) out.accessory = String(a.accessory)
  for (const key of ['hairColor', 'skin', 'topColor', 'pantsColor'] as const) {
    if (typeof a[key] === 'string' && HEX_COLOR.test(a[key] as string)) out[key] = a[key] as string
  }
  if (typeof a.photoUrl === 'string' && a.photoUrl.length <= 300) {
    const m = PHOTO_PATH.exec(a.photoUrl)
    if (m) out.photoUrl = `/kairos-api/character/photo/${m[1]}`
  }
  return out
}

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  pingInterval: 10000,
  pingTimeout: 8000,
})
export class PresenceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server

  private readonly players = new Map<string, Player>()
  // org de cada socket, derivada do JWT no handshake (fonte de verdade do isolamento)
  private readonly socketOrg = new Map<string, string | null>()
  // uuid real do usuário (JWT sub) — socket.id não é uuid, não pode ir em colunas uuid (ex: Track.addedBy)
  private readonly socketUserId = new Map<string, string | null>()
  // sessão única por usuário: userId -> socket.id ativo no momento. Mesma conta
  // aberta em várias abas (localStorage compartilha o token) só fica com UM
  // personagem visível — a aba nova derruba a antiga.
  private readonly userSocket = new Map<string, string>()
  // estado do jukebox por sala (org:map) — fila/faixa atual/modo, em memória
  private readonly jukebox = new Map<string, JukeboxRoomState>()
  // modo de voz por sala (org:map) — qualquer membro pode alternar, vale pra todos
  private readonly voiceMode = new Map<string, VoiceMode>()
  private readonly whiteboards = new Map<string, WhiteboardState>()
  private readonly lastMoveAt = new Map<string, number>()
  private readonly lastJukeboxAddAt = new Map<string, number>()

  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jukeboxService: JukeboxService,
  ) {}

  // sala = org + mapa (templates de orgs diferentes não se misturam)
  private room(org: string | null, map: MapId): string {
    return `${org || 'public'}:${map}`
  }

  async handleConnection(socket: Socket) {
    // valida o token do handshake e guarda a org + o uuid real do usuário
    let org: string | null = null
    let userId: string | null = null
    try {
      const token = socket.handshake.auth?.token as string | undefined
      if (token) {
        const payload: any = this.jwt.verify(token, { secret: jwtSecret() })
        const user = await this.users.findOne({ where: { id: payload.sub } })
        org = user?.organizationId ?? null
        userId = user?.id ?? null
      }
    } catch {
      org = null
      userId = null
    }
    // sem usuário válido não entra — todo cliente legítimo tem token (login,
    // registro ou convidado); socket anônimo era spam/DoS de graça nas salas
    if (!userId) {
      socket.disconnect(true)
      return
    }
    this.socketOrg.set(socket.id, org)
    this.socketUserId.set(socket.id, userId)

    // sessão única: mesmo usuário já tem outra aba/dispositivo conectado?
    // derruba a antiga (o cliente lá recebe 'sessionKicked' e NÃO reconecta
    // sozinho — desconexão iniciada pelo servidor não dispara auto-reconnect
    // do socket.io, evitando um looping de "kick mútuo" entre as abas).
    if (userId) {
      const previousSocketId = this.userSocket.get(userId)
      if (previousSocketId && previousSocketId !== socket.id) {
        const previousSocket = this.server.sockets.sockets.get(previousSocketId)
        previousSocket?.emit('sessionKicked')
        previousSocket?.disconnect(true)
      }
      this.userSocket.set(userId, socket.id)
    }
  }

  handleDisconnect(socket: Socket) {
    const player = this.players.get(socket.id)
    if (player) {
      this.players.delete(socket.id)
      this.server.to(this.room(player.org, player.map)).emit('playerLeft', { id: socket.id })
      this.cleanupRoomIfEmpty(player.org, player.map)
    }
    const userId = this.socketUserId.get(socket.id)
    // só remove se ESSE socket ainda for o "dono" da sessão — evita que o
    // disconnect tardio de uma aba já kickada apague o registro da aba nova
    if (userId && this.userSocket.get(userId) === socket.id) this.userSocket.delete(userId)
    this.socketOrg.delete(socket.id)
    this.socketUserId.delete(socket.id)
    this.lastMoveAt.delete(socket.id)
    this.lastJukeboxAddAt.delete(socket.id)
  }

  @SubscribeMessage('join')
  handleJoin(socket: Socket, payload: JoinPayload) {
    const org = this.socketOrg.get(socket.id) ?? null
    const map = String(payload?.map ?? '').slice(0, 64)
    if (!map) return
    // join repetido (ex: remount sem switchMap) — sai da sala velha antes,
    // senão o socket fica nas duas e o avatar vira fantasma pra quem ficou
    const existing = this.players.get(socket.id)
    if (existing && existing.map !== map) {
      const oldRoom = this.room(existing.org, existing.map)
      socket.leave(oldRoom)
      this.server.to(oldRoom).emit('playerLeft', { id: socket.id })
      this.players.delete(socket.id)
      this.cleanupRoomIfEmpty(existing.org, existing.map)
    }
    const player: Player = {
      id: socket.id,
      name: sanitizeName(payload?.name),
      avatar: sanitizeAvatar(payload?.avatar),
      map,
      org,
      x: sanitizeCoord(payload?.x, 0),
      y: sanitizeCoord(payload?.y, 0),
      facing: 'down',
      pose: 'idle',
      boost: false,
    }
    this.players.set(socket.id, player)
    const room = this.room(org, player.map)
    socket.join(room)
    socket.emit('players', this.peersInRoom(org, player.map, socket.id))
    socket.to(room).emit('playerJoined', player)
    socket.emit('jukeboxState', this.jukeboxSnapshot(room))
    socket.emit('voiceState', { mode: this.voiceMode.get(room) || 'proximity' })
  }

  @SubscribeMessage('move')
  handleMove(socket: Socket, payload: { x: number; y: number; facing?: Facing; pose?: Pose; boost?: boolean }) {
    const player = this.players.get(socket.id)
    if (!player) return
    const now = Date.now()
    if (now - (this.lastMoveAt.get(socket.id) ?? 0) < MOVE_MIN_INTERVAL_MS) return
    this.lastMoveAt.set(socket.id, now)
    if (typeof payload?.x !== 'number' || !Number.isFinite(payload.x) || Math.abs(payload.x) > COORD_LIMIT) return
    if (typeof payload?.y !== 'number' || !Number.isFinite(payload.y) || Math.abs(payload.y) > COORD_LIMIT) return
    const facing = FACING_VALUES.includes(payload.facing as Facing) ? (payload.facing as Facing) : undefined
    const pose = POSE_VALUES.includes(payload.pose as Pose) ? (payload.pose as Pose) : undefined
    player.x = payload.x
    player.y = payload.y
    if (facing) player.facing = facing
    if (pose) player.pose = pose
    player.boost = !!payload.boost
    socket.to(this.room(player.org, player.map)).emit('playerMoved', {
      id: socket.id,
      x: payload.x,
      y: payload.y,
      facing: player.facing,
      pose: player.pose,
      boost: player.boost,
    })
  }

  @SubscribeMessage('chat')
  handleChat(socket: Socket, payload: { text: string }) {
    const player = this.players.get(socket.id)
    if (!player) return
    const text = String(payload?.text ?? '').trim().slice(0, 300)
    if (!text) return
    this.server.to(this.room(player.org, player.map)).emit('chatMessage', {
      id: socket.id,
      name: player.name,
      text,
      ts: Date.now(),
    })
  }

  // relay de sinalização WebRTC 1:1 — só entre players na mesma sala
  @SubscribeMessage('rtc-signal')
  handleRtcSignal(socket: Socket, payload: { to: string; signal: unknown }) {
    const me = this.players.get(socket.id)
    const target = this.players.get(payload?.to)
    if (!me || !target) return
    if (me.org !== target.org || me.map !== target.map) return
    this.server.to(payload.to).emit('rtc-signal', { from: socket.id, signal: payload.signal })
  }

  @SubscribeMessage('switchMap')
  handleSwitchMap(socket: Socket, payload: { map: MapId }) {
    const player = this.players.get(socket.id)
    const map = String(payload?.map ?? '').slice(0, 64)
    if (!player || !map || player.map === map) return
    const oldOrg = player.org
    const oldMap = player.map
    socket.leave(this.room(oldOrg, oldMap))
    this.server.to(this.room(oldOrg, oldMap)).emit('playerLeft', { id: socket.id })
    player.map = map
    this.cleanupRoomIfEmpty(oldOrg, oldMap)
    const room = this.room(player.org, player.map)
    socket.join(room)
    socket.emit('players', this.peersInRoom(player.org, player.map, socket.id))
    socket.to(room).emit('playerJoined', player)
    socket.emit('jukeboxState', this.jukeboxSnapshot(room))
    socket.emit('voiceState', { mode: this.voiceMode.get(room) || 'proximity' })
  }

  // ---- voz: modo por sala (org:map) — proximidade (padrão) ou sala inteira ----

  @SubscribeMessage('voiceSetMode')
  handleVoiceSetMode(socket: Socket, payload: { mode: VoiceMode }) {
    const player = this.players.get(socket.id)
    if (!player || (payload?.mode !== 'proximity' && payload?.mode !== 'room')) return
    const room = this.room(player.org, player.map)
    this.voiceMode.set(room, payload.mode)
    this.server.to(room).emit('voiceState', { mode: payload.mode })
  }

  // ---- lousa: strokes por chave `${room}:${objectId}`, em memória ----

  @SubscribeMessage('boardJoin')
  handleBoardJoin(socket: Socket, payload: { objectId: string }) {
    const player = this.players.get(socket.id)
    const objectId = this.sanitizeObjectId(payload?.objectId)
    if (!player || !objectId) return
    const key = this.boardKey(this.room(player.org, player.map), objectId)
    socket.emit('boardState', { objectId, strokes: this.whiteboardStateFor(key).strokes })
  }

  @SubscribeMessage('boardStroke')
  handleBoardStroke(socket: Socket, payload: { objectId: string; stroke: Stroke }) {
    const player = this.players.get(socket.id)
    const objectId = this.sanitizeObjectId(payload?.objectId)
    if (!player || !objectId) return
    const stroke = payload?.stroke
    if (!stroke || typeof stroke.id !== 'string' || stroke.id.length > 64 || !Array.isArray(stroke.points)) return
    if (typeof stroke.color !== 'string' || stroke.color.length > 32) stroke.color = '#111111'
    stroke.points = stroke.points
      .filter((p) => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
      .slice(0, BOARD_MAX_POINTS_PER_STROKE)
    const room = this.room(player.org, player.map)
    const key = this.boardKey(room, objectId)
    const state = this.whiteboardStateFor(key)
    const existingIndex = state.strokes.findIndex((s) => s.id === stroke.id)
    if (existingIndex >= 0) {
      state.strokes[existingIndex] = stroke
    } else {
      state.strokes.push(stroke)
      if (state.strokes.length > BOARD_MAX_STROKES) state.strokes.shift()
    }
    socket.to(room).emit('boardStroke', { objectId, stroke })
  }

  @SubscribeMessage('boardClear')
  handleBoardClear(socket: Socket, payload: { objectId: string }) {
    const player = this.players.get(socket.id)
    const objectId = this.sanitizeObjectId(payload?.objectId)
    if (!player || !objectId) return
    const room = this.room(player.org, player.map)
    const key = this.boardKey(room, objectId)
    this.whiteboardStateFor(key).strokes = []
    socket.to(room).emit('boardClear', { objectId })
  }

  private sanitizeObjectId(raw: unknown): string | null {
    const id = String(raw ?? '').trim()
    // sem ':' — é o separador das chaves de sala/lousa
    return id && id.length <= 64 && !id.includes(':') ? id : null
  }

  private boardKey(room: string, objectId: string): string {
    return `${room}:${objectId}`
  }

  private whiteboardStateFor(key: string): WhiteboardState {
    let state = this.whiteboards.get(key)
    if (!state) {
      // cap por sala: objectId vem do cliente — sem limite, ids inventados
      // criariam lousas infinitas na memória
      const room = key.slice(0, key.lastIndexOf(':'))
      let count = 0
      for (const k of this.whiteboards.keys()) {
        if (k.startsWith(`${room}:`)) count++
      }
      if (count >= BOARD_MAX_PER_ROOM) {
        const oldest = [...this.whiteboards.keys()].find((k) => k.startsWith(`${room}:`))
        if (oldest) this.whiteboards.delete(oldest)
      }
      state = { strokes: [] }
      this.whiteboards.set(key, state)
    }
    return state
  }

  // sala esvaziou → para o timer do jukebox e descarta fila/modo de voz (música
  // tocando pra ninguém e estado acumulando pra sempre); as lousas ficam — são o
  // "conteúdo" da sala e já têm cap próprio
  private cleanupRoomIfEmpty(org: string | null, map: MapId) {
    for (const p of this.players.values()) {
      if (p.org === org && p.map === map) return
    }
    const room = this.room(org, map)
    const juke = this.jukebox.get(room)
    if (juke?.timer) clearTimeout(juke.timer)
    this.jukebox.delete(room)
    this.voiceMode.delete(room)
  }

  // ---- jukebox: fila por sala (org:map), sincronizada por startedAt ----

  @SubscribeMessage('jukeboxAdd')
  async handleJukeboxAdd(socket: Socket, payload: { input: string }) {
    const player = this.players.get(socket.id)
    if (!player) return
    const userId = this.socketUserId.get(socket.id)
    if (!userId) {
      socket.emit('jukeboxError', { message: 'Faça login para adicionar música' })
      return
    }
    const room = this.room(player.org, player.map)
    const state = this.jukeboxStateFor(room)

    let youtubeId: string
    try {
      youtubeId = this.jukeboxService.extractYoutubeId(payload?.input)
    } catch (e) {
      socket.emit('jukeboxError', { message: (e as Error).message || 'Link inválido' })
      return
    }
    if (state.queue.length >= JUKEBOX_MAX_QUEUE) {
      socket.emit('jukeboxError', { message: `Fila cheia (máximo ${JUKEBOX_MAX_QUEUE} músicas)` })
      return
    }
    // cooldown por socket SÓ pra música nova (dispara yt-dlp) — re-adicionar da
    // biblioteca é barato e o "tocar tudo" manda várias de uma vez de propósito
    if (!(await this.jukeboxService.isKnown(youtubeId))) {
      const last = this.lastJukeboxAddAt.get(socket.id) ?? 0
      if (Date.now() - last < JUKEBOX_ADD_COOLDOWN_MS) {
        socket.emit('jukeboxError', { message: 'Calma — espere alguns segundos entre downloads' })
        return
      }
      this.lastJukeboxAddAt.set(socket.id, Date.now())
    }
    // fila de TOCAR e fila de BAIXAR são coisas diferentes: a mesma música pode
    // entrar quantas vezes quiser na fila de tocar — o download em si é dedupado
    // por youtubeId dentro do JukeboxService (baixa uma vez só, mesmo com pedidos
    // concorrentes pra essa música).
    try {
      state.status = 'buscando informações...'
      this.broadcastJukebox(room)
      const track = await this.jukeboxService.resolveTrack(youtubeId, userId, player.name, (label) => {
        state.status = label
        this.broadcastJukebox(room)
      })
      const item: JukeboxQueueItem = {
        trackId: track.id,
        youtubeId: track.youtubeId,
        title: track.title,
        durationSec: track.durationSec,
        addedByName: player.name,
      }
      state.queue.push(item)
      state.status = null
      if (!state.current) this.advanceJukebox(room)
      else this.broadcastJukebox(room)
    } catch (e) {
      state.status = null
      this.broadcastJukebox(room)
      socket.emit('jukeboxError', { message: (e as Error).message || 'Falha ao adicionar música' })
    }
  }

  @SubscribeMessage('jukeboxSkip')
  handleJukeboxSkip(socket: Socket) {
    const player = this.players.get(socket.id)
    if (!player) return
    this.advanceJukebox(this.room(player.org, player.map))
  }

  @SubscribeMessage('jukeboxSetMode')
  handleJukeboxSetMode(socket: Socket, payload: { mode: JukeboxMode }) {
    const player = this.players.get(socket.id)
    if (!player || (payload?.mode !== 'proximity' && payload?.mode !== 'room')) return
    const room = this.room(player.org, player.map)
    this.jukeboxStateFor(room).mode = payload.mode
    this.broadcastJukebox(room)
  }

  private jukeboxStateFor(room: string): JukeboxRoomState {
    let state = this.jukebox.get(room)
    if (!state) {
      state = { mode: 'proximity', queue: [], current: null, startedAt: null, timer: null, status: null }
      this.jukebox.set(room, state)
    }
    return state
  }

  private jukeboxSnapshot(room: string) {
    const s = this.jukeboxStateFor(room)
    return { mode: s.mode, queue: s.queue, current: s.current, startedAt: s.startedAt, status: s.status }
  }

  private broadcastJukebox(room: string) {
    this.server.to(room).emit('jukeboxState', this.jukeboxSnapshot(room))
  }

  // toca a próxima da fila (chamado ao terminar a atual, pular, ou ao chegar a 1ª música)
  private advanceJukebox(room: string) {
    // sala vazia (ex: download terminou depois de todo mundo sair) → descarta o
    // estado em vez de agendar timer tocando pra ninguém
    if (!(this.server.sockets.adapter.rooms.get(room)?.size ?? 0)) {
      const stale = this.jukebox.get(room)
      if (stale?.timer) clearTimeout(stale.timer)
      this.jukebox.delete(room)
      return
    }
    const state = this.jukeboxStateFor(room)
    if (state.timer) {
      clearTimeout(state.timer)
      state.timer = null
    }
    state.current = state.queue.shift() || null
    state.startedAt = state.current ? Date.now() : null
    this.broadcastJukebox(room)
    if (state.current) {
      const ms = Math.max(5000, state.current.durationSec * 1000)
      state.timer = setTimeout(() => this.advanceJukebox(room), ms)
    }
  }

  // { mapId: qtd } dentro de uma org (consumido pelo GET /presence/counts)
  getCounts(orgId: string | null): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const p of this.players.values()) {
      if (p.org !== orgId) continue
      counts[p.map] = (counts[p.map] || 0) + 1
    }
    return counts
  }

  private peersInRoom(org: string | null, map: MapId, exceptId: string): Player[] {
    const peers: Player[] = []
    for (const player of this.players.values()) {
      if (player.org === org && player.map === map && player.id !== exceptId) peers.push(player)
    }
    return peers
  }
}
