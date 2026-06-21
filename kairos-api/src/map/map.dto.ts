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
} from 'class-validator'

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
  @IsObject()
  spawn?: { x: number; y: number }

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
  @IsObject()
  spawn?: { x: number; y: number }

  @IsOptional()
  @IsArray()
  objects?: unknown[]
}
