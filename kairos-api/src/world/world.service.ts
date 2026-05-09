import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { WorldState } from './world-state.entity'

@Injectable()
export class WorldService {
  constructor(@InjectRepository(WorldState) private repo: Repository<WorldState>) {}

  async get(userId: string) {
    return this.repo.findOne({ where: { user: { id: userId } } })
  }

  async save(userId: string, data: Partial<WorldState>) {
    let state = await this.repo.findOne({ where: { user: { id: userId } } })
    if (state) {
      Object.assign(state, data)
    } else {
      state = this.repo.create({ ...data, user: { id: userId } as any })
    }
    return this.repo.save(state)
  }
}
