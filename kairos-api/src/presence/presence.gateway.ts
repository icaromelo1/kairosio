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
  // estado do jukebox por sala (org:map) — fila/faixa atual/modo, em memória
  private readonly jukebox = new Map<string, JukeboxRoomState>()
  // modo de voz por sala (org:map) — qualquer membro pode alternar, vale pra todos
  private readonly voiceMode = new Map<string, VoiceMode>()

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
        const payload: any = this.jwt.verify(token, { secret: process.env.JWT_SECRET || 'kairos-secret' })
        const user = await this.users.findOne({ where: { id: payload.sub } })
        org = user?.organizationId ?? null
        userId = user?.id ?? null
      }
    } catch {
      org = null
      userId = null
    }
    this.socketOrg.set(socket.id, org)
    this.socketUserId.set(socket.id, userId)
  }

  handleDisconnect(socket: Socket) {
    const player = this.players.get(socket.id)
    if (player) {
      this.players.delete(socket.id)
      this.server.to(this.room(player.org, player.map)).emit('playerLeft', { id: socket.id })
    }
    this.socketOrg.delete(socket.id)
    this.socketUserId.delete(socket.id)
  }

  @SubscribeMessage('join')
  handleJoin(socket: Socket, payload: JoinPayload) {
    const org = this.socketOrg.get(socket.id) ?? null
    const player: Player = {
      id: socket.id,
      name: payload.name,
      avatar: payload.avatar,
      map: payload.map,
      org,
      x: payload.x,
      y: payload.y,
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
    player.x = payload.x
    player.y = payload.y
    if (payload.facing) player.facing = payload.facing
    if (payload.pose) player.pose = payload.pose
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
    if (!player || player.map === payload.map) return
    socket.leave(this.room(player.org, player.map))
    this.server.to(this.room(player.org, player.map)).emit('playerLeft', { id: socket.id })
    player.map = payload.map
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
