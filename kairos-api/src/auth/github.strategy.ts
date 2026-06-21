import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-github2'

// Só é registrada quando GITHUB_CLIENT_ID/SECRET existem (ver auth.module).
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
    })
  }

  validate(_accessToken: string, _refreshToken: string, profile: any, done: (err: any, user: any) => void) {
    const email = profile?.emails?.[0]?.value || `${profile?.username || 'user'}@github.local`
    done(null, { email })
  }
}
