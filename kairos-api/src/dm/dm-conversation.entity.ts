import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { DM_PREVIA_MAX } from './dm'

@Entity('dm_conversations')
@Index(['userAId', 'userBId'], { unique: true })
export class DmConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  userAId: string

  @Column({ type: 'uuid' })
  userBId: string

  @Column({ type: 'timestamptz', nullable: true })
  readAAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  readBAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null

  @Column({ type: 'uuid', nullable: true })
  lastMessageAuthorId: string | null

  @Column({ type: 'varchar', length: DM_PREVIA_MAX, nullable: true })
  lastMessagePreview: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date
}
