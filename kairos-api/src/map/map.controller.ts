import { Body, Controller, Get, Param, Put } from '@nestjs/common'
import { MapService } from './map.service'
import { GameMap } from './game-map.entity'

@Controller('map')
export class MapController {
  constructor(private readonly maps: MapService) {}

  @Get()
  findAll() {
    return this.maps.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.maps.findOne(id)
  }

  // editor in-game: salva alterações de tamanho/itens/paleta de um mundo
  @Put(':id')
  update(@Param('id') id: string, @Body() patch: Partial<GameMap>) {
    return this.maps.update(id, patch)
  }
}
