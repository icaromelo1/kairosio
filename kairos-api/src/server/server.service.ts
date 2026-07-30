import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
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

  // cria o servidor, torna o criador admin (nova membership) e ativa ele na hora
  async create(userId: string, name: string): Promise<Server> {
    const server = await this.servers.save(
      this.servers.create({ name, slug: await this.uniqueSlug(slugify(name)), ownerId: userId }),
    )
    await this.memberships.save(this.memberships.create({ userId, serverId: server.id, role: 'admin' }))
    await this.users.update(userId, { serverId: server.id, serverRole: 'admin' })
    return server
  }

  // servidor ATIVO do usuário + membros (sempre que houver servidor ativo)
  async me(userId: string) {
    const serverId = await this.userServer(userId)
    if (!serverId) return null
    const server = await this.servers.findOne({ where: { id: serverId } })
    const members = await this.users.find({
      where: { serverId },
      select: ['id', 'email', 'serverRole', 'createdAt'],
    })
    return { ...server, members }
  }

  // lista todos os servidores de que o usuário é membro (independente de qual está ativo)
  async listMine(userId: string) {
    const memberships = await this.memberships.find({ where: { userId } })
    const activeServerId = await this.userServer(userId)
    const result = []
    for (const m of memberships) {
      const server = await this.servers.findOne({ where: { id: m.serverId } })
      if (!server) continue
      result.push({ id: server.id, name: server.name, slug: server.slug, role: m.role, active: server.id === activeServerId })
    }
    return result
  }

  // troca o servidor ativo — exige que o usuário já seja membro dele
  async switchActive(userId: string, serverId: string) {
    const membership = await this.memberships.findOne({ where: { userId, serverId } })
    if (!membership) throw new ForbiddenException('Você não é membro deste servidor')
    await this.users.update(userId, { serverId, serverRole: membership.role })
    return this.me(userId)
  }

  // entra num servidor via convite — ADICIONA uma membership nova; se o usuário ainda não
  // tem servidor ativo, esse passa a ser; se já tem outro ativo, continua ativo o mesmo
  // (o usuário troca manualmente depois via switchActive, se quiser)
  async join(userId: string, code: string) {
    const invite = await this.invites.findOne({ where: { code } })
    if (!invite) throw new NotFoundException('Convite inválido')
    if (invite.expiresAt && invite.expiresAt < new Date()) throw new GoneException('Convite expirado')
    if (invite.maxUses != null && invite.uses >= invite.maxUses) throw new GoneException('Convite esgotado')

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

  async createInvite(serverId: string, userId: string) {
    const code = randomBytes(6).toString('base64url').slice(0, 8)
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000)
    await this.invites.save(this.invites.create({ code, serverId, createdBy: userId, expiresAt, maxUses: 50 }))
    return { code, expiresAt }
  }

  async updateServer(serverId: string, name: string) {
    await this.servers.update(serverId, { name, slug: await this.uniqueSlug(slugify(name), serverId) })
    return this.servers.findOne({ where: { id: serverId } })
  }

  async setRole(serverId: string, targetId: string, role: 'admin' | 'member', requesterId: string) {
    // mudar o próprio papel permitiria o último admin se rebaixar e travar o servidor
    if (targetId === requesterId) throw new BadRequestException('Você não pode alterar seu próprio papel')
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
    const target = await this.users.findOne({ where: { id: targetId } })
    if (!target) throw new NotFoundException('Membro não encontrado')

    await this.memberships.delete({ userId: targetId, serverId })

    if (target.serverId === serverId) {
      const other = await this.memberships.findOne({ where: { userId: targetId } })
      if (other) {
        await this.users.update(targetId, { serverId: other.serverId, serverRole: other.role })
      } else {
        await this.users.update(targetId, { serverId: null, serverRole: 'member' })
      }
    }
    return { removed: targetId }
  }

  private async userServer(userId: string): Promise<string | null> {
    const u = await this.users.findOne({ where: { id: userId } })
    return u?.serverId ?? null
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
