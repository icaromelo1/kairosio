import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator'

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

export class TransferServerDto {
  @IsUUID()
  userId: string
}

export class ListMineQueryDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  archived?: string
}
