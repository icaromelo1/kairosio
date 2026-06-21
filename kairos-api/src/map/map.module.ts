import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { GameMap } from './game-map.entity'
import { MapService } from './map.service'
import { MapController } from './map.controller'

@Module({
  imports: [TypeOrmModule.forFeature([GameMap])],
  providers: [MapService],
  controllers: [MapController],
})
export class MapModule {}
