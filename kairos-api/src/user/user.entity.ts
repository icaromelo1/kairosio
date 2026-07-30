import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true, nullable: true })
  email: string

  @Column({ nullable: true })
  password: string

  @Column({ default: false })
  isGuest: boolean

  // multi-tenancy: servidor atual do usuário e papel dentro dele
  @Column({ type: 'uuid', nullable: true })
  serverId: string | null

  @Column({ default: 'member' })
  serverRole: 'admin' | 'member'

  @CreateDateColumn()
  createdAt: Date
}
