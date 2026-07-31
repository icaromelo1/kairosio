import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  mapId: string

  @Column()
  objectId: string

  @Column({ type: 'uuid' })
  serverId: string

  @Column()
  title: string

  @Column({ default: false })
  done: boolean

  @Column({ type: 'uuid' })
  createdBy: string

  @CreateDateColumn()
  createdAt: Date
}
