import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'

// Camada de revisão por cima das máscaras estáticas de avatar (bootstrap automático,
// 6 presets x 12 quadros = 72). Cada linha é a correção manual de um quadro: a máscara
// de pixels editada + quais regiões faltantes ali são intencionais (ex.: nuca sem pele
// num quadro de costas) em vez de defeito do bootstrap. Usada pela futura tela
// /admin/mascaras para saber onde retomar a revisão.
@Entity('mascara_revisoes')
export class MascaraRevisao {
  @PrimaryColumn()
  preset: string

  @PrimaryColumn()
  quadro: string

  @Column({ nullable: true })
  pixels: string | null

  @Column('jsonb', { nullable: true })
  intencional: string[] | null

  @Column({ default: false })
  revisado: boolean

  @Column({ default: false })
  duvida: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
