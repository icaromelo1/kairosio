import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Character } from './character.entity'

@Injectable()
export class CharacterService {
  constructor(@InjectRepository(Character) private repo: Repository<Character>) {}

  async get(userId: string) {
    return this.repo.findOne({ where: { user: { id: userId } } })
  }

  async save(userId: string, data: Partial<Character>) {
    let char = await this.repo.findOne({ where: { user: { id: userId } } })
    if (char) {
      Object.assign(char, data)
    } else {
      char = this.repo.create({ ...data, user: { id: userId } as any })
    }
    return this.repo.save(char)
  }
}
