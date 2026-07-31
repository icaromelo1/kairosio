import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { TaskService } from './task.service'
import { CreateTaskDto, UpdateTaskDto } from './task.dto'

@UseGuards(AuthGuard('jwt'))
@Controller('task')
export class TaskController {
  constructor(private readonly tasks: TaskService) {}

  // tarefas são escopadas por servidor — sem servidor (convidado num mundo template) a
  // lista é vazia e criar explica o motivo em vez de estourar 500 no NOT NULL
  @Get()
  list(@Request() req: any, @Query('mapId') mapId: string, @Query('objectId') objectId: string) {
    if (!req.user.serverId) return []
    return this.tasks.list(req.user.serverId, mapId, objectId)
  }

  @Post()
  create(@Request() req: any, @Body() dto: CreateTaskDto) {
    if (!req.user.serverId) {
      throw new ForbiddenException('Entre num servidor para usar as tarefas da mesa.')
    }
    return this.tasks.create(req.user.serverId, req.user.sub, dto)
  }

  @Patch(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() patch: UpdateTaskDto) {
    return this.tasks.update(req.user.serverId, id, patch)
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.tasks.remove(req.user.serverId, id)
  }
}
