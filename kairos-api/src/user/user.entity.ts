import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true, nullable: true })
  email: string

  @Column({ nullable: true })
  password: string

  @Column({ default: false })
  isGuest: boolean

  @CreateDateColumn()
  createdAt: Date
}
