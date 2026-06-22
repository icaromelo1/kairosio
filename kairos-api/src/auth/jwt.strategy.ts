import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { User } from '../user/user.entity'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@InjectRepository(User) private users: Repository<User>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'kairos-secret',
    })
  }

  // injeta org/papel SEMPRE frescos do banco (não dependem do que está no token)
  async validate(payload: any) {
    const user = await this.users.findOne({ where: { id: payload.sub } })
    return {
      sub: payload.sub,
      email: payload.email ?? user?.email ?? null,
      isGuest: payload.isGuest ?? user?.isGuest ?? false,
      organizationId: user?.organizationId ?? null,
      orgRole: user?.orgRole ?? 'member',
    }
  }
}
