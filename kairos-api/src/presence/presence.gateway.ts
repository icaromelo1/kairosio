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
import { MapService } from '../map/map.service'
import { jwtSecret } from '../auth/jwt-secret'

type MapId = string
type Facing = 'down' | 'up' | 'left' | 'right'
type Pose = 'idle' | 'walk' | 'dance' | 'wave' | 'sit' | 'giro' | 'pulo' | 'robo'

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

interface AreaRect {
  id: string
  nome: string
  aberta: boolean
  x: number
  y: number
  w: number
  h: number
}

interface MensagemGuardada {
  id: string
  userId: string
  name: string
  text: string
  ts: number
  escopo: 'mundo' | 'sala'
  canal: string
}

const MOVE_MIN_INTERVAL_MS = 50
const CHAT_MIN_INTERVAL_MS = 500
// teto por canal, não global: a conversa de uma sala não pode empurrar a do
// mundo pra fora
const CHAT_HISTORICO_MAX = 50
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
const ESCALA_MIN = 0.4
const ESCALA_MAX = 3
const COORD_LIMIT = 100000
const JUKEBOX_ADD_COOLDOWN_MS = 5000
const JUKEBOX_MAX_QUEUE = 50
const FACING_VALUES: Facing[] = ['down', 'up', 'left', 'right']
const POSE_VALUES: Pose[] = ['idle', 'walk', 'dance', 'wave', 'sit', 'giro', 'pulo', 'robo']
// id de preset de avatar — MESMO formato que o SaveCharacterDto valida. A lista
// fechada que existia aqui era dos cabelos do avatar procedural, extinto quando
// o avatar virou sprite: o front passava a mandar 'ruivo-verde', isto derrubava
// o campo, e cada pessoa aparecia como o preset PADRÃO para todas as outras —
// só ela mesma se via direito. Terceira cópia da mesma lista morta (as outras
// duas eram o DTO e o índice de tiles): validar FORMATO, não enumerar valores.
const PRESET_ID = /^[a-z0-9-]{1,40}$/
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
  return name || 'Sem nome'
}

function sanitizeCoord(raw: unknown, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) && Math.abs(n) <= COORD_LIMIT ? n : fallback
}

