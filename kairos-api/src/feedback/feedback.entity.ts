import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

export type FeedbackKind = 'bug' | 'melhoria'
export type FeedbackStatus = 'aberto' | 'em_andamento' | 'resolvido' | 'recusado'

// Relato de bug ou pedido de melhoria. Guarda o status da correção e o autor
// (email + id do usuário). Só usuários com email cadastrado podem criar.
@Entity('feedbacks')
export class Feedback {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ default: 'bug' })
  kind: FeedbackKind

  @Column()
  title: string

  @Column('text')
  message: string

  @Column({ default: 'aberto' })
  status: FeedbackStatus

  @Column()
  authorEmail: string

  @Column({ type: 'uuid' })
  authorId: string

  // setada quando o status vai pra resolvido/recusado (data da resolução)
  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
