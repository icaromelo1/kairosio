import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common'
import { FeedbackService } from './feedback.service'
import { CreateFeedbackDto, UpdateFeedbackStatusDto } from './feedback.dto'

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post()
  create(@Body() body: CreateFeedbackDto) {
    return this.feedback.create({ ...body, kind: body.kind ?? 'bug' })
  }

  @Get()
  findAll() {
    return this.feedback.findAll()
  }

  // atualização de status da correção (uso administrativo / futuro painel)
  @Put(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdateFeedbackStatusDto) {
    return this.feedback.updateStatus(id, body.status)
  }
}
