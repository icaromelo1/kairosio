import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { FriendshipStatus } from './friendship'

@Entity('friendships')
@Index(['userAId', 'userBId'], { unique: true })
export class Friendship {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  userAId: string

  @Column({ type: 'uuid' })
  userBId: string

  @Column({ default: 'pendente' })
  status: FriendshipStatus

  @Column({ type: 'uuid' })
  requestedBy: string

  @Column({ type: 'uuid', nullable: true })
  blockedBy: string | null

  @Column({ type: 'timestamptz', nullable: true })
  respondedAt: Date | null

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date
}
