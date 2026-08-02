import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true, nullable: true })
  email: string

  @Column({ nullable: true })
  password: string

  @Column({ nullable: true })
  username: string | null

  @Column({ nullable: true, unique: true })
  usernameLower: string | null

  @Column({ type: 'timestamptz', nullable: true })
  usernameChangedAt: Date | null

  @Column({ default: false })
  isGuest: boolean

  @Column({ default: false })
  isSudo: boolean

  // multi-tenancy: servidor atual do usuário e papel dentro dele
  @Column({ type: 'uuid', nullable: true })
  serverId: string | null

  @Column({ default: 'member' })
  serverRole: 'admin' | 'member'

  @CreateDateColumn()
  createdAt: Date
}
