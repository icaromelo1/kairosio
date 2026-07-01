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
import { Organization } from './organization.entity'
import { OrgInvite } from './org-invite.entity'
import { OrgMembership } from './org-membership.entity'
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
export class OrgService implements OnModuleInit {
  constructor(
    @InjectRepository(Organization) private orgs: Repository<Organization>,
    @InjectRepository(OrgInvite) private invites: Repository<OrgInvite>,
    @InjectRepository(OrgMembership) private memberships: Repository<OrgMembership>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(GameMap) private maps: Repository<GameMap>,
  ) {}

  // backfill único: usuários com organizationId (schema antigo, 1:1) que ainda não
  // têm membership correspondente ganham uma linha — migração idempotente, roda toda
  // subida mas só insere o que faltar.
  async onModuleInit() {
    const users = await this.users.find({ where: {} })
    for (const u of users) {
      if (!u.organizationId) continue
      const exists = await this.memberships.findOne({ where: { userId: u.id, organizationId: u.organizationId } })
      if (!exists) {
        await this.memberships.save(
          this.memberships.create({ userId: u.id, organizationId: u.organizationId, role: u.orgRole }),
        )
      }
    }
  }

  // cria a org, torna o criador admin (nova membership) e ativa ela na hora
  async create(userId: string, name: string): Promise<Organization> {
    const org = await this.orgs.save(
      this.orgs.create({ name, slug: await this.uniqueSlug(slugify(name)), ownerId: userId }),
    )
    await this.memberships.save(this.memberships.create({ userId, organizationId: org.id, role: 'admin' }))
    await this.users.update(userId, { organizationId: org.id, orgRole: 'admin' })
    return org
  }

  // org ATIVA do usuário + membros (sempre que houver org ativa)
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

  // lista todas as orgs de que o usuário é membro (independente de qual está ativa)
  async listMine(userId: string) {
    const memberships = await this.memberships.find({ where: { userId } })
    const activeOrgId = await this.userOrg(userId)
    const result = []
    for (const m of memberships) {
      const org = await this.orgs.findOne({ where: { id: m.organizationId } })
      if (!org) continue
      result.push({ id: org.id, name: org.name, slug: org.slug, role: m.role, active: org.id === activeOrgId })
    }
    return result
  }

  // troca a org ativa — exige que o usuário já seja membro dela
  async switchActive(userId: string, orgId: string) {
    const membership = await this.memberships.findOne({ where: { userId, organizationId: orgId } })
    if (!membership) throw new ForbiddenException('Você não é membro desta organização')
    await this.users.update(userId, { organizationId: orgId, orgRole: membership.role })
    return this.me(userId)
  }

  // entra numa org via convite — ADICIONA uma membership nova; se o usuário ainda não
  // tem org ativa, essa passa a ser; se já tem outra ativa, continua ativa a mesma
  // (o usuário troca manualmente depois via switchActive, se quiser)
  async join(userId: string, code: string) {
    const invite = await this.invites.findOne({ where: { code } })
    if (!invite) throw new NotFoundException('Convite inválido')
    if (invite.expiresAt && invite.expiresAt < new Date()) throw new GoneException('Convite expirado')
    if (invite.maxUses != null && invite.uses >= invite.maxUses) throw new GoneException('Convite esgotado')

    const already = await this.memberships.findOne({ where: { userId, organizationId: invite.organizationId } })
    if (already) throw new ConflictException('Você já é membro desta organização')

    await this.memberships.save(
      this.memberships.create({ userId, organizationId: invite.organizationId, role: 'member' }),
    )
    await this.invites.increment({ code }, 'uses', 1)

    const hasActive = await this.userOrg(userId)
    if (!hasActive) {
      await this.users.update(userId, { organizationId: invite.organizationId, orgRole: 'member' })
    }
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
    await this.memberships.update({ userId: targetId, organizationId: orgId }, { role })
    return { id: targetId, orgRole: role }
  }

  // remove o membro da org (membership) — se essa era a org ATIVA dele, cai pra outra
  // membership existente (se houver) ou fica sem org ativa
  async removeMember(orgId: string, targetId: string, requesterId: string) {
    if (targetId === requesterId) throw new BadRequestException('Você não pode se remover')
    const target = await this.users.findOne({ where: { id: targetId } })
    if (!target) throw new NotFoundException('Membro não encontrado')

    await this.memberships.delete({ userId: targetId, organizationId: orgId })

    if (target.organizationId === orgId) {
      const other = await this.memberships.findOne({ where: { userId: targetId } })
      if (other) {
        await this.users.update(targetId, { organizationId: other.organizationId, orgRole: other.role })
      } else {
        await this.users.update(targetId, { organizationId: null, orgRole: 'member' })
      }
    }
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
