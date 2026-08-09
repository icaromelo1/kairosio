import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '../user/user.entity'
import { MapModule } from '../map/map.module'
import { MediaService } from './media.service'
import { MediaController } from './media.controller'

@Module({
  imports: [TypeOrmModule.forFeature([User]), MapModule],
  providers: [MediaService],
  controllers: [MediaController],
})
export class MediaModule {}
