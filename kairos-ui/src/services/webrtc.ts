// Voz por proximidade (WebRTC). Opt-in: precisa de permissão de microfone.
// Conexões P2P de áudio com quem está perto; sinalização via socket (presence).
import { sendRtcSignal, setRtcHandler } from './presence'

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

interface Signal {
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

export class VoiceChat {
  private pcs = new Map<string, RTCPeerConnection>()
  private audios = new Map<string, HTMLAudioElement>()
  private localStream: MediaStream | null = null
  private selfId = ''
  private micMuted = false
  private mutedPeers = new Set<string>()
  enabled = false

  setSelf(id: string) {
    this.selfId = id
  }

  /** Liga o microfone. Retorna false se o usuário negar a permissão. */
  async enable(): Promise<boolean> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      this.enabled = true
      setRtcHandler((from, signal) => this.onSignal(from, signal as Signal))
      return true
    } catch {
      this.enabled = false
      return false
    }
  }

  disable() {
    this.enabled = false
    this.micMuted = false
    this.mutedPeers.clear()
    for (const id of [...this.pcs.keys()]) this.drop(id)
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null
    setRtcHandler(null)
  }

  /** Desliga só o envio do microfone (mantém as conexões vivas, sem renegociar). */
  muteMic() {
    this.micMuted = true
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = false))
  }
  unmuteMic() {
    this.micMuted = false
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = true))
  }
  isMicMuted(): boolean {
    return this.micMuted
  }

  /** Silencia localmente o áudio recebido de um peer específico (não afeta os outros). */
  muteRemote(peerId: string) {
    this.mutedPeers.add(peerId)
    const a = this.audios.get(peerId)
    if (a) a.muted = true
  }
  unmuteRemote(peerId: string) {
    this.mutedPeers.delete(peerId)
    const a = this.audios.get(peerId)
    if (a) a.muted = false
  }
  isRemoteMuted(peerId: string): boolean {
    return this.mutedPeers.has(peerId)
  }

  /** Reconcilia as conexões com a lista de quem está no alcance de voz. */
  sync(nearIds: string[]) {
    if (!this.enabled) return
    const near = new Set(nearIds)
    for (const id of near) {
      if (!this.pcs.has(id)) this.connect(id, this.selfId < id) // o "menor" id inicia (evita glare)
    }
    for (const id of [...this.pcs.keys()]) {
      if (!near.has(id)) this.drop(id)
    }
  }

  activePeers(): string[] {
    return [...this.pcs.keys()]
  }

  /** Derruba todas as conexões; o `sync` recria no próximo frame (corrige áudio travado). */
  reconnect() {
    for (const id of [...this.pcs.keys()]) this.drop(id)
  }

  private connect(peerId: string, initiator: boolean) {
    const pc = new RTCPeerConnection(RTC_CONFIG)
    this.pcs.set(peerId, pc)
    if (this.micMuted) this.localStream?.getAudioTracks().forEach((t) => (t.enabled = false))
    this.localStream?.getTracks().forEach((t) => pc.addTrack(t, this.localStream!))
    pc.onicecandidate = (e) => {
      if (e.candidate) sendRtcSignal(peerId, { candidate: e.candidate.toJSON() })
    }
    pc.ontrack = (e) => this.playRemote(peerId, e.streams[0])
    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) this.drop(peerId)
    }
    if (initiator) {
      pc.createOffer()
        .then((o) => pc.setLocalDescription(o))
        .then(() => sendRtcSignal(peerId, { sdp: pc.localDescription! }))
        .catch(() => this.drop(peerId))
    }
  }

  private async onSignal(from: string, signal: Signal) {
    if (!this.enabled) return
    let pc = this.pcs.get(from)
    if (!pc) {
      this.connect(from, false)
      pc = this.pcs.get(from)!
    }
    try {
      if (signal.sdp) {
        await pc.setRemoteDescription(signal.sdp)
        if (signal.sdp.type === 'offer') {
          const ans = await pc.createAnswer()
          await pc.setLocalDescription(ans)
          sendRtcSignal(from, { sdp: pc.localDescription! })
        }
      } else if (signal.candidate) {
        await pc.addIceCandidate(signal.candidate)
      }
    } catch {
      // ignora candidatos/descrições fora de ordem
    }
  }

  private playRemote(peerId: string, stream: MediaStream) {
    let a = this.audios.get(peerId)
    if (!a) {
      a = new Audio()
      a.autoplay = true
      a.muted = this.mutedPeers.has(peerId)
      this.audios.set(peerId, a)
    }
    a.srcObject = stream
  }

  private drop(peerId: string) {
    this.pcs.get(peerId)?.close()
    this.pcs.delete(peerId)
    const a = this.audios.get(peerId)
    if (a) {
      a.srcObject = null
      this.audios.delete(peerId)
    }
  }
}
