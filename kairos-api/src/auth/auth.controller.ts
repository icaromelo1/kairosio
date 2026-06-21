import { Controller, Post, Body, Get, Request, UseGuards } from '@nestjs/common'
import { AuthService } from './auth.service'
import { AuthGuard } from '@nestjs/passport'
import { AuthCredentialsDto } from './auth.dto'

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() body: AuthCredentialsDto) {
    return this.authService.login(body.email, body.password)
  }

  @Post('register')
  register(@Body() body: AuthCredentialsDto) {
    return this.authService.register(body.email, body.password)
  }

  @Post('guest')
  guest() {
    return this.authService.loginAsGuest()
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  me(@Request() req: any) {
    return this.authService.me(req.user.sub)
  }
}
