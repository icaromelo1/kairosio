import { BadRequestException, Controller, Delete, Get, Param, Post, Put, Body, Request, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { CharacterService } from './character.service'

// evita depender de @types/multer só por causa deste tipo (conflito de peer-deps no lockfile atual)
interface UploadedPhoto {
  buffer: Buffer
  mimetype: string
  size: number
}

@Controller('character')
export class CharacterController {
  constructor(private characterService: CharacterService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  get(@Request() req: any) {
    return this.characterService.get(req.user.sub)
  }

  @UseGuards(AuthGuard('jwt'))
  @Put()
  save(@Request() req: any, @Body() body: any) {
    return this.characterService.save(req.user.sub, body)
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('photo')
  @UseInterceptors(FileInterceptor('photo'))
  async uploadPhoto(@Request() req: any, @UploadedFile() file: UploadedPhoto) {
    if (!file) throw new BadRequestException('Nenhuma foto enviada')
    return this.characterService.savePhoto(req.user.sub, file)
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('photo')
  removePhoto(@Request() req: any) {
    return this.characterService.removePhoto(req.user.sub)
  }

  // pública (sem guard) — precisa carregar em todos os clientes conectados na sala,
  // não só no dono da foto; mesmo padrão do /jukebox/stream/:id
  @Get('photo/:fileName')
  async servePhoto(@Param('fileName') fileName: string, @Res() res: Response) {
    // valida o formato antes de tocar no filesystem — evita path traversal via fileName
    if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(fileName)) throw new BadRequestException('Nome de arquivo inválido')
    const path = await this.characterService.photoLocalPath(fileName)
    res.sendFile(path)
  }
}
