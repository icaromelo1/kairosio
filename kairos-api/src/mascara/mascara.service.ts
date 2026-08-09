import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { MascaraRevisao } from './mascara-revisao.entity'
import { UpdateMascaraRevisaoDto } from './mascara.dto'

@Injectable()
export class MascaraService {
  constructor(
    @InjectRepository(MascaraRevisao)
    private readonly repo: Repository<MascaraRevisao>,
  ) {}

  // lista tudo o que já foi gravado — é o que permite a futura tela /admin/mascaras
  // saber quais dos 72 quadros já foram revisados e retomar de onde parou
  listar(): Promise<MascaraRevisao[]> {
    return this.repo.find()
  }

  // upsert: grava a cada decisão (não só no fim). Só os campos presentes no DTO
  // sobrescrevem a revisão existente — omitir um campo preserva o valor já salvo.
  async salvar(preset: string, quadro: string, dto: UpdateMascaraRevisaoDto): Promise<MascaraRevisao> {
    let revisao = await this.repo.findOne({ where: { preset, quadro } })
    if (!revisao) revisao = this.repo.create({ preset, quadro })

    if (dto.pixels !== undefined) revisao.pixels = dto.pixels
    if (dto.intencional !== undefined) revisao.intencional = dto.intencional
    if (dto.duvida !== undefined) revisao.duvida = dto.duvida
    revisao.revisado = dto.revisado

    return this.repo.save(revisao)
  }
}
