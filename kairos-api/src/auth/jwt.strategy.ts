import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { User } from '../user/user.entity'
import { jwtSecret } from './jwt-secret'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@InjectRepository(User) private users: Repository<User>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtSecret(),
    })
  }

  // injeta org/papel SEMPRE frescos do banco (não dependem do que está no token);
  // usuário apagado (ex: convidado pós-logout) invalida o token na hora
  async validate(payload: any) {
    const user = await this.users.findOne({ where: { id: payload.sub } })
    if (!user) throw new UnauthorizedException()
    return {
      sub: payload.sub,
      email: payload.email ?? user.email ?? null,
      isGuest: payload.isGuest ?? user.isGuest ?? false,
      organizationId: user.organizationId ?? null,
      orgRole: user.orgRole ?? 'member',
    }
  }
}
