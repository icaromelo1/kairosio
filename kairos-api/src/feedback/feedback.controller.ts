import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FeedbackService } from './feedback.service'
import { CreateFeedbackDto, UpdateFeedbackStatusDto } from './feedback.dto'
import { isAdminEmail } from '../auth/admin'

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post()
  create(@Body() body: CreateFeedbackDto) {
    return this.feedback.create({ ...body, kind: body.kind ?? 'bug' })
  }

  @Get()
  findAll() {
    return this.feedback.findAllPublic()
  }

  // mudar o status da correção — só admin (email na allowlist)
  @UseGuards(AuthGuard('jwt'))
  @Put(':id/status')
  updateStatus(@Request() req: any, @Param('id') id: string, @Body() body: UpdateFeedbackStatusDto) {
    if (!isAdminEmail(req.user.email)) {
      throw new ForbiddenException('Apenas administradores podem alterar o status')
    }
    return this.feedback.updateStatus(id, body.status)
  }
}
