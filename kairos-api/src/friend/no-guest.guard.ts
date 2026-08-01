import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'

@Injectable()
export class NoGuestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest()
    if (req.user?.isGuest) {
      throw new ForbiddenException({
        code: 'guest-no-friends',
        message: 'Convidado não tem lista de amigos. Crie uma conta pra adicionar amigos.',
      })
    }
    return true
  }
}
