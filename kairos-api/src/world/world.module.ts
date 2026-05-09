import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { WorldState } from './world-state.entity'
import { WorldService } from './world.service'
import { WorldController } from './world.controller'

@Module({
  imports: [TypeOrmModule.forFeature([WorldState])],
  providers: [WorldService],
  controllers: [WorldController],
})
export class WorldModule {}
