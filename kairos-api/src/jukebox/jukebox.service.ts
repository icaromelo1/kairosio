import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Track } from './track.entity'
import { YtDlpService } from './ytdlp.service'
import { DriveService } from './drive.service'
import { CacheService } from './cache.service'

@Injectable()
export class JukeboxService {
  constructor(
    @InjectRepository(Track) private readonly tracks: Repository<Track>,
    private readonly ytdlp: YtDlpService,
    private readonly drive: DriveService,
    private readonly cache: CacheService,
  ) {}

  extractYoutubeId(input: string): string {
    return this.ytdlp.extractYoutubeId(input)
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
      void this.cache.enforceLimit()
      return existing
    }

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
    void this.cache.enforceLimit()
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
    void this.cache.enforceLimit()
    return { path: this.cache.localPath(track.driveFile), track }
  }
}
