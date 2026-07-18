import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Note } from './note.entity'
import { CreateNoteDto, UpdateNoteDto } from './note.dto'

@Injectable()
export class NoteService {
  constructor(
    @InjectRepository(Note)
    private readonly repo: Repository<Note>,
  ) {}

  list(organizationId: string | null, mapId: string, objectId: string): Promise<Note[]> {
    return this.repo.find({
      where: { organizationId, mapId, objectId },
      order: { createdAt: 'ASC' },
    })
  }

  create(organizationId: string | null, userId: string, dto: CreateNoteDto): Promise<Note> {
    const note = this.repo.create({
      mapId: dto.mapId,
      objectId: dto.objectId,
      body: dto.body,
      organizationId,
      createdBy: userId,
    })
    return this.repo.save(note)
  }

  async update(organizationId: string | null, id: string, dto: UpdateNoteDto): Promise<Note> {
    const note = await this.findOne(id)
    if (note.organizationId !== organizationId) {
      throw new NotFoundException(`Nota "${id}" não encontrada`)
    }
    note.body = dto.body
    return this.repo.save(note)
  }

  async remove(organizationId: string | null, id: string): Promise<{ deleted: string }> {
    const note = await this.findOne(id)
    if (note.organizationId !== organizationId) {
      throw new NotFoundException(`Nota "${id}" não encontrada`)
    }
    await this.repo.remove(note)
    return { deleted: id }
  }

  private async findOne(id: string): Promise<Note> {
    const note = await this.repo.findOne({ where: { id } })
    if (!note) throw new NotFoundException(`Nota "${id}" não encontrada`)
    return note
  }
}
