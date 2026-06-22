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

type MapId = string
type Facing = 'down' | 'up' | 'left' | 'right'
type Pose = 'idle' | 'walk' | 'dance' | 'wave'

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

  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  // sala = org + mapa (templates de orgs diferentes não se misturam)
  private room(org: string | null, map: MapId): string {
    return `${org || 'public'}:${map}`
  }

  async handleConnection(socket: Socket) {
    // valida o token do handshake e guarda a org do usuário
    let org: string | null = null
    try {
      const token = socket.handshake.auth?.token as string | undefined
      if (token) {
        const payload: any = this.jwt.verify(token, { secret: process.env.JWT_SECRET || 'kairos-secret' })
        const user = await this.users.findOne({ where: { id: payload.sub } })
        org = user?.organizationId ?? null
      }
    } catch {
      org = null
    }
    this.socketOrg.set(socket.id, org)
  }

  handleDisconnect(socket: Socket) {
    const player = this.players.get(socket.id)
    if (player) {
      this.players.delete(socket.id)
      this.server.to(this.room(player.org, player.map)).emit('playerLeft', { id: socket.id })
    }
    this.socketOrg.delete(socket.id)
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
    }
    this.players.set(socket.id, player)
    const room = this.room(org, player.map)
    socket.join(room)
    socket.emit('players', this.peersInRoom(org, player.map, socket.id))
    socket.to(room).emit('playerJoined', player)
  }

  @SubscribeMessage('move')
  handleMove(socket: Socket, payload: { x: number; y: number; facing?: Facing; pose?: Pose }) {
    const player = this.players.get(socket.id)
    if (!player) return
    player.x = payload.x
    player.y = payload.y
    if (payload.facing) player.facing = payload.facing
    if (payload.pose) player.pose = payload.pose
    socket.to(this.room(player.org, player.map)).emit('playerMoved', {
      id: socket.id,
      x: payload.x,
      y: payload.y,
      facing: player.facing,
      pose: player.pose,
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