// só os campos conhecidos do look, cada um validado — e a foto vira o caminho
// CANÔNICO relativo (/kairos-api/character/photo/<arquivo>), nunca uma URL
// externa arbitrária repassada pra todo mundo carregar
function sanitizeAvatar(raw: unknown): Record<string, string | number | null> {
  if (!raw || typeof raw !== 'object' || JSON.stringify(raw).length > AVATAR_MAX_JSON) return {}
  const a = raw as Record<string, unknown>
  const out: Record<string, string | number | null> = {}
  if (typeof a.escala === 'number' && Number.isFinite(a.escala)) {
    out.escala = Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, a.escala))
  }
  if (typeof a.hairStyle === 'string' && PRESET_ID.test(a.hairStyle)) out.hairStyle = a.hairStyle
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
  // estado do jukebox por objeto (servidor:map::jukeboxId) — fila/faixa atual/área, em memória
  private readonly jukebox = new Map<string, JukeboxRoomState>()
  // salas (áreas) trancadas por mapa (servidor:map) — ids de área, alternados por quem está dentro
  private readonly salasTrancadas = new Map<string, Set<string>>()
  // geometria das áreas por mapa (não por servidor: a forma do mapa é a mesma
  // pra todo mundo que o usa), carregada sob demanda e mantida em cache — muda raramente
  private readonly areasPorMapa = new Map<MapId, AreaRect[]>()
  // área ocupada agora por cada socket, pra só recalcular no passo em que ela muda
  private readonly areaAtualDoSocket = new Map<string, string | null>()
  // sudo invisível: some de players/playerJoined/playerMoved/presença pros outros
  private readonly invisiveis = new Set<string>()
  // hora forçada do mundo por mapa; null/ausente = segue a hora real
  private readonly horaDoMundo = new Map<string, number | null>()
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
  // histórico por canal. só é descartado quando o último ocupante sai — é o que
  // dá continuidade a quem chega depois, e usa o mesmo gatilho do destrancamento
  // automático de sala.
  private readonly historicoChat = new Map<string, MensagemGuardada[]>()
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
    private readonly mapService: MapService,
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
      this.emitPlayerLeft(player)
      this.emitPresenceLeave(player)
      this.saiDaAreaAtual(player)
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
    this.areaAtualDoSocket.delete(socketId)
    this.invisiveis.delete(socketId)
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
      this.emitPlayerLeft(existing)
      this.players.delete(socket.id)
      this.saiDaAreaAtual(existing)
      this.cleanupRoomIfEmpty(existing.serverId, existing.map)
    }
    await this.ensureAreasLoaded(map)
    const userId = this.socketUserId.get(socket.id) ?? ''
    const player: Player = {
      id: socket.id,
      userId,
      name: await this.nomeDoUsuario(userId),
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
    this.areaAtualDoSocket.set(socket.id, this.areaDoPonto(player.map, player.x, player.y))
    const room = this.room(serverId, player.map)
    socket.join(room)
    socket.emit('players', this.peersInRoom(serverId, player.map, socket.id))
    this.emitPlayerJoined(socket, player, room)
    this.emitActiveJukeboxes(socket, room)
    socket.emit('salaEstado', { trancadas: [...(this.salasTrancadas.get(room) ?? [])] })
    socket.emit('horaDoMundo', { hora: this.horaDoMundo.get(room) ?? null })
    this.entrarNosCanaisDeChat(socket, player)
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
    this.aplicarNovaPosicao(player)
    this.emitPlayerMoved(socket, player, this.room(player.serverId, player.map))
  }

  @SubscribeMessage('chat')
  handleChat(socket: Socket, payload: { text: string; escopo?: 'mundo' | 'sala' }) {
    const player = this.players.get(socket.id)
    if (!player) return
    // descarte silencioso: o cliente já segura o envio por 500ms, isto aqui é a
    // rede pra quem chama o socket direto pelo console
    const now = Date.now()
    if (now - (this.lastChatAt.get(socket.id) ?? 0) < CHAT_MIN_INTERVAL_MS) return
    const text = String(payload?.text ?? '').trim().slice(0, 255)
    if (!text) return
    this.lastChatAt.set(socket.id, now)

    // falar na sala exige estar numa: sem a checagem, o cliente podia mandar
    // escopo 'sala' de qualquer lugar e escrever numa conversa que não é dele
    const sala = payload?.escopo === 'sala' ? this.salaDoSocket(socket.id) : null
    const escopo: 'mundo' | 'sala' = sala ? 'sala' : 'mundo'
    const canal = sala
      ? this.canalDaSala(player.serverId, player.map, sala.id)
      : this.canalDoMundo(player.serverId, player.map)

    const msg: MensagemGuardada = {
      id: socket.id,
      userId: player.userId,
      name: player.name,
      text,
      ts: Date.now(),
      escopo,
      canal,
    }
    this.guardarNoHistorico(canal, msg)
    this.server.to(canal).emit('chatMessage', msg)
  }

  private guardarNoHistorico(canal: string, msg: MensagemGuardada) {
    const lista = this.historicoChat.get(canal) ?? []
    lista.push(msg)
    if (lista.length > CHAT_HISTORICO_MAX) lista.splice(0, lista.length - CHAT_HISTORICO_MAX)
    this.historicoChat.set(canal, lista)
  }

  private enviarHistorico(socket: Socket, canal: string, escopo: 'mundo' | 'sala', nome: string) {
    socket.emit('chatCanal', {
      canal,
      escopo,
      nome,
      mensagens: this.historicoChat.get(canal) ?? [],
    })
  }

  private descartarHistoricoSeVazio(canal: string, ocupado: boolean) {
    if (ocupado) return
    this.historicoChat.delete(canal)
  }


  @SubscribeMessage('avatarUpdate')
  async handleAvatarUpdate(socket: Socket, payload: { avatar: unknown }) {
    const player = this.players.get(socket.id)
    if (!player) return
    const now = Date.now()
    if (now - (this.lastAvatarAt.get(socket.id) ?? 0) < AVATAR_MIN_INTERVAL_MS) return
    this.lastAvatarAt.set(socket.id, now)
    const avatar = sanitizeAvatar(payload?.avatar)
    if (avatar.escala !== undefined && !(await this.ehSudo(socket))) delete avatar.escala
    player.avatar = avatar
    socket.to(this.room(player.serverId, player.map)).emit('playerAvatar', {
      id: socket.id,
      avatar: player.avatar,
      name: player.name,
    })
  }

  @SubscribeMessage('nomeAtualizado')
  async handleNomeAtualizado(socket: Socket) {
    const player = this.players.get(socket.id)
    if (!player) return
    const nomeNovo = await this.nomeDoUsuario(player.userId)
    if (nomeNovo === player.name) return
    player.name = nomeNovo
    socket.to(this.room(player.serverId, player.map)).emit('playerAvatar', {
      id: socket.id,
      avatar: player.avatar,
      name: player.name,
    })
    this.emitPresence(player, 'update')
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
  async handleSwitchMap(socket: Socket, payload: { map: MapId }) {
    const player = this.players.get(socket.id)
    const map = String(payload?.map ?? '').slice(0, 64)
    if (!player || !map || player.map === map) return
    this.stopScreenShareFor(player)
    const oldServerId = player.serverId
    const oldMap = player.map
    socket.leave(this.room(oldServerId, oldMap))
    socket.leave(this.canalDoMundo(oldServerId, oldMap))
    this.emitPlayerLeft(player)
    this.saiDaAreaAtual(player)
    player.map = map
    this.cleanupRoomIfEmpty(oldServerId, oldMap)
    await this.ensureAreasLoaded(map)
    this.areaAtualDoSocket.set(socket.id, this.areaDoPonto(player.map, player.x, player.y))
    const room = this.room(player.serverId, player.map)
    socket.join(room)
    socket.emit('players', this.peersInRoom(player.serverId, player.map, socket.id))
    this.emitPlayerJoined(socket, player, room)
    this.emitActiveJukeboxes(socket, room)
    socket.emit('salaEstado', { trancadas: [...(this.salasTrancadas.get(room) ?? [])] })
    socket.emit('horaDoMundo', { hora: this.horaDoMundo.get(room) ?? null })
    this.entrarNosCanaisDeChat(socket, player)
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
      if (player.serverId === serverId && !this.invisiveis.has(player.id)) people.push(this.personOf(player))
    }
    return people
  }

  // o serverId sai SEMPRE do player (derivado do token no handshake), nunca do
  // payload — quem recebe é só quem entrou na sala de presença dele
  private emitPresence(player: Player, type: 'join' | 'update') {
    if (!player.serverId || this.invisiveis.has(player.id)) return
    const delta: PresenceDelta = { serverId: player.serverId, type, person: this.personOf(player) }
    this.server.to(this.presenceRoom(player.serverId)).emit('presenceDelta', delta)
  }

  private emitPresenceLeave(player: Player) {
    if (!player.serverId || this.invisiveis.has(player.id)) return
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

  // ---- geometria das áreas: cache por mapa, carregado sob demanda ----

  private async ehSudo(socket: Socket): Promise<boolean> {
    const userId = this.socketUserId.get(socket.id)
    if (!userId) return false
    const user = await this.users.findOne({ where: { id: userId } })
    return !!user?.isSudo
  }

  private async nomeDoUsuario(userId: string): Promise<string> {
    if (!userId) return sanitizeName(null)
    const user = await this.users.findOne({ where: { id: userId } })
    return sanitizeName(user?.username)
  }

  private async ensureAreasLoaded(mapId: MapId): Promise<void> {
    if (this.areasPorMapa.has(mapId)) return
    let areas: AreaRect[] = []
    try {
      const map = await this.mapService.findOne(mapId)
      areas = (map.objects as any[])
        .filter((o) => o && o.kind === 'area' && o.id)
        .map((o) => ({
          id: String(o.id),
          nome: String(o.name ?? o.nome ?? o.id),
          aberta: o.aberta === true,
          x: Number(o.x),
          y: Number(o.y),
          w: Number(o.w),
          h: Number(o.h),
        }))
    } catch {
      areas = []
    }
    this.areasPorMapa.set(mapId, areas)
  }

  // a MENOR área que contém o ponto: sala pequena dentro de saguão grande
  // devolveria o saguão se fosse a primeira da lista
  private areaDoPonto(mapId: MapId, x: number, y: number): string | null {
    const areas = this.areasPorMapa.get(mapId) ?? []
    let achado: string | null = null
    let menor = Infinity
    for (const a of areas) {
      if (x < a.x || x >= a.x + a.w || y < a.y || y >= a.y + a.h) continue
      const tamanho = a.w * a.h
      if (tamanho < menor) { menor = tamanho; achado = a.id }
    }
    return achado
  }

  private areaPorId(mapId: MapId, areaId: string): AreaRect | null {
    return (this.areasPorMapa.get(mapId) ?? []).find((a) => a.id === areaId) ?? null
  }

  // praça é área ABERTA e não é sala: quem está nela fala no mundo, mesma regra
  // que já vale pra trancar
  private salaDoSocket(socketId: string): AreaRect | null {
    const player = this.players.get(socketId)
    const areaId = this.areaAtualDoSocket.get(socketId)
    if (!player || !areaId) return null
    const area = this.areaPorId(player.map, areaId)
    return area && !area.aberta ? area : null
  }

  private canalDoMundo(serverId: string | null, map: MapId): string {
    return `${this.room(serverId, map)}::chat:mundo`
  }

  private canalDaSala(serverId: string | null, map: MapId, areaId: string): string {
    return `${this.room(serverId, map)}::chat:sala:${areaId}`
  }

  // recalcula a área do jogador só quando ela muda (o move é frequente) e, ao
  // sair de uma, dispara o destrancamento se ninguém mais ficou dentro
  private aplicarNovaPosicao(player: Player) {
    const novaArea = this.areaDoPonto(player.map, player.x, player.y)
    const anterior = this.areaAtualDoSocket.get(player.id) ?? null
    if (novaArea === anterior) return
    this.areaAtualDoSocket.set(player.id, novaArea)
    this.trocarCanalDeSala(player, anterior, novaArea)
    if (anterior) this.destrancarSeVazia(player.serverId, player.map, anterior)
  }

  // o canal da sala acompanha o corpo: sair da sala tem que tirar do canal, senão
  // a pessoa continua lendo (e podendo escrever) numa conversa que já deixou
  private trocarCanalDeSala(player: Player, anterior: string | null, nova: string | null) {
    const socket = this.server.sockets.sockets.get(player.id)
    if (!socket) return
    if (anterior) {
      const area = this.areaPorId(player.map, anterior)
      if (area && !area.aberta) {
        const canal = this.canalDaSala(player.serverId, player.map, anterior)
        socket.leave(canal)
        this.descartarHistoricoSeVazio(canal, this.salaTemGente(player.serverId, player.map, anterior))
      }
    }
    if (nova) {
      const area = this.areaPorId(player.map, nova)
      if (area && !area.aberta) {
        const canal = this.canalDaSala(player.serverId, player.map, nova)
        socket.join(canal)
        this.enviarHistorico(socket, canal, 'sala', area.nome)
      }
    }
    if (!nova) socket.emit('chatCanalSala', { canal: null, nome: null })
  }

  // entrar no mundo é entrar na conversa dele; se o ponto de entrada já é dentro
  // de uma sala, entra nas duas de uma vez
  private entrarNosCanaisDeChat(socket: Socket, player: Player) {
    const canalMundo = this.canalDoMundo(player.serverId, player.map)
    socket.join(canalMundo)
    this.enviarHistorico(socket, canalMundo, 'mundo', 'Mundo')
    const sala = this.salaDoSocket(socket.id)
    if (!sala) {
      socket.emit('chatCanalSala', { canal: null, nome: null })
      return
    }
    const canalSala = this.canalDaSala(player.serverId, player.map, sala.id)
    socket.join(canalSala)
    this.enviarHistorico(socket, canalSala, 'sala', sala.nome)
  }

  private salaTemGente(serverId: string | null, map: MapId, areaId: string): boolean {
    for (const [socketId, area] of this.areaAtualDoSocket) {
      if (area !== areaId) continue
      const p = this.players.get(socketId)
      if (p && p.serverId === serverId && p.map === map) return true
    }
    return false
  }

  // saiu do mapa/desconectou: solta a área que ocupava e verifica o destrancamento
  private saiDaAreaAtual(player: Player) {
    const areaId = this.areaAtualDoSocket.get(player.id)
    this.areaAtualDoSocket.delete(player.id)
    if (!areaId) return
    const area = this.areaPorId(player.map, areaId)
    if (area && !area.aberta) {
      const canal = this.canalDaSala(player.serverId, player.map, areaId)
      this.server.sockets.sockets.get(player.id)?.leave(canal)
      this.descartarHistoricoSeVazio(canal, this.salaTemGente(player.serverId, player.map, areaId))
    }
    this.destrancarSeVazia(player.serverId, player.map, areaId)
  }

  private destrancarSeVazia(serverId: string | null, map: MapId, areaId: string) {
    const room = this.room(serverId, map)
    const trancadas = this.salasTrancadas.get(room)
    if (!trancadas?.has(areaId)) return
    for (const [socketId, area] of this.areaAtualDoSocket) {
      if (area !== areaId) continue
      const p = this.players.get(socketId)
      if (p && p.serverId === serverId && p.map === map) return
    }
    trancadas.delete(areaId)
    this.server.to(room).emit('salaEstado', { trancadas: [...trancadas] })
  }

  // ---- broadcasts de presença de mapa, filtrados pra quem está invisível ----

  private emitPlayerLeft(player: Player) {
    if (this.invisiveis.has(player.id)) return
    this.server.to(this.room(player.serverId, player.map)).emit('playerLeft', { id: player.id })
  }

  private emitPlayerJoined(socket: Socket, player: Player, room: string) {
    if (this.invisiveis.has(player.id)) return
    socket.to(room).emit('playerJoined', player)
  }

  private emitPlayerMoved(socket: Socket, player: Player, room: string) {
    if (this.invisiveis.has(player.id)) return
    socket.to(room).emit('playerMoved', {
      id: player.id,
      x: player.x,
      y: player.y,
      facing: player.facing,
      pose: player.pose,
      boost: player.boost,
    })
  }

  // ---- poderes do sudo: tudo validado no servidor, mesmo padrão de handleJukeboxAlcanceGlobal ----

  @SubscribeMessage('sudoInvisivel')
  async handleSudoInvisivel(socket: Socket, payload: { on: boolean }) {
    const player = this.players.get(socket.id)
    if (!player || typeof payload?.on !== 'boolean') return
    const userId = this.socketUserId.get(socket.id)
    if (!userId) return
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user?.isSudo) return
    if (this.invisiveis.has(socket.id) === payload.on) return
    const room = this.room(player.serverId, player.map)
    if (payload.on) {
      socket.to(room).emit('playerLeft', { id: socket.id })
      this.emitPresenceLeave(player)
      this.invisiveis.add(socket.id)
    } else {
      this.invisiveis.delete(socket.id)
      socket.to(room).emit('playerJoined', player)
      this.emitPresence(player, 'join')
    }
  }

  @SubscribeMessage('sudoPuxar')
  async handleSudoPuxar(socket: Socket, payload: { alvoId: string }) {
    const player = this.players.get(socket.id)
    const alvoId = typeof payload?.alvoId === 'string' ? payload.alvoId : ''
    if (!player || !alvoId) return
    const alvo = this.players.get(alvoId)
    if (!alvo || alvo.serverId !== player.serverId || alvo.map !== player.map) return
    const userId = this.socketUserId.get(socket.id)
    if (!userId) return
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user?.isSudo) return
    alvo.x = player.x
    alvo.y = player.y
    this.aplicarNovaPosicao(alvo)
    const alvoSocket = this.server.sockets.sockets.get(alvoId)
    alvoSocket?.emit('puxado', { x: alvo.x, y: alvo.y })
    if (alvoSocket) this.emitPlayerMoved(alvoSocket, alvo, this.room(alvo.serverId, alvo.map))
  }

  @SubscribeMessage('sudoFesta')
  async handleSudoFesta(socket: Socket) {
    const player = this.players.get(socket.id)
    if (!player) return
    const userId = this.socketUserId.get(socket.id)
    if (!userId) return
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user?.isSudo) return
    this.server.to(this.room(player.serverId, player.map)).emit('festa', {})
  }

  @SubscribeMessage('sudoTeleporte')
  async handleSudoTeleporte(socket: Socket, payload: { x: number; y: number }) {
    const player = this.players.get(socket.id)
    if (!player) return
    if (typeof payload?.x !== 'number' || !Number.isFinite(payload.x) || Math.abs(payload.x) > COORD_LIMIT) return
    if (typeof payload?.y !== 'number' || !Number.isFinite(payload.y) || Math.abs(payload.y) > COORD_LIMIT) return
    const userId = this.socketUserId.get(socket.id)
    if (!userId) return
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user?.isSudo) return
    player.x = payload.x
    player.y = payload.y
    this.aplicarNovaPosicao(player)
    this.emitPlayerMoved(socket, player, this.room(player.serverId, player.map))
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
    const prefix = `${room}::`
    // último a sair apaga a luz: o histórico do mundo e o das salas dele só some
    // quando o mapa esvazia de vez
    for (const canal of [...this.historicoChat.keys()]) {
      if (canal.startsWith(prefix)) this.historicoChat.delete(canal)
    }
    for (const [key, state] of this.jukebox) {
      if (!key.startsWith(prefix)) continue
      if (state.timer) clearTimeout(state.timer)
      this.jukebox.delete(key)
    }
    this.salasTrancadas.delete(room)
  }

  // ---- jukebox: fila por objeto (servidor:map::jukeboxId), sincronizada por startedAt ----

  @SubscribeMessage('jukeboxAdd')
  async handleJukeboxAdd(socket: Socket, payload: { input: string; areaId?: string; jukeboxId?: string }) {
    const player = this.players.get(socket.id)
    if (!player) return
    const jukeboxId = this.sanitizeObjectId(payload?.jukeboxId)
    if (!jukeboxId) return
    const userId = this.socketUserId.get(socket.id)
    if (!userId) {
      socket.emit('jukeboxError', { message: 'Faça login para adicionar música' })
      return
    }
    const room = this.room(player.serverId, player.map)
    const state = this.jukeboxStateFor(room, jukeboxId)
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
      this.broadcastJukebox(room, jukeboxId)
      const track = await this.jukeboxService.resolveTrack(youtubeId, userId, player.name, player.serverId, (label) => {
        state.status = label
        this.broadcastJukebox(room, jukeboxId)
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
      if (!state.current) this.advanceJukebox(room, jukeboxId)
      else this.broadcastJukebox(room, jukeboxId)
    } catch (e) {
      state.status = null
      this.broadcastJukebox(room, jukeboxId)
      socket.emit('jukeboxError', { message: (e as Error).message || 'Falha ao adicionar música' })
    }
  }

  @SubscribeMessage('jukeboxSkip')
  handleJukeboxSkip(socket: Socket, payload: { jukeboxId?: string }) {
    const player = this.players.get(socket.id)
    if (!player) return
    const jukeboxId = this.sanitizeObjectId(payload?.jukeboxId)
    if (!jukeboxId) return
    this.advanceJukebox(this.room(player.serverId, player.map), jukeboxId)
  }

  // só quem é sudo altera o alcance da sala pra além da proximidade — vale pra
  // todos os que ouvem esse jukebox
  @SubscribeMessage('jukeboxAlcanceGlobal')
  async handleJukeboxAlcanceGlobal(socket: Socket, payload: { value: boolean; jukeboxId?: string }) {
    const player = this.players.get(socket.id)
    if (!player || typeof payload?.value !== 'boolean') return
    const jukeboxId = this.sanitizeObjectId(payload?.jukeboxId)
    if (!jukeboxId) return
    const userId = this.socketUserId.get(socket.id)
    if (!userId) return
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user?.isSudo) return
    const room = this.room(player.serverId, player.map)
    this.jukeboxStateFor(room, jukeboxId).alcanceGlobal = payload.value
    this.broadcastJukebox(room, jukeboxId)
  }

  @SubscribeMessage('definirHora')
  async handleDefinirHora(socket: Socket, payload: { hora: number | null }) {
    const player = this.players.get(socket.id)
    if (!player) return
    const bruta = payload?.hora
    const hora = bruta === null ? null : Number(bruta)
    if (hora !== null && (!Number.isFinite(hora) || hora < 0 || hora >= 24)) return
    const userId = this.socketUserId.get(socket.id)
    if (!userId) return
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user?.isSudo) return
    const room = this.room(player.serverId, player.map)
    this.horaDoMundo.set(room, hora)
    this.server.to(room).emit('horaDoMundo', { hora })
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

  private jukeboxKey(room: string, jukeboxId: string): string {
    return `${room}::${jukeboxId}`
  }

  private jukeboxStateFor(room: string, jukeboxId: string): JukeboxRoomState {
    const key = this.jukeboxKey(room, jukeboxId)
    let state = this.jukebox.get(key)
    if (!state) {
      state = { areaId: null, alcanceGlobal: false, queue: [], current: null, startedAt: null, timer: null, status: null }
      this.jukebox.set(key, state)
    }
    return state
  }

  private jukeboxPayload(s: JukeboxRoomState, jukeboxId: string) {
    return {
      jukeboxId,
      areaId: s.areaId,
      alcanceGlobal: s.alcanceGlobal,
      queue: s.queue,
      current: s.current,
      startedAt: s.startedAt,
      status: s.status,
    }
  }

  private broadcastJukebox(room: string, jukeboxId: string) {
    const s = this.jukeboxStateFor(room, jukeboxId)
    this.server.to(room).emit('jukeboxState', this.jukeboxPayload(s, jukeboxId))
  }

  // ao entrar/trocar de mapa: entrega o estado de toda jukebox já em memória
  // pra essa sala — só as que alguém já mexeu, o gateway não conhece a geometria
  // do mapa pra saber quais objetos existem
  private emitActiveJukeboxes(socket: Socket, room: string) {
    const prefix = `${room}::`
    for (const [key, state] of this.jukebox) {
      if (!key.startsWith(prefix)) continue
      socket.emit('jukeboxState', this.jukeboxPayload(state, key.slice(prefix.length)))
    }
  }

  // toca a próxima da fila (chamado ao terminar a atual, pular, ou ao chegar a 1ª música)
  private advanceJukebox(room: string, jukeboxId: string) {
    const key = this.jukeboxKey(room, jukeboxId)
    // sala vazia (ex: download terminou depois de todo mundo sair) → descarta o
    // estado em vez de agendar timer tocando pra ninguém
    if (!(this.server.sockets.adapter.rooms.get(room)?.size ?? 0)) {
      const stale = this.jukebox.get(key)
      if (stale?.timer) clearTimeout(stale.timer)
      this.jukebox.delete(key)
      return
    }
    const state = this.jukeboxStateFor(room, jukeboxId)
    if (state.timer) {
      clearTimeout(state.timer)
      state.timer = null
    }
    state.current = state.queue.shift() || null
    state.startedAt = state.current ? Date.now() : null
    this.broadcastJukebox(room, jukeboxId)
    if (state.current) {
      const ms = Math.max(5000, state.current.durationSec * 1000)
      state.timer = setTimeout(() => this.advanceJukebox(room, jukeboxId), ms)
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
      if (
        player.serverId === serverId &&
        player.map === map &&
        player.id !== exceptId &&
        !this.invisiveis.has(player.id)
      )
        peers.push(player)
    }
    return peers
  }
}
