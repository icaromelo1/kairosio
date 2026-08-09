import { Entity, PrimaryGeneratedColumn, Column, OneToOne, ManyToOne, JoinColumn } from 'typeorm'
import { Avatar } from '../avatar/avatar.entity'
import { User } from '../user/user.entity'

@Entity('characters')
export class Character {
  @PrimaryGeneratedColumn('uuid')
  id: string

  // CASCADE: apagar um usuário (ex: convidado no logout) remove o personagem junto
  @OneToOne(() => User, { onDelete: 'CASCADE' })
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

  @Column({ default: 'none' })
  accessory: string

  // Qual avatar a pessoa está vestindo. Nullable porque a coluna nasce antes do
  // backfill: marcar NOT NULL com a tabela já povoada derrubaria o boot.
  //
  // RESTRICT e não CASCADE: "só exclui avatar se ninguém usa" tem que ser regra do
  // banco. Como contagem no aplicativo teria janela de corrida — alguém veste entre
  // a contagem e o DELETE — é o próprio Postgres que recusa.
  @ManyToOne(() => Avatar, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'avatarId' })
  avatar: Avatar | null

  // coluna da relação, explícita: é por ela que o salvamento grava sem precisar
  // carregar o avatar inteiro
  @Column({ type: 'uuid', nullable: true, default: null })
  avatarId: string | null

  // nome do arquivo da foto de perfil no Drive/cache (null = usa o sprite pixel)
  @Column({ type: 'varchar', nullable: true, default: null })
  photoFile: string | null
}
