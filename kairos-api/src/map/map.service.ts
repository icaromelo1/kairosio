import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'
import { GameMap } from './game-map.entity'
import { SEED_MAPS } from './seed-maps'

@Injectable()
export class MapService implements OnModuleInit {
  constructor(
    @InjectRepository(GameMap)
    private readonly repo: Repository<GameMap>,
  ) {}

  // semeia os mapas oficiais na primeira subida (idempotente)
  async onModuleInit() {
    const count = await this.repo.count({ where: { ownerId: IsNull() } })
    if (count === 0) {
      await this.repo.save(SEED_MAPS.map((m) => ({ ...m, ownerId: null })))
    }
  }

  findAll(): Promise<GameMap[]> {
    return this.repo.find({ order: { name: 'ASC' } })
  }

  async findOne(id: string): Promise<GameMap> {
    const map = await this.repo.findOne({ where: { id } })
    if (!map) throw new NotFoundException(`Mapa "${id}" não encontrado`)
    return map
  }

  // usado pelo editor in-game pra salvar tamanho/itens/paleta de um mundo
  async update(id: string, patch: Partial<GameMap>): Promise<GameMap> {
    const map = await this.findOne(id)
    Object.assign(map, patch, { id: map.id })
    return this.repo.save(map)
  }
}
