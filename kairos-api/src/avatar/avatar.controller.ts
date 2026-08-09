import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { SudoGuard } from '../auth/sudo.guard'
import { AvatarService } from './avatar.service'
import { CriarAvatarDto, OrigemAvatarDto } from './avatar.dto'

@UseGuards(AuthGuard('jwt'))
@Controller('avatares')
export class AvatarController {
  constructor(private readonly avatares: AvatarService) {}

  // ORDEM IMPORTA: as rotas literais vêm antes de qualquer ':id'. Declaradas depois,
  // o parâmetro captura "acervo" e "aleatorio" como identificador e o resultado é 404
  // em runtime — coisa que build e typecheck não pegam.
  @Get()
  catalogo() {
    return this.avatares.catalogo()
  }

  // sem SudoGuard: a pessoa comum entra aqui para a edição avançada dos avatares
  // dela. Quem separa o que cada uma vê é o serviço, não a rota
  @Get('acervo')
  acervo(@Request() req: { user: { sub: string; isSudo: boolean } }) {
    return this.avatares.acervo(req.user.sub, req.user.isSudo)
  }

  @Get('aleatorio')
  aleatorio() {
    return this.avatares.aleatorio()
  }

  @Post()
  criar(@Request() req: { user: { sub: string; isGuest: boolean } }, @Body() body: CriarAvatarDto) {
    return this.avatares.criar(body, req.user.sub, req.user.isGuest)
  }

  @UseGuards(SudoGuard)
  @Patch(':id/origem')
  promover(@Param('id', ParseUUIDPipe) id: string, @Body() body: OrigemAvatarDto) {
    return this.avatares.promover(id, body.origem)
  }

  @Patch(':id')
  atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { sub: string; isSudo: boolean } },
    @Body() body: CriarAvatarDto,
  ) {
    return this.avatares.atualizar(id, body, req.user.sub, req.user.isSudo)
  }

  @Delete(':id')
  remover(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { sub: string; isSudo: boolean } },
  ) {
    return this.avatares.remover(id, req.user.sub, req.user.isSudo)
  }
}
