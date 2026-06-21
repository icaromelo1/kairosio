import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL || 'postgres://kairos:kairos@localhost:5432/kairosio',
      entities: [User, Character, WorldState, GameMap, Feedback],
      synchronize: true,
    }),
    AuthModule,
    CharacterModule,
    WorldModule,
    PresenceModule,
    MapModule,
    FeedbackModule,
  ],
})
export class AppModule {}
