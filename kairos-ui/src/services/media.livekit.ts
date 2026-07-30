// Camada de mídia sobre o LiveKit (SFU). Substitui a malha P2P artesanal anterior.
//
// ESTE MÓDULO CARREGA O SDK INTEIRO. Ninguém deve importá-lo estaticamente — a
// fachada em `media.ts` o traz por import() dinâmico quando alguém entra na voz,
// e é isso que mantém o livekit-client fora do bundle da landing/login/personagem.
// O estado reativo vive em `media.state.ts` justamente pra sobreviver a isso.
import {
  Room,
  RoomEvent,
  ScreenSharePresets,
  Track,
  createLocalAudioTrack,
  type LocalAudioTrack,
  type LocalTrack,
  type LocalTrackPublication,
  type LocalVideoTrack,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteVideoTrack,
  type ScreenShareCaptureOptions,
  type TrackPublication,
  type TrackPublishOptions,
} from 'livekit-client'
import { apiFetch } from './http'
import {
  SELF_KEY,
  peers,
  screenElements,
  screenStats,
  selfScreenElement,
  selfVideoElement,
  state,
  videoElements,
  type ScreenMode,
} from './media.state'

const SCREEN_STATS_MS = 3000

// Os ScreenSharePresets do SDK param em h1080fps30 — não existe preset de 60fps
// (livekit/client-sdk-js#1822). O modo fluidez monta o encoding na mão: o preset
// de 30fps usa 2 Mbps, e dobrar o framerate pede entre 3 e 4 Mbps.
const SCREEN_PROFILES: Record<ScreenMode, { capture: ScreenShareCaptureOptions; publish: TrackPublishOptions }> = {
  detail: {
    capture: {
      audio: true,
      contentHint: 'detail',
      resolution: ScreenSharePresets.h720fps30.resolution,
    },
    publish: {
      source: Track.Source.ScreenShare,
      screenShareEncoding: ScreenSharePresets.h720fps30.encoding,
      degradationPreference: 'maintain-resolution',
    },
  },
  motion: {
    capture: {
      audio: true,
      contentHint: 'motion',
      resolution: { width: 1280, height: 720, frameRate: 60 },
    },
    publish: {
      source: Track.Source.ScreenShare,
      screenShareEncoding: { maxBitrate: 3_500_000, maxFramerate: 60, priority: 'medium' },
      degradationPreference: 'maintain-framerate',
    },
  },
}

// fechar o seletor de tela do navegador não é falha, é desistência: vira no-op
// silencioso em vez de mensagem de erro
const PICKER_DISMISSED = new Set(['NotAllowedError', 'AbortError', 'NotFoundError'])

function isPickerDismissed(e: unknown): boolean {
  return PICKER_DISMISSED.has((e as { name?: string } | null)?.name || '')
}

