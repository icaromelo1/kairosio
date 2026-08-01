import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PresenceGateway } from './presence.gateway'
import { PresenceController } from './presence.controller'
import { User } from '../user/user.entity'
import { ServerMembership } from '../server/server-membership.entity'
import { JukeboxModule } from '../jukebox/jukebox.module'
import { DmModule } from '../dm/dm.module'
import { FriendModule } from '../friend/friend.module'
import { jwtSecret } from '../auth/jwt-secret'

@Module({
  imports: [
    // ServerMembership é lida (nunca escrita) aqui: é a autorização de quem pode
    // observar a presença de cada servidor
    TypeOrmModule.forFeature([User, ServerMembership]),
    // registerAsync: lê o segredo na instanciação, depois do ConfigModule
    JwtModule.registerAsync({ useFactory: () => ({ secret: jwtSecret() }) }),
    JukeboxModule,
    DmModule,
    FriendModule,
  ],
  providers: [PresenceGateway],
  controllers: [PresenceController],
})
export class PresenceModule {}
