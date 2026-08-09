import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AccessToken } from 'livekit-server-sdk'
import { User } from '../user/user.entity'
import { MapService } from '../map/map.service'
import { livekitConfig } from './livekit-config'

const TOKEN_TTL = '2h'

export interface MediaUser {
  sub: string
  serverId: string | null
}

export interface MediaToken {
  token: string
  url: string
}

@Injectable()
export class MediaService {
  constructor(
    private readonly maps: MapService,
    @InjectRepository(User) private readonly usuarios: Repository<User>,
  ) {}

  async issueToken(user: MediaUser, mapId: string): Promise<MediaToken> {
    // o mapa do corpo é do cliente: findOneForUser derruba com 404 o que não for
    // template nem do servidor do usuário, antes de qualquer token ser assinado
    const map = await this.maps.findOneForUser(mapId, user.serverId ?? null)
    const { apiKey, apiSecret, url } = livekitConfig()

    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.sub,
      name: await this.displayName(user.sub),
      ttl: TOKEN_TTL,
    })
    at.addGrant({
      roomJoin: true,
      room: this.room(user.serverId ?? null, map.id),
      canPublish: true,
      canSubscribe: true,
    })

    return { token: await at.toJwt(), url }
  }

  // MESMO esquema do PresenceGateway.room() — se divergir, a sala de mídia deixa
  // de bater com a de presença e os avatares ficam sem áudio/vídeo dos vizinhos
  private room(serverId: string | null, mapId: string): string {
    return `${serverId || 'public'}:${mapId}`
  }

  // vem do @nome, que é o nome único da pessoa. Antes vinha de characters.name, uma
  // cópia do mesmo valor herdada de quando personagem tinha nome próprio
  private async displayName(userId: string): Promise<string> {
    const usuario = await this.usuarios.findOne({ where: { id: userId } })
    return usuario?.username?.trim() || 'Convidado'
  }
}
