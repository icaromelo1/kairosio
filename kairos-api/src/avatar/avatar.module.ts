import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Avatar } from './avatar.entity'
import { Character } from '../character/character.entity'
import { AvatarService } from './avatar.service'
import { AvatarController } from './avatar.controller'

// Character entra por forFeature (a entidade), não por importar o CharacterModule:
// o CharacterModule já importa este, e importar de volta fecharia um ciclo.
@Module({
  imports: [TypeOrmModule.forFeature([Avatar, Character])],
  providers: [AvatarService],
  controllers: [AvatarController],
  exports: [AvatarService],
})
export class AvatarModule {}
