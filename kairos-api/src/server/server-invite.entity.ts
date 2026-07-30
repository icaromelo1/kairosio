import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm'

@Entity('server_invites')
export class ServerInvite {
  @PrimaryColumn()
  code: string

  @Column({ type: 'uuid' })
  serverId: string

  @Column({ type: 'uuid' })
  createdBy: string

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null

  @Column({ type: 'int', nullable: true })
  maxUses: number | null

  @Column({ type: 'int', default: 0 })
  uses: number

  @CreateDateColumn()
  createdAt: Date
}
