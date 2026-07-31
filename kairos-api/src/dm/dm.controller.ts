import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Throttle } from '@nestjs/throttler'
import { NoGuestGuard } from '../friend/no-guest.guard'
import { DmService } from './dm.service'
import { DmHistoryQueryDto, SendDmDto } from './dm.dto'

// convidado não tem amigos (a conta some no logout), logo não tem conversa — o guard da
// amizade barra antes de qualquer consulta e explica o caminho
@UseGuards(AuthGuard('jwt'), NoGuestGuard)
@Controller('dm')
export class DmController {
  constructor(private readonly dm: DmService) {}

  @Get()
  list(@Request() req: any) {
    return this.dm.list(req.user.sub)
  }

  // :id aqui é a CONVERSA (veio do GET /dm); no POST abaixo é o usuário amigo
  @Get(':id/messages')
  history(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DmHistoryQueryDto,
  ) {
    return this.dm.history(req.user.sub, id, query.before, query.limit)
  }

  // o freio de verdade é o intervalo mínimo entre envios, no serviço; este teto só evita
  // que uma sequência de 429 saia mais barata que a mensagem em si
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Post(':friendId/messages')
  send(
    @Request() req: any,
    @Param('friendId', ParseUUIDPipe) friendId: string,
    @Body() dto: SendDmDto,
  ) {
    return this.dm.send(req.user.sub, friendId, dto.text)
  }

  @Post(':id/read')
  read(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.dm.markRead(req.user.sub, id)
  }
}
