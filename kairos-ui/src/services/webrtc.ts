import { sendRtcSignal, setRtcHandler } from './presence'
import { attachLevelMeter } from './audio-level'

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

const SPEAK_THRESHOLD = 14
const SPEAK_STREAK_NEEDED = 2
const SELF_KEY = '__self__'

interface Signal {
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
  camera?: boolean
}

export class VoiceChat {
  private pcs = new Map<string, RTCPeerConnection>()
  private audios = new Map<string, HTMLAudioElement>()
  private videos = new Map<string, HTMLVideoElement>()
  private videoSenders = new Map<string, RTCRtpSender>()
  private negotiationReady = new Set<string>()
  private levelCleanups = new Map<string, () => void>()
  private speakStreaks = new Map<string, number>()
  private localStream: MediaStream | null = null
  private localCameraStream: MediaStream | null = null
  private selfId = ''
  private micMuted = false
  private mutedPeers = new Set<string>()
  private camerasOn = new Set<string>()
  private speakingPeers = new Set<string>()
  private selfSpeaking = false
  enabled = false
  cameraEnabled = false

  setSelf(id: string) {
    this.selfId = id
  }

  async enable(): Promise<boolean> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      this.micMuted = true
      this.localStream.getAudioTracks().forEach((t) => (t.enabled = false))
      this.attachSpeakingMeter(SELF_KEY, this.localStream, true)
    } catch {
      this.localStream = null
    }
    this.enabled = true
    setRtcHandler((from, signal) => this.onSignal(from, signal as Signal))
    return true
  }

  hasMic(): boolean {
    return !!this.localStream
  }

  disable() {
    this.enabled = false
    this.micMuted = false
    this.mutedPeers.clear()
    for (const id of [...this.pcs.keys()]) this.drop(id)
    this.disableCamera()
    this.detachSpeakingMeter(SELF_KEY)
    this.selfSpeaking = false
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null
    setRtcHandler(null)
  }

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

  async enableCamera(): Promise<boolean> {
    if (this.cameraEnabled) return true
    try {
      this.localCameraStream = await navigator.mediaDevices.getUserMedia({ video: true })
    } catch {
      this.localCameraStream = null
      return false
    }
    const track = this.localCameraStream.getVideoTracks()[0]
    if (!track) return false
    for (const [peerId, pc] of this.pcs) {
      const existing = this.videoSenders.get(peerId)
      if (existing) {
        existing.replaceTrack(track).catch(() => {})
      } else {
        const sender = pc.addTrack(track, this.localCameraStream)
        this.videoSenders.set(peerId, sender)
      }
    }
    this.cameraEnabled = true
    for (const peerId of this.pcs.keys()) sendRtcSignal(peerId, { camera: true })
    return true
  }

  disableCamera() {
    if (!this.cameraEnabled) return
    for (const sender of this.videoSenders.values()) {
      sender.replaceTrack(null).catch(() => {})
    }
    this.localCameraStream?.getTracks().forEach((t) => t.stop())
    this.localCameraStream = null
    this.cameraEnabled = false
    for (const peerId of this.pcs.keys()) sendRtcSignal(peerId, { camera: false })
  }

  isCameraEnabled(): boolean {
    return this.cameraEnabled
  }

  isPeerCameraOn(peerId: string): boolean {
    return this.camerasOn.has(peerId)
  }

  activeVideoPeerIds(): string[] {
    return [...this.camerasOn]
  }

  getRemoteVideoElement(peerId: string): HTMLVideoElement | undefined {
    return this.videos.get(peerId)
  }

  isSelfSpeaking(): boolean {
    return this.selfSpeaking
  }

  isPeerSpeaking(peerId: string): boolean {
    return this.speakingPeers.has(peerId)
  }

  speakingPeerIds(): string[] {
    return [...this.speakingPeers]
  }

  sync(nearIds: string[]) {
    if (!this.enabled) return
    const near = new Set(nearIds)
    for (const id of near) {
      if (!this.pcs.has(id)) this.connect(id, this.selfId < id)
    }
    for (const id of [...this.pcs.keys()]) {
      if (!near.has(id)) this.drop(id)
    }
  }

  activePeers(): string[] {
    return [...this.pcs.keys()]
  }

  reconnect() {
    for (const id of [...this.pcs.keys()]) this.drop(id)
  }

  private connect(peerId: string, initiator: boolean) {
    const pc = new RTCPeerConnection(RTC_CONFIG)
    this.pcs.set(peerId, pc)
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => pc.addTrack(t, this.localStream!))
    } else {
      pc.addTransceiver('audio', { direction: 'recvonly' })
    }
    if (this.cameraEnabled && this.localCameraStream) {
      const track = this.localCameraStream.getVideoTracks()[0]
      if (track) {
        const sender = pc.addTrack(track, this.localCameraStream)
        this.videoSenders.set(peerId, sender)
      }
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) sendRtcSignal(peerId, { candidate: e.candidate.toJSON() })
    }
    pc.ontrack = (e) => {
      if (e.track.kind === 'video') {
        this.playRemoteVideo(peerId, e.streams[0]!)
      } else {
        this.playRemote(peerId, e.streams[0]!)
      }
    }
    pc.onnegotiationneeded = () => {
      if (!this.negotiationReady.has(peerId)) return
      if (pc.signalingState !== 'stable') return
      pc.createOffer()
        .then((o) => pc.setLocalDescription(o))
        .then(() => sendRtcSignal(peerId, { sdp: pc.localDescription! }))
        .catch(() => {})
    }
    pc.oniceconnectionstatechange = () => {
      if (['connected', 'completed'].includes(pc.iceConnectionState)) this.negotiationReady.add(peerId)
    }
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
    if (signal.camera !== undefined) {
      if (signal.camera) this.camerasOn.add(from)
      else this.camerasOn.delete(from)
      return
    }
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
      return
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
    this.attachSpeakingMeter(peerId, stream, false)
  }

  private playRemoteVideo(peerId: string, stream: MediaStream) {
    let v = this.videos.get(peerId)
    if (!v) {
      v = document.createElement('video')
      v.autoplay = true
      v.playsInline = true
      v.muted = true
      this.videos.set(peerId, v)
    }
    v.srcObject = stream
    this.camerasOn.add(peerId)
  }

  private attachSpeakingMeter(id: string, stream: MediaStream, isSelf: boolean) {
    this.detachSpeakingMeter(id)
    this.levelCleanups.set(
      id,
      attachLevelMeter(stream, (level) => this.handleLevel(id, level, isSelf)),
    )
  }

  private detachSpeakingMeter(id: string) {
    this.levelCleanups.get(id)?.()
    this.levelCleanups.delete(id)
    this.speakStreaks.delete(id)
  }

  private handleLevel(id: string, level: number, isSelf: boolean) {
    const prev = this.speakStreaks.get(id) ?? 0
    const above = level > SPEAK_THRESHOLD
    const next = above ? (prev > 0 ? prev + 1 : 1) : prev < 0 ? prev - 1 : -1
    this.speakStreaks.set(id, next)
    if (next >= SPEAK_STREAK_NEEDED) {
      if (isSelf) this.selfSpeaking = true
      else this.speakingPeers.add(id)
    } else if (next <= -SPEAK_STREAK_NEEDED) {
      if (isSelf) this.selfSpeaking = false
      else this.speakingPeers.delete(id)
    }
  }

  private drop(peerId: string) {
    this.pcs.get(peerId)?.close()
    this.pcs.delete(peerId)
    this.negotiationReady.delete(peerId)
    this.videoSenders.delete(peerId)
    this.camerasOn.delete(peerId)
    const a = this.audios.get(peerId)
    if (a) {
      a.srcObject = null
      this.audios.delete(peerId)
    }
    const v = this.videos.get(peerId)
    if (v) {
      v.srcObject = null
      this.videos.delete(peerId)
    }
    this.detachSpeakingMeter(peerId)
    this.speakingPeers.delete(peerId)
  }
}
