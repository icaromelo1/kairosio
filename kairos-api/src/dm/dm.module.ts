import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { FriendModule } from '../friend/friend.module'
import { DmConversation } from './dm-conversation.entity'
import { DmMessage } from './dm-message.entity'
import { DmDelivery } from './dm-delivery'
import { DmService } from './dm.service'
import { DmController } from './dm.controller'

@Module({
  imports: [TypeOrmModule.forFeature([DmConversation, DmMessage]), FriendModule],
  providers: [DmService, DmDelivery],
  controllers: [DmController],
  exports: [DmDelivery],
})
export class DmModule {}
