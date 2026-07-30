import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { NoteService } from './note.service'
import { CreateNoteDto, UpdateNoteDto } from './note.dto'

@UseGuards(AuthGuard('jwt'))
@Controller('note')
export class NoteController {
  constructor(private readonly notes: NoteService) {}

  // notas são escopadas por org — sem org (convidado num mundo template) a
  // lista é vazia e criar explica o motivo em vez de estourar 500 no NOT NULL
  @Get()
  findAll(@Request() req: any, @Query('mapId') mapId: string, @Query('objectId') objectId: string) {
    if (!req.user.organizationId) return []
    return this.notes.list(req.user.organizationId, mapId, objectId)
  }

  @Post()
  create(@Request() req: any, @Body() dto: CreateNoteDto) {
    if (!req.user.organizationId) {
      throw new ForbiddenException('Entre numa organização para usar as notas da estante.')
    }
    return this.notes.create(req.user.organizationId, req.user.sub, dto)
  }

  @Patch(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.notes.update(req.user.organizationId, id, dto)
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.notes.remove(req.user.organizationId, id)
  }
}
