import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator'

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/
// id de preset de avatar — hoje vem de kairos-ui/src/game/furniture/avatar/presets.json.
// A lista fechada que existia aqui ('short', 'curly', …) era dos cabelos do avatar
// procedural, que deixou de existir quando o avatar virou sprite: o front passou a
// mandar 'ruivo-verde' e TODO salvamento voltava 400. Duas listas em pacotes
// diferentes sempre iam divergir — quem decide o que existe é o front, que já
// cai no preset padrão diante de id desconhecido, e o formato é o que se valida.
const PRESET_ID = /^[a-z0-9-]{1,40}$/

export class SaveCharacterDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  name?: string

  @IsOptional()
  @Matches(PRESET_ID)
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
