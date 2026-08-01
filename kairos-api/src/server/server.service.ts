import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { randomBytes } from 'crypto'
import { Server } from './server.entity'
import { ServerInvite } from './server-invite.entity'
import { ServerMembership } from './server-membership.entity'
import { User } from '../user/user.entity'
import { Character } from '../character/character.entity'
import { GameMap } from '../map/game-map.entity'

function slugify(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'servidor'
  )
}

@Injectable()
export class ServerService implements OnModuleInit {
  constructor(
    @InjectRepository(Server) private servers: Repository<Server>,
    @InjectRepository(ServerInvite) private invites: Repository<ServerInvite>,
    @InjectRepository(ServerMembership) private memberships: Repository<ServerMembership>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(GameMap) private maps: Repository<GameMap>,
  ) {}

  // backfill único: usuários com serverId (schema antigo, 1:1) que ainda não
  // têm membership correspondente ganham uma linha — migração idempotente, roda toda
  // subida mas só insere o que faltar.
  async onModuleInit() {
    const users = await this.users.find({ where: {} })
    for (const u of users) {
      if (!u.serverId) continue
      const exists = await this.memberships.findOne({ where: { userId: u.id, serverId: u.serverId } })
      if (!exists) {
        await this.memberships.save(
          this.memberships.create({ userId: u.id, serverId: u.serverId, role: u.serverRole }),
        )
      }
    }
  }

  // cria o servidor, torna o criador admin (nova membership), ativa ele na hora e
  // já nasce com o link de convite pronto
  async create(userId: string, name: string): Promise<Server> {
    const server = await this.servers.save(
      this.servers.create({ name, slug: await this.uniqueSlug(slugify(name)), ownerId: userId }),
    )
    await this.memberships.save(this.memberships.create({ userId, serverId: server.id, role: 'admin' }))
    await this.users.update(userId, { serverId: server.id, serverRole: 'admin' })
    await this.issueInvite(server.id, userId)
    return server
  }

  // servidor ATIVO do usuário + membros (sempre que houver servidor ativo)
  async me(userId: string) {
    const serverId = await this.userServer(userId)
    if (!serverId) return null
    const server = await this.servers.findOne({ where: { id: serverId } })
    if (!server || server.archivedAt) return null
    // a lista sai de server_memberships: users.serverId só diz quem está COM este
    // servidor ativo agora, então membro que está noutro sumiria da administração.
    // O nome de exibição vive em Character, não em User.
    const members = await this.memberships
      .createQueryBuilder('m')
      .innerJoin(User, 'u', 'u.id = m.userId')
      .leftJoin(Character, 'c', 'c."userId" = m.userId')
      .select('u.id', 'id')
      .addSelect('u.email', 'email')
      .addSelect('c.name', 'name')
      .addSelect('m.role', 'serverRole')
      .addSelect('m.joinedAt', 'joinedAt')
      .where('m.serverId = :serverId', { serverId })
      .orderBy('m.joinedAt', 'ASC')
      .getRawMany<{ id: string; email: string; name: string | null; serverRole: 'admin' | 'member'; joinedAt: Date }>()
    return { ...server, members }
  }

