import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { NoteService } from './note.service'
import { CreateNoteDto, UpdateNoteDto } from './note.dto'

@UseGuards(AuthGuard('jwt'))
@Controller('note')
export class NoteController {
  constructor(private readonly notes: NoteService) {}

  @Get()
  findAll(@Request() req: any, @Query('mapId') mapId: string, @Query('objectId') objectId: string) {
    return this.notes.list(req.user.organizationId, mapId, objectId)
  }

  @Post()
  create(@Request() req: any, @Body() dto: CreateNoteDto) {
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
