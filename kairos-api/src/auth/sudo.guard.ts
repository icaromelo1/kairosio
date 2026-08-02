import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'

// Exige sudo — administrador geral do produto (usado após o AuthGuard('jwt')).
// O flag vem sempre fresco do banco pela jwt.strategy, então revogar tem efeito
// imediato, sem esperar o token expirar.
@Injectable()
export class SudoGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest()
    if (!req.user?.isSudo) {
      throw new ForbiddenException('Apenas administradores gerais')
    }
    return true
  }
}
