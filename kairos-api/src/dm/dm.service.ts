import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, LessThan, Repository } from 'typeorm'
import { FriendService, Perfil } from '../friend/friend.service'
import { friendPair, isParty, otherSide } from '../friend/friendship'
import { DmConversation } from './dm-conversation.entity'
import { DmMessage } from './dm-message.entity'
import { DmDelivery, DmMensagemView } from './dm-delivery'
import {
  DM_INTERVALO_MIN_MS,
  DM_PAGINA_MAX,
  DM_PAGINA_PADRAO,
  DM_TEXTO_MAX,
  decodeCursor,
  encodeCursor,
  normalizeTexto,
  previa,
} from './dm'

const UNIQUE_VIOLATION = '23505'

@Injectable()
export class DmService {
  constructor(
    @InjectRepository(DmConversation) private conversations: Repository<DmConversation>,
    @InjectRepository(DmMessage) private messages: Repository<DmMessage>,
    private readonly friends: FriendService,
    private readonly delivery: DmDelivery,
  ) {}

  async list(userId: string) {
    const perfis = new Map<string, Perfil>()
    for (const amigo of await this.friends.list(userId)) {
      if (amigo.usuario) perfis.set(amigo.usuario.id, amigo.usuario)
    }
    if (!perfis.size) return []

    const rows = await this.conversations.find({
      where: [{ userAId: userId }, { userBId: userId }],
    })
    const minhas = rows.filter((row) => perfis.has(otherSide(row, userId)))
    if (!minhas.length) return []

    const naoLidas = await this.contarNaoLidas(userId, minhas)
    return minhas
      .map((row) => this.conversaView(row, userId, perfis.get(otherSide(row, userId)) ?? null, naoLidas.get(row.id) ?? 0))
      .sort((a, b) => this.quando(b) - this.quando(a))
  }

  async history(userId: string, conversaId: string, before?: string, limit?: number) {
    const conversa = await this.minha(conversaId, userId)
    await this.assertAmizade(userId, otherSide(conversa, userId))

    const take = Math.min(Math.max(Math.trunc(Number(limit)) || DM_PAGINA_PADRAO, 1), DM_PAGINA_MAX)
    const cursor = before ? decodeCursor(before) : null
    if (before && !cursor) {
      throw new BadRequestException({
        code: 'dm-cursor-invalido',
        message: 'Cursor de paginação inválido.',
      })
    }

    const where: FindOptionsWhere<DmMessage>[] = cursor
      ? [
          { conversationId: conversa.id, createdAt: LessThan(cursor.enviadaEm) },
          { conversationId: conversa.id, createdAt: cursor.enviadaEm, id: LessThan(cursor.id) },
        ]
      : [{ conversationId: conversa.id }]

    const rows = await this.messages.find({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      take: take + 1,
    })
    const pagina = rows.slice(0, take)
    const ultima = pagina[pagina.length - 1]
    return {
      conversaId: conversa.id,
      mensagens: pagina.map((row) => this.mensagemView(row, userId)),
      proximoCursor: rows.length > take && ultima ? encodeCursor(ultima.createdAt, ultima.id) : null,
    }
  }

  async send(userId: string, amigoUserId: string, textoBruto: unknown) {
    if (userId === amigoUserId) {
      throw new BadRequestException({
        code: 'dm-consigo',
        message: 'Você não pode mandar mensagem pra você mesmo.',
      })
    }
    await this.assertAmizade(userId, amigoUserId)

    const texto = normalizeTexto(textoBruto)
    if (!texto) {
      throw new BadRequestException({
        code: 'dm-vazia',
        message: 'Escreva alguma coisa antes de enviar.',
      })
    }
    if (texto.length > DM_TEXTO_MAX) {
      throw new BadRequestException({
        code: 'dm-texto-longo',
        message: `Mensagem muito longa — o máximo é ${DM_TEXTO_MAX} caracteres.`,
      })
    }
    await this.assertIntervalo(userId)

    const conversa = await this.acharOuCriar(userId, amigoUserId)
    const enviadaEm = new Date()
    const mensagem = await this.messages.save(
      this.messages.create({
        conversationId: conversa.id,
        authorId: userId,
        text: texto,
        createdAt: enviadaEm,
      }),
    )
    conversa.lastMessageAt = enviadaEm
    conversa.lastMessageAuthorId = userId
    conversa.lastMessagePreview = previa(texto)
    await this.conversations.save(conversa)

    await this.anunciar(conversa, mensagem, userId, amigoUserId)
    return this.mensagemView(mensagem, userId)
  }

  async markRead(userId: string, conversaId: string) {
    const conversa = await this.minha(conversaId, userId)
    const outroId = otherSide(conversa, userId)
    await this.assertAmizade(userId, outroId)
    const lidoEm = new Date()
    if (conversa.userAId === userId) conversa.readAAt = lidoEm
    else conversa.readBAt = lidoEm
    await this.conversations.save(conversa)
    this.delivery.leu({ paraUserId: outroId, conversaId: conversa.id, lidoEm })
    return { ok: true, conversaId: conversa.id, lidoEm, naoLidas: 0 }
  }

