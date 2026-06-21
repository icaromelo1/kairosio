import { IsEmail, IsString, MinLength } from 'class-validator'

export class AuthCredentialsDto {
  @IsEmail({}, { message: 'Email inválido' })
  email: string

  @IsString()
  @MinLength(6, { message: 'A senha precisa de pelo menos 6 caracteres' })
  password: string
}
