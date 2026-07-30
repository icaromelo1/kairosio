import { IsIn, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateServerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  name: string
}

export class JoinServerDto {
  @IsString()
  @MinLength(4)
  @MaxLength(16)
  code: string
}

export class UpdateServerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  name: string
}

export class SetRoleDto {
  @IsIn(['admin', 'member'])
  role: 'admin' | 'member'
}
