import { Injectable, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'
import { Avatar } from './avatar.entity'
import { CORPOS } from './avatar.presets'

@Injectable()
export class AvatarService implements OnModuleInit {
  constructor(
    @InjectRepository(Avatar)
    private readonly repo: Repository<Avatar>,
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
}
