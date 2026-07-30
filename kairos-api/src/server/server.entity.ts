import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('servers')
export class Server {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  name: string

  @Column({ unique: true })
  slug: string

  @Column({ type: 'uuid' })
  ownerId: string

  @CreateDateColumn()
  createdAt: Date
}
