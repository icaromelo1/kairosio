import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Task } from './task.entity'
import { CreateTaskDto, UpdateTaskDto } from './task.dto'

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private readonly repo: Repository<Task>,
  ) {}

  list(serverId: string, mapId: string, objectId: string): Promise<Task[]> {
    return this.repo.find({
      where: { serverId, mapId, objectId },
      order: { createdAt: 'ASC' },
    })
  }

  create(serverId: string, userId: string, dto: CreateTaskDto): Promise<Task> {
    const task = this.repo.create({
      mapId: dto.mapId,
      objectId: dto.objectId,
      title: dto.title,
      serverId,
      createdBy: userId,
    })
    return this.repo.save(task)
  }

  async update(serverId: string, id: string, patch: UpdateTaskDto): Promise<Task> {
    const task = await this.findOneForServer(serverId, id)
    Object.assign(task, patch)
    return this.repo.save(task)
  }

  async remove(serverId: string, id: string): Promise<{ deleted: string }> {
    const task = await this.findOneForServer(serverId, id)
    await this.repo.remove(task)
    return { deleted: id }
  }

  private async findOneForServer(serverId: string, id: string): Promise<Task> {
    const task = await this.repo.findOne({ where: { id, serverId } })
    if (!task) throw new NotFoundException(`Task "${id}" não encontrada`)
    return task
  }
}
