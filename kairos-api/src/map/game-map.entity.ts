import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity('game_maps')
export class GameMap {
  @PrimaryColumn()
  id: string

  @Column()
  name: string

  @Column('real')
  largura: number

  @Column('real')
  profundidade: number

  @Column({ default: '#eadfc8' })
  piso: string

  @Column('jsonb')
  spawn: { x: number; y: number }

  @Column('jsonb')
  salas: unknown[]

  @Column('jsonb')
  mobilia: unknown[]

  @Column('jsonb', { default: () => "'[]'" })
  areas: unknown[]

  @Column({ type: 'uuid', nullable: true })
  ownerId: string | null

  @Column({ type: 'uuid', nullable: true })
  serverId: string | null

  @Column({ default: false })
  isTemplate: boolean

  @Column({ type: 'timestamp', nullable: true, default: null })
  editadoEm: Date | null
}
