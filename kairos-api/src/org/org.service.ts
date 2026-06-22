import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { randomBytes } from 'crypto'
import { Organization } from './organization.entity'
import { OrgInvite } from './org-invite.entity'
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
      .slice(0, 32) || 'org'
  )
}

@Injectable()
export class OrgService {
  constructor(
    @InjectRepository(Organization) private orgs: Repository<Organization>,
    @InjectRepository(OrgInvite) private invites: Repository<OrgInvite>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(GameMap) private maps: Repository<GameMap>,
  ) {}

  // cria a org e torna o criador admin
  async create(userId: string, name: string): Promise<Organization> {
    if (await this.userOrg(userId)) {
      throw new ConflictException('Você já está em uma organização')
    }
    const org = await this.orgs.save(
      this.orgs.create({ name, slug: await this.uniqueSlug(slugify(name)), ownerId: userId }),
    )
    await this.users.update(userId, { organizationId: org.id, orgRole: 'admin' })
    return org
  }

  // org atual do usuário + membros (sempre que houver org)
  async me(userId: string) {
    const orgId = await this.userOrg(userId)
    if (!orgId) return null
    const org = await this.orgs.findOne({ where: { id: orgId } })
    const members = await this.users.find({
      where: { organizationId: orgId },
      select: ['id', 'email', 'orgRole', 'createdAt'],
    })
    return { ...org, members }
  }

  async join(userId: string, code: string) {
    if (await this.userOrg(userId)) {
      throw new ConflictException('Você já está em uma organização')
    }
    const invite = await this.invites.findOne({ where: { code } })
    if (!invite) throw new NotFoundException('Convite inválido')
    if (invite.expiresAt && invite.expiresAt < new Date()) throw new GoneException('Convite expirado')
    if (invite.maxUses != null && invite.uses >= invite.maxUses) throw new GoneException('Convite esgotado')
    await this.users.update(userId, { organizationId: invite.organizationId, orgRole: 'member' })
    await this.invites.increment({ code }, 'uses', 1)
    return this.me(userId)
  }

  async createInvite(orgId: string, userId: string) {
    const code = randomBytes(6).toString('base64url').slice(0, 8)
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000)
    await this.invites.save(this.invites.create({ code, organizationId: orgId, createdBy: userId, expiresAt, maxUses: 50 }))
    return { code, expiresAt }
  }

  async updateOrg(orgId: string, name: string) {
    await this.orgs.update(orgId, { name, slug: await this.uniqueSlug(slugify(name), orgId) })
    return this.orgs.findOne({ where: { id: orgId } })
  }

  async setRole(orgId: string, targetId: string, role: 'admin' | 'member') {
    const target = await this.users.findOne({ where: { id: targetId } })
    if (!target || target.organizationId !== orgId) throw new NotFoundException('Membro não encontrado')
    await this.users.update(targetId, { orgRole: role })
    return { id: targetId, orgRole: role }
  }

  async removeMember(orgId: string, targetId: string, requesterId: string) {
    if (targetId === requesterId) throw new BadRequestException('Você não pode se remover')
    const target = await this.users.findOne({ where: { id: targetId } })
    if (!target || target.organizationId !== orgId) throw new NotFoundException('Membro não encontrado')
    await this.users.update(targetId, { organizationId: null, orgRole: 'member' })
    return { removed: targetId }
  }

  private async userOrg(userId: string): Promise<string | null> {
    const u = await this.users.findOne({ where: { id: userId } })
    return u?.organizationId ?? null
  }

  private async uniqueSlug(base: string, exceptId?: string): Promise<string> {
    let slug = base
    let n = 1
    while (true) {
      const found = await this.orgs.findOne({ where: { slug } })
      if (!found || found.id === exceptId) return slug
      n += 1
      slug = `${base}-${n}`
    }
  }
}
