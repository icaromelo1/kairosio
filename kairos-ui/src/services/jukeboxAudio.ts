import { jukeboxState } from './presence'

const API_URL = import.meta.env.VITE_API_URL || window.location.origin
const STREAM_BASE = `${API_URL}/kairos-api/jukebox/stream`

// Toca a faixa atual da sala sincronizada por startedAt (quem entra no meio
// entra no ponto certo, não do início). Volume é controlado de fora (proximidade
// vs sala inteira, calculado no ticker do GamePage).
class JukeboxAudio {
  private audio: HTMLAudioElement | null = null
  private currentTrackId: string | null = null

  private ensureAudio(): HTMLAudioElement {
    if (!this.audio) this.audio = new Audio()
    return this.audio
  }

  sync() {
    const track = jukeboxState.current
    const a = this.ensureAudio()
    if (!track) {
      if (this.currentTrackId) {
        a.pause()
        a.removeAttribute('src')
        this.currentTrackId = null
      }
      return
    }
    if (track.trackId !== this.currentTrackId) {
      this.currentTrackId = track.trackId
      a.src = `${STREAM_BASE}/${track.trackId}`
      const offset = jukeboxState.startedAt ? (Date.now() - jukeboxState.startedAt) / 1000 : 0
      a.currentTime = Math.max(0, offset)
      a.play().catch(() => {
        // autoplay bloqueado até o usuário interagir — toca quando ele apertar [E]
      })
    }
  }

  setVolume(v: number) {
    if (this.audio) this.audio.volume = Math.max(0, Math.min(1, v))
  }

  stop() {
    if (this.audio) {
      this.audio.pause()
      this.audio.removeAttribute('src')
    }
    this.currentTrackId = null
  }
}

export const jukeboxAudio = new JukeboxAudio()
