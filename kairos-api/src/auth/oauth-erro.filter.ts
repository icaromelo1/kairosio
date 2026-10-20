import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common'
import type { Response } from 'express'
import { FRONT_URL } from './front-url'

@Catch()
export class OAuthErroFilter implements ExceptionFilter {
  private readonly logger = new Logger('OAuth')

  catch(erro: unknown, host: ArgumentsHost) {
    this.logger.warn(erro instanceof Error ? erro.message : String(erro))
    host.switchToHttp().getResponse<Response>().redirect(`${FRONT_URL}/login#erro=oauth`)
  }
}
