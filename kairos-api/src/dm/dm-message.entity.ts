import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('dm_messages')
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

  @Column({ type: 'timestamptz' })
  createdAt: Date
}
