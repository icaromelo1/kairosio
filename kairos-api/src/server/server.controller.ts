import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ServerService } from './server.service'
import { ServerAdminGuard } from './server-admin.guard'
import { CreateServerDto, JoinServerDto, SetRoleDto, UpdateServerDto } from './server.dto'

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

  // todos os servidores de que o usuário é membro (pra tela de escolha no login)
  @Get('mine')
  mine(@Request() req: any) {
    return this.servers.listMine(req.user.sub)
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

  // ---- admin do servidor ----
  @UseGuards(ServerAdminGuard)
  @Post('invite')
  invite(@Request() req: any) {
    return this.servers.createInvite(req.user.serverId, req.user.sub)
  }

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
