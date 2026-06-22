import { Controller, Get, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { PresenceGateway } from './presence.gateway'

@UseGuards(AuthGuard('jwt'))
@Controller('presence')
export class PresenceController {
  constructor(private readonly gateway: PresenceGateway) {}

  // { mapId: quantos online } dentro da org do usuário
  @Get('counts')
  counts(@Request() req: any) {
    return this.gateway.getCounts(req.user.organizationId)
  }
}
