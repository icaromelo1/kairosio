import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MascaraRevisao } from './mascara-revisao.entity'
import { MascaraService } from './mascara.service'
import { MascaraController } from './mascara.controller'

@Module({
  imports: [TypeOrmModule.forFeature([MascaraRevisao])],
  providers: [MascaraService],
  controllers: [MascaraController],
  exports: [MascaraService],
})
export class MascaraModule {}
