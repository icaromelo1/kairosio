import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, UpdateDateColumn } from 'typeorm'
import { User } from '../user/user.entity'

@Entity('world_states')
export class WorldState {
  @PrimaryGeneratedColumn('uuid')
  id: string

  // CASCADE: apagar um usuário (ex: convidado no logout) remove o estado salvo junto
  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User

  @Column({ default: 'studio' })
  activeMap: string

  @Column({ type: 'float', default: 15 })
  playerX: number

  @Column({ type: 'float', default: 12 })
  playerY: number

  @UpdateDateColumn()
  updatedAt: Date
}
