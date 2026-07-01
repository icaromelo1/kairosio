import { Controller, Get, Param, Res } from '@nestjs/common'
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
  // colar o link de novo, já vem do cache/Drive sem precisar do yt-dlp
  @Get('tracks')
  async listTracks() {
    return this.jukebox.listTracks()
  }
}
