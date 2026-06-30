import { Injectable } from '@nestjs/common'
import * as fs from 'node:fs'
import * as path from 'node:path'

// Cache local "quente" das músicas em disco. Sem TTL por tempo — limite por
// ESPAÇO (10GB por padrão): ao estourar, remove por LRU usando o mtime do
// arquivo (tocado/baixado recentemente = mtime novo). O Drive guarda a cópia
// permanente; o que sai daqui sempre pode voltar de lá.
@Injectable()
export class CacheService {
  private readonly dir = path.resolve(process.env.MUSIC_CACHE_DIR || './music-cache')
  private readonly maxBytes = parseInt(process.env.MUSIC_CACHE_MAX_BYTES || '10737418240', 10)

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

  async enforceLimit(): Promise<void> {
    const names = await fs.promises.readdir(this.dir)
    const files = await Promise.all(
      names.map(async (name) => {
        const p = this.localPath(name)
        const st = await fs.promises.stat(p)
        return { name, path: p, size: st.size, mtime: st.mtimeMs }
      }),
    )
    let total = files.reduce((sum, f) => sum + f.size, 0)
    if (total <= this.maxBytes) return
    for (const f of files.sort((a, b) => a.mtime - b.mtime)) {
      if (total <= this.maxBytes) break
      await fs.promises.unlink(f.path).catch(() => {})
      total -= f.size
    }
  }
}
