import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Feedback, FeedbackKind, FeedbackStatus } from './feedback.entity'
import { User } from '../user/user.entity'

interface CreateFeedbackDto {
  email: string
  kind: FeedbackKind
  title: string
  message: string
}

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback) private readonly repo: Repository<Feedback>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async create(dto: CreateFeedbackDto): Promise<Feedback> {
    const email = (dto.email || '').trim().toLowerCase()
    const title = (dto.title || '').trim()
    const message = (dto.message || '').trim()
    if (!email || !title || !message) {
      throw new BadRequestException('Email, título e descrição são obrigatórios')
    }
    // gate: só quem tem email cadastrado pode dar feedback
    const user = await this.users.findOne({ where: { email } })
    if (!user) {
      throw new ForbiddenException('Email não cadastrado. Crie uma conta para enviar feedback.')
    }
    const fb = this.repo.create({
      kind: dto.kind === 'melhoria' ? 'melhoria' : 'bug',
      title,
      message,
      authorEmail: email,
      authorId: user.id,
      status: 'aberto',
    })
    return this.repo.save(fb)
  }

  findAll(): Promise<Feedback[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } })
  }

  async updateStatus(id: string, status: FeedbackStatus): Promise<Feedback> {
    const fb = await this.repo.findOne({ where: { id } })
    if (!fb) throw new NotFoundException('Feedback não encontrado')
    fb.status = status
    return this.repo.save(fb)
  }
}
