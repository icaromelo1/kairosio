import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as fs from 'node:fs'
import * as path from 'node:path'

const execFileAsync = promisify(execFile)
const EXEC_OPTS = { maxBuffer: 1024 * 1024 * 10, timeout: 5 * 60 * 1000 }
const MAX_DURATION_SEC = parseInt(process.env.JUKEBOX_MAX_DURATION_SEC || '1200', 10) // 20min
const PLAYER_CLIENTS = process.env.JUKEBOX_PLAYER_CLIENTS || 'web,mweb,tv'

export interface YtDlpInfo {
  title: string
  durationSec: number
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}min`
  return `${m}min`
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
  private readonly logger = new Logger(YtDlpService.name)
  private readonly cookiesFile = process.env.COOKIES_FILE
  private readonly potProviderUrl = process.env.POT_PROVIDER_URL

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

  private potArgs(): string[] {
    if (!this.potProviderUrl) return []
    return [
      '--extractor-args',
      `youtube:player_client=${PLAYER_CLIENTS}`,
      '--extractor-args',
      `youtubepot-bgutilhttp:base_url=${this.potProviderUrl}`,
    ]
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
      const { stdout } = await execFileAsync(
        'yt-dlp',
        ['-j', '--no-playlist', ...this.cookieArgs(), ...this.potArgs(), url],
        EXEC_OPTS,
      )
      const data = JSON.parse(stdout)
      if (data.is_live) {
        throw new BadRequestException('Não dá pra adicionar uma live em andamento')
      }
      const durationSec = Math.round(Number(data.duration) || 0)
      if (!durationSec) {
        throw new BadRequestException('Não foi possível determinar a duração do vídeo')
      }
      if (durationSec > MAX_DURATION_SEC) {
        throw new BadRequestException(
          `Vídeo muito longo (${formatDuration(durationSec)}) — máximo permitido é ${formatDuration(MAX_DURATION_SEC)}`,
        )
      }
      return { title: String(data.title || youtubeId), durationSec }
    } catch (e) {
      if (e instanceof BadRequestException) throw e
      throw this.translateError(e as Error)
    }
  }

  async downloadAudio(youtubeId: string, destDir: string): Promise<string> {
    const url = `https://www.youtube.com/watch?v=${youtubeId}`
    const outTemplate = path.join(destDir, `${youtubeId}.%(ext)s`)
    try {
      await execFileAsync(
        'yt-dlp',
        [
          '-x',
          '--audio-format',
          'mp3',
          '--no-playlist',
          ...this.cookieArgs(),
          ...this.potArgs(),
          '-o',
          outTemplate,
          url,
        ],
        EXEC_OPTS,
      )
    } catch (e) {
      throw this.translateError(e as Error)
    }
    return path.join(destDir, `${youtubeId}.mp3`)
  }

  private translateError(e: Error): Error {
    this.logger.error(e.message)

    if (/Sign in to confirm/i.test(e.message)) {
      return new ServiceUnavailableException(
        'YouTube bloqueou o download deste servidor (anti-bot). Os cookies do servidor precisam ser renovados.',
      )
    }
    if (/Requested format is not available|Only images are available/i.test(e.message)) {
      return new ServiceUnavailableException(
        'O YouTube não liberou o áudio deste vídeo agora. Tente de novo em alguns minutos ou escolha outro link.',
      )
    }
    if (/Video unavailable|Private video|members-only/i.test(e.message)) {
      return new BadRequestException('Esse vídeo não está disponível publicamente.')
    }
    if (/is not a valid URL|Unsupported URL/i.test(e.message)) {
      return new BadRequestException('Link do YouTube inválido')
    }
    return new ServiceUnavailableException('Não deu pra baixar o áudio agora. Tente de novo em alguns minutos.')
  }
}
