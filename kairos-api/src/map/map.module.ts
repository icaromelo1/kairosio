import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { GameMap } from './game-map.entity'
import { MapService } from './map.service'
import { MapController } from './map.controller'
import { ServerModule } from '../server/server.module'

@Module({
  imports: [TypeOrmModule.forFeature([GameMap]), forwardRef(() => ServerModule)],
  providers: [MapService],
  controllers: [MapController],
  exports: [MapService],
})
export class MapModule {}
