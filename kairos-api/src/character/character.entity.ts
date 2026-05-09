import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm'
import { User } from '../user/user.entity'

@Entity('characters')
export class Character {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @OneToOne(() => User)
  @JoinColumn()
  user: User

  @Column({ default: '' })
  name: string

  @Column({ default: 'short' })
  hairStyle: string

  @Column({ default: '#3d2817' })
  hairColor: string

  @Column({ default: '#e8b894' })
  skin: string

  @Column({ default: '#7c3aed' })
  topColor: string

  @Column({ default: '#1f2937' })
  pantsColor: string
}
