// Camada de mídia sobre o LiveKit (SFU). Substitui a malha P2P artesanal anterior.
//
// Tudo aqui é chaveado por `identity` = uuid do usuário (o backend assina o token do
// LiveKit com req.user.sub e o PresenceGateway manda o mesmo uuid em RemotePlayer.userId).
// Não confundir com o socket.id (RemotePlayer.id), que continua sendo a chave de
// avatar/posição/nome no mapa e não vale nada para o LiveKit.
import { reactive, shallowRef } from 'vue'
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  type LocalAudioTrack,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type TrackPublication,
} from 'livekit-client'
import { apiFetch } from './http'

export interface MediaPeer {
  identity: string
  name: string
  subscribed: boolean
  // "eu silenciei" — local, só afeta o meu volume
  mutedByMe: boolean
  // "ele está mudo" — o participante mutou o próprio microfone (ou nem publicou).
  // Chega pela sinalização do LiveKit mesmo sem assinatura, então vale pra quem
  // está fora do raio de proximidade também.
  micOff: boolean
  hasCamera: boolean
  speaking: boolean
}

function micOffOf(participant: RemoteParticipant): boolean {
  const publication = participant.getTrackPublication(Track.Source.Microphone)
  return !publication || !!publication.isMuted
}

interface MediaToken {
  token: string
  url: string
}

async function fetchMediaToken(mapId: string): Promise<MediaToken> {
  const res = await apiFetch('/media/token', { method: 'POST', body: JSON.stringify({ mapId }) })
  if (!res.ok) throw new Error(`Falha ao autorizar a voz (${res.status})`)
  return res.json()
}

class MediaRoom {
  private room: Room | null = null
  private inFlight: Promise<boolean> | null = null
  private videoEls = new Map<string, HTMLVideoElement>()
  private audioEls = new Map<string, HTMLAudioElement>()

  readonly state = reactive({
    connected: false,
    connecting: false,
    micAvailable: false,
    micMuted: true,
    cameraOn: false,
    selfSpeaking: false,
    error: '',
  })

  readonly peers = reactive(new Map<string, MediaPeer>())

  readonly videoElements = shallowRef(new Map<string, HTMLVideoElement>())

  readonly selfVideoElement = shallowRef<HTMLVideoElement | null>(null)

  async connect(mapId: string): Promise<boolean> {
    // espera uma tentativa anterior terminar de se desfazer antes de abrir outra —
    // sem isso, trocar de mundo duas vezes seguidas deixava a segunda sem voz
    if (this.inFlight) await this.inFlight.catch(() => false)
    if (this.room) return this.state.connected
    const attempt = this.attemptConnect(mapId)
    this.inFlight = attempt
    try {
      return await attempt
    } finally {
      if (this.inFlight === attempt) this.inFlight = null
    }
  }

  // NUNCA enfileirar o disconnect atrás de uma conexão em andamento: ele é o que
  // desliga o microfone ao sair da tela e precisa valer no mesmo tick. Quem estiver
  // no meio de um await descobre que perdeu a vez pelo teste `this.room !== room`.
  async disconnect(): Promise<void> {
    const room = this.room
    this.room = null
    this.reset()
    if (!room) return
    await this.abandon(room)
  }

  async reconnect(mapId: string): Promise<boolean> {
    await this.disconnect()
    return this.connect(mapId)
  }

  private async attemptConnect(mapId: string): Promise<boolean> {
    this.state.connecting = true
    this.state.error = ''
    try {
      let config: MediaToken
      try {
        config = await fetchMediaToken(mapId)
      } catch (e) {
        this.state.error = (e as Error).message || 'Falha ao autorizar a voz'
        return false
      }

      const room = new Room({ adaptiveStream: true, dynacast: true })
      this.room = room
      this.bind(room)
      try {
        // autoSubscribe: false é o que faz a proximidade existir — nada de áudio/vídeo
        // desce antes de setSubscribed(true) explícito
        await room.connect(config.url, config.token, { autoSubscribe: false })
      } catch (e) {
        if (this.room === room) this.room = null
        await this.abandon(room)
        this.state.error = (e as Error).message || 'Não foi possível conectar à sala de voz'
        return false
      }
      // saiu da tela durante o handshake: a Room ficaria viva sem dono
      if (this.room !== room) {
        await this.abandon(room)
        return false
      }

      this.state.connected = true
      this.state.micMuted = true
      for (const participant of room.remoteParticipants.values()) this.trackParticipant(participant)
      await this.setMicEnabled(true)
      return this.room === room
    } finally {
      this.state.connecting = false
    }
  }

  private async abandon(room: Room) {
    this.unbind(room)
    // parar as tracks locais na mão ANTES do disconnect: se o sinal pro servidor
    // travar, o microfone e a câmera continuariam abertos depois de sair da tela
    for (const publication of room.localParticipant.trackPublications.values()) publication.track?.stop()
    await room.disconnect().catch(() => {})
  }

