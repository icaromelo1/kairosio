import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PresenceGateway } from './presence.gateway'
import { PresenceController } from './presence.controller'
import { User } from '../user/user.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.register({ secret: process.env.JWT_SECRET || 'kairos-secret' }),
  ],
  providers: [PresenceGateway],
  controllers: [PresenceController],
})
export class PresenceModule {}
