import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { User } from '../user/user.entity'
import { Character } from '../character/character.entity'
import { Server } from '../server/server.entity'
import { ServerMembership } from '../server/server-membership.entity'
import { normalizeUsername } from '../user/username'
import { Friendship } from './friendship.entity'
import { FriendServerInvite } from './friend-server-invite.entity'
import { MAX_PEDIDOS_PENDENTES, friendPair, isParty, otherSide, stripAt } from './friendship'

const UNIQUE_VIOLATION = '23505'

export interface Perfil {
  id: string
  username: string | null
  nome: string | null
}

@Injectable()
export class FriendService {
  constructor(
    @InjectRepository(Friendship) private friendships: Repository<Friendship>,
    @InjectRepository(FriendServerInvite) private serverInvites: Repository<FriendServerInvite>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Server) private servers: Repository<Server>,
    @InjectRepository(ServerMembership) private memberships: Repository<ServerMembership>,
  ) {}

  async list(userId: string) {
    const rows = await this.friendships.find({
      where: [
        { userAId: userId, status: 'aceita' },
        { userBId: userId, status: 'aceita' },
      ],
    })
    return this.views(rows, userId)
  }

  // só os ids de quem já é amigo aceito, em lote. Existe pro gateway de presença:
  // ele precisa do conjunto por usuário a cada varredura, e as views de `list`
  // trariam junto um join de perfil que ninguém ali usa.
  async acceptedFriendIds(userIds: string[]): Promise<Map<string, Set<string>>> {
    const unicos = [...new Set(userIds)].filter(Boolean)
    const mapa = new Map<string, Set<string>>()
    for (const id of unicos) mapa.set(id, new Set<string>())
    if (!unicos.length) return mapa
    const rows = await this.friendships.find({
      where: [
        { userAId: In(unicos), status: 'aceita' },
        { userBId: In(unicos), status: 'aceita' },
      ],
    })
    for (const row of rows) {
      mapa.get(row.userAId)?.add(row.userBId)
      mapa.get(row.userBId)?.add(row.userAId)
    }
    return mapa
  }

  async pending(userId: string) {
    const rows = await this.friendships.find({
      where: [
        { userAId: userId, status: 'pendente' },
        { userBId: userId, status: 'pendente' },
      ],
    })
    return {
      recebidos: await this.views(
        rows.filter((r) => r.requestedBy !== userId),
        userId,
      ),
      enviados: await this.views(
        rows.filter((r) => r.requestedBy === userId),
        userId,
      ),
    }
  }

  // só quem bloqueou enxerga a linha bloqueada — é daqui que sai o id pro unblock
  async blocked(userId: string) {
    const rows = await this.friendships.find({
      where: [
        { userAId: userId, status: 'bloqueada', blockedBy: userId },
        { userBId: userId, status: 'bloqueada', blockedBy: userId },
      ],
    })
    return this.views(rows, userId)
  }

  // "estes dois podem se falar agora?" — só 'aceita' responde sim. Desfazer a amizade
  // apaga a linha e bloquear muda o status, então os dois casos caem aqui do mesmo jeito.
  async saoAmigos(userId: string, outroId: string): Promise<boolean> {
    if (!userId || !outroId || userId === outroId) return false
    const row = await this.friendships.findOne({
      where: { ...friendPair(userId, outroId), status: 'aceita' },
    })
    return !!row
  }

  async request(userId: string, rawUsername: string) {
    const me = await this.users.findOne({ where: { id: userId } })
    if (!me) throw new UnauthorizedException()
    if (!me.usernameLower) {
      throw new ForbiddenException({
        code: 'sem-username',
        message: 'Escolha seu nome de usuário antes de adicionar amigos.',
      })
    }

    // o teto é conferido ANTES de procurar o alvo: conferido depois, a mensagem de
    // teto só apareceria pra nome que existe, virando um detector de contas
    const pendentes = await this.friendships.count({
      where: { requestedBy: userId, status: 'pendente' },
    })
    if (pendentes >= MAX_PEDIDOS_PENDENTES) {
      throw new ForbiddenException({
        code: 'friend-pending-limit',
        message: `Você já tem ${MAX_PEDIDOS_PENDENTES} pedidos de amizade esperando resposta. Espere alguém responder antes de mandar outro.`,
      })
    }

    const alvo = await this.users.findOne({
      where: { usernameLower: normalizeUsername(stripAt(rawUsername)) },
    })
    if (!alvo || alvo.isGuest) throw this.usuarioNaoEncontrado()
    if (alvo.id === userId) {
      throw new BadRequestException({
        code: 'amizade-consigo',
        message: 'Você não pode adicionar você mesmo.',
      })
    }

    const pair = friendPair(userId, alvo.id)
    const existente = await this.friendships.findOne({ where: pair })
    if (existente) return this.reconciliar(existente, userId)

    const novo = this.friendships.create({ ...pair, status: 'pendente', requestedBy: userId })
    try {
      await this.friendships.save(novo)
    } catch (err: any) {
      if (err?.code !== UNIQUE_VIOLATION) throw err
      // os dois se pediram no mesmo instante e passaram juntos pela consulta acima:
      // quem perdeu a corrida do UNIQUE cai aqui e resolve contra a linha que venceu
      const corrida = await this.friendships.findOne({ where: pair })
      if (!corrida) throw err
      return this.reconciliar(corrida, userId)
    }
    return this.view(novo, userId)
  }

  async accept(userId: string, id: string) {
    const row = await this.mine(id, userId)
    if (row.status === 'aceita') return this.view(row, userId)
    if (row.status === 'bloqueada') {
      throw new ConflictException({
        code: 'friend-blocked-by-me',
        message: 'Você bloqueou essa pessoa. Desbloqueie antes de aceitar.',
      })
    }
    if (row.requestedBy === userId) throw this.pedidoNaoEncontrado()

    row.status = 'aceita'
    row.respondedAt = new Date()
    await this.friendships.save(row)
    return this.view(row, userId)
  }

  // recusar apaga a linha: os três estados do par são pendente, aceita e bloqueada —
  // não existe "recusada" guardada, e quem pediu não é avisado
  async reject(userId: string, id: string) {
    const row = await this.mine(id, userId)
    if (row.status !== 'pendente' || row.requestedBy === userId) throw this.pedidoNaoEncontrado()
    await this.friendships.delete(row.id)
    return { ok: true }
  }

  // some dos dois lados sem avisar ninguém; serve também pra desistir de um pedido enviado
  async remove(userId: string, id: string) {
    const row = await this.mine(id, userId)
    await this.friendships.delete(row.id)
    return { ok: true }
  }

  async block(userId: string, id: string) {
    const row = await this.mine(id, userId)
    row.status = 'bloqueada'
    row.blockedBy = userId
    row.respondedAt = new Date()
    await this.friendships.save(row)
    return this.view(row, userId)
  }

  // desbloquear não devolve a amizade: apaga a linha e os dois voltam a ser estranhos
  async unblock(userId: string, id: string) {
    const row = await this.mine(id, userId)
    if (row.status !== 'bloqueada' || row.blockedBy !== userId) throw this.amizadeNaoEncontrada()
    await this.friendships.delete(row.id)
    return { ok: true }
  }

  async inviteToServer(userId: string, id: string, serverId: string) {
    const row = await this.mine(id, userId)
    if (row.status !== 'aceita') {
      throw new ForbiddenException({
        code: 'friend-not-accepted',
        message: 'Você só pode convidar quem já é seu amigo.',
      })
    }
    const amigoId = otherSide(row, userId)

    // mesma régua do link de convite (GET /server/:id/invite): quem não pode tirar o
    // link também não pode convidar por dentro
    const minha = await this.memberships.findOne({ where: { userId, serverId } })
    if (!minha) throw new ForbiddenException('Você não é membro deste servidor')
    if (minha.role !== 'admin') {
      throw new ForbiddenException('Apenas administradores do servidor podem convidar')
    }

    const server = await this.servers.findOne({ where: { id: serverId } })
    if (!server) throw new NotFoundException('Servidor não encontrado')
    if (server.archivedAt) {
      throw new ForbiddenException('Este servidor está arquivado e não aceita novos membros')
    }

    const jaMembro = await this.memberships.findOne({ where: { userId: amigoId, serverId } })
    if (jaMembro) throw new ConflictException('Essa pessoa já é membro deste servidor')

    const jaConvidado = await this.serverInvites.findOne({
      where: { serverId, toUserId: amigoId, status: 'pendente' },
    })
    if (jaConvidado) return this.inviteView(jaConvidado, server.name)

    const convite = await this.serverInvites.save(
      this.serverInvites.create({
        serverId,
        fromUserId: userId,
        toUserId: amigoId,
        status: 'pendente',
      }),
    )
    return this.inviteView(convite, server.name)
  }

  async serverInvitesFor(userId: string) {
    const rows = await this.serverInvites.find({
      where: { toUserId: userId, status: 'pendente' },
    })
    if (!rows.length) return []
    const perfis = await this.perfis(rows.map((r) => r.fromUserId))
    const servidores = await this.servers.find({
      where: { id: In([...new Set(rows.map((r) => r.serverId))]) },
    })
    const nomes = new Map(servidores.map((s) => [s.id, s.name]))
    return rows.map((r) => ({
      ...this.inviteView(r, nomes.get(r.serverId) ?? null),
      de: perfis.get(r.fromUserId) ?? null,
    }))
  }

  // a linha bloqueada pelo outro não existe pro bloqueado: mesma resposta de uma
  // amizade que nunca houve, pra nada na API denunciar o bloqueio
  private async mine(id: string, userId: string): Promise<Friendship> {
    const row = await this.friendships.findOne({ where: { id } })
    if (!row || !isParty(row, userId)) throw this.amizadeNaoEncontrada()
    if (row.status === 'bloqueada' && row.blockedBy !== userId) throw this.amizadeNaoEncontrada()
    return row
  }

  private async reconciliar(row: Friendship, userId: string) {
    if (row.status === 'bloqueada') {
      if (row.blockedBy === userId) {
        throw new ConflictException({
          code: 'friend-blocked-by-me',
          message: 'Você bloqueou essa pessoa. Desbloqueie antes de adicioná-la.',
        })
      }
      throw this.usuarioNaoEncontrado()
    }
    if (row.status === 'aceita') {
      throw new ConflictException({ code: 'friend-already', message: 'Vocês já são amigos.' })
    }
    // o outro já tinha pedido: pedir de volta é o mesmo que aceitar, e continua uma linha só
    if (row.requestedBy !== userId) {
      row.status = 'aceita'
      row.respondedAt = new Date()
      await this.friendships.save(row)
    }
    return this.view(row, userId)
  }

  private async view(row: Friendship, userId: string) {
    const [view] = await this.views([row], userId)
    return view
  }

  private async views(rows: Friendship[], userId: string) {
    if (!rows.length) return []
    const perfis = await this.perfis(rows.map((r) => otherSide(r, userId)))
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      pedidoFeitoPorMim: row.requestedBy === userId,
      desde: row.respondedAt ?? null,
      criadoEm: row.createdAt ?? null,
      usuario: perfis.get(otherSide(row, userId)) ?? null,
    }))
  }

  // o nome de exibição vive em Character, o @nome em User
  async perfis(ids: string[]): Promise<Map<string, Perfil>> {
    const unicos = [...new Set(ids)]
    const mapa = new Map<string, Perfil>()
    if (!unicos.length) return mapa
    const rows = await this.users
      .createQueryBuilder('u')
      .leftJoin(Character, 'c', 'c."userId" = u.id')
      .select('u.id', 'id')
      .addSelect('u.username', 'username')
      .addSelect('c.name', 'nome')
      .where('u.id IN (:...ids)', { ids: unicos })
      .getRawMany<Perfil>()
    for (const row of rows) mapa.set(row.id, row)
    return mapa
  }

  private inviteView(convite: FriendServerInvite, serverName: string | null) {
    return {
      id: convite.id,
      serverId: convite.serverId,
      servidor: serverName,
      status: convite.status,
      criadoEm: convite.createdAt ?? null,
    }
  }

  private usuarioNaoEncontrado() {
    return new NotFoundException({ code: 'user-not-found', message: 'Usuário não encontrado' })
  }

  private amizadeNaoEncontrada() {
    return new NotFoundException({ code: 'friend-not-found', message: 'Amizade não encontrada' })
  }

  private pedidoNaoEncontrado() {
    return new NotFoundException({ code: 'friend-request-not-found', message: 'Pedido não encontrado' })
  }
}
