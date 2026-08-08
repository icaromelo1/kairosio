import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { TileRevisao } from './tile-revisao.entity'
import { UpdateTileRevisaoDto } from './tile.dto'

@Injectable()
export class TileService {
  constructor(
    @InjectRepository(TileRevisao)
    private readonly repo: Repository<TileRevisao>,
  ) {}

  // lista as revisões já gravadas (opcionalmente filtradas por pack) — é o que
  // permite a futura tela /admin/tiles mesclar com o JSON base e retomar de onde parou
  listar(pack?: string): Promise<TileRevisao[]> {
    return this.repo.find(pack ? { where: { pack } } : {})
  }

  // upsert: grava a cada decisão (não só no fim). Só os campos presentes no DTO
  // sobrescrevem a revisão existente — omitir um campo preserva o valor já salvo.
  async salvar(pack: string, indice: number, dto: UpdateTileRevisaoDto): Promise<TileRevisao> {
    let revisao = await this.repo.findOne({ where: { pack, indice } })
    if (!revisao) revisao = this.repo.create({ pack, indice })

    if (dto.nome !== undefined) revisao.nome = dto.nome
    if (dto.cat !== undefined) revisao.cat = dto.cat
    if (dto.solido !== undefined) revisao.solido = dto.solido
    if (dto.serveComo !== undefined) revisao.serveComo = dto.serveComo
    revisao.revisado = dto.revisado

    return this.repo.save(revisao)
  }
}