  async setMicEnabled(on: boolean): Promise<boolean> {
    const room = this.room
    if (!room) return false
    const local = room.localParticipant
    if (!on) {
      const publication = local.getTrackPublication(Track.Source.Microphone)
      if (publication?.track) await local.unpublishTrack(publication.track, true).catch(() => {})
      this.state.micAvailable = false
      return false
    }
    if (local.getTrackPublication(Track.Source.Microphone)) return this.state.micAvailable
    let track: LocalAudioTrack | null = null
    try {
      track = await createLocalAudioTrack()
      // o getUserMedia acima pode ficar segundos no prompt de permissão: se a sala
      // morreu nesse meio-tempo, esta track é a que deixaria o microfone aceso
      if (this.room !== room) {
        track.stop()
        return false
      }
      // mutar ANTES de publicar: publicar e mutar depois abre uma janela em que o
      // áudio já sobe pro SFU, e a voz sempre começa muda
      if (this.state.micMuted) await track.mute()
      await local.publishTrack(track)
      if (this.room !== room) {
        track.stop()
        return false
      }
      this.state.micAvailable = true
      return true
    } catch {
      track?.stop()
      this.state.micAvailable = false
      return false
    }
  }

  async setMicMuted(muted: boolean): Promise<void> {
    this.state.micMuted = muted
    const publication = this.room?.localParticipant.getTrackPublication(Track.Source.Microphone)
    if (!publication) return
    try {
      await (muted ? publication.mute() : publication.unmute())
    } catch {
      this.state.micMuted = !!publication.isMuted
    }
  }

  async setCameraEnabled(on: boolean): Promise<boolean> {
    const room = this.room
    if (!room) return false
    try {
      const publication = await room.localParticipant.setCameraEnabled(on)
      // mesma corrida do microfone: a câmera só abre de fato depois do await
      if (this.room !== room) {
        for (const publication of room.localParticipant.trackPublications.values()) publication.track?.stop()
        this.releaseSelfVideo()
        return false
      }
      this.state.cameraOn = on
      this.releaseSelfVideo()
      if (on && publication?.videoTrack) {
        const element = publication.videoTrack.attach() as HTMLVideoElement
        element.muted = true
        this.selfVideoElement.value = element
      }
    } catch {
      this.state.cameraOn = false
      this.releaseSelfVideo()
    }
    return this.state.cameraOn
  }

  setPeerMuted(identity: string, muted: boolean) {
    const peer = this.peers.get(identity)
    if (!peer) return
    this.room?.remoteParticipants.get(identity)?.setVolume(muted ? 0 : 1)
    peer.mutedByMe = muted
  }

  isSubscribed(identity: string): boolean {
    return !!this.peers.get(identity)?.subscribed
  }

  syncSubscriptions(identities: Iterable<string>) {
    const room = this.room
    if (!room) return
    const wanted = new Set(identities)
    for (const [identity, participant] of room.remoteParticipants) {
      const peer = this.peers.get(identity)
      if (!peer) continue
      const on = wanted.has(identity)
      if (peer.subscribed === on) continue
      peer.subscribed = on
      for (const publication of participant.trackPublications.values()) publication.setSubscribed(on)
    }
  }

  private bind(room: Room) {
    room.on(RoomEvent.ParticipantConnected, this.onParticipantConnected)
    room.on(RoomEvent.ParticipantDisconnected, this.onParticipantDisconnected)
    room.on(RoomEvent.TrackPublished, this.onTrackPublished)
    room.on(RoomEvent.TrackUnpublished, this.onTrackUnpublished)
    room.on(RoomEvent.TrackSubscribed, this.onTrackSubscribed)
    room.on(RoomEvent.TrackUnsubscribed, this.onTrackUnsubscribed)
    room.on(RoomEvent.TrackMuted, this.onTrackMuteChanged)
    room.on(RoomEvent.TrackUnmuted, this.onTrackMuteChanged)
    room.on(RoomEvent.ActiveSpeakersChanged, this.onActiveSpeakers)
    room.on(RoomEvent.Disconnected, this.onDisconnected)
  }

  private unbind(room: Room) {
    room.off(RoomEvent.ParticipantConnected, this.onParticipantConnected)
    room.off(RoomEvent.ParticipantDisconnected, this.onParticipantDisconnected)
    room.off(RoomEvent.TrackPublished, this.onTrackPublished)
    room.off(RoomEvent.TrackUnpublished, this.onTrackUnpublished)
    room.off(RoomEvent.TrackSubscribed, this.onTrackSubscribed)
    room.off(RoomEvent.TrackUnsubscribed, this.onTrackUnsubscribed)
    room.off(RoomEvent.TrackMuted, this.onTrackMuteChanged)
    room.off(RoomEvent.TrackUnmuted, this.onTrackMuteChanged)
    room.off(RoomEvent.ActiveSpeakersChanged, this.onActiveSpeakers)
    room.off(RoomEvent.Disconnected, this.onDisconnected)
  }

