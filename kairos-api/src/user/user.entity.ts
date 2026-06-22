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

  // multi-tenancy: org atual do usuário e papel dentro dela
  @Column({ type: 'uuid', nullable: true })
  organizationId: string | null

  @Column({ default: 'member' })
  orgRole: 'admin' | 'member'

  @CreateDateColumn()
  createdAt: Date
}