function isScreenSource(source: Track.Source): boolean {
  return source === Track.Source.ScreenShare || source === Track.Source.ScreenShareAudio
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

export class MediaRoom {
  private room: Room | null = null
  private inFlight: Promise<boolean> | null = null
  private videoEls = new Map<string, HTMLVideoElement>()
  private audioEls = new Map<string, HTMLAudioElement>()
  private screenEls = new Map<string, HTMLVideoElement>()
  // o áudio da aba vive num elemento próprio: reusar o do microfone faria uma
  // fonte derrubar a outra, já que os dois são chaveados por identity
  private screenAudioEls = new Map<string, HTMLAudioElement>()
  private remoteScreens = new Map<string, RemoteVideoTrack>()
  private screenTrack: LocalVideoTrack | null = null
  private screenAudioTrack: LocalAudioTrack | null = null
  private statsTimer = 0
  private statsPrev = new Map<string, { frames: number; at: number }>()
  private sampling = false

  // apelidos dos containers de `media.state.ts`: são os MESMOS objetos reativos
  // que a fachada publica, então o que a classe escreve aqui a UI já está vendo
  // — sem isso o estado nasceria dentro do módulo tardio e a UI observaria uma
  // cópia morta
  readonly state = state
  readonly peers = peers
  readonly videoElements = videoElements
  readonly selfVideoElement = selfVideoElement
  readonly screenElements = screenElements
  readonly selfScreenElement = selfScreenElement
  readonly screenStats = screenStats

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

  async startScreenShare(mode: ScreenMode): Promise<boolean> {
    const room = this.room
    if (!room || this.state.screenBusy || this.state.screenOn) return false
    const profile = SCREEN_PROFILES[mode]
    this.state.screenBusy = true
    this.state.screenError = ''
    let tracks: LocalTrack[] = []
    try {
      try {
        tracks = await room.localParticipant.createScreenTracks(profile.capture)
      } catch (e) {
        if (!isPickerDismissed(e)) this.state.screenError = (e as Error).message || 'Não foi possível capturar a tela'
        return false
      }

      const video = tracks.find((track) => track.kind === Track.Kind.Video) as LocalVideoTrack | undefined
      const audio = tracks.find((track) => track.kind === Track.Kind.Audio) as LocalAudioTrack | undefined
      // o seletor pode ficar minutos aberto: se a sala morreu nesse meio-tempo,
      // estas tracks são a captura de tela que seguiria viva sem dono
      if (!video || this.room !== room) {
        for (const track of tracks) track.stop()
        return false
      }

      try {
        await room.localParticipant.publishTrack(video, profile.publish)
        if (audio) await room.localParticipant.publishTrack(audio, { source: Track.Source.ScreenShareAudio })
      } catch (e) {
        for (const track of tracks) {
          await room.localParticipant.unpublishTrack(track, true).catch(() => {})
          track.stop()
        }
        this.state.screenError = (e as Error).message || 'Não foi possível publicar a tela'
        return false
      }

      if (this.room !== room) {
        for (const track of tracks) track.stop()
        return false
      }

      this.screenTrack = video
      this.screenAudioTrack = audio ?? null
      this.state.screenMode = mode
      this.state.screenOn = true
      this.attachSelfScreen(video)
      this.syncStatsTimer()
      return true
    } finally {
      this.state.screenBusy = false
    }
  }

  async stopScreenShare(): Promise<void> {
    const room = this.room
    const video = this.screenTrack
    const audio = this.screenAudioTrack
    this.clearSelfScreen()
    for (const track of [video, audio]) {
      if (!track) continue
      if (room) await room.localParticipant.unpublishTrack(track, true).catch(() => {})
      // parar na mão porque unpublishTrack só para a track quando o sinal chega
      // ao servidor: sem isto o navegador segue com o indicador de captura ligado
      track.stop()
    }
  }

  setWatching(identity: string, on: boolean) {
    const peer = this.peers.get(identity)
    if (!peer) return
    peer.watching = on
    this.applyScreenSubscription(identity)
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
      for (const publication of participant.trackPublications.values()) {
        // a tela é opt-in por clique: a distância só decide quem PODE assistir
        if (isScreenSource(publication.source)) continue
        publication.setSubscribed(on)
      }
      this.applyScreenSubscription(identity)
    }
  }

  private applyScreenSubscription(identity: string) {
    const participant = this.room?.remoteParticipants.get(identity)
    const peer = this.peers.get(identity)
    if (!participant || !peer) return
    const on = peer.watching && peer.subscribed
    for (const publication of participant.trackPublications.values()) {
      if (!isScreenSource(publication.source)) continue
      publication.setSubscribed(on)
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
    room.on(RoomEvent.LocalTrackUnpublished, this.onLocalTrackUnpublished)
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
    room.off(RoomEvent.LocalTrackUnpublished, this.onLocalTrackUnpublished)
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
    // o aviso de "fulano começou a transmitir" NÃO sai daqui: TrackPublished só
    // chega pra quem está na sala do LiveKit, e quem está andando pelo mapa sem
    // ter entrado na voz é justamente quem mais precisa saber. Quem avisa é o
    // PresenceGateway (evento screenShare), via GamePage.
    if (isScreenSource(publication.source)) {
      if (publication.source === Track.Source.ScreenShare) peer.screen = true
      this.applyScreenSubscription(participant.identity)
      return
    }
    if (publication.source === Track.Source.Camera) peer.hasCamera = true
    if (publication.source === Track.Source.Microphone) peer.micOff = !!publication.isMuted
    // publicação nova de quem já está no raio precisa ser assinada na hora — o
    // syncSubscriptions só reage a mudança de distância, não a mudança de track
    if (peer.subscribed) publication.setSubscribed(true)
  }

  private onTrackUnpublished = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
    const peer = this.peers.get(participant.identity)
    if (!peer) return
    if (publication.source === Track.Source.ScreenShare) {
      peer.screen = false
      // quem parou e voltou a transmitir exige um novo clique em "assistir",
      // senão a transmissão seguinte desceria sozinha
      peer.watching = false
      // rede de segurança: o TrackUnsubscribed chega antes deste evento e já
      // limpou tudo, mas se um dia não chegar é isto que impede o timer de
      // estatística de seguir medindo uma transmissão que acabou
      this.dropRemoteScreen(participant.identity)
      return
    }
    if (publication.source === Track.Source.ScreenShareAudio) {
      this.releaseElement(this.screenAudioEls, participant.identity)
      return
    }
    if (publication.source === Track.Source.Camera) peer.hasCamera = false
    // despublicar o microfone é o que o setMicEnabled(false) faz: sem track não
    // há como ser ouvido, então conta como mudo
    if (publication.source === Track.Source.Microphone) peer.micOff = true
  }

  private onLocalTrackUnpublished = (publication: LocalTrackPublication) => {
    if (publication.source !== Track.Source.ScreenShare) return
    const audio = this.screenAudioTrack
    this.clearSelfScreen()
    // "Parar compartilhamento" na barra do navegador encerra só a track de
    // vídeo (o SDK despublica sozinho ao vê-la terminar): sem isto o botão
    // continuaria dizendo "transmitindo" e o áudio da aba seguiria no ar
    if (!audio) return
    void this.room?.localParticipant.unpublishTrack(audio, true).catch(() => {})
    audio.stop()
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
    const identity = participant.identity
    if (track.kind === Track.Kind.Video) {
      if (publication.source === Track.Source.ScreenShare) {
        this.releaseElement(this.screenEls, identity)
        const element = track.attach() as HTMLVideoElement
        element.muted = true
        this.screenEls.set(identity, element)
        this.remoteScreens.set(identity, track as RemoteVideoTrack)
        this.refreshScreenElements()
        this.syncStatsTimer()
        return
      }
      if (publication.source !== Track.Source.Camera) return
      this.releaseElement(this.videoEls, identity)
      const element = track.attach() as HTMLVideoElement
      element.muted = true
      this.videoEls.set(identity, element)
      this.refreshVideoElements()
      return
    }
    if (track.kind === Track.Kind.Audio) {
      const store = publication.source === Track.Source.ScreenShareAudio ? this.screenAudioEls : this.audioEls
      this.releaseElement(store, identity)
      store.set(identity, track.attach() as HTMLAudioElement)
    }
  }

  private onTrackUnsubscribed = (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
    const identity = participant.identity
    if (track.kind === Track.Kind.Video) {
      if (publication.source === Track.Source.ScreenShare) {
        if (!this.detachElement(this.screenEls, identity, track)) return
        this.remoteScreens.delete(identity)
        this.dropScreenStats(identity)
        this.refreshScreenElements()
        this.syncStatsTimer()
        return
      }
      if (this.detachElement(this.videoEls, identity, track)) this.refreshVideoElements()
      return
    }
    const store = publication.source === Track.Source.ScreenShareAudio ? this.screenAudioEls : this.audioEls
    this.detachElement(store, identity, track)
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
      existing.screen = !!participant.getTrackPublication(Track.Source.ScreenShare)
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
      screen: !!participant.getTrackPublication(Track.Source.ScreenShare),
      watching: false,
    })
  }

  private dropParticipant(identity: string) {
    this.peers.delete(identity)
    this.releaseElement(this.videoEls, identity)
    this.releaseElement(this.audioEls, identity)
    this.refreshVideoElements()
    this.dropRemoteScreen(identity)
  }

  private dropRemoteScreen(identity: string) {
    this.releaseElement(this.screenEls, identity)
    this.releaseElement(this.screenAudioEls, identity)
    this.remoteScreens.delete(identity)
    this.dropScreenStats(identity)
    this.refreshScreenElements()
    this.syncStatsTimer()
  }

  private releaseSelfVideo() {
    const element = this.selfVideoElement.value
    if (!element) return
    element.srcObject = null
    element.remove()
    this.selfVideoElement.value = null
  }

  private attachSelfScreen(track: LocalVideoTrack) {
    this.releaseSelfScreen()
    const element = track.attach() as HTMLVideoElement
    element.muted = true
    this.selfScreenElement.value = element
  }

  private releaseSelfScreen() {
    const element = this.selfScreenElement.value
    if (!element) return
    element.srcObject = null
    element.remove()
    this.selfScreenElement.value = null
  }

  private clearSelfScreen() {
    this.screenTrack = null
    this.screenAudioTrack = null
    this.state.screenOn = false
    this.releaseSelfScreen()
    this.dropScreenStats(SELF_KEY)
    this.syncStatsTimer()
  }

  private releaseElement(store: Map<string, HTMLMediaElement>, identity: string) {
    const element = store.get(identity)
    if (!element) return
    element.srcObject = null
    element.remove()
    store.delete(identity)
  }

  private detachElement(store: Map<string, HTMLMediaElement>, identity: string, track: RemoteTrack): boolean {
    const element = store.get(identity)
    if (!element) return false
    track.detach(element)
    element.remove()
    store.delete(identity)
    return true
  }

  // shallowRef só reage à troca da referência — copiar é o que notifica a UI
  private refreshVideoElements() {
    this.videoElements.value = new Map(this.videoEls)
  }

  private refreshScreenElements() {
    this.screenElements.value = new Map(this.screenEls)
  }

  private dropScreenStats(key: string) {
    this.screenStats.delete(key)
    this.statsPrev.delete(key)
  }

  // o timer existe só enquanto há alguma tela pra medir: sem isto ele seguiria
  // rodando depois que o último tile de transmissão sumiu
  private syncStatsTimer() {
    const wanted = !!this.screenTrack || this.remoteScreens.size > 0
    if (wanted === !!this.statsTimer) return
    if (!wanted) {
      window.clearInterval(this.statsTimer)
      this.statsTimer = 0
      this.statsPrev.clear()
      return
    }
    this.statsTimer = window.setInterval(() => void this.sampleScreenStats(), SCREEN_STATS_MS)
    void this.sampleScreenStats()
  }

  private async sampleScreenStats() {
    if (this.sampling) return
    this.sampling = true
    try {
      const local = this.screenTrack
      if (local) {
        const stats = await local.getSenderStats().catch(() => [])
        // vem ordenado da maior resolução pra menor; com simulcast + dynacast as
        // camadas que ninguém assina ficam paradas e sem frameWidth
        const layer = stats.find((entry) => (entry.framesPerSecond ?? 0) > 0) ?? stats[0]
        const settings = local.mediaStreamTrack.getSettings()
        if (this.screenTrack === local) {
          this.screenStats.set(SELF_KEY, {
            width: layer?.frameWidth || settings.width || 0,
            height: layer?.frameHeight || settings.height || 0,
            fps: Math.round(layer?.framesPerSecond ?? 0),
          })
        }
      }

      for (const [identity, track] of [...this.remoteScreens]) {
        const stats = await track.getReceiverStats().catch(() => undefined)
        if (!stats || !this.remoteScreens.has(identity)) continue
        // VideoReceiverStats não traz framesPerSecond: o fps sai do delta de
        // framesDecoded entre duas amostras
        const previous = this.statsPrev.get(identity)
        const frames = stats.framesDecoded ?? 0
        const elapsed = previous ? (stats.timestamp - previous.at) / 1000 : 0
        this.statsPrev.set(identity, { frames, at: stats.timestamp })
        this.screenStats.set(identity, {
          width: stats.frameWidth || 0,
          height: stats.frameHeight || 0,
          fps: elapsed > 0 ? Math.max(0, Math.round((frames - (previous?.frames ?? 0)) / elapsed)) : 0,
        })
      }
    } finally {
      this.sampling = false
    }
  }

  private reset() {
    for (const identity of [...this.videoEls.keys()]) this.releaseElement(this.videoEls, identity)
    for (const identity of [...this.audioEls.keys()]) this.releaseElement(this.audioEls, identity)
    for (const identity of [...this.screenEls.keys()]) this.releaseElement(this.screenEls, identity)
    for (const identity of [...this.screenAudioEls.keys()]) this.releaseElement(this.screenAudioEls, identity)
    this.releaseSelfVideo()
    this.remoteScreens.clear()
    this.videoElements.value = new Map()
    this.screenElements.value = new Map()
    this.screenStats.clear()
    this.statsPrev.clear()
    this.clearSelfScreen()
    this.peers.clear()
    this.state.connected = false
    this.state.micAvailable = false
    this.state.micMuted = true
    this.state.cameraOn = false
    this.state.selfSpeaking = false
    this.state.screenBusy = false
    this.state.screenError = ''
  }
}

export const mediaRoom = new MediaRoom()
