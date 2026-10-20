import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20'
import type { PerfilOAuth } from './oauth'

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        'https://icaromelodev.com.br/kairos-api/auth/google/callback',
      scope: ['email', 'profile'],
    })
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) {
    const email = profile.emails?.find((e) => e.verified)?.value ?? null
    const perfil: PerfilOAuth = { provedor: 'google', id: profile.id, email }
    done(null, perfil)
  }
}
