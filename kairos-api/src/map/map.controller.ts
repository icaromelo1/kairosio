import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { MapService } from './map.service'
import { ServerService } from '../server/server.service'
import { CreateMapDto, UpdateMapDto } from './map.dto'

// tudo exige login; a leitura é escopada pelo servidor do usuário (+ templates)
@UseGuards(AuthGuard('jwt'))
@Controller('map')
export class MapController {
  constructor(
    private readonly maps: MapService,
    private readonly servers: ServerService,
  ) {}

  // ?serverId= permite olhar os mundos de outro servidor SEM trocar o ativo —
  // é o que sustenta o "navegar sem desconectar" da barra lateral. A membership
  // é conferida aqui: sem isso, qualquer um listaria os mundos de qualquer servidor.
  @Get()
  async findAll(@Request() req: any, @Query('serverId') serverId?: string) {
    if (!serverId || serverId === req.user.serverId) {
      return this.maps.findAllForUser(req.user.serverId)
    }
    await this.servers.requireMembership(req.user.sub, serverId)
    return this.maps.findAllForUser(serverId)
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.maps.findOneForUser(id, req.user.serverId)
  }

  @Post()
  create(@Request() req: any, @Body() dto: CreateMapDto) {
    if (req.user.isGuest) {
      throw new ForbiddenException('Convidados não podem criar mundos. Crie uma conta.')
    }
    if (!req.user.serverId) {
      throw new ForbiddenException('Entre ou crie um servidor para criar mundos.')
    }
    return this.maps.create(dto, req.user.sub, req.user.serverId)
  }

  @Put(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() patch: UpdateMapDto) {
    return this.maps.update(id, patch, req.user.sub)
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.maps.remove(id, req.user.sub, req.user.serverId, req.user.serverRole === 'admin')
  }
}
