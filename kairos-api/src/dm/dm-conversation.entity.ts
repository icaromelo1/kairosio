import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { DM_PREVIA_MAX } from './dm'

// uma linha por par de pessoas, nunca duas: userAId guarda sempre o menor dos dois ids
// (friendPair, o mesmo da amizade). O UNIQUE é sobre colunas comuns porque o synchronize
// do TypeORM não cria índice por expressão — a normalização acontece antes da escrita.
@Entity('dm_conversations')
@Index(['userAId', 'userBId'], { unique: true })
export class DmConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  userAId: string

  @Column({ type: 'uuid' })
  userBId: string

  // marca de leitura de cada lado: não-lidas é contar mensagem do outro depois dela.
  // Uma marca por pessoa, não por mensagem — a contagem é derivada, nunca guardada.
  @Column({ type: 'timestamptz', nullable: true })
  readAAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  readBAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null

  @Column({ type: 'uuid', nullable: true })
  lastMessageAuthorId: string | null

  // cópia curta da última mensagem, só pra lista de conversas. Mensagem enviada não é
  // editada nem apagada (fora de escopo), então esta cópia não tem como divergir.
  @Column({ type: 'varchar', length: DM_PREVIA_MAX, nullable: true })
  lastMessagePreview: string | null

  // timestamptz em todas as datas: em "timestamp" simples o pg devolve a hora sem fuso,
  // que o JSON.stringify reexporta como se fosse UTC e joga o valor 3h pra frente
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date
}
