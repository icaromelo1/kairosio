import { Controller, Get, Put, Body, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { CharacterService } from './character.service'

@UseGuards(AuthGuard('jwt'))
@Controller('character')
export class CharacterController {
  constructor(private characterService: CharacterService) {}

  @Get()
  get(@Request() req: any) {
    return this.characterService.get(req.user.sub)
  }

  @Put()
  save(@Request() req: any, @Body() body: any) {
    return this.characterService.save(req.user.sub, body)
  }
}
