import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Track } from './track.entity'
import { JukeboxService } from './jukebox.service'
import { JukeboxController } from './jukebox.controller'
import { YtDlpService } from './ytdlp.service'
import { DriveService } from './drive.service'
import { CacheService } from './cache.service'

@Module({
  imports: [TypeOrmModule.forFeature([Track])],
  providers: [JukeboxService, YtDlpService, DriveService, CacheService],
  controllers: [JukeboxController],
  exports: [JukeboxService],
})
export class JukeboxModule {}
