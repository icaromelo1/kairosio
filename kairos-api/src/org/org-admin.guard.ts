import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'

// Exige que o usuário seja admin de uma org (usado após o AuthGuard('jwt')).
@Injectable()
export class OrgAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest()
    if (!req.user?.organizationId || req.user?.orgRole !== 'admin') {
      throw new ForbiddenException('Apenas administradores da organização')
    }
    return true
  }
}
