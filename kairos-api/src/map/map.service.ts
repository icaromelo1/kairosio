import { ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'
import { GameMap } from './game-map.entity'
import { CreateMapDto, UpdateMapDto } from './map.dto'
import { SEED_MAPS } from './seed-maps'

const DEFAULT_PALETTE = {
  floor: ['#1a1a26', '#1d1d2a'],
  floorTrim: '#15151f',
  wall: '#0d0d14',
  wallTop: '#252535',
  accent: '#7c3aed',
}

function slugify(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // remove acentos
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'mundo'
  )
}

@Injectable()
export class MapService implements OnModuleInit {
  constructor(
    @InjectRepository(GameMap)
    private readonly repo: Repository<GameMap>,
  ) {}

  // semeia os mapas oficiais e garante que sejam templates globais (sem org, visíveis a todos)
  async onModuleInit() {
    const count = await this.repo.count({ where: { ownerId: IsNull() } })
    if (count === 0) {
      await this.repo.save(SEED_MAPS.map((m) => ({ ...m, ownerId: null })))
    }
    // mundos oficiais (sem dono) = templates
    await this.repo.update({ ownerId: IsNull() }, { isTemplate: true, organizationId: null })
  }

  // visível ao usuário: templates globais + mundos da org dele
  findAllForUser(orgId: string | null): Promise<GameMap[]> {
    const where: any[] = [{ isTemplate: true }]
    if (orgId) where.push({ organizationId: orgId })
    return this.repo.find({ where, order: { name: 'ASC' } })
  }

  // leitura escopada: só template ou mundo da org do usuário
  async findOneForUser(id: string, orgId: string | null): Promise<GameMap> {
    const map = await this.findOne(id)
    if (!map.isTemplate && map.organizationId !== orgId) {
      throw new NotFoundException(`Mapa "${id}" não encontrado`)
    }
    return map
  }

  async findOne(id: string): Promise<GameMap> {
    const map = await this.repo.findOne({ where: { id } })
    if (!map) throw new NotFoundException(`Mapa "${id}" não encontrado`)
    return map
  }

  // cria um mundo na org do usuário
  async create(dto: CreateMapDto, ownerId: string, organizationId: string): Promise<GameMap> {
    const id = await this.uniqueId(slugify(dto.name))
    const map = this.repo.create({
      id,
      name: dto.name,
      blurb: dto.blurb ?? '',
      hours: 'sempre',
      label: 'custom',
      width: dto.width,
      height: dto.height,
      palette: dto.palette ?? DEFAULT_PALETTE,
      spawn: dto.spawn ?? { x: Math.floor(dto.width / 2), y: Math.floor(dto.height / 2) },
      objects: dto.objects ?? [],
      ownerId,
      organizationId,
      isTemplate: false,
    })
    return this.repo.save(map)
  }

  // edição — só o dono; templates protegidos
  async update(id: string, patch: UpdateMapDto, userId: string): Promise<GameMap> {
    const map = await this.findOne(id)
    if (map.isTemplate || map.ownerId === null) throw new ForbiddenException('Mundo oficial não pode ser editado')
    if (map.ownerId !== userId) throw new ForbiddenException('Você só pode editar mundos que criou')
    Object.assign(map, patch, { id: map.id, ownerId: map.ownerId, organizationId: map.organizationId, isTemplate: false })
    return this.repo.save(map)
  }

  // remoção — o dono, ou um admin da MESMA org do mundo
  async remove(id: string, userId: string, orgId: string | null, isAdmin: boolean): Promise<{ deleted: string }> {
    const map = await this.findOne(id)
    if (map.isTemplate || map.ownerId === null) throw new ForbiddenException('Mundo oficial não pode ser apagado')
    const isOwner = map.ownerId === userId
    const isOrgAdmin = isAdmin && !!orgId && map.organizationId === orgId
    if (!isOwner && !isOrgAdmin) throw new ForbiddenException('Sem permissão para apagar este mundo')
    await this.repo.remove(map)
    return { deleted: id }
  }

  private async uniqueId(base: string): Promise<string> {
    let id = base
    let n = 1
    while (await this.repo.findOne({ where: { id } })) {
      n += 1
      id = `${base}-${n}`
    }
    return id
  }
}