  private onParticipantConnected = (participant: RemoteParticipant) => {
    this.trackParticipant(participant)
  }

  private onParticipantDisconnected = (participant: RemoteParticipant) => {
    this.dropParticipant(participant.identity)
  }

  private onTrackPublished = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
    const peer = this.peers.get(participant.identity)
    if (!peer) return
    if (publication.source === Track.Source.Camera) peer.hasCamera = true
    if (publication.source === Track.Source.Microphone) peer.micOff = !!publication.isMuted
    // publicação nova de quem já está no raio precisa ser assinada na hora — o
    // syncSubscriptions só reage a mudança de distância, não a mudança de track
    if (peer.subscribed) publication.setSubscribed(true)
  }

  private onTrackUnpublished = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
    const peer = this.peers.get(participant.identity)
    if (!peer) return
    if (publication.source === Track.Source.Camera) peer.hasCamera = false
    // despublicar o microfone é o que o setMicEnabled(false) faz: sem track não
    // há como ser ouvido, então conta como mudo
    if (publication.source === Track.Source.Microphone) peer.micOff = true
  }

  private onTrackMuteChanged = (publication: TrackPublication, participant: Participant) => {
    if (publication.source !== Track.Source.Microphone) return
    const peer = this.peers.get(participant.identity)
    if (!peer) return
    peer.micOff = !!publication.isMuted
  }

  private onTrackSubscribed = (
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) => {
    if (track.kind === Track.Kind.Video) {
      if (publication.source !== Track.Source.Camera) return
      this.releaseElement(this.videoEls, participant.identity)
      const element = track.attach() as HTMLVideoElement
      element.muted = true
      this.videoEls.set(participant.identity, element)
      this.refreshVideoElements()
      return
    }
    if (track.kind === Track.Kind.Audio) {
      this.releaseElement(this.audioEls, participant.identity)
      this.audioEls.set(participant.identity, track.attach() as HTMLAudioElement)
    }
  }

  private onTrackUnsubscribed = (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
    if (track.kind === Track.Kind.Video) {
      const element = this.videoEls.get(participant.identity)
      if (!element) return
      track.detach(element)
      element.remove()
      this.videoEls.delete(participant.identity)
      this.refreshVideoElements()
      return
    }
    const element = this.audioEls.get(participant.identity)
    if (!element) return
    track.detach(element)
    element.remove()
    this.audioEls.delete(participant.identity)
  }

  private onActiveSpeakers = (speakers: Participant[]) => {
    const speaking = new Set<string>()
    let self = false
    for (const speaker of speakers) {
      if (speaker.isLocal) self = true
      else speaking.add(speaker.identity)
    }
    this.state.selfSpeaking = self
    for (const peer of this.peers.values()) peer.speaking = speaking.has(peer.identity)
  }

  private onDisconnected = () => {
    const room = this.room
    this.room = null
    if (room) this.unbind(room)
    this.reset()
  }

  private trackParticipant(participant: RemoteParticipant) {
    const existing = this.peers.get(participant.identity)
    if (existing) {
      existing.hasCamera = !!participant.getTrackPublication(Track.Source.Camera)
      existing.micOff = micOffOf(participant)
      return
    }
    this.peers.set(participant.identity, {
      identity: participant.identity,
      name: participant.name || '',
      subscribed: false,
      mutedByMe: false,
      micOff: micOffOf(participant),
      hasCamera: !!participant.getTrackPublication(Track.Source.Camera),
      speaking: false,
    })
  }

  private dropParticipant(identity: string) {
    this.peers.delete(identity)
    this.releaseElement(this.videoEls, identity)
    this.releaseElement(this.audioEls, identity)
    this.refreshVideoElements()
  }

  private releaseSelfVideo() {
    const element = this.selfVideoElement.value
    if (!element) return
    element.srcObject = null
    element.remove()
    this.selfVideoElement.value = null
  }

  private releaseElement(store: Map<string, HTMLMediaElement>, identity: string) {
    const element = store.get(identity)
    if (!element) return
    element.srcObject = null
    element.remove()
    store.delete(identity)
  }

  // shallowRef só reage à troca da referência — copiar é o que notifica a UI
  private refreshVideoElements() {
    this.videoElements.value = new Map(this.videoEls)
  }

  private reset() {
    for (const identity of [...this.videoEls.keys()]) this.releaseElement(this.videoEls, identity)
    for (const identity of [...this.audioEls.keys()]) this.releaseElement(this.audioEls, identity)
    this.releaseSelfVideo()
    this.videoElements.value = new Map()
    this.peers.clear()
    this.state.connected = false
    this.state.micAvailable = false
    this.state.micMuted = true
    this.state.cameraOn = false
    this.state.selfSpeaking = false
  }
}

export const media = new MediaRoom()
