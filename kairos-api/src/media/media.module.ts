import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Character } from '../character/character.entity'
import { MapModule } from '../map/map.module'
import { MediaService } from './media.service'
import { MediaController } from './media.controller'

@Module({
  imports: [TypeOrmModule.forFeature([Character]), MapModule],
  providers: [MediaService],
  controllers: [MediaController],
})
export class MediaModule {}
