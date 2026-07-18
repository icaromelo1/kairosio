import { IsString, MaxLength, MinLength } from 'class-validator'

export class CreateNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  mapId: string

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  objectId: string

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body: string
}

export class UpdateNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body: string
}
