import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'

// Camada de revisão por cima dos índices estáticos de tile (indice-*.json, no front).
// Cada linha é um PATCH opcional por tile (pack + índice): só os campos aqui presentes
// sobrepõem o JSON base quando alguém for ler/mesclar (a futura tela /admin/tiles).
// Escolhido em vez de reescrever o JSON no servidor ou migrar o índice inteiro pro banco
// porque o JSON continua sendo importado direto pelo front (busca.ts, render) sem round
// trip de rede — só a decisão manual (1.654 tiles) vira registro incremental e resumível.
@Entity('tile_revisoes')
export class TileRevisao {
  @PrimaryColumn()
  pack: string

  @PrimaryColumn('int')
  indice: number

  @Column({ nullable: true })
  nome: string | null

  @Column({ nullable: true })
  cat: string | null

  @Column({ nullable: true })
  solido: boolean | null

  @Column('jsonb', { nullable: true })
  serveComo: string[] | null

  @Column({ default: false })
  revisado: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
