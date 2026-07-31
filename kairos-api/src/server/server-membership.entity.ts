import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

// vínculo N:N entre User e Server — um usuário pode pertencer a vários servidores;
// User.serverId continua existindo como "servidor ativo no momento" (conveniência
// pro presence gateway e queries de isolamento), mas a fonte de verdade de "de quais
// servidores eu sou membro" é essa tabela.
@Entity('server_memberships')
export class ServerMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  userId: string

  @Column({ type: 'uuid' })
  serverId: string

  @Column({ default: 'member' })
  role: 'admin' | 'member'

  @CreateDateColumn()
  joinedAt: Date
}
