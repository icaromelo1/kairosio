import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateTileRevisaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nome?: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  cat?: string

  @IsOptional()
  @IsBoolean()
  solido?: boolean

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serveComo?: string[]

  @IsBoolean()
  revisado: boolean
}
