import { Controller, Post, Body, Get, Request, Res, UseGuards } from '@nestjs/common'
import { Response } from 'express'
import { AuthService } from './auth.service'
import { AuthGuard } from '@nestjs/passport'
import { AuthCredentialsDto } from './auth.dto'

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

  // chamado ao clicar em "Sair" — se for convidado, apaga a conta inteira
  // (personagem/mundo salvo/vínculos de servidor); conta real não sofre nada
  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(@Request() req: any) {
    await this.authService.logout(req.user.sub)
    return { ok: true }
  }
}
