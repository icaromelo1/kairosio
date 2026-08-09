import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, IsNull, QueryFailedError, Repository } from 'typeorm'
import { Avatar, OrigemAvatar } from './avatar.entity'
import { Character } from '../character/character.entity'
import { CORPOS, IDS_DE_CORPO } from './avatar.presets'
import { CriarAvatarDto } from './avatar.dto'

// Postgres: violação de chave estrangeira. É o que o ON DELETE RESTRICT do
// characters.avatarId dispara quando alguém ainda está vestindo o avatar.
const FK_VIOLADA = '23503'

@Injectable()
export class AvatarService implements OnModuleInit {
  constructor(
    @InjectRepository(Avatar)
    private readonly repo: Repository<Avatar>,
    @InjectRepository(Character)
    private readonly personagens: Repository<Character>,
  ) {}

  async existe(id: string): Promise<boolean> {
    return (await this.repo.countBy({ id })) > 0
  }

  // Os 6 corpos do Kenney viram linhas origem='base' para que o seletor e o sorteio
  // sejam uma consulta só, em vez de "lista fixa no front + tabela no banco" — que é
  // exatamente a duplicação que já fez o contador da barra lateral mentir.
  async onModuleInit() {
    for (const corpo of CORPOS) {
      const jaTem = await this.repo.findOne({
        where: { base: corpo.id, origem: 'base', pele: IsNull(), cabelo: IsNull(), roupa: IsNull() },
      })
      if (jaTem) continue
      await this.repo.save(
        this.repo.create({
          base: corpo.id,
          origem: 'base',
          pele: null,
          cabelo: null,
          roupa: null,
          acessorios: [],
          criadoPor: null,
        }),
      )
    }
  }

  // o seletor da criação de personagem: só o que é oferecido a todo mundo. Avatar de
  // usuário fica de fora daqui de propósito, mas continua elegível no sorteio.
  catalogo() {
    return this.repo.find({ where: { origem: In(['base', 'sudo']) }, order: { criadoEm: 'ASC' } })
  }

  async aleatorio(): Promise<Avatar | null> {
    return this.repo
      .createQueryBuilder('a')
      .orderBy('RANDOM()')
      .limit(1)
      .getOne()
  }

  async criar(dto: CriarAvatarDto, userId: string, ehConvidado: boolean): Promise<Avatar> {
    if (ehConvidado) {
      throw new ForbiddenException('Convidado escolhe um avatar pronto, mas não cria')
    }
    if (!IDS_DE_CORPO.has(dto.base)) {
      throw new BadRequestException('Corpo desconhecido')
    }
    return this.repo.save(
      this.repo.create({
        base: dto.base,
        pele: dto.pele ?? null,
        cabelo: dto.cabelo ?? null,
        roupa: dto.roupa ?? null,
        acessorios: dto.acessorios ?? [],
        origem: 'usuario',
        criadoPor: { id: userId } as never,
      }),
    )
  }

  async atualizar(id: string, dto: CriarAvatarDto, userId: string, ehSudo: boolean): Promise<Avatar> {
    const avatar = await this.repo.findOne({ where: { id }, relations: ['criadoPor'] })
    if (!avatar) throw new NotFoundException('Avatar não encontrado')
    if (avatar.origem === 'base') throw new ForbiddenException('Os corpos do acervo não se editam')
    if (!ehSudo && avatar.criadoPor?.id !== userId) {
      throw new ForbiddenException('Este avatar é de outra pessoa')
    }
    if (!IDS_DE_CORPO.has(dto.base)) throw new BadRequestException('Corpo desconhecido')
    Object.assign(avatar, {
      base: dto.base,
      pele: dto.pele ?? null,
      cabelo: dto.cabelo ?? null,
      roupa: dto.roupa ?? null,
      acessorios: dto.acessorios ?? avatar.acessorios,
    })
    return this.repo.save(avatar)
  }

  async remover(id: string, userId: string, ehSudo: boolean): Promise<void> {
    const avatar = await this.repo.findOne({ where: { id }, relations: ['criadoPor'] })
    if (!avatar) throw new NotFoundException('Avatar não encontrado')
    if (avatar.origem === 'base') {
      throw new ForbiddenException('Os corpos do acervo não se excluem')
    }
    if (!ehSudo && avatar.criadoPor?.id !== userId) {
      throw new ForbiddenException('Este avatar é de outra pessoa')
    }
    try {
      await this.repo.delete({ id })
    } catch (e) {
      // deixar o banco recusar em vez de contar antes: entre a contagem e o DELETE
      // cabe alguém vestir o avatar, e aí a checagem teria mentido
      if (e instanceof QueryFailedError && (e as { driverError?: { code?: string } }).driverError?.code === FK_VIOLADA) {
        const emUso = await this.personagens.countBy({ avatarId: id })
        throw new ConflictException({ mensagem: 'Alguém está usando este avatar', emUso })
      }
      throw e
    }
  }

  async promover(id: string, origem: OrigemAvatar): Promise<Avatar> {
    if (origem === 'base') throw new BadRequestException('Só os 6 corpos originais são base')
    const avatar = await this.repo.findOne({ where: { id } })
    if (!avatar) throw new NotFoundException('Avatar não encontrado')
    if (avatar.origem === 'base') throw new ForbiddenException('Os corpos do acervo não mudam de origem')
    avatar.origem = origem
    return this.repo.save(avatar)
  }

  // a tela de curadoria: tudo, com autor e quantas pessoas estão vestindo — é a
  // contagem que decide se o botão de excluir fica disponível
  async acervo(userId: string, ehSudo: boolean) {
    // sudo cura o acervo inteiro; a pessoa comum entra na mesma tela para editar de
    // verdade os avatares dela, e só vê os dela
    const avatares = ehSudo
      ? await this.repo.find({ relations: ['criadoPor'], order: { criadoEm: 'ASC' } })
      : await this.repo.find({
          where: { criadoPor: { id: userId } },
          relations: ['criadoPor'],
          order: { criadoEm: 'ASC' },
        })
    const usos = await this.personagens
      .createQueryBuilder('c')
      .select('c.avatarId', 'avatarId')
      .addSelect('COUNT(*)', 'n')
      .where('c.avatarId IS NOT NULL')
      .groupBy('c.avatarId')
      .getRawMany<{ avatarId: string; n: string }>()
    const porAvatar = new Map(usos.map((u) => [u.avatarId, Number(u.n)]))
    return avatares.map((a) => ({
      id: a.id,
      base: a.base,
      pele: a.pele,
      cabelo: a.cabelo,
      roupa: a.roupa,
      acessorios: a.acessorios,
      origem: a.origem,
      criadoEm: a.criadoEm,
      autor: a.criadoPor?.username ?? null,
      emUso: porAvatar.get(a.id) ?? 0,
    }))
  }
}
