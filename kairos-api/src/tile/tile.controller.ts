import { Body, Controller, Get, Param, ParseIntPipe, Put, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { SudoGuard } from '../auth/sudo.guard'
import { TileService } from './tile.service'
import { UpdateTileRevisaoDto } from './tile.dto'

// revisão manual do índice de tiles (1.654 tiles nos 3 tilesheets) — ferramenta
// interna, só para administradores gerais (isSudo)
@UseGuards(AuthGuard('jwt'), SudoGuard)
@Controller('tiles')
export class TileController {
  constructor(private readonly tiles: TileService) {}

  @Get('revisoes')
  listar(@Query('pack') pack?: string) {
    return this.tiles.listar(pack)
  }

  @Put(':pack/:indice')
  salvar(
    @Param('pack') pack: string,
    @Param('indice', ParseIntPipe) indice: number,
    @Body() dto: UpdateTileRevisaoDto,
  ) {
    return this.tiles.salvar(pack, indice, dto)
  }
}
