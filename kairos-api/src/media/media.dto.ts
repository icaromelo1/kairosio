import { IsString, MaxLength, MinLength } from 'class-validator'

export class MediaTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  mapId: string
}
