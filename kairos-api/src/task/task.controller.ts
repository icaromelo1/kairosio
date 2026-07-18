import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { TaskService } from './task.service'
import { CreateTaskDto, UpdateTaskDto } from './task.dto'

@UseGuards(AuthGuard('jwt'))
@Controller('task')
export class TaskController {
  constructor(private readonly tasks: TaskService) {}

  @Get()
  list(@Request() req: any, @Query('mapId') mapId: string, @Query('objectId') objectId: string) {
    return this.tasks.list(req.user.organizationId, mapId, objectId)
  }

  @Post()
  create(@Request() req: any, @Body() dto: CreateTaskDto) {
    return this.tasks.create(req.user.organizationId, req.user.sub, dto)
  }

  @Patch(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() patch: UpdateTaskDto) {
    return this.tasks.update(req.user.organizationId, id, patch)
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.tasks.remove(req.user.organizationId, id)
  }
}
