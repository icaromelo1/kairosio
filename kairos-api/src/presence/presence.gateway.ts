import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'

type MapId = string

interface Player {
  id: string
  name: string
  avatar: unknown
  map: MapId
  x: number
  y: number
}

interface JoinPayload {
  name: string
  avatar: unknown
  map: MapId
  x: number
  y: number
}

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class PresenceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server

  // socketId -> Player (a sala do socket.io guarda quem está em cada mapa)
  private readonly players = new Map<string, Player>()

  handleConnection() {
    // nada até o cliente mandar `join` com nome/avatar/mapa
  }

  handleDisconnect(socket: Socket) {
    const player = this.players.get(socket.id)
    if (!player) return
    this.players.delete(socket.id)
    this.server.to(player.map).emit('playerLeft', { id: socket.id })
  }

  @SubscribeMessage('join')
  handleJoin(socket: Socket, payload: JoinPayload) {
    const player: Player = {
      id: socket.id,
      name: payload.name,
      avatar: payload.avatar,
      map: payload.map,
      x: payload.x,
      y: payload.y,
    }
    this.players.set(socket.id, player)
    socket.join(player.map)

    // snapshot dos outros já presentes nesse mapa
    socket.emit('players', this.peersInMap(player.map, socket.id))
    // avisa os demais que entrou
    socket.to(player.map).emit('playerJoined', player)
  }

  @SubscribeMessage('move')
  handleMove(socket: Socket, payload: { x: number; y: number }) {
    const player = this.players.get(socket.id)
    if (!player) return
    player.x = payload.x
    player.y = payload.y
    socket.to(player.map).emit('playerMoved', { id: socket.id, x: payload.x, y: payload.y })
  }

  @SubscribeMessage('switchMap')
  handleSwitchMap(socket: Socket, payload: { map: MapId }) {
    const player = this.players.get(socket.id)
    if (!player || player.map === payload.map) return
    // sai do mapa antigo
    socket.leave(player.map)
    this.server.to(player.map).emit('playerLeft', { id: socket.id })
    // entra no novo
    player.map = payload.map
    socket.join(player.map)
    socket.emit('players', this.peersInMap(player.map, socket.id))
    socket.to(player.map).emit('playerJoined', player)
  }

  private peersInMap(map: MapId, exceptId: string): Player[] {
    const peers: Player[] = []
    for (const player of this.players.values()) {
      if (player.map === map && player.id !== exceptId) peers.push(player)
    }
    return peers
  }
}
