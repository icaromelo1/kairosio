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

  list(organizationId: string, mapId: string, objectId: string): Promise<Task[]> {
    return this.repo.find({
      where: { organizationId, mapId, objectId },
      order: { createdAt: 'ASC' },
    })
  }

  create(organizationId: string, userId: string, dto: CreateTaskDto): Promise<Task> {
    const task = this.repo.create({
      mapId: dto.mapId,
      objectId: dto.objectId,
      title: dto.title,
      organizationId,
      createdBy: userId,
    })
    return this.repo.save(task)
  }

  async update(organizationId: string, id: string, patch: UpdateTaskDto): Promise<Task> {
    const task = await this.findOneForOrg(organizationId, id)
    Object.assign(task, patch)
    return this.repo.save(task)
  }

  async remove(organizationId: string, id: string): Promise<{ deleted: string }> {
    const task = await this.findOneForOrg(organizationId, id)
    await this.repo.remove(task)
    return { deleted: id }
  }

  private async findOneForOrg(organizationId: string, id: string): Promise<Task> {
    const task = await this.repo.findOne({ where: { id, organizationId } })
    if (!task) throw new NotFoundException(`Task "${id}" não encontrada`)
    return task
  }
}
