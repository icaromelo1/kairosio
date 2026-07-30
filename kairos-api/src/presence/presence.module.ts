import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PresenceGateway } from './presence.gateway'
import { PresenceController } from './presence.controller'
import { User } from '../user/user.entity'
import { JukeboxModule } from '../jukebox/jukebox.module'
import { jwtSecret } from '../auth/jwt-secret'

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    // registerAsync: lê o segredo na instanciação, depois do ConfigModule
    JwtModule.registerAsync({ useFactory: () => ({ secret: jwtSecret() }) }),
    JukeboxModule,
  ],
  providers: [PresenceGateway],
  controllers: [PresenceController],
})
export class PresenceModule {}
