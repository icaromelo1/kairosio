import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

@Entity('characters')
export class Character {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // CASCADE: apagar um usuário (ex: convidado no logout) remove o personagem junto
  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column({ type: 'jsonb', nullable: true, default: null })
  aparencia: unknown | null;

  // nome do arquivo da foto de perfil no Drive/cache (null = sem foto)
  @Column({ type: 'varchar', nullable: true, default: null })
  photoFile: string | null;
}
