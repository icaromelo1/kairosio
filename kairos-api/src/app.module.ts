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
import { ServerModule } from './server/server.module'
import { Server } from './server/server.entity'
import { ServerInvite } from './server/server-invite.entity'
import { ServerMembership } from './server/server-membership.entity'
import { JukeboxModule } from './jukebox/jukebox.module'
import { Track } from './jukebox/track.entity'
import { TaskModule } from './task/task.module'
import { Task } from './task/task.entity'
import { NoteModule } from './note/note.module'
import { Note } from './note/note.entity'
import { MediaModule } from './media/media.module'
import { FriendModule } from './friend/friend.module'
import { Friendship } from './friend/friendship.entity'
import { FriendServerInvite } from './friend/friend-server-invite.entity'
import { DmModule } from './dm/dm.module'
import { DmConversation } from './dm/dm-conversation.entity'
import { DmMessage } from './dm/dm-message.entity'
import { TileModule } from './tile/tile.module'
import { TileRevisao } from './tile/tile-revisao.entity'
import { MascaraModule } from './mascara/mascara.module'
import { MascaraRevisao } from './mascara/mascara-revisao.entity'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL || 'postgres://kairos:kairos@localhost:5432/kairosio',
      entities: [User, Character, WorldState, GameMap, Feedback, Server, ServerInvite, ServerMembership, Track, Task, Note, Friendship, FriendServerInvite, DmConversation, DmMessage, TileRevisao, MascaraRevisao],
      synchronize: true,
    }),
    AuthModule,
    CharacterModule,
    WorldModule,
    PresenceModule,
    MapModule,
    FeedbackModule,
    ServerModule,
    JukeboxModule,
    TaskModule,
    NoteModule,
    MediaModule,
    FriendModule,
    DmModule,
    TileModule,
    MascaraModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
