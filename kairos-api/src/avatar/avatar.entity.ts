import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { User } from '../user/user.entity'

// Um avatar é uma combinação: um corpo do acervo (base) mais as cores escolhidas.
// Vira entidade própria, e não colunas soltas em `characters`, porque precisa ter
// dono, entrar no sorteio e ser curado — nada disso cabe num punhado de campos.
//
// Só existe linha quando alguém SALVA. Rascunho é do cliente, então mexer nas cores
// e desistir não deixa lixo aqui.
export type OrigemAvatar = 'base' | 'sudo' | 'usuario'

@Entity('avatares')
export class Avatar {
  @PrimaryGeneratedColumn('uuid')
  id: string

  // id do corpo no acervo de arte do front (ruivo-verde, idoso, …). É o único ponto
  // onde servidor e front precisam concordar sobre vocabulário — o mesmo tipo de
  // acoplamento que produziu o hairStyle 'short' apontando pra corpo inexistente.
  @Column()
  base: string

  // nulo = mantém a cor original do corpo
  @Column({ type: 'varchar', nullable: true, default: null })
  pele: string | null

  @Column({ type: 'varchar', nullable: true, default: null })
  cabelo: string | null

  @Column({ type: 'varchar', nullable: true, default: null })
  roupa: string | null

  @Column('jsonb', { default: () => "'[]'" })
  acessorios: string[]

  @Column({ default: 'usuario' })
  origem: OrigemAvatar

  // SET NULL e não CASCADE: conta apagada não pode levar junto um avatar que outra
  // pessoa esteja vestindo, nem furar o sorteio. O avatar sobrevive sem autor.
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn()
  criadoPor: User | null

  @CreateDateColumn()
  criadoEm: Date
}
