import { Controller, Get, Put, Body, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { WorldService } from './world.service'
import { SaveWorldStateDto } from './world-state.dto'

@UseGuards(AuthGuard('jwt'))
@Controller('world')
export class WorldController {
  constructor(private worldService: WorldService) {}

  @Get('state')
  get(@Request() req: any) {
    return this.worldService.get(req.user.sub)
  }

  @Put('state')
  save(@Request() req: any, @Body() body: SaveWorldStateDto) {
    return this.worldService.save(req.user.sub, body)
  }
}
