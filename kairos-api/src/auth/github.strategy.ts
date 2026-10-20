import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-github2'
import type { PerfilOAuth } from './oauth'

interface EmailDoGithub {
  value: string
  primary?: boolean
  verified?: boolean
}

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor() {
    super({
      clientID: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      callbackURL:
        process.env.GITHUB_CALLBACK_URL ||
        'https://icaromelodev.com.br/kairos-api/auth/github/callback',
      scope: ['user:email'],
      allRawEmails: true,
    })
  }

  validate(_accessToken: string, _refreshToken: string, profile: { id: string; emails?: EmailDoGithub[] }, done: (err: unknown, user: PerfilOAuth) => void) {
    const verificados = (profile.emails ?? []).filter((e) => e.verified)
    const email = (verificados.find((e) => e.primary) ?? verificados[0])?.value ?? null
    done(null, { provedor: 'github', id: String(profile.id), email })
  }
}
