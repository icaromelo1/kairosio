import { Injectable } from '@nestjs/common'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const EXEC_OPTS = { maxBuffer: 1024 * 1024 * 10, timeout: 5 * 60 * 1000 }

// Storage durável das músicas — reaproveita o remote `rclone` já usado em produção
// nos backups do Minecraft (gdrive:, escopo drive.file, token já autorizado).
@Injectable()
export class DriveService {
  private readonly remote = process.env.DRIVE_REMOTE || 'gdrive:kairos-music'
  private readonly configPath = process.env.RCLONE_CONFIG_PATH

  private args(extra: string[]): string[] {
    return this.configPath ? ['--config', this.configPath, ...extra] : extra
  }

  async upload(localPath: string, fileName: string): Promise<void> {
    await execFileAsync('rclone', this.args(['copyto', localPath, `${this.remote}/${fileName}`]), EXEC_OPTS)
  }

  async download(fileName: string, destPath: string): Promise<void> {
    await execFileAsync('rclone', this.args(['copyto', `${this.remote}/${fileName}`, destPath]), EXEC_OPTS)
  }
}
