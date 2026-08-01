import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator'
import { DM_PAGINA_MAX, DM_TEXTO_MAX } from './dm'

export class SendDmDto {
  @IsString()
  @MinLength(1)
  @MaxLength(DM_TEXTO_MAX)
  text: string
}

export class DmHistoryQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  before?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(DM_PAGINA_MAX)
  limit?: number
}
