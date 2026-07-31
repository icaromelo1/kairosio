import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'

export class AuthCredentialsDto {
  @IsEmail({}, { message: 'Email inválido' })
  email: string

  @IsString()
  @MinLength(6, { message: 'A senha precisa de pelo menos 6 caracteres' })
  password: string
}

// o teto de 64 é só contra payload gigante: quem recusa por tamanho/formato é o
// checkUsername, que sabe distinguir formato de nome reservado na resposta
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
