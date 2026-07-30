import { Controller, ForbiddenException, Get, Param, Post, Query, Request, Res, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Response } from 'express'
import { JukeboxService } from './jukebox.service'
import { isAdminEmail } from '../auth/admin'

@Controller('jukebox')
export class JukeboxController {
  constructor(private readonly jukebox: JukeboxService) {}

  // pública (sem guard) — o <audio> não manda header Authorization; ids são uuids.
  // res.sendFile (Express) já lida com Range requests, o <audio> do navegador precisa disso
  @Get('stream/:id')
  async stream(@Param('id') id: string, @Res() res: Response) {
    const { path } = await this.jukebox.streamPath(id)
    res.sendFile(path, { headers: { 'Content-Type': 'audio/mpeg' } })
  }

  // biblioteca de músicas já baixadas antes (qualquer sala) — pra reaproveitar sem
  // colar o link de novo, já vem do cache/Drive sem precisar do yt-dlp. ?q= filtra por título
  @UseGuards(AuthGuard('jwt'))
  @Get('tracks')
  async listTracks(@Query('q') q?: string) {
    return this.jukebox.listTracks(q)
  }

  // rebaixa do Drive pro cache local tudo que estiver faltando (ex: depois de perder
  // o volume de cache num redeploy) — não bate no YouTube, só no Drive. Operação
  // pesada (Drive + yt-dlp por arquivo órfão) → só admin
  @UseGuards(AuthGuard('jwt'))
  @Post('sync')
  async sync(@Request() req: any) {
    if (!isAdminEmail(req.user.email)) throw new ForbiddenException('Apenas administradores')
    return this.jukebox.syncFromDrive()
  }
}
