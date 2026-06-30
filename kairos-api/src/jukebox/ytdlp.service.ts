import { BadRequestException, Injectable } from '@nestjs/common'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as path from 'node:path'

const execFileAsync = promisify(execFile)
const EXEC_OPTS = { maxBuffer: 1024 * 1024 * 10, timeout: 5 * 60 * 1000 }

export interface YtDlpInfo {
  title: string
  durationSec: number
}

// Download de áudio via yt-dlp. Aceita link completo ou o id de 11 caracteres do YouTube.
@Injectable()
export class YtDlpService {
  extractYoutubeId(input: string): string {
    const trimmed = (input || '').trim()
    if (/^[\w-]{11}$/.test(trimmed)) return trimmed
    const m = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/)
    if (m) return m[1]
    throw new BadRequestException('Link do YouTube inválido')
  }

  async fetchInfo(youtubeId: string): Promise<YtDlpInfo> {
    const url = `https://www.youtube.com/watch?v=${youtubeId}`
    const { stdout } = await execFileAsync('yt-dlp', ['-j', '--no-playlist', url], EXEC_OPTS)
    const data = JSON.parse(stdout)
    return { title: String(data.title || youtubeId), durationSec: Math.round(Number(data.duration) || 0) }
  }

  async downloadAudio(youtubeId: string, destDir: string): Promise<string> {
    const url = `https://www.youtube.com/watch?v=${youtubeId}`
    const outTemplate = path.join(destDir, `${youtubeId}.%(ext)s`)
    await execFileAsync(
      'yt-dlp',
      ['-x', '--audio-format', 'mp3', '--no-playlist', '-o', outTemplate, url],
      EXEC_OPTS,
    )
    return path.join(destDir, `${youtubeId}.mp3`)
  }
}
