import { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { Server, Socket } from 'socket.io'
import { User } from '../user/user.entity'
import { ServerMembership } from '../server/server-membership.entity'
import { JukeboxService } from '../jukebox/jukebox.service'
import { FriendService } from '../friend/friend.service'
import { DmDelivery } from '../dm/dm-delivery'
import { jwtSecret } from '../auth/jwt-secret'

type MapId = string
type Facing = 'down' | 'up' | 'left' | 'right'
type Pose = 'idle' | 'walk' | 'dance' | 'wave' | 'sit'

interface JukeboxQueueItem {
  trackId: string
  youtubeId: string
  title: string
  durationSec: number
  addedByName: string
}

interface JukeboxRoomState {
  areaId: string | null
  alcanceGlobal: boolean
  queue: JukeboxQueueItem[]
  current: JukeboxQueueItem | null
  startedAt: number | null
  timer: ReturnType<typeof setTimeout> | null
  status: string | null
}

interface Player {
  id: string
  // uuid do usuário, derivado do TOKEN. É a mesma identity usada no LiveKit,
  // então o cliente casa o avatar (identificado por socket.id) com o participante
  // de mídia sem precisar de handshake próprio
  userId: string
  name: string
  avatar: unknown
  map: MapId
  serverId: string | null // servidor derivado do TOKEN (não do cliente) — isola as salas
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

// pessoa numa lista de presença de servidor (barra lateral): identidade + o que a
// UI indica ao lado do nome. Posição NÃO entra — mover não pode gerar tráfego aqui.
interface PresencePerson {
  id: string
  userId: string
  name: string
  map: MapId
  micMuted: boolean
  sharingScreen: boolean
}

type PresenceDelta =
  | { serverId: string; type: 'join' | 'update'; person: PresencePerson }
  | { serverId: string; type: 'leave'; id: string }

interface FriendPresence {
  userId: string
  online: boolean
  serverId?: string
  map?: MapId
  micMuted?: boolean
  sharingScreen?: boolean
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
const CHAT_MIN_INTERVAL_MS = 500
const SCREEN_MIN_INTERVAL_MS = 1000
const MIC_MIN_INTERVAL_MS = 500
const PRESENCE_WATCH_MIN_INTERVAL_MS = 500
const PRESENCE_WATCH_MAX_SERVERS = 30
const FRIEND_WATCH_MIN_INTERVAL_MS = 1000
const AVATAR_MIN_INTERVAL_MS = 1000
const MEMBERSHIP_RECHECK_MIN_INTERVAL_MS = 5000
const MEMBERSHIP_SWEEP_MS = 30000
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

function sameSet(a: Set<string> | undefined, b: Set<string>): boolean {
  if (!a || a.size !== b.size) return false
  for (const item of a) {
    if (!b.has(item)) return false
  }
  return true
}

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
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer() server: Server

  private readonly players = new Map<string, Player>()
  // servidor de cada socket, derivado do JWT no handshake (fonte de verdade do isolamento)
  private readonly socketServer = new Map<string, string | null>()
  // uuid real do usuário (JWT sub) — socket.id não é uuid, não pode ir em colunas uuid (ex: Track.addedBy)
  private readonly socketUserId = new Map<string, string | null>()
  // sessão única por usuário: userId -> socket.id ativo no momento. Mesma conta
  // aberta em várias abas (localStorage compartilha o token) só fica com UM
  // personagem visível — a aba nova derruba a antiga.
  private readonly userSocket = new Map<string, string>()
  // estado do jukebox por sala (servidor:map) — fila/faixa atual/área, em memória
  private readonly jukebox = new Map<string, JukeboxRoomState>()
  // salas (áreas) trancadas por mapa (servidor:map) — ids de área, alternados por quem está dentro
  private readonly salasTrancadas = new Map<string, Set<string>>()
  private readonly whiteboards = new Map<string, WhiteboardState>()
  // quem está transmitindo a tela (socket.id) — só pra saber se a transição é
  // real e pra desfazer o aviso quando a aba cai sem mandar o 'off'
  private readonly sharingScreen = new Set<string>()
  // microfone ABERTO por socket. Ausência = mudo: quem nunca reportou nada nunca
  // aparece com o microfone aberto na lista dos outros.
  private readonly micUnmuted = new Set<string>()
  // servidores de que o dono do socket é membro, lidos do banco no handshake
  // (server_memberships pelo sub do JWT). É a ÚNICA autorização de presença —
  // nenhum id de servidor vindo do cliente entra aqui.
  private readonly socketMemberships = new Map<string, Set<string>>()
  // servidores que o socket está observando (subconjunto autorizado do que pediu)
  private readonly watchedServers = new Map<string, Set<string>>()
  private readonly lastMembershipCheckAt = new Map<string, number>()
  private readonly friendWatchers = new Map<string, Set<string>>()
  private readonly socketGuest = new Set<string>()
  // handshake em andamento por socket — quem depende da identidade espera aqui
  private readonly identityReady = new Map<string, Promise<void>>()
  private readonly lastMoveAt = new Map<string, number>()
  private readonly lastChatAt = new Map<string, number>()
  private readonly lastScreenAt = new Map<string, number>()
  private readonly lastMicAt = new Map<string, number>()
  private readonly lastWatchAt = new Map<string, number>()
  private readonly lastFriendWatchAt = new Map<string, number>()
  private readonly lastAvatarAt = new Map<string, number>()
  private readonly lastJukeboxAddAt = new Map<string, number>()
  private membershipSweep: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ServerMembership) private readonly memberships: Repository<ServerMembership>,
    private readonly jukeboxService: JukeboxService,
    private readonly friends: FriendService,
    private readonly dmDelivery: DmDelivery,
  ) {}

  // revalidação periódica das memberships de quem está observando: sair de um
  // servidor (ou ser removido dele) não derruba o socket, então sem isto a lista
  // continuaria chegando até a aba fechar
  onModuleInit() {
    this.membershipSweep = setInterval(() => void this.sweepMemberships(), MEMBERSHIP_SWEEP_MS)
    this.membershipSweep.unref?.()

    this.dmDelivery.register(({ paraUserId, conversaId, de, naoLidas, mensagem }) => {
      const socketId = this.userSocket.get(paraUserId)
      if (!socketId) return
      this.server.to(socketId).emit('dmMessage', { conversaId, de, naoLidas, mensagem })
    })
  }

  onModuleDestroy() {
    if (this.membershipSweep) clearInterval(this.membershipSweep)
    this.membershipSweep = null
  }

  // sala = servidor + mapa (templates de servidores diferentes não se misturam)
  private room(serverId: string | null, map: MapId): string {
    return `${serverId || 'public'}:${map}`
  }

  // o cliente emite 'join' assim que o socket abre, e o socket.io entrega essa
  // mensagem mesmo com o handshake ainda no meio das consultas ao banco. Sem
  // esperar por aqui, o player nasce com serverId nulo e cai na sala pública:
  // some da lista de presença do servidor e some do isolamento por servidor.
  handleConnection(socket: Socket): Promise<void> {
    const identity = this.resolveIdentity(socket)
    this.identityReady.set(socket.id, identity)
    return identity
  }

  private async resolveIdentity(socket: Socket) {
    // valida o token do handshake e guarda o servidor + o uuid real do usuário
    let serverId: string | null = null
    let userId: string | null = null
    let isGuest = false
    try {
      const token = socket.handshake.auth?.token as string | undefined
      if (token) {
        const payload: any = this.jwt.verify(token, { secret: jwtSecret() })
        const user = await this.users.findOne({ where: { id: payload.sub } })
        serverId = user?.serverId ?? null
        userId = user?.id ?? null
        isGuest = !!user?.isGuest
      }
    } catch {
      serverId = null
      userId = null
    }
    // sem usuário válido não entra — todo cliente legítimo tem token (login,
    // registro ou convidado); socket anônimo era spam/DoS de graça nas salas
    if (!userId) {
      socket.disconnect(true)
      return
    }
    this.socketServer.set(socket.id, serverId)
    this.socketUserId.set(socket.id, userId)
    if (isGuest) this.socketGuest.add(socket.id)
    await this.loadMemberships(socket.id, userId)

    // sessão única: mesmo usuário já tem outra aba/dispositivo conectado?
    // derruba a antiga (o cliente lá recebe 'sessionKicked' e NÃO reconecta
    // sozinho — desconexão iniciada pelo servidor não dispara auto-reconnect
    // do socket.io, evitando um looping de "kick mútuo" entre as abas).
    const previousSocketId = this.userSocket.get(userId)
    this.userSocket.set(userId, socket.id)
    if (previousSocketId && previousSocketId !== socket.id) {
      const previousSocket = this.server.sockets.sockets.get(previousSocketId)
      previousSocket?.emit('sessionKicked')
      previousSocket?.disconnect(true)
    }

    // caiu enquanto o banco respondia: o handleDisconnect já passou e limpou
    // antes destas linhas gravarem
    if (socket.disconnected) {
      if (this.userSocket.get(userId) === socket.id) this.userSocket.delete(userId)
      this.forgetSocket(socket.id)
      return
    }
    if (!previousSocketId) this.emitFriendPresence(userId)
  }

  handleDisconnect(socket: Socket) {
    const player = this.players.get(socket.id)
    if (player) {
      // antes do playerLeft e antes de sair do mapa: o broadcast usa a sala que
      // o player ainda ocupa
      this.stopScreenShareFor(player)
      this.players.delete(socket.id)
      this.server.to(this.room(player.serverId, player.map)).emit('playerLeft', { id: socket.id })
      this.emitPresenceLeave(player)
      this.cleanupRoomIfEmpty(player.serverId, player.map)
    }
    const userId = this.socketUserId.get(socket.id)
    // só remove se ESSE socket ainda for o "dono" da sessão — evita que o
    if (userId && this.userSocket.get(userId) === socket.id) {
      this.userSocket.delete(userId)
      this.emitFriendOffline(userId)
    }
    this.forgetSocket(socket.id)
  }

  private forgetSocket(socketId: string) {
    this.socketServer.delete(socketId)
    this.socketUserId.delete(socketId)
    this.identityReady.delete(socketId)
    this.sharingScreen.delete(socketId)
    this.micUnmuted.delete(socketId)
    this.socketMemberships.delete(socketId)
    this.watchedServers.delete(socketId)
    this.friendWatchers.delete(socketId)
    this.socketGuest.delete(socketId)
    this.lastMembershipCheckAt.delete(socketId)
    this.lastMoveAt.delete(socketId)
    this.lastChatAt.delete(socketId)
    this.lastScreenAt.delete(socketId)
    this.lastMicAt.delete(socketId)
    this.lastWatchAt.delete(socketId)
    this.lastFriendWatchAt.delete(socketId)
    this.lastAvatarAt.delete(socketId)
    this.lastJukeboxAddAt.delete(socketId)
  }

  @SubscribeMessage('join')
  async handleJoin(socket: Socket, payload: JoinPayload) {
    await this.identityReady.get(socket.id)
    // token inválido: o handshake já mandou desconectar, não vira player
    if (!this.socketUserId.has(socket.id)) return
    const serverId = this.socketServer.get(socket.id) ?? null
    const map = String(payload?.map ?? '').slice(0, 64)
    if (!map) return
    // join repetido (ex: remount sem switchMap) — sai da sala velha antes,
    // senão o socket fica nas duas e o avatar vira fantasma pra quem ficou
    const existing = this.players.get(socket.id)
    if (existing && existing.map !== map) {
      this.stopScreenShareFor(existing)
      const oldRoom = this.room(existing.serverId, existing.map)
      socket.leave(oldRoom)
      this.server.to(oldRoom).emit('playerLeft', { id: socket.id })
      this.players.delete(socket.id)
      this.cleanupRoomIfEmpty(existing.serverId, existing.map)
    }
    const player: Player = {
      id: socket.id,
      userId: this.socketUserId.get(socket.id) ?? '',
      name: sanitizeName(payload?.name),
      avatar: sanitizeAvatar(payload?.avatar),
      map,
      serverId,
      x: sanitizeCoord(payload?.x, 0),
      y: sanitizeCoord(payload?.y, 0),
      facing: 'down',
      pose: 'idle',
      boost: false,
    }
    this.players.set(socket.id, player)
    const room = this.room(serverId, player.map)
    socket.join(room)
    socket.emit('players', this.peersInRoom(serverId, player.map, socket.id))
    socket.to(room).emit('playerJoined', player)
    socket.emit('jukeboxState', this.jukeboxSnapshot(room))
    socket.emit('salaEstado', { trancadas: [...(this.salasTrancadas.get(room) ?? [])] })
    // join repetido mantém o mesmo socket.id na lista de presença: é troca de
    // mundo pra quem observa, não uma pessoa nova
    this.emitPresence(player, existing ? 'update' : 'join')
    this.emitFriendPresence(player.userId, player)
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
    socket.to(this.room(player.serverId, player.map)).emit('playerMoved', {
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
    // descarte silencioso: o cliente já segura o envio por 500ms, isto aqui é a
    // rede pra quem chama o socket direto pelo console
    const now = Date.now()
    if (now - (this.lastChatAt.get(socket.id) ?? 0) < CHAT_MIN_INTERVAL_MS) return
    const text = String(payload?.text ?? '').trim().slice(0, 255)
    if (!text) return
    this.lastChatAt.set(socket.id, now)
    this.server.to(this.room(player.serverId, player.map)).emit('chatMessage', {
      id: socket.id,
      userId: player.userId,
      name: player.name,
      text,
      ts: Date.now(),
    })
  }

  @SubscribeMessage('avatarUpdate')
  handleAvatarUpdate(socket: Socket, payload: { avatar: unknown; name?: unknown }) {
    const player = this.players.get(socket.id)
    if (!player) return
    const now = Date.now()
    if (now - (this.lastAvatarAt.get(socket.id) ?? 0) < AVATAR_MIN_INTERVAL_MS) return
    this.lastAvatarAt.set(socket.id, now)
    player.avatar = sanitizeAvatar(payload?.avatar)
    const nomeNovo = payload?.name === undefined ? player.name : sanitizeName(payload.name)
    const nomeMudou = nomeNovo !== player.name
    player.name = nomeNovo
    socket.to(this.room(player.serverId, player.map)).emit('playerAvatar', {
      id: socket.id,
      avatar: player.avatar,
      name: player.name,
    })
    if (nomeMudou) this.emitPresence(player, 'update')
  }

  // relay de sinalização WebRTC 1:1 — só entre players na mesma sala
  @SubscribeMessage('rtc-signal')
  handleRtcSignal(socket: Socket, payload: { to: string; signal: unknown }) {
    const me = this.players.get(socket.id)
    const target = this.players.get(payload?.to)
    if (!me || !target) return
    if (me.serverId !== target.serverId || me.map !== target.map) return
    this.server.to(payload.to).emit('rtc-signal', { from: socket.id, signal: payload.signal })
  }

  @SubscribeMessage('switchMap')
  handleSwitchMap(socket: Socket, payload: { map: MapId }) {
    const player = this.players.get(socket.id)
    const map = String(payload?.map ?? '').slice(0, 64)
    if (!player || !map || player.map === map) return
    this.stopScreenShareFor(player)
    const oldServerId = player.serverId
    const oldMap = player.map
    socket.leave(this.room(oldServerId, oldMap))
    this.server.to(this.room(oldServerId, oldMap)).emit('playerLeft', { id: socket.id })
    player.map = map
    this.cleanupRoomIfEmpty(oldServerId, oldMap)
    const room = this.room(player.serverId, player.map)
    socket.join(room)
    socket.emit('players', this.peersInRoom(player.serverId, player.map, socket.id))
    socket.to(room).emit('playerJoined', player)
    socket.emit('jukeboxState', this.jukeboxSnapshot(room))
    socket.emit('salaEstado', { trancadas: [...(this.salasTrancadas.get(room) ?? [])] })
    this.emitPresence(player, 'update')
    this.emitFriendPresence(player.userId, player)
  }

  // ---- presença por servidor: quem está em cada mundo, pra barra lateral ----
  //
  // Separada das salas de mapa de propósito: aqui o cliente acompanha servidores
  // que não são o ativo dele (olhar sem trocar), e o que trafega é delta, não
  // posição. Sala de entrega = `presence:<serverId>`, e só se entra nela depois
  // de bater a membership no banco.

  @SubscribeMessage('presenceWatch')
  async handlePresenceWatch(socket: Socket, payload: { serverIds: string[] }) {
    // mesma corrida do join: sem esperar, a membership do handshake ainda não
    // existe e todo servidor pedido seria negado
    await this.identityReady.get(socket.id)
    const now = Date.now()
    if (now - (this.lastWatchAt.get(socket.id) ?? 0) < PRESENCE_WATCH_MIN_INTERVAL_MS) return
    this.lastWatchAt.set(socket.id, now)

    const requested = Array.isArray(payload?.serverIds)
      ? [
          ...new Set(
            payload.serverIds.filter((id) => typeof id === 'string' && !!id && id.length <= 64),
          ),
        ].slice(0, PRESENCE_WATCH_MAX_SERVERS)
      : []

    let allowed = this.socketMemberships.get(socket.id) ?? new Set<string>()
    // membership do handshake envelhece (entrar num servidor novo não reconecta o
    // socket): relê o banco só quando aparece um id fora do cache, com cooldown
    // próprio pra que id inventado não vire consulta por mensagem
    const userId = this.socketUserId.get(socket.id)
    if (
      userId &&
      requested.some((id) => !allowed.has(id)) &&
      now - (this.lastMembershipCheckAt.get(socket.id) ?? 0) >= MEMBERSHIP_RECHECK_MIN_INTERVAL_MS
    ) {
      allowed = await this.loadMemberships(socket.id, userId)
    }

    const watched = this.watchedServers.get(socket.id) ?? new Set<string>()
    // ids não autorizados somem em silêncio — negar com erro confirmaria que o
    // servidor existe pra quem está sondando
    const next = new Set(requested.filter((id) => allowed.has(id)))
    for (const serverId of watched) {
      if (!next.has(serverId)) socket.leave(this.presenceRoom(serverId))
    }
    for (const serverId of next) {
      if (watched.has(serverId)) continue
      socket.join(this.presenceRoom(serverId))
      socket.emit('presenceState', { serverId, people: this.peopleInServer(serverId) })
    }
    if (next.size) this.watchedServers.set(socket.id, next)
    else this.watchedServers.delete(socket.id)
  }

  // estado do microfone reportado pelo próprio dono (o gateway não fala com o
  // LiveKit); vale mesmo antes do join, pra lista já nascer certa
  @SubscribeMessage('micState')
  handleMicState(socket: Socket, payload: { muted: boolean }) {
    if (typeof payload?.muted !== 'boolean') return
    if (this.micUnmuted.has(socket.id) === !payload.muted) return
    const now = Date.now()
    if (now - (this.lastMicAt.get(socket.id) ?? 0) < MIC_MIN_INTERVAL_MS) return
    this.lastMicAt.set(socket.id, now)
    if (payload.muted) this.micUnmuted.delete(socket.id)
    else this.micUnmuted.add(socket.id)
    const player = this.players.get(socket.id)
    if (player) {
      this.emitPresence(player, 'update')
      this.emitFriendPresence(player.userId, player)
    }
  }

  @SubscribeMessage('friendPresenceWatch')
  async handleFriendPresenceWatch(socket: Socket) {
    await this.identityReady.get(socket.id)
    const userId = this.socketUserId.get(socket.id)
    if (!userId) return
    const now = Date.now()
    if (now - (this.lastFriendWatchAt.get(socket.id) ?? 0) < FRIEND_WATCH_MIN_INTERVAL_MS) return
    this.lastFriendWatchAt.set(socket.id, now)

    if (this.socketGuest.has(socket.id)) {
      this.friendWatchers.set(socket.id, new Set<string>())
      socket.emit('friendPresenceState', { friends: [] })
      return
    }

    if (now - (this.lastMembershipCheckAt.get(socket.id) ?? 0) >= MEMBERSHIP_RECHECK_MIN_INTERVAL_MS) {
      await this.loadMemberships(socket.id, userId)
    }

    let ids: Set<string>
    try {
      ids = (await this.friends.acceptedFriendIds([userId])).get(userId) ?? new Set<string>()
    } catch {
      return
    }
    if (!this.socketUserId.has(socket.id)) return
    this.friendWatchers.set(socket.id, ids)
    socket.emit('friendPresenceState', { friends: this.friendSnapshotFor(socket.id) })
  }

  @SubscribeMessage('friendPresenceUnwatch')
  handleFriendPresenceUnwatch(socket: Socket) {
    this.friendWatchers.delete(socket.id)
  }

  private friendPresenceOf(
    player: Player | undefined,
    userId: string,
    viewerServers: Set<string>,
  ): FriendPresence {
    if (!player?.serverId || !viewerServers.has(player.serverId)) return { userId, online: true }
    return {
      userId,
      online: true,
      serverId: player.serverId,
      map: player.map,
      micMuted: !this.micUnmuted.has(player.id),
      sharingScreen: this.sharingScreen.has(player.id),
    }
  }

  private friendSnapshotFor(socketId: string): FriendPresence[] {
    const friends = this.friendWatchers.get(socketId)
    if (!friends?.size) return []
    const viewerServers = this.socketMemberships.get(socketId) ?? new Set<string>()
    const out: FriendPresence[] = []
    for (const friendId of friends) {
      const friendSocketId = this.userSocket.get(friendId)
      if (!friendSocketId) continue
      out.push(this.friendPresenceOf(this.players.get(friendSocketId), friendId, viewerServers))
    }
    return out
  }

  private emitFriendPresence(userId: string, player?: Player) {
    for (const [socketId, friends] of this.friendWatchers) {
      if (!friends.has(userId)) continue
      const viewerServers = this.socketMemberships.get(socketId) ?? new Set<string>()
      this.server.to(socketId).emit('friendPresenceDelta', {
        friend: this.friendPresenceOf(player, userId, viewerServers),
      })
    }
  }

  private emitFriendOffline(userId: string) {
    for (const [socketId, friends] of this.friendWatchers) {
      if (!friends.has(userId)) continue
      this.server.to(socketId).emit('friendPresenceDelta', { friend: { userId, online: false } })
    }
  }

  private presenceRoom(serverId: string): string {
    return `presence:${serverId}`
  }

  private personOf(player: Player): PresencePerson {
    return {
      id: player.id,
      userId: player.userId,
      name: player.name,
      map: player.map,
      micMuted: !this.micUnmuted.has(player.id),
      sharingScreen: this.sharingScreen.has(player.id),
    }
  }

  private peopleInServer(serverId: string): PresencePerson[] {
    const people: PresencePerson[] = []
    for (const player of this.players.values()) {
      if (player.serverId === serverId) people.push(this.personOf(player))
    }
    return people
  }

  // o serverId sai SEMPRE do player (derivado do token no handshake), nunca do
  // payload — quem recebe é só quem entrou na sala de presença dele
  private emitPresence(player: Player, type: 'join' | 'update') {
    if (!player.serverId) return
    const delta: PresenceDelta = { serverId: player.serverId, type, person: this.personOf(player) }
    this.server.to(this.presenceRoom(player.serverId)).emit('presenceDelta', delta)
  }

  private emitPresenceLeave(player: Player) {
    if (!player.serverId) return
    const delta: PresenceDelta = { serverId: player.serverId, type: 'leave', id: player.id }
    this.server.to(this.presenceRoom(player.serverId)).emit('presenceDelta', delta)
  }

  private async loadMemberships(socketId: string, userId: string): Promise<Set<string>> {
    this.lastMembershipCheckAt.set(socketId, Date.now())
    try {
      const rows = await this.memberships.find({ where: { userId } })
      const set = new Set(rows.map((r) => r.serverId))
      // socket pode ter caído durante a consulta — repor a entrada aqui vazaria
      // memória (o disconnect já passou)
      if (this.socketUserId.has(socketId)) this.socketMemberships.set(socketId, set)
      return set
    } catch {
      return this.socketMemberships.get(socketId) ?? new Set<string>()
    }
  }

  // uma consulta só pra todos os observadores: quem perdeu a membership sai da
  private async sweepMemberships() {
    const socketIds = new Set<string>([...this.watchedServers.keys(), ...this.friendWatchers.keys()])
    const userIds = new Set<string>()
    for (const socketId of socketIds) {
      const userId = this.socketUserId.get(socketId)
      if (userId) userIds.add(userId)
    }
    if (!userIds.size) return
    let rows: ServerMembership[]
    try {
      rows = await this.memberships.find({ where: { userId: In([...userIds]) } })
    } catch {
      return
    }
    const byUser = new Map<string, Set<string>>()
    for (const row of rows) {
      const set = byUser.get(row.userId) ?? new Set<string>()
      set.add(row.serverId)
      byUser.set(row.userId, set)
    }
    const mudouMembership = new Set<string>()
    for (const socketId of socketIds) {
      const userId = this.socketUserId.get(socketId)
      if (!userId) continue
      const fresh = byUser.get(userId) ?? new Set<string>()
      if (!sameSet(this.socketMemberships.get(socketId), fresh)) mudouMembership.add(socketId)
      this.socketMemberships.set(socketId, fresh)
      this.lastMembershipCheckAt.set(socketId, Date.now())
    }
    for (const [socketId, watched] of this.watchedServers) {
      const fresh = this.socketMemberships.get(socketId)
      if (!fresh) continue
      for (const serverId of [...watched]) {
        if (fresh.has(serverId)) continue
        watched.delete(serverId)
        const socket = this.server.sockets.sockets.get(socketId)
        socket?.leave(this.presenceRoom(serverId))
        socket?.emit('presenceRevoked', { serverId })
      }
      if (!watched.size) this.watchedServers.delete(socketId)
    }
    await this.sweepFriendWatchers(mudouMembership)
  }

  private async sweepFriendWatchers(mudouMembership: Set<string>) {
    const userBySocket = new Map<string, string>()
    for (const socketId of this.friendWatchers.keys()) {
      const userId = this.socketUserId.get(socketId)
      if (userId && !this.socketGuest.has(socketId)) userBySocket.set(socketId, userId)
    }
    if (!userBySocket.size) return
    let fresh: Map<string, Set<string>>
    try {
      fresh = await this.friends.acceptedFriendIds([...new Set(userBySocket.values())])
    } catch {
      return
    }
    for (const [socketId, userId] of userBySocket) {
      if (!this.friendWatchers.has(socketId)) continue
      const agora = fresh.get(userId) ?? new Set<string>()
      const mudouLista = !sameSet(this.friendWatchers.get(socketId), agora)
      this.friendWatchers.set(socketId, agora)
      if (!mudouLista && !mudouMembership.has(socketId)) continue
      this.server
        .to(socketId)
        .emit('friendPresenceState', { friends: this.friendSnapshotFor(socketId) })
    }
  }

  // ---- salas trancadas: ids de área por mapa (servidor:map), alternados por quem está dentro ----
  //
  // O servidor não conhece a geometria do mapa — não valida se quem trancou
  // estava de fato dentro da área. Isso é responsabilidade da UI, que só
  // oferece o botão a quem está dentro.

  @SubscribeMessage('salaTrancar')
  handleSalaTrancar(socket: Socket, payload: { areaId: string; trancada: boolean }) {
    const player = this.players.get(socket.id)
    const areaId = typeof payload?.areaId === 'string' ? payload.areaId.trim().slice(0, 64) : ''
    if (!player || !areaId || typeof payload?.trancada !== 'boolean') return
    const room = this.room(player.serverId, player.map)
    const trancadas = this.salasTrancadas.get(room) ?? new Set<string>()
    if (payload.trancada) trancadas.add(areaId)
    else trancadas.delete(areaId)
    this.salasTrancadas.set(room, trancadas)
    this.server.to(room).emit('salaEstado', { trancadas: [...trancadas] })
  }

  // ---- transmissão de tela: aviso pra sala inteira do MAPA ----
  //
  // Mora aqui, e não no LiveKit, porque quem ainda não entrou na voz não recebe
  // evento nenhum do SFU — e é justamente essa pessoa que precisa descobrir que
  // tem algo acontecendo. O socket é onde todo mundo do mapa está.

  @SubscribeMessage('screenShare')
  handleScreenShare(socket: Socket, payload: { on: boolean }) {
    const player = this.players.get(socket.id)
    if (!player || typeof payload?.on !== 'boolean') return
    // o aviso é sobre a TRANSIÇÃO: repetir o mesmo estado não vira notificação
    if (this.sharingScreen.has(socket.id) === payload.on) return
    // mesma rede do handleChat: o cliente só emite na virada, isto segura quem
    // chama o socket direto pelo console e inunda a sala de avisos
    const now = Date.now()
    if (now - (this.lastScreenAt.get(socket.id) ?? 0) < SCREEN_MIN_INTERVAL_MS) return
    this.lastScreenAt.set(socket.id, now)
    if (payload.on) this.sharingScreen.add(socket.id)
    else this.sharingScreen.delete(socket.id)
    this.broadcastScreenShare(player, payload.on)
    this.emitPresence(player, 'update')
    this.emitFriendPresence(player.userId, player)
  }

  // o nome sai do player do servidor (já capado em NAME_MAX no join), nunca do
  // payload — o cliente não escolhe como é anunciado pra sala
  private broadcastScreenShare(player: Player, on: boolean) {
    this.server.to(this.room(player.serverId, player.map)).emit('screenShareState', {
      id: player.id,
      userId: player.userId,
      name: player.name,
      on,
    })
  }

  // saiu da sala (troca de mapa, remount ou queda) transmitindo: sem isto o
  // aviso ficaria mentindo até expirar, e a flag presa impediria o próximo
  // 'on' de virar notificação
  private stopScreenShareFor(player: Player) {
    if (!this.sharingScreen.delete(player.id)) return
    this.broadcastScreenShare(player, false)
  }

  // ---- lousa: strokes por chave `${room}:${objectId}`, em memória ----

  @SubscribeMessage('boardJoin')
  handleBoardJoin(socket: Socket, payload: { objectId: string }) {
    const player = this.players.get(socket.id)
    const objectId = this.sanitizeObjectId(payload?.objectId)
    if (!player || !objectId) return
    const key = this.boardKey(this.room(player.serverId, player.map), objectId)
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
    const room = this.room(player.serverId, player.map)
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
    const room = this.room(player.serverId, player.map)
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

  // sala esvaziou → para o timer do jukebox e descarta fila/salas trancadas
  // (música tocando pra ninguém e estado acumulando pra sempre); as lousas
  // ficam — são o "conteúdo" da sala e já têm cap próprio
  private cleanupRoomIfEmpty(serverId: string | null, map: MapId) {
    for (const p of this.players.values()) {
      if (p.serverId === serverId && p.map === map) return
    }
    const room = this.room(serverId, map)
    const juke = this.jukebox.get(room)
    if (juke?.timer) clearTimeout(juke.timer)
    this.jukebox.delete(room)
    this.salasTrancadas.delete(room)
  }

  // ---- jukebox: fila por sala (servidor:map), sincronizada por startedAt ----

  @SubscribeMessage('jukeboxAdd')
  async handleJukeboxAdd(socket: Socket, payload: { input: string; areaId?: string }) {
    const player = this.players.get(socket.id)
    if (!player) return
    const userId = this.socketUserId.get(socket.id)
    if (!userId) {
      socket.emit('jukeboxError', { message: 'Faça login para adicionar música' })
      return
    }
    const room = this.room(player.serverId, player.map)
    const state = this.jukeboxStateFor(room)
    // fila nova (nada tocando, nada na fila): a área de origem grava aqui —
    // adicionar numa fila já em andamento não muda de onde ela "pertence"
    const startingNewQueue = !state.current && state.queue.length === 0
    const areaId = typeof payload?.areaId === 'string' ? payload.areaId.trim().slice(0, 64) || null : null

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
      const track = await this.jukeboxService.resolveTrack(youtubeId, userId, player.name, player.serverId, (label) => {
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
      if (startingNewQueue) state.areaId = areaId
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
    this.advanceJukebox(this.room(player.serverId, player.map))
  }

  // só quem é sudo altera o alcance da sala pra além da proximidade — vale pra
  // todos os que ouvem o jukebox dessa sala
  @SubscribeMessage('jukeboxAlcanceGlobal')
  async handleJukeboxAlcanceGlobal(socket: Socket, payload: { value: boolean }) {
    const player = this.players.get(socket.id)
    if (!player || typeof payload?.value !== 'boolean') return
    const userId = this.socketUserId.get(socket.id)
    if (!userId) return
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user?.isSudo) return
    const room = this.room(player.serverId, player.map)
    this.jukeboxStateFor(room).alcanceGlobal = payload.value
    this.broadcastJukebox(room)
  }

  @SubscribeMessage('jukeboxVolumeTodos')
  async handleJukeboxVolumeTodos(socket: Socket, payload: { volume: number }) {
    const player = this.players.get(socket.id)
    const volume = Number(payload?.volume)
    if (!player || !Number.isFinite(volume) || volume < 0 || volume > 1) return
    const userId = this.socketUserId.get(socket.id)
    if (!userId) return
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user?.isSudo) return
    this.server.to(this.room(player.serverId, player.map)).emit('jukeboxVolumeTodos', { volume })
  }

  private jukeboxStateFor(room: string): JukeboxRoomState {
    let state = this.jukebox.get(room)
    if (!state) {
      state = { areaId: null, alcanceGlobal: false, queue: [], current: null, startedAt: null, timer: null, status: null }
      this.jukebox.set(room, state)
    }
    return state
  }

  private jukeboxSnapshot(room: string) {
    const s = this.jukeboxStateFor(room)
    return {
      areaId: s.areaId,
      alcanceGlobal: s.alcanceGlobal,
      queue: s.queue,
      current: s.current,
      startedAt: s.startedAt,
      status: s.status,
    }
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

  // { mapId: qtd } dentro de um servidor (consumido pelo GET /presence/counts)
  getCounts(serverId: string | null): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const p of this.players.values()) {
      if (p.serverId !== serverId) continue
      counts[p.map] = (counts[p.map] || 0) + 1
    }
    return counts
  }

  private peersInRoom(serverId: string | null, map: MapId, exceptId: string): Player[] {
    const peers: Player[] = []
    for (const player of this.players.values()) {
      if (player.serverId === serverId && player.map === map && player.id !== exceptId) peers.push(player)
    }
    return peers
  }
}
