import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { FriendshipStatus } from './friendship'

// uma linha por par de pessoas, nunca duas. userAId guarda sempre o menor dos dois
// ids (friendPair): o UNIQUE abaixo é sobre colunas comuns de propósito, porque o
// synchronize do TypeORM não cria índice por expressão — a normalização acontece
// antes da escrita, não dentro do índice.
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

  // de que lado mostrar o pedido: quem pediu vê "enviado", o outro vê "recebido"
  @Column({ type: 'uuid' })
  requestedBy: string

  // bloqueio é assimétrico: a linha é invisível pra quem foi bloqueado e só quem
  // está aqui pode desfazer
  @Column({ type: 'uuid', nullable: true })
  blockedBy: string | null

  @Column({ type: 'timestamptz', nullable: true })
  respondedAt: Date | null

  // timestamptz nas duas datas: em "timestamp" simples o pg devolve a hora sem fuso,
  // que o JSON.stringify reexporta como se fosse UTC e joga o valor 3h pra frente
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date
}
