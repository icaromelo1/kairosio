import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { MapService } from './map.service'
import { CreateMapDto, UpdateMapDto } from './map.dto'

// tudo exige login; a leitura é escopada pela org do usuário (+ templates)
@UseGuards(AuthGuard('jwt'))
@Controller('map')
export class MapController {
  constructor(private readonly maps: MapService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.maps.findAllForUser(req.user.organizationId)
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.maps.findOneForUser(id, req.user.organizationId)
  }

  @Post()
  create(@Request() req: any, @Body() dto: CreateMapDto) {
    if (req.user.isGuest) {
      throw new ForbiddenException('Convidados não podem criar mundos. Crie uma conta.')
    }
    if (!req.user.organizationId) {
      throw new ForbiddenException('Entre ou crie uma organização para criar mundos.')
    }
    return this.maps.create(dto, req.user.sub, req.user.organizationId)
  }

  @Put(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() patch: UpdateMapDto) {
    return this.maps.update(id, patch, req.user.sub)
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.maps.remove(id, req.user.sub, req.user.organizationId, req.user.orgRole === 'admin')
  }
}
