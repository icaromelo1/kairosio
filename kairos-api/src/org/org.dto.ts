import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateOrgDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  name: string
}

export class JoinOrgDto {
  @IsString()
  @MinLength(4)
  @MaxLength(16)
  code: string
}

export class UpdateOrgDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  name?: string
}

export class SetRoleDto {
  @IsIn(['admin', 'member'])
  role: 'admin' | 'member'
}
