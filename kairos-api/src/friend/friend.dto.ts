import { IsString, IsUUID, MaxLength } from 'class-validator'

// o teto de 64 é só contra payload gigante; quem decide se o nome existe é a busca,
// que responde igual pra "não existe" e pra "não posso mostrar"
export class FriendRequestDto {
  @IsString()
  @MaxLength(64)
  username: string
}

export class InviteServerDto {
  @IsUUID()
  serverId: string
}
