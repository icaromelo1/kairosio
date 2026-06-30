import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as fs from 'node:fs'
import * as path from 'node:path'

const execFileAsync = promisify(execFile)
const EXEC_OPTS = { maxBuffer: 1024 * 1024 * 10, timeout: 5 * 60 * 1000 }

export interface YtDlpInfo {
  title: string
  durationSec: number
}

// Download de áudio via yt-dlp. Aceita link completo ou o id de 11 caracteres do YouTube.
//
// IPs de datacenter (incluindo a VM Oracle) costumam ser bloqueados pelo YouTube com
// "Sign in to confirm you're not a bot" — testado com vários --extractor-args
// player_client (tv/ios/mweb/web_embedded/...), nenhum contorna. Único fix real é
// autenticar com cookies de uma sessão logada (exportados do navegador do Icaro,
// extensão tipo "Get cookies.txt"). Ver COOKIES_FILE no .env.
@Injectable()
export class YtDlpService {
  private readonly cookiesFile = process.env.COOKIES_FILE

  // só ativa se o arquivo existir E não estiver vazio (placeholder até o Icaro subir
  // o cookies.txt de verdade — sem isso, --cookies de um arquivo vazio dá erro pior)
  private cookieArgs(): string[] {
    if (!this.cookiesFile) return []
    try {
      return fs.statSync(this.cookiesFile).size > 0 ? ['--cookies', this.cookiesFile] : []
    } catch {
      return []
    }
  }

  extractYoutubeId(input: string): string {
    const trimmed = (input || '').trim()
    if (/^[\w-]{11}$/.test(trimmed)) return trimmed
    const m = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/)
    if (m) return m[1]
    throw new BadRequestException('Link do YouTube inválido')
  }

  async fetchInfo(youtubeId: string): Promise<YtDlpInfo> {
    const url = `https://www.youtube.com/watch?v=${youtubeId}`
    try {
      const { stdout } = await execFileAsync('yt-dlp', ['-j', '--no-playlist', ...this.cookieArgs(), url], EXEC_OPTS)
      const data = JSON.parse(stdout)
      return { title: String(data.title || youtubeId), durationSec: Math.round(Number(data.duration) || 0) }
    } catch (e) {
      throw this.translateError(e as Error)
    }
  }

  async downloadAudio(youtubeId: string, destDir: string): Promise<string> {
    const url = `https://www.youtube.com/watch?v=${youtubeId}`
    const outTemplate = path.join(destDir, `${youtubeId}.%(ext)s`)
    try {
      await execFileAsync(
        'yt-dlp',
        ['-x', '--audio-format', 'mp3', '--no-playlist', ...this.cookieArgs(), '-o', outTemplate, url],
        EXEC_OPTS,
      )
    } catch (e) {
      throw this.translateError(e as Error)
    }
    return path.join(destDir, `${youtubeId}.mp3`)
  }

  private translateError(e: Error): Error {
    if (/Sign in to confirm/i.test(e.message)) {
      return new ServiceUnavailableException(
        'YouTube bloqueou o download deste servidor (anti-bot). Configure COOKIES_FILE no servidor.',
      )
    }
    return e
  }
}
