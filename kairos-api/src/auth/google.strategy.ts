import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy, VerifyCallback } from 'passport-google-oauth20'

// Só é registrada quando GOOGLE_CLIENT_ID/SECRET existem (ver auth.module).
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

  validate(_accessToken: string, _refreshToken: string, profile: any, done: VerifyCallback) {
    const email = profile?.emails?.[0]?.value
    done(null, { email })
  }
}
