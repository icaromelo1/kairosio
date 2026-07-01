import { Injectable } from '@nestjs/common'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as fs from 'node:fs'
import * as path from 'node:path'

const execFileAsync = promisify(execFile)
const EXEC_OPTS = { maxBuffer: 1024 * 1024 * 10, timeout: 2 * 60 * 1000 }

// Storage durável das fotos de perfil — mesmo padrão rclone/Drive já usado no
// jukebox (kairos-api/src/jukebox/drive.service.ts), só que num remote separado.
@Injectable()
export class AvatarPhotoStorageService {
  private readonly remote = process.env.AVATAR_DRIVE_REMOTE || 'gdrive:kairos-avatars'
  private readonly configPath = process.env.RCLONE_CONFIG_PATH
  private readonly cacheDir = path.resolve(process.env.AVATAR_CACHE_DIR || './avatar-cache')

  constructor() {
    fs.mkdirSync(this.cacheDir, { recursive: true })
  }

  private args(extra: string[]): string[] {
    return this.configPath ? ['--config', this.configPath, ...extra] : extra
  }

  localPath(fileName: string): string {
    return path.join(this.cacheDir, fileName)
  }

  has(fileName: string): boolean {
    return fs.existsSync(this.localPath(fileName))
  }

  writeLocal(fileName: string, buffer: Buffer): void {
    fs.writeFileSync(this.localPath(fileName), buffer)
  }

  async upload(fileName: string): Promise<void> {
    await execFileAsync('rclone', this.args(['copyto', this.localPath(fileName), `${this.remote}/${fileName}`]), EXEC_OPTS)
  }

  async download(fileName: string): Promise<string> {
    const dest = this.localPath(fileName)
    if (!fs.existsSync(dest)) {
      await execFileAsync('rclone', this.args(['copyto', `${this.remote}/${fileName}`, dest]), EXEC_OPTS)
    }
    return dest
  }

  async deleteFile(fileName: string): Promise<void> {
    fs.rmSync(this.localPath(fileName), { force: true })
    try {
      await execFileAsync('rclone', this.args(['deletefile', `${this.remote}/${fileName}`]), EXEC_OPTS)
    } catch {
      // arquivo já pode não existir no Drive (ex: upload anterior falhou) — não bloqueia a remoção local
    }
  }
}
