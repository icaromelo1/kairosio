import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { MapService } from './map.service'
import { CreateMapDto, UpdateMapDto } from './map.dto'

@Controller('map')
export class MapController {
  constructor(private readonly maps: MapService) {}

  // leitura é pública — qualquer um navega pelos mundos
  @Get()
  findAll() {
    return this.maps.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.maps.findOne(id)
  }

  // criar / editar / apagar exigem login; dono vem do token
  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Request() req: any, @Body() dto: CreateMapDto) {
    if (req.user.isGuest) {
      throw new ForbiddenException('Convidados não podem criar mundos. Crie uma conta.')
    }
    return this.maps.create(dto, req.user.sub)
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() patch: UpdateMapDto) {
    return this.maps.update(id, patch, req.user.sub)
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.maps.remove(id, req.user.sub)
  }
}
