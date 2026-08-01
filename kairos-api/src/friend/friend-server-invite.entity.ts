import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

export type FriendServerInviteStatus = 'pendente' | 'aceito' | 'recusado'

@Entity('friend_server_invites')
@Index(['toUserId', 'status'])
export class FriendServerInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  serverId: string

  @Column({ type: 'uuid' })
  fromUserId: string

  @Column({ type: 'uuid' })
  toUserId: string

  @Column({ default: 'pendente' })
  status: FriendServerInviteStatus

  @Column({ type: 'timestamptz', nullable: true })
  respondedAt: Date | null

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date
}