  private async assertAmizade(userId: string, outroId: string) {
    if (await this.friends.saoAmigos(userId, outroId)) return
    throw new ForbiddenException({
      code: 'dm-sem-amizade',
      message: 'Vocês não são amigos. Só dá pra conversar com quem aceitou sua amizade.',
    })
  }

  private async assertIntervalo(userId: string) {
    const ultima = await this.messages.findOne({
      where: { authorId: userId },
      order: { createdAt: 'DESC' },
    })
    if (!ultima) return
    if (Date.now() - new Date(ultima.createdAt).getTime() >= DM_INTERVALO_MIN_MS) return
    throw new HttpException(
      {
        code: 'dm-rapido-demais',
        message: 'Calma — espere um instante antes de mandar outra mensagem.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    )
  }

  private async acharOuCriar(userId: string, outroId: string): Promise<DmConversation> {
    const par = friendPair(userId, outroId)
    const existente = await this.conversations.findOne({ where: par })
    if (existente) return existente
    try {
      return await this.conversations.save(this.conversations.create(par))
    } catch (err: any) {
      if (err?.code !== UNIQUE_VIOLATION) throw err
      const corrida = await this.conversations.findOne({ where: par })
      if (!corrida) throw err
      return corrida
    }
  }

  private async minha(conversaId: string, userId: string): Promise<DmConversation> {
    const row = await this.conversations.findOne({ where: { id: conversaId } })
    if (!row || !isParty(row, userId)) {
      throw new NotFoundException({ code: 'dm-not-found', message: 'Conversa não encontrada' })
    }
    return row
  }

  private async anunciar(
    conversa: DmConversation,
    mensagem: DmMessage,
    autorId: string,
    destinatarioId: string,
  ) {
    try {
      const [naoLidas, perfis] = await Promise.all([
        this.contarNaoLidas(destinatarioId, [conversa]),
        this.friends.perfis([autorId]),
      ])
      this.delivery.entregar({
        paraUserId: destinatarioId,
        conversaId: conversa.id,
        de: perfis.get(autorId) ?? null,
        naoLidas: naoLidas.get(conversa.id) ?? 0,
        mensagem: this.mensagemView(mensagem, destinatarioId),
      })
    } catch {}
  }

  private async contarNaoLidas(
    userId: string,
    conversas: DmConversation[],
  ): Promise<Map<string, number>> {
    const ids = conversas.filter((c) => c.lastMessageAt).map((c) => c.id)
    if (!ids.length) return new Map()
    const rows = await this.messages
      .createQueryBuilder('m')
      .select('m."conversationId"', 'id')
      .addSelect('COUNT(*)::int', 'total')
      .innerJoin(DmConversation, 'c', 'c.id = m."conversationId"')
      .where('m."conversationId" IN (:...ids)', { ids })
      .andWhere('m."authorId" <> :me', { me: userId })
      .andWhere(
        `((c."userAId" = :me AND (c."readAAt" IS NULL OR m."createdAt" > c."readAAt"))
          OR (c."userBId" = :me AND (c."readBAt" IS NULL OR m."createdAt" > c."readBAt")))`,
      )
      .groupBy('m."conversationId"')
      .getRawMany<{ id: string; total: number }>()
    return new Map(rows.map((row) => [row.id, Number(row.total)]))
  }

  private mensagemView(row: DmMessage, userId: string): DmMensagemView {
    return {
      id: row.id,
      conversaId: row.conversationId,
      autorId: row.authorId,
      minha: row.authorId === userId,
      texto: row.text,
      enviadaEm: row.createdAt,
    }
  }

  private conversaView(
    row: DmConversation,
    userId: string,
    usuario: Perfil | null,
    naoLidas: number,
  ) {
    return {
      id: row.id,
      usuario,
      ultimaMensagem: row.lastMessageAt
        ? {
            texto: row.lastMessagePreview ?? '',
            autorId: row.lastMessageAuthorId,
            minha: row.lastMessageAuthorId === userId,
            enviadaEm: row.lastMessageAt,
          }
        : null,
      naoLidas,
      lidoEm: (row.userAId === userId ? row.readAAt : row.readBAt) ?? null,
      // quando o OUTRO leu: é o que sustenta o "vista às hh:mm" sob a última
      // mensagem minha. O dado já era gravado, só nunca saía daqui
      lidoPeloOutroEm: (row.userAId === userId ? row.readBAt : row.readAAt) ?? null,
      criadoEm: row.createdAt ?? null,
    }
  }

  private quando(view: { ultimaMensagem: { enviadaEm: Date } | null; criadoEm: Date | null }) {
    const data = view.ultimaMensagem?.enviadaEm ?? view.criadoEm
    return data ? new Date(data).getTime() : 0
  }
}
