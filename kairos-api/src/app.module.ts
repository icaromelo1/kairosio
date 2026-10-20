import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { TypeOrmModule } from '@nestjs/typeorm'
import { opcoesDoBanco } from './database/opcoes'
import { AuthModule } from './auth/auth.module'
import { CharacterModule } from './character/character.module'
import { PresenceModule } from './presence/presence.module'
import { MapModule } from './map/map.module'
import { FeedbackModule } from './feedback/feedback.module'
import { ServerModule } from './server/server.module'
import { JukeboxModule } from './jukebox/jukebox.module'
import { TaskModule } from './task/task.module'
import { NoteModule } from './note/note.module'
import { MediaModule } from './media/media.module'
import { FriendModule } from './friend/friend.module'
import { DmModule } from './dm/dm.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    TypeOrmModule.forRoot({ ...opcoesDoBanco, migrationsRun: true }),
    AuthModule,
    CharacterModule,
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
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
