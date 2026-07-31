import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'

// a conta de convidado é apagada no logout: amizade com ela apontaria pra um id que
// deixa de existir
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
