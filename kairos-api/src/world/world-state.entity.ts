import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, UpdateDateColumn } from 'typeorm'
import { User } from '../user/user.entity'

@Entity('world_states')
export class WorldState {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @OneToOne(() => User)
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
