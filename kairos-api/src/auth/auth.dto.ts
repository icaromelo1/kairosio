import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'

export class AuthCredentialsDto {
  @IsEmail({}, { message: 'Email inválido' })
  email: string

  @IsString()
  @MinLength(6, { message: 'A senha precisa de pelo menos 6 caracteres' })
  password: string
}

export class RegisterDto extends AuthCredentialsDto {
  @IsString()
  @MaxLength(64)
  username: string
}

export class UpdateUsernameDto {
  @IsString()
  @MaxLength(64)
  username: string
}

export class UsernameQueryDto {
  @IsString()
  @MaxLength(64)
  u: string
}
