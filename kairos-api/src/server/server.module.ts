import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Server } from './server.entity'
import { ServerInvite } from './server-invite.entity'
import { ServerMembership } from './server-membership.entity'
import { User } from '../user/user.entity'
import { Character } from '../character/character.entity'
import { GameMap } from '../map/game-map.entity'
import { ServerService } from './server.service'
import { ServerController } from './server.controller'

@Module({
  imports: [TypeOrmModule.forFeature([Server, ServerInvite, ServerMembership, User, GameMap, Character])],
  providers: [ServerService],
  controllers: [ServerController],
  exports: [ServerService],
})
export class ServerModule {}
