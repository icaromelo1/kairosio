import { Injectable } from '@nestjs/common'
import * as fs from 'node:fs'
import * as path from 'node:path'

// Cache local "quente" das músicas em disco. Expiração é por TEMPO — faixas que
// não tocam há mais de 7 dias são removidas (Drive + cache + registro) pelo
// JukeboxService.pruneStaleTracks(), não por limite de espaço em disco.
@Injectable()
export class CacheService {
  private readonly dir = path.resolve(process.env.MUSIC_CACHE_DIR || './music-cache')

  constructor() {
    fs.mkdirSync(this.dir, { recursive: true })
  }

  dirPath(): string {
    return this.dir
  }

  localPath(fileName: string): string {
    return path.join(this.dir, fileName)
  }

  has(fileName: string): boolean {
    return fs.existsSync(this.localPath(fileName))
  }

  // marca como "recém-usado" pro LRU (download novo ou play)
  touch(fileName: string): void {
    const p = this.localPath(fileName)
    if (fs.existsSync(p)) {
      const now = new Date()
      fs.utimesSync(p, now, now)
    }
  }

  remove(fileName: string): void {
    const p = this.localPath(fileName)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }
}
