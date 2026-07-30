import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator'

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/

export class SaveCharacterDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  name?: string

  @IsOptional()
  @IsIn(['short', 'curly', 'ponytail', 'mohawk', 'helmet', 'buzz', 'long'])
  hairStyle?: string

  @IsOptional()
  @Matches(HEX_COLOR)
  hairColor?: string

  @IsOptional()
  @Matches(HEX_COLOR)
  skin?: string

  @IsOptional()
  @Matches(HEX_COLOR)
  topColor?: string

  @IsOptional()
  @Matches(HEX_COLOR)
  pantsColor?: string

  @IsOptional()
  @IsIn(['none', 'glasses', 'hat'])
  accessory?: string
}
