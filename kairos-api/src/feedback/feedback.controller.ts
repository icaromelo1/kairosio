import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common'
import { FeedbackService } from './feedback.service'
import { FeedbackKind, FeedbackStatus } from './feedback.entity'

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post()
  create(@Body() body: { email: string; kind: FeedbackKind; title: string; message: string }) {
    return this.feedback.create(body)
  }

  @Get()
  findAll() {
    return this.feedback.findAll()
  }

  // atualização de status da correção (uso administrativo / futuro painel)
  @Put(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: FeedbackStatus }) {
    return this.feedback.updateStatus(id, body.status)
  }
}
