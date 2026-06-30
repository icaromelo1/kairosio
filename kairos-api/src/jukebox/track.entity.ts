import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

// Música baixada do YouTube e guardada no Drive (storage durável). O cache local
// em disco é só um espelho "quente" — pode sumir e ser reconstruído a partir daqui.
@Entity('jukebox_tracks')
export class Track {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true })
  youtubeId: string

  @Column()
  title: string

  @Column({ type: 'int' })
  durationSec: number

  // path do arquivo dentro do remote do Drive (ex: "abc123.mp3")
  @Column()
  driveFile: string

  @Column({ type: 'uuid' })
  addedBy: string

  @Column()
  addedByName: string

  @CreateDateColumn()
  createdAt: Date

  // último play — base do LRU do cache local (não do registro em si, que é permanente)
  @Column({ type: 'timestamp', nullable: true })
  lastPlayedAt: Date | null
}
