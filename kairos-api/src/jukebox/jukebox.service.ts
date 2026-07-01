import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { LessThan, Repository } from 'typeorm'
import { Track } from './track.entity'
import { YtDlpService } from './ytdlp.service'
import { DriveService } from './drive.service'
import { CacheService } from './cache.service'

const STALE_DAYS = 7
const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000 // checa a cada 6h

@Injectable()
export class JukeboxService implements OnModuleInit {
  private readonly logger = new Logger(JukeboxService.name)
  // dedup real da fila de DOWNLOAD: pedidos concorrentes da mesma música (ex: duas
  // pessoas adicionando o mesmo link ao mesmo tempo) esperam o MESMO download em vez
  // de baixar/subir pro Drive em paralelo. A fila de TOCAR não tem esse limite — a
  // mesma faixa pode entrar quantas vezes quiser (ver PresenceGateway.handleJukeboxAdd).
  private readonly inFlightDownloads = new Map<string, Promise<Track>>()

  constructor(
    @InjectRepository(Track) private readonly tracks: Repository<Track>,
    private readonly ytdlp: YtDlpService,
    private readonly drive: DriveService,
    private readonly cache: CacheService,
  ) {}

  onModuleInit() {
    // roda uma vez no boot e depois periodicamente — só critério de expiração é
    // "não tocou há mais de 7 dias" (sem limite de espaço em disco)
    void this.pruneStaleTracks()
    setInterval(() => void this.pruneStaleTracks(), PRUNE_INTERVAL_MS)
  }

  extractYoutubeId(input: string): string {
    return this.ytdlp.extractYoutubeId(input)
  }

  // biblioteca de faixas já baixadas (qualquer sala), mais tocadas recentemente primeiro,
  // opcionalmente filtrada por texto no título
  async listTracks(search?: string): Promise<Pick<Track, 'id' | 'youtubeId' | 'title' | 'durationSec'>[]> {
    const qb = this.tracks
      .createQueryBuilder('track')
      .select(['track.id', 'track.youtubeId', 'track.title', 'track.durationSec'])
      .orderBy('track.lastPlayedAt', 'DESC')
      .take(100)
    if (search?.trim()) {
      qb.where('track.title ILIKE :q', { q: `%${search.trim()}%` })
    }
    return qb.getMany()
  }

  // apaga (Drive + cache local + registro) faixas que não tocam há mais de 7 dias
  async pruneStaleTracks(): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000)
    const stale = await this.tracks.find({ where: { lastPlayedAt: LessThan(cutoff) } })
    for (const track of stale) {
      try {
        await this.drive.deleteFile(track.driveFile).catch(() => {})
        this.cache.remove(track.driveFile)
        await this.tracks.remove(track)
        this.logger.log(`Faixa expirada removida: ${track.title} (sem tocar há mais de ${STALE_DAYS} dias)`)
      } catch (e) {
        this.logger.warn(`Falha ao expirar faixa ${track.id}: ${(e as Error).message}`)
      }
    }
  }

  // rebaixa (re-sincroniza) tudo que está no Drive pro cache local — útil depois de
  // perder o volume de cache (redeploy, disco novo) sem precisar rebaixar do YouTube
  async syncFromDrive(): Promise<{ total: number; downloaded: number; skipped: number }> {
    const files = await this.drive.listFiles()
    let downloaded = 0
    let skipped = 0
    for (const fileName of files) {
      if (this.cache.has(fileName)) {
        skipped++
        continue
      }
      await this.drive.download(fileName, this.cache.localPath(fileName))
      downloaded++
    }
    return { total: files.length, downloaded, skipped }
  }

  // resolve um link/id pra uma Track: dedup por youtubeId (já baixada antes? só
  // garante que está quente no cache) ou baixa + sobe pro Drive pela primeira vez.
  async resolveTrack(
    youtubeId: string,
    userId: string,
    userName: string,
    onProgress?: (label: string) => void,
  ): Promise<Track> {
    const existing = await this.tracks.findOne({ where: { youtubeId } })
    if (existing) {
      onProgress?.('preparando...')
      if (!this.cache.has(existing.driveFile)) {
        await this.drive.download(existing.driveFile, this.cache.localPath(existing.driveFile))
      }
      this.cache.touch(existing.driveFile)
      return existing
    }

    // ainda não foi baixada — dedupa downloads concorrentes da MESMA música (ex:
    // duas pessoas mandando o mesmo link ao mesmo tempo): quem chegar depois só
    // espera o download que já está em andamento, em vez de baixar/subir de novo.
    const inFlight = this.inFlightDownloads.get(youtubeId)
    if (inFlight) return inFlight

    const promise = this.downloadAndSave(youtubeId, userId, userName, onProgress).finally(() => {
      this.inFlightDownloads.delete(youtubeId)
    })
    this.inFlightDownloads.set(youtubeId, promise)
    return promise
  }

  private async downloadAndSave(
    youtubeId: string,
    userId: string,
    userName: string,
    onProgress?: (label: string) => void,
  ): Promise<Track> {
    onProgress?.('baixando áudio do YouTube...')
    const info = await this.ytdlp.fetchInfo(youtubeId)
    await this.ytdlp.downloadAudio(youtubeId, this.cache.dirPath())
    const fileName = `${youtubeId}.mp3`
    onProgress?.('enviando pro armazenamento...')
    await this.drive.upload(this.cache.localPath(fileName), fileName)

    const track = this.tracks.create({
      youtubeId,
      title: info.title,
      durationSec: info.durationSec,
      driveFile: fileName,
      addedBy: userId,
      addedByName: userName,
      lastPlayedAt: new Date(),
    })
    await this.tracks.save(track)
    this.cache.touch(fileName)
    return track
  }

  // garante a faixa quente no cache local (baixa do Drive se tiver expirado) e
  // retorna o caminho do arquivo pro streaming.
  async streamPath(trackId: string): Promise<{ path: string; track: Track }> {
    const track = await this.tracks.findOne({ where: { id: trackId } })
    if (!track) throw new NotFoundException('Faixa não encontrada')
    if (!this.cache.has(track.driveFile)) {
      await this.drive.download(track.driveFile, this.cache.localPath(track.driveFile))
    }
    this.cache.touch(track.driveFile)
    track.lastPlayedAt = new Date()
    await this.tracks.save(track)
    return { path: this.cache.localPath(track.driveFile), track }
  }
}
