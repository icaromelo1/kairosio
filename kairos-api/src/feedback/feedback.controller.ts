import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FeedbackService } from './feedback.service'
import { CreateFeedbackDto, UpdateFeedbackStatusDto } from './feedback.dto'
import { SudoGuard } from '../auth/sudo.guard'

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  // email vem do TOKEN, não do corpo: sem isso qualquer visitante postava em
  // nome de outra pessoa cadastrada (o gate só checava se o email existia)
  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Request() req: any, @Body() body: CreateFeedbackDto) {
    return this.feedback.create({ ...body, email: req.user.email, kind: body.kind ?? 'bug' })
  }

  @Get()
  findAll() {
    return this.feedback.findAllPublic()
  }

  @UseGuards(AuthGuard('jwt'), SudoGuard)
  @Put(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdateFeedbackStatusDto) {
    return this.feedback.updateStatus(id, body.status)
  }
}
