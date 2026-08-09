import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Avatar } from './avatar.entity'

@Injectable()
export class AvatarService {
  constructor(
    @InjectRepository(Avatar)
    private readonly repo: Repository<Avatar>,
  ) {}
}
