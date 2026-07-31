import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('dm_messages')
// (conversa, data) serve a página do histórico; (autor, data) serve o intervalo mínimo
// entre envios, que procura a última mensagem da pessoa
@Index(['conversationId', 'createdAt'])
@Index(['authorId', 'createdAt'])
export class DmMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  conversationId: string

  @Column({ type: 'uuid' })
  authorId: string

  @Column('text')
  text: string

  // gravada pelo processo, não pelo now() do banco: o cursor da paginação é esta data em
  // ISO, e ela precisa voltar do banco idêntica à que o cliente recebeu
  @Column({ type: 'timestamptz' })
  createdAt: Date
}
