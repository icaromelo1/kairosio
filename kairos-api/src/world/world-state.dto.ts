import { IsNumber, IsString, MaxLength } from 'class-validator'

export class SaveWorldStateDto {
  @IsString()
  @MaxLength(64)
  activeMap: string

  @IsNumber()
  playerX: number

  @IsNumber()
  playerY: number
}
