import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

// vínculo N:N entre User e Organization — um usuário pode pertencer a várias orgs;
// User.organizationId continua existindo como "org ativa no momento" (conveniência
// pro presence gateway e queries de isolamento), mas a fonte de verdade de "de quais
// orgs eu sou membro" é essa tabela.
@Entity('org_memberships')
export class OrgMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  userId: string

  @Column({ type: 'uuid' })
  organizationId: string

  @Column({ default: 'member' })
  role: 'admin' | 'member'

  @CreateDateColumn()
  joinedAt: Date
}
