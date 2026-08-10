import { Column, Entity, PrimaryColumn } from 'typeorm'

// Definição de um mundo do Kairos, persistida no banco. O formato espelha o
// MapDef do front: palette/spawn/objects ficam em colunas jsonb, então o editor
// in-game (futuro) edita tamanho e itens só salvando esse registro.
@Entity('game_maps')
export class GameMap {
  @PrimaryColumn()
  id: string

  @Column()
  name: string

  @Column({ default: '' })
  blurb: string

  @Column({ default: '' })
  hours: string

  @Column({ default: 'default' })
  label: string

  @Column('int')
  width: number

  @Column('int')
  height: number

  @Column('jsonb')
  palette: unknown

  @Column('jsonb')
  spawn: unknown

  @Column('jsonb')
  objects: unknown[]

  // dono do mapa (null = mapa oficial/global). Base pros mundos criados por usuários.
  @Column({ type: 'uuid', nullable: true })
  ownerId: string | null

  // multi-tenancy: servidor dono do mundo (null = template global, visível a todos)
  @Column({ type: 'uuid', nullable: true })
  serverId: string | null

  @Column({ default: false })
  isTemplate: boolean

  // marcado quando um sudo edita o mapa pelo jogo. O seed do boot pula o que tem
  // isto preenchido: sem essa marca, a primeira correção feita à mão seria
  // sobrescrita pelo código no deploy seguinte, sem aviso.
  @Column({ type: 'timestamp', nullable: true, default: null })
  editadoEm: Date | null
}
