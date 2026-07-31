import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Friendship } from './friendship.entity'
import { FriendServerInvite } from './friend-server-invite.entity'
import { User } from '../user/user.entity'
import { Character } from '../character/character.entity'
import { Server } from '../server/server.entity'
import { ServerMembership } from '../server/server-membership.entity'
import { FriendService } from './friend.service'
import { FriendController } from './friend.controller'

@Module({
  imports: [
    TypeOrmModule.forFeature([Friendship, FriendServerInvite, User, Character, Server, ServerMembership]),
  ],
  providers: [FriendService],
  controllers: [FriendController],
  exports: [FriendService],
})
export class FriendModule {}
