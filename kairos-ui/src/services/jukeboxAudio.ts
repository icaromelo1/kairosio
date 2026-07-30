import { ref, watch } from 'vue'
import { jukeboxState } from './presence'

const API_URL = import.meta.env.VITE_API_URL || window.location.origin
const STREAM_BASE = `${API_URL}/kairos-api/jukebox/stream`

// volume pessoal (0-1), independente por jogador — multiplica o volume calculado
// por proximidade/sala antes de aplicar no <audio>. Persiste entre sessões.
const storedVolume = Number(localStorage.getItem('kairos-jukebox-volume'))
export const personalVolume = ref(Number.isFinite(storedVolume) && storedVolume >= 0 && storedVolume <= 1 ? storedVolume : 1)
watch(personalVolume, (v) => localStorage.setItem('kairos-jukebox-volume', String(v)))

// Toca a faixa atual da sala sincronizada por startedAt (quem entra no meio
// entra no ponto certo, não do início). Volume é controlado de fora (proximidade
// vs sala inteira, calculado no ticker do GamePage).
class JukeboxAudio {
  private audio: HTMLAudioElement | null = null
  // trackId + startedAt: a mesma música duas vezes seguidas na fila é uma
  // reprodução NOVA (só o trackId não recomeçava o <audio> já terminado)
  private currentKey: string | null = null

  private ensureAudio(): HTMLAudioElement {
    if (!this.audio) this.audio = new Audio()
    return this.audio
  }

  sync() {
    const track = jukeboxState.current
    const a = this.ensureAudio()
    if (!track) {
      if (this.currentKey) {
        a.pause()
        a.removeAttribute('src')
        this.currentKey = null
      }
      return
    }
    const key = `${track.trackId}:${jukeboxState.startedAt ?? 0}`
    if (key !== this.currentKey) {
      this.currentKey = key
      a.src = `${STREAM_BASE}/${track.trackId}`
      const offset = jukeboxState.startedAt ? (Date.now() - jukeboxState.startedAt) / 1000 : 0
      a.currentTime = Math.max(0, offset)
      a.play().catch(() => {
        // autoplay bloqueado até o usuário interagir — toca quando ele apertar [E]
      })
    }
  }

  setVolume(v: number) {
    if (this.audio) this.audio.volume = Math.max(0, Math.min(1, v)) * personalVolume.value
  }

  stop() {
    if (this.audio) {
      this.audio.pause()
      this.audio.removeAttribute('src')
    }
    this.currentKey = null
  }
}

export const jukeboxAudio = new JukeboxAudio()
