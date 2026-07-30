import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { MediaService } from './media.service'
import { MediaTokenDto } from './media.dto'

@UseGuards(AuthGuard('jwt'))
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('token')
  token(@Request() req: any, @Body() dto: MediaTokenDto) {
    return this.media.issueToken(req.user, dto.mapId)
  }
}
