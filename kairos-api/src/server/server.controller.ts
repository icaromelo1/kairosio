import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ServerService } from './server.service'
import { ServerAdminGuard } from './server-admin.guard'
import {
  CreateServerDto,
  JoinServerDto,
  ListMineQueryDto,
  SetRoleDto,
  TransferServerDto,
  UpdateServerDto,
} from './server.dto'

@UseGuards(AuthGuard('jwt'))
@Controller('server')
export class ServerController {
  constructor(private readonly servers: ServerService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateServerDto) {
    // convidado some no logout (conta apagada) — o servidor dele ficaria órfão
    if (req.user.isGuest) {
      throw new ForbiddenException('Convidados não podem criar servidores. Crie uma conta.')
    }
    return this.servers.create(req.user.sub, dto.name)
  }

  @Get('me')
  me(@Request() req: any) {
    return this.servers.me(req.user.sub)
  }

  // todos os servidores de que o usuário é membro (pra tela de escolha no login);
  // ?archived=true lista só os arquivados (seção de arquivados do painel)
  @Get('mine')
  mine(@Request() req: any, @Query() query: ListMineQueryDto) {
    return this.servers.listMine(req.user.sub, query.archived === 'true')
  }

  // troca qual servidor está ativo nesta sessão
  @Post('switch/:id')
  switchActive(@Request() req: any, @Param('id') id: string) {
    return this.servers.switchActive(req.user.sub, id)
  }

  @Post('join')
  join(@Request() req: any, @Body() dto: JoinServerDto) {
    return this.servers.join(req.user.sub, dto.code)
  }

  // ---- ações sobre um servidor específico (pode não ser o ativo) ----
  // a permissão é resolvida no service contra o :id, não pelo ServerAdminGuard
  @Post(':id/leave')
  leave(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.servers.leave(req.user.sub, id)
  }

  @Get(':id/invite')
  invite(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.servers.getInvite(id, req.user.sub)
  }

  @Post(':id/invite/revoke')
  revokeInvite(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.servers.revokeInvite(id, req.user.sub)
  }

  @Post(':id/transfer')
  transfer(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TransferServerDto) {
    return this.servers.transferOwnership(id, req.user.sub, dto.userId)
  }

  @Post(':id/archive')
  archive(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.servers.archive(id, req.user.sub)
  }

  @Post(':id/restore')
  restore(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.servers.restore(id, req.user.sub)
  }

  // ---- admin do servidor ATIVO ----
  @UseGuards(ServerAdminGuard)
  @Put()
  update(@Request() req: any, @Body() dto: UpdateServerDto) {
    return this.servers.updateServer(req.user.serverId, dto.name)
  }

  @UseGuards(ServerAdminGuard)
  @Put('member/:id/role')
  setRole(@Request() req: any, @Param('id') id: string, @Body() dto: SetRoleDto) {
    return this.servers.setRole(req.user.serverId, id, dto.role, req.user.sub)
  }

  @UseGuards(ServerAdminGuard)
  @Delete('member/:id')
  removeMember(@Request() req: any, @Param('id') id: string) {
    return this.servers.removeMember(req.user.serverId, id, req.user.sub)
  }
}
