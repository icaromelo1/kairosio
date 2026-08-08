import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { TileRevisao } from './tile-revisao.entity'
import { TileService } from './tile.service'
import { TileController } from './tile.controller'

@Module({
  imports: [TypeOrmModule.forFeature([TileRevisao])],
  providers: [TileService],
  controllers: [TileController],
  exports: [TileService],
})
export class TileModule {}
