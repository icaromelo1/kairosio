import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true, nullable: true })
  email: string

  @Column({ nullable: true })
  password: string

  // identidade pública (@nome), como a pessoa digitou. Nulo em convidado (a conta
  // some ao sair) e nas contas criadas antes desta coluna existir
  @Column({ nullable: true })
  username: string | null

  // o Postgres compara texto byte a byte: sem esta coluna em minúsculas o UNIQUE
  // deixaria "Icaro" e "icaro" coexistirem como nomes diferentes
  @Column({ nullable: true, unique: true })
  usernameLower: string | null

  @Column({ type: 'timestamptz', nullable: true })
  usernameChangedAt: Date | null

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
