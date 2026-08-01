import { Controller, Post, Patch, Body, Get, Query, Request, Res, UseGuards } from '@nestjs/common'
import { Response } from 'express'
import { Throttle } from '@nestjs/throttler'
import { AuthService } from './auth.service'
import { AuthGuard } from '@nestjs/passport'
import { AuthCredentialsDto, RegisterDto, UpdateUsernameDto, UsernameQueryDto } from './auth.dto'

const FRONT_URL = process.env.FRONT_URL || 'https://icaromelodev.com.br/kairos'

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // ---- OAuth (ativo só com credenciais; ver auth.module) ----
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleStart() {
    // o guard redireciona pro Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Request() req: any, @Res() res: Response) {
    const { token } = await this.authService.oauthLogin(req.user.email)
    res.redirect(`${FRONT_URL}/login?token=${token}`)
  }

  @Get('github')
  @UseGuards(AuthGuard('github'))
  githubStart() {
    // o guard redireciona pro GitHub
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(@Request() req: any, @Res() res: Response) {
    const { token } = await this.authService.oauthLogin(req.user.email)
    res.redirect(`${FRONT_URL}/login?token=${token}`)
  }

  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post('login')
  login(@Body() body: AuthCredentialsDto) {
    return this.authService.login(body.email, body.password)
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body.email, body.password, body.username)
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('username-disponivel')
  usernameDisponivel(@Query() query: UsernameQueryDto) {
    return this.authService.usernameStatus(query.u)
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('username')
  changeUsername(@Request() req: any, @Body() body: UpdateUsernameDto) {
    return this.authService.changeUsername(req.user.sub, body.username)
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  me(@Request() req: any) {
    return this.authService.me(req.user.sub)
  }

  // chamado ao clicar em "Sair" — se for convidado, apaga a conta inteira
  // (personagem/mundo salvo/vínculos de servidor); conta real não sofre nada
  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(@Request() req: any) {
    await this.authService.logout(req.user.sub)
    return { ok: true }
  }
}
