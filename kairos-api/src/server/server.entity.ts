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

  // arquivado some das listagens e não aceita entrada, mas membros, mundos e convite continuam no banco
  @Column({ type: 'timestamp', nullable: true })
  archivedAt: Date | null

  @CreateDateColumn()
  createdAt: Date
}
