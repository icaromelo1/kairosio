import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'

// Exige que o usuário seja admin de um servidor (usado após o AuthGuard('jwt')).
@Injectable()
export class ServerAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest()
    if (req.user?.isSudo) return true
    if (!req.user?.serverId || req.user?.serverRole !== 'admin') {
      throw new ForbiddenException('Apenas administradores do servidor')
    }
    return true
  }
}
