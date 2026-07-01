import { Body, Controller, Delete, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { OrgService } from './org.service'
import { OrgAdminGuard } from './org-admin.guard'
import { CreateOrgDto, JoinOrgDto, SetRoleDto, UpdateOrgDto } from './org.dto'

@UseGuards(AuthGuard('jwt'))
@Controller('org')
export class OrgController {
  constructor(private readonly org: OrgService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateOrgDto) {
    return this.org.create(req.user.sub, dto.name)
  }

  @Get('me')
  me(@Request() req: any) {
    return this.org.me(req.user.sub)
  }

  // todas as orgs de que o usuário é membro (pra tela de escolha no login)
  @Get('mine')
  mine(@Request() req: any) {
    return this.org.listMine(req.user.sub)
  }

  // troca qual org está ativa nesta sessão
  @Post('switch/:id')
  switchActive(@Request() req: any, @Param('id') id: string) {
    return this.org.switchActive(req.user.sub, id)
  }

  @Post('join')
  join(@Request() req: any, @Body() dto: JoinOrgDto) {
    return this.org.join(req.user.sub, dto.code)
  }

  // ---- admin da org ----
  @UseGuards(OrgAdminGuard)
  @Post('invite')
  invite(@Request() req: any) {
    return this.org.createInvite(req.user.organizationId, req.user.sub)
  }

  @UseGuards(OrgAdminGuard)
  @Put()
  update(@Request() req: any, @Body() dto: UpdateOrgDto) {
    return this.org.updateOrg(req.user.organizationId, dto.name!)
  }

  @UseGuards(OrgAdminGuard)
  @Put('member/:id/role')
  setRole(@Request() req: any, @Param('id') id: string, @Body() dto: SetRoleDto) {
    return this.org.setRole(req.user.organizationId, id, dto.role)
  }

  @UseGuards(OrgAdminGuard)
  @Delete('member/:id')
  removeMember(@Request() req: any, @Param('id') id: string) {
    return this.org.removeMember(req.user.organizationId, id, req.user.sub)
  }
}
