import { ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, IsNull, Not, Repository } from 'typeorm'
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

  // semeia os mapas oficiais e garante que sejam templates globais (sem servidor, visíveis a todos)
  async onModuleInit() {
    const oficiais = SEED_MAPS.map((m) => m.id)
    // mundo oficial nunca é editável no jogo (update/remove recusam), então
    // sobrescrever a partir do seed não descarta trabalho de ninguém — e é o
    // que faz correção de mundo oficial chegar em produção
    for (const m of SEED_MAPS) {
      // mundo oficial já corrigido à mão por um sudo não volta ao que está no
      // código: sobrescrever aqui apagaria o trabalho no deploy seguinte
      const atual = await this.repo.findOne({ where: { id: m.id } })
      if (atual?.editadoEm) continue
      await this.repo.save({ ...m, ownerId: null })
    }
    // mundos oficiais (sem dono) = templates
    await this.repo.update(
      { ownerId: IsNull(), id: In(oficiais) },
      { isTemplate: true, serverId: null },
    )
    // oficiais que saíram do seed deixam de aparecer, mas o registro fica no banco
    await this.repo.update(
      { ownerId: IsNull(), id: Not(In(oficiais)) },
      { isTemplate: false },
    )
  }

  // visível ao usuário: templates globais + mundos do servidor dele
  findAllForUser(serverId: string | null): Promise<GameMap[]> {
    const where: any[] = [{ isTemplate: true }]
    if (serverId) where.push({ serverId })
    return this.repo.find({ where, order: { name: 'ASC' } })
  }

  // leitura escopada: só template ou mundo do servidor do usuário
  async findOneForUser(id: string, serverId: string | null): Promise<GameMap> {
    const map = await this.findOne(id)
    if (!map.isTemplate && map.serverId !== serverId) {
      throw new NotFoundException(`Mapa "${id}" não encontrado`)
    }
    return map
  }

  async findOne(id: string): Promise<GameMap> {
    const map = await this.repo.findOne({ where: { id } })
    if (!map) throw new NotFoundException(`Mapa "${id}" não encontrado`)
    return map
  }

  // cria um mundo no servidor do usuário
  async create(dto: CreateMapDto, ownerId: string, serverId: string): Promise<GameMap> {
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
      serverId,
      isTemplate: false,
    })
    return this.repo.save(map)
  }

  // edição — o dono do mundo, ou um sudo em QUALQUER mundo, inclusive os oficiais
  async update(id: string, patch: UpdateMapDto, userId: string, ehSudo = false): Promise<GameMap> {
    const map = await this.findOne(id)
    if (ehSudo) {
      // sudo mexe no mundo oficial sem despromovê-lo: zerar isTemplate aqui o
      // tiraria da lista de todo mundo até o próximo boot
      Object.assign(map, patch, {
        id: map.id,
        ownerId: map.ownerId,
        serverId: map.serverId,
        isTemplate: map.isTemplate,
        editadoEm: new Date(),
      })
      return this.repo.save(map)
    }
    if (map.isTemplate || map.ownerId === null) throw new ForbiddenException('Mundo oficial não pode ser editado')
    if (map.ownerId !== userId) throw new ForbiddenException('Você só pode editar mundos que criou')
    Object.assign(map, patch, { id: map.id, ownerId: map.ownerId, serverId: map.serverId, isTemplate: false })
    return this.repo.save(map)
  }

  // remoção — o dono, ou um admin do MESMO servidor do mundo
  async remove(id: string, userId: string, serverId: string | null, isAdmin: boolean): Promise<{ deleted: string }> {
    const map = await this.findOne(id)
    if (map.isTemplate || map.ownerId === null) throw new ForbiddenException('Mundo oficial não pode ser apagado')
    const isOwner = map.ownerId === userId
    const isServerAdmin = isAdmin && !!serverId && map.serverId === serverId
    if (!isOwner && !isServerAdmin) throw new ForbiddenException('Sem permissão para apagar este mundo')
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
