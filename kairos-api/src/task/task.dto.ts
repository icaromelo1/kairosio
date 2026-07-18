import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateTaskDto {
  @IsString()
  mapId: string

  @IsString()
  objectId: string

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string

  @IsOptional()
  @IsBoolean()
  done?: boolean
}
