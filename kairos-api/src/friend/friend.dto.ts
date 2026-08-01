import { IsString, IsUUID, MaxLength } from 'class-validator'

export class FriendRequestDto {
  @IsString()
  @MaxLength(64)
  username: string
}

export class InviteServerDto {
  @IsUUID()
  serverId: string
}
