import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtStrategy } from './jwt.strategy'
import { GoogleStrategy } from './google.strategy'
import { GithubStrategy } from './github.strategy'
import { User } from '../user/user.entity'

// OAuth só entra quando as credenciais existem — sem creds, o login normal segue intacto
const oauthStrategies: any[] = []
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) oauthStrategies.push(GoogleStrategy)
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) oauthStrategies.push(GithubStrategy)

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'kairos-secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [AuthService, JwtStrategy, ...oauthStrategies],
  controllers: [AuthController],
})
export class AuthModule {}
