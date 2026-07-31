import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Throttle } from '@nestjs/throttler'
import { FriendService } from './friend.service'
import { FriendRequestDto, InviteServerDto } from './friend.dto'
import { NoGuestGuard } from './no-guest.guard'

@UseGuards(AuthGuard('jwt'), NoGuestGuard)
@Controller('friend')
export class FriendController {
  constructor(private readonly friends: FriendService) {}

  @Get()
  list(@Request() req: any) {
    return this.friends.list(req.user.sub)
  }

  @Get('pending')
  pending(@Request() req: any) {
    return this.friends.pending(req.user.sub)
  }

  @Get('blocked')
  blocked(@Request() req: any) {
    return this.friends.blocked(req.user.sub)
  }

  @Get('invites')
  invites(@Request() req: any) {
    return this.friends.serverInvitesFor(req.user.sub)
  }

  @Post('invites/:id/accept')
  acceptInvite(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.friends.respondServerInvite(req.user.sub, id, true)
  }

  @Post('invites/:id/reject')
  rejectInvite(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.friends.respondServerInvite(req.user.sub, id, false)
  }

  // limite próprio, bem abaixo do teto global: no ritmo de 120/min esta rota vira um
  // enumerador de quais @nomes existem na plataforma
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('request')
  request(@Request() req: any, @Body() dto: FriendRequestDto) {
    return this.friends.request(req.user.sub, dto.username)
  }

  @Post(':id/accept')
  accept(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.friends.accept(req.user.sub, id)
  }

  @Post(':id/reject')
  reject(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.friends.reject(req.user.sub, id)
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.friends.remove(req.user.sub, id)
  }

  @Post(':id/block')
  block(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.friends.block(req.user.sub, id)
  }

  @Post(':id/unblock')
  unblock(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.friends.unblock(req.user.sub, id)
  }

  @Post(':id/invite-server')
  inviteServer(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteServerDto,
  ) {
    return this.friends.inviteToServer(req.user.sub, id, dto.serverId)
  }
}
