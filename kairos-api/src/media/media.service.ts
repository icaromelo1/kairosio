import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AccessToken } from 'livekit-server-sdk'
import { Character } from '../character/character.entity'
import { MapService } from '../map/map.service'
import { livekitConfig } from './livekit-config'

const TOKEN_TTL = '2h'

export interface MediaUser {
  sub: string
  organizationId: string | null
}

export interface MediaToken {
  token: string
  url: string
}

@Injectable()
export class MediaService {
  constructor(
    private readonly maps: MapService,
    @InjectRepository(Character) private readonly characters: Repository<Character>,
  ) {}

  async issueToken(user: MediaUser, mapId: string): Promise<MediaToken> {
    // o mapa do corpo é do cliente: findOneForUser derruba com 404 o que não for
    // template nem da org do usuário, antes de qualquer token ser assinado
    const map = await this.maps.findOneForUser(mapId, user.organizationId ?? null)
    const { apiKey, apiSecret, url } = livekitConfig()

    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.sub,
      name: await this.displayName(user.sub),
      ttl: TOKEN_TTL,
    })
    at.addGrant({
      roomJoin: true,
      room: this.room(user.organizationId ?? null, map.id),
      canPublish: true,
      canSubscribe: true,
    })

    return { token: await at.toJwt(), url }
  }

  // MESMO esquema do PresenceGateway.room() — se divergir, a sala de mídia deixa
  // de bater com a de presença e os avatares ficam sem áudio/vídeo dos vizinhos
  private room(org: string | null, mapId: string): string {
    return `${org || 'public'}:${mapId}`
  }

  private async displayName(userId: string): Promise<string> {
    const character = await this.characters.findOne({ where: { user: { id: userId } } })
    return character?.name?.trim() || 'Convidado'
  }
}
