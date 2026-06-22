import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm'

@Entity('org_invites')
export class OrgInvite {
  @PrimaryColumn()
  code: string

  @Column({ type: 'uuid' })
  organizationId: string

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
