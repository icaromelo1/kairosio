import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { SudoGuard } from '../auth/sudo.guard'
import { MascaraService } from './mascara.service'
import { UpdateMascaraRevisaoDto } from './mascara.dto'

// revisão manual das máscaras de avatar (6 presets x 12 quadros = 72) — ferramenta
// interna, só para administradores gerais (isSudo)
@UseGuards(AuthGuard('jwt'), SudoGuard)
@Controller('mascaras')
export class MascaraController {
  constructor(private readonly mascaras: MascaraService) {}

  @Get()
  listar() {
    return this.mascaras.listar()
  }

  @Put(':preset/:quadro')
  salvar(
    @Param('preset') preset: string,
    @Param('quadro') quadro: string,
    @Body() dto: UpdateMascaraRevisaoDto,
  ) {
    return this.mascaras.salvar(preset, quadro, dto)
  }
}
