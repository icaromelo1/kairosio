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
    // registerAsync (em vez de register) lê process.env.JWT_SECRET só na hora de
    // instanciar, não na hora de importar o módulo — com register(), esse valor era
    // capturado ANTES do ConfigModule.forRoot() carregar o .env (import de AuthModule
    // resolve antes do decorator do AppModule rodar), então assinatura e verificação
    // (JwtStrategy, que lê na instanciação) podiam usar segredos diferentes sempre
    // que o JWT_SECRET só existisse via .env (não como variável de ambiente real).
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET || 'kairos-secret',
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, ...oauthStrategies],
  controllers: [AuthController],
})
export class AuthModule {}
