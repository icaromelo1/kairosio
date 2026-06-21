import { Module } from '@nestjs/common'
import { PresenceGateway } from './presence.gateway'
import { PresenceController } from './presence.controller'

@Module({
  providers: [PresenceGateway],
  controllers: [PresenceController],
})
export class PresenceModule {}
