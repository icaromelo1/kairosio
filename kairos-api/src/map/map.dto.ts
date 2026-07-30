import { Type } from 'class-transformer'
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'

export class SpawnDto {
  @IsInt()
  @Min(0)
  @Max(119)
  x: number

  @IsInt()
  @Min(0)
  @Max(119)
  y: number
}

export class CreateMapDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  name: string

  @IsInt()
  @Min(8)
  @Max(120)
  width: number

  @IsInt()
  @Min(8)
  @Max(120)
  height: number

  @IsOptional()
  @IsString()
  @MaxLength(160)
  blurb?: string

  @IsOptional()
  @IsObject()
  palette?: Record<string, unknown>

  @IsOptional()
  @ValidateNested()
  @Type(() => SpawnDto)
  spawn?: SpawnDto

  @IsOptional()
  @IsArray()
  objects?: unknown[]
}

export class UpdateMapDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  name?: string

  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(120)
  width?: number

  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(120)
  height?: number

  @IsOptional()
  @IsString()
  @MaxLength(160)
  blurb?: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  hours?: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string

  @IsOptional()
  @IsObject()
  palette?: Record<string, unknown>

  @IsOptional()
  @ValidateNested()
  @Type(() => SpawnDto)
  spawn?: SpawnDto

  @IsOptional()
  @IsArray()
  objects?: unknown[]
}
