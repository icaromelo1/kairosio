import { Controller, Get, Param, Post, Query, Res } from '@nestjs/common'
import { Response } from 'express'
import { JukeboxService } from './jukebox.service'

@Controller('jukebox')
export class JukeboxController {
  constructor(private readonly jukebox: JukeboxService) {}

  // res.sendFile (Express) já lida com Range requests, o <audio> do navegador precisa disso
  @Get('stream/:id')
  async stream(@Param('id') id: string, @Res() res: Response) {
    const { path } = await this.jukebox.streamPath(id)
    res.sendFile(path, { headers: { 'Content-Type': 'audio/mpeg' } })
  }

  // biblioteca de músicas já baixadas antes (qualquer sala) — pra reaproveitar sem
  // colar o link de novo, já vem do cache/Drive sem precisar do yt-dlp. ?q= filtra por título
  @Get('tracks')
  async listTracks(@Query('q') q?: string) {
    return this.jukebox.listTracks(q)
  }

  // rebaixa do Drive pro cache local tudo que estiver faltando (ex: depois de perder
  // o volume de cache num redeploy) — não bate no YouTube, só no Drive
  @Post('sync')
  async sync() {
    return this.jukebox.syncFromDrive()
  }
}