  // lista os servidores de que o usuário é membro (independente de qual está ativo);
  // arquivados só aparecem quando pedidos explicitamente
  async listMine(userId: string, archived = false) {
    const activeServerId = await this.userServer(userId)
    const rows = await this.memberships
      .createQueryBuilder('m')
      .innerJoin(Server, 's', 's.id = m.serverId')
      .select('s.id', 'id')
      .addSelect('s.name', 'name')
      .addSelect('s.slug', 'slug')
      .addSelect('s.archivedAt', 'archivedAt')
      .addSelect('s.ownerId', 'ownerId')
      .addSelect('m.role', 'role')
      .where('m.userId = :userId', { userId })
      .andWhere(archived ? 's.archivedAt IS NOT NULL' : 's.archivedAt IS NULL')
      .orderBy('s.name', 'ASC')
      .getRawMany<{ id: string; name: string; slug: string; archivedAt: Date | null; ownerId: string; role: 'admin' | 'member' }>()

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      role: r.role,
      active: r.id === activeServerId,
      archived: r.archivedAt !== null,
      owner: r.ownerId === userId,
    }))
  }

  // troca o servidor ativo — exige que o usuário já seja membro dele
  async switchActive(userId: string, serverId: string) {
    const membership = await this.requireMembership(userId, serverId)
    const server = await this.servers.findOne({ where: { id: serverId } })
    if (!server) throw new NotFoundException('Servidor não encontrado')
    if (server.archivedAt) throw new ForbiddenException('Este servidor está arquivado')
    await this.users.update(userId, { serverId, serverRole: membership.role })
    return this.me(userId)
  }

  // entra num servidor via convite — ADICIONA uma membership nova; se o usuário ainda não
  // tem servidor ativo, esse passa a ser; se já tem outro ativo, continua ativo o mesmo
  // (o usuário troca manualmente depois via switchActive, se quiser)
  async join(userId: string, code: string) {
    const invite = await this.invites.findOne({ where: { code } })
    if (!invite) throw new NotFoundException('Convite inválido')

    const server = await this.servers.findOne({ where: { id: invite.serverId } })
    if (!server) throw new NotFoundException('Servidor não encontrado')
    if (server.archivedAt) throw new ForbiddenException('Este servidor está arquivado e não aceita novos membros')

    const already = await this.memberships.findOne({ where: { userId, serverId: invite.serverId } })
    if (already) throw new ConflictException('Você já é membro deste servidor')

    await this.memberships.save(
      this.memberships.create({ userId, serverId: invite.serverId, role: 'member' }),
    )
    await this.invites.increment({ code }, 'uses', 1)

    const hasActive = await this.userServer(userId)
    if (!hasActive) {
      await this.users.update(userId, { serverId: invite.serverId, serverRole: 'member' })
    }
    return this.me(userId)
  }

  async joinFromFriendInvite(userId: string, serverId: string) {
    const server = await this.servers.findOne({ where: { id: serverId } })
    if (!server) throw new NotFoundException('Servidor não encontrado')
    if (server.archivedAt) throw new ForbiddenException('Este servidor está arquivado e não aceita novos membros')

    const already = await this.memberships.findOne({ where: { userId, serverId } })
    if (already) throw new ConflictException('Você já é membro deste servidor')

    await this.memberships.save(this.memberships.create({ userId, serverId, role: 'member' }))

    const hasActive = await this.userServer(userId)
    if (!hasActive) {
      await this.users.update(userId, { serverId, serverRole: 'member' })
    }
    return this.me(userId)
  }

  async getInvite(serverId: string, userId: string) {
    await this.requireAdmin(userId, serverId)
    const invite = await this.invites.findOne({ where: { serverId }, order: { createdAt: 'DESC' } })
    if (invite) return { code: invite.code, uses: invite.uses }
    return this.issueInvite(serverId, userId)
  }

  // único jeito de um link morrer: o código antigo é apagado e outro nasce no lugar
  async revokeInvite(serverId: string, userId: string) {
    await this.requireAdmin(userId, serverId)
    await this.invites.delete({ serverId })
    return this.issueInvite(serverId, userId)
  }

  // sair do servidor — o dono e o último administrador precisam passar a posse antes,
  // senão o servidor fica sem ninguém que possa administrá-lo
  async leave(userId: string, serverId: string) {
    const membership = await this.requireMembership(userId, serverId)
    const server = await this.servers.findOne({ where: { id: serverId } })
    if (!server) throw new NotFoundException('Servidor não encontrado')

    if (server.ownerId === userId) {
      throw new ForbiddenException(
        'Você é o dono deste servidor. Transfira a posse a outro membro antes de sair.',
      )
    }
    if (membership.role === 'admin') {
      const admins = await this.memberships.count({ where: { serverId, role: 'admin' } })
      if (admins <= 1) {
        throw new ForbiddenException(
          'Você é o último administrador deste servidor. Transfira a posse a outro membro antes de sair.',
        )
      }
    }

    await this.memberships.delete({ userId, serverId })
    await this.reassignActiveServer(userId, serverId)
    return { left: serverId, active: await this.me(userId) }
  }

  // passa a posse a outro membro, que vira admin; quem transferiu fica como membro comum
  async transferOwnership(serverId: string, ownerId: string, newOwnerId: string) {
    await this.requireOwner(ownerId, serverId)
    if (newOwnerId === ownerId) throw new BadRequestException('Você já é o dono deste servidor')

    const target = await this.memberships.findOne({ where: { userId: newOwnerId, serverId } })
    if (!target) throw new NotFoundException('O novo dono precisa ser membro do servidor')

    await this.memberships.update({ userId: newOwnerId, serverId }, { role: 'admin' })
    await this.memberships.update({ userId: ownerId, serverId }, { role: 'member' })
    await this.servers.update(serverId, { ownerId: newOwnerId })
    await this.syncActiveRole(newOwnerId, serverId, 'admin')
    await this.syncActiveRole(ownerId, serverId, 'member')

    return { id: serverId, ownerId: newOwnerId }
  }

  async archive(serverId: string, userId: string) {
    await this.requireOwner(userId, serverId)
    await this.servers.update(serverId, { archivedAt: new Date() })

    // ninguém pode ficar com um arquivado como ativo — continuaria enxergando os mundos dele
    const members = await this.memberships.find({ where: { serverId } })
    for (const m of members) await this.reassignActiveServer(m.userId, serverId)

    return this.servers.findOne({ where: { id: serverId } })
  }

  async restore(serverId: string, userId: string) {
    await this.requireOwner(userId, serverId)
    await this.servers.update(serverId, { archivedAt: null })
    return this.servers.findOne({ where: { id: serverId } })
  }

  async updateServer(serverId: string, name: string) {
    await this.servers.update(serverId, { name, slug: await this.uniqueSlug(slugify(name), serverId) })
    return this.servers.findOne({ where: { id: serverId } })
  }

  async setRole(serverId: string, targetId: string, role: 'admin' | 'member', requesterId: string) {
    // mudar o próprio papel permitiria o último admin se rebaixar e travar o servidor
    if (targetId === requesterId) throw new BadRequestException('Você não pode alterar seu próprio papel')
    await this.refuseIfOwner(serverId, targetId, 'rebaixar o dono do servidor')
    const target = await this.users.findOne({ where: { id: targetId } })
    if (!target || target.serverId !== serverId) throw new NotFoundException('Membro não encontrado')
    await this.users.update(targetId, { serverRole: role })
    await this.memberships.update({ userId: targetId, serverId }, { role })
    return { id: targetId, serverRole: role }
  }

  // remove o membro do servidor (membership) — se esse era o servidor ATIVO dele, cai pra outra
  // membership existente (se houver) ou fica sem servidor ativo
  async removeMember(serverId: string, targetId: string, requesterId: string) {
    if (targetId === requesterId) throw new BadRequestException('Você não pode se remover')
    await this.refuseIfOwner(serverId, targetId, 'remover o dono do servidor')
    const target = await this.users.findOne({ where: { id: targetId } })
    if (!target) throw new NotFoundException('Membro não encontrado')

    await this.memberships.delete({ userId: targetId, serverId })
    await this.reassignActiveServer(targetId, serverId)
    return { removed: targetId }
  }

  // link fixo: sem expiração e sem limite de usos
  private async issueInvite(serverId: string, userId: string) {
    const invite = await this.invites.save(
      this.invites.create({
        code: await this.uniqueCode(),
        serverId,
        createdBy: userId,
        expiresAt: null,
        maxUses: null,
      }),
    )
    return { code: invite.code, uses: invite.uses }
  }

  // as rotas com :id agem sobre um servidor que pode não ser o ativo, e o ServerAdminGuard
  // só enxerga o ativo — a permissão dessas rotas é resolvida aqui, contra o servidor alvo
  async requireMembership(userId: string, serverId: string): Promise<ServerMembership> {
    const membership = await this.memberships.findOne({ where: { userId, serverId } })
    if (!membership) throw new ForbiddenException('Você não é membro deste servidor')
    return membership
  }

  private async requireAdmin(userId: string, serverId: string): Promise<ServerMembership> {
    const membership = await this.requireMembership(userId, serverId)
    if (membership.role !== 'admin') throw new ForbiddenException('Apenas administradores do servidor')
    return membership
  }

  private async requireOwner(userId: string, serverId: string): Promise<Server> {
    const server = await this.servers.findOne({ where: { id: serverId } })
    if (!server) throw new NotFoundException('Servidor não encontrado')
    if (server.ownerId !== userId) throw new ForbiddenException('Apenas o dono do servidor')
    return server
  }

  // User.serverRole descreve só o servidor ATIVO — escrever nele quando o ativo é outro
  // corromperia o papel do usuário no servidor errado
  private async syncActiveRole(userId: string, serverId: string, role: 'admin' | 'member') {
    await this.users.update({ id: userId, serverId }, { serverRole: role })
  }

  // quem perde o vínculo com o servidor ativo cai pra outro de que já é membro (nunca um
  // arquivado) ou fica sem servidor ativo
  private async reassignActiveServer(userId: string, leftServerId: string) {
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user || user.serverId !== leftServerId) return

    const fallback = await this.memberships
      .createQueryBuilder('m')
      .innerJoin(Server, 's', 's.id = m.serverId')
      .where('m.userId = :userId', { userId })
      .andWhere('m.serverId != :leftServerId', { leftServerId })
      .andWhere('s.archivedAt IS NULL')
      .orderBy('m.joinedAt', 'ASC')
      .getOne()

    if (fallback) {
      await this.users.update(userId, { serverId: fallback.serverId, serverRole: fallback.role })
    } else {
      await this.users.update(userId, { serverId: null, serverRole: 'member' })
    }
  }

  private async refuseIfOwner(serverId: string, targetId: string, acao: string) {
    const server = await this.servers.findOne({ where: { id: serverId } })
    if (server?.ownerId === targetId) {
      throw new BadRequestException(`Não é possível ${acao}. Transfira a posse antes.`)
    }
  }

  private async userServer(userId: string): Promise<string | null> {
    const u = await this.users.findOne({ where: { id: userId } })
    return u?.serverId ?? null
  }

  private async uniqueCode(): Promise<string> {
    while (true) {
      const code = randomBytes(6).toString('base64url').slice(0, 8)
      const found = await this.invites.findOne({ where: { code } })
      if (!found) return code
    }
  }

  private async uniqueSlug(base: string, exceptId?: string): Promise<string> {
    let slug = base
    let n = 1
    while (true) {
      const found = await this.servers.findOne({ where: { slug } })
      if (!found || found.id === exceptId) return slug
      n += 1
      slug = `${base}-${n}`
    }
  }
}
