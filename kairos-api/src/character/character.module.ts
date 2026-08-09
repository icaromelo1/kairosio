import { Module } from '@nestjs/common'
import { AvatarModule } from '../avatar/avatar.module'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Character } from './character.entity'
import { CharacterService } from './character.service'
import { CharacterController } from './character.controller'
import { AvatarPhotoStorageService } from './avatar-photo-storage.service'

@Module({
  imports: [AvatarModule, TypeOrmModule.forFeature([Character])],
  providers: [CharacterService, AvatarPhotoStorageService],
  controllers: [CharacterController],
})
export class CharacterModule {}
