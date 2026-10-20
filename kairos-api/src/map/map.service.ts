import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { GameMap } from './game-map.entity'
import { ESCRITORIO } from './escritorio'

@Injectable()
export class MapService implements OnModuleInit {
  constructor(
    @InjectRepository(GameMap)
    private readonly repo: Repository<GameMap>,
  ) {}

  async onModuleInit() {
    const atual = await this.repo.findOne({ where: { id: ESCRITORIO.id } })
    if (atual?.editadoEm) return
    await this.repo.save({ ...ESCRITORIO, ownerId: null, serverId: null, isTemplate: true })
  }

  findAllForUser(serverId: string | null): Promise<GameMap[]> {
    const where: any[] = [{ isTemplate: true }]
    if (serverId) where.push({ serverId })
    return this.repo.find({ where, order: { name: 'ASC' } })
  }

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
}
