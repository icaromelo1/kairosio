import { IsArray, IsIn, IsOptional, IsString, Matches, ValidateIf } from 'class-validator'

const HEX = /^#[0-9a-fA-F]{6}$/
// mesmo formato do PRESET_ID do personagem: quem decide quais corpos existem é a
// lista canônica em avatar.presets.ts, e o que se valida aqui é a forma
const ID_CORPO = /^[a-z0-9-]{1,40}$/

// nulo é um valor legítimo e diferente de ausente: significa "volta pra cor original
// do corpo". Por isso ValidateIf em vez de IsOptional, que aceitaria null calado.
const corOpcional = () => ValidateIf((_, v) => v !== null && v !== undefined)

export class CriarAvatarDto {
  @Matches(ID_CORPO)
  base: string

  @corOpcional()
  @Matches(HEX)
  pele?: string | null

  @corOpcional()
  @Matches(HEX)
  cabelo?: string | null

  @corOpcional()
  @Matches(HEX)
  roupa?: string | null

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  acessorios?: string[]
}

export class OrigemAvatarDto {
  @IsIn(['base', 'sudo', 'usuario'])
  origem: 'base' | 'sudo' | 'usuario'
}
