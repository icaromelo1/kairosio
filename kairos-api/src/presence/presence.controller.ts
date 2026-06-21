import { Controller, Get } from '@nestjs/common'
import { PresenceGateway } from './presence.gateway'

@Controller('presence')
export class PresenceController {
  constructor(private readonly gateway: PresenceGateway) {}

  // { mapId: quantidade } — quantos jogadores online em cada mundo
  @Get('counts')
  counts() {
    return this.gateway.getCounts()
  }
}
