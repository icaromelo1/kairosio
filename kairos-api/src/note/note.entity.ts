import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity('notes')
export class Note {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  mapId: string

  @Column()
  objectId: string

  @Column({ type: 'uuid', nullable: true })
  serverId: string | null

  @Column('text')
  body: string

  @Column({ type: 'uuid' })
  createdBy: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
