import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from './auth/auth.module'
import { CharacterModule } from './character/character.module'
import { WorldModule } from './world/world.module'
import { PresenceModule } from './presence/presence.module'
import { MapModule } from './map/map.module'
import { FeedbackModule } from './feedback/feedback.module'
import { User } from './user/user.entity'
import { Character } from './character/character.entity'
import { WorldState } from './world/world-state.entity'
import { GameMap } from './map/game-map.entity'
import { Feedback } from './feedback/feedback.entity'
import { OrgModule } from './org/org.module'
import { Organization } from './org/organization.entity'
import { OrgInvite } from './org/org-invite.entity'
import { JukeboxModule } from './jukebox/jukebox.module'
import { Track } from './jukebox/track.entity'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL || 'postgres://kairos:kairos@localhost:5432/kairosio',
      entities: [User, Character, WorldState, GameMap, Feedback, Organization, OrgInvite, Track],
      synchronize: true,
    }),
    AuthModule,
    CharacterModule,
    WorldModule,
    PresenceModule,
    MapModule,
    FeedbackModule,
    OrgModule,
    JukeboxModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
