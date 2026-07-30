// Fachada da camada de mídia.
//
// O `livekit-client` custa ~840 kB e não serve pra nada na landing, no login nem
// na tela de personagem. Este módulo publica o estado reativo (que é leve e vive
// em `media.state.ts`) e só baixa o `media.livekit.ts` — com o SDK junto — quando
// alguém de fato entra na voz.
//
// A API é a mesma que o GamePage e o MediaStage já consumiam. Os métodos que a UI
// chama antes de conectar viram no-op; os que ela chama a cada frame (isSubscribed,
// syncSubscriptions) continuam síncronos, lendo o estado compartilhado.
import {
  peers,
  screenElements,
  screenStats,
  selfScreenElement,
  selfVideoElement,
  state,
  videoElements,
  type ScreenMode,
} from './media.state'

export { SELF_KEY } from './media.state'
export type { MediaPeer, ScreenMode, ScreenStats } from './media.state'

type MediaRoom = import('./media.livekit').MediaRoom

let impl: MediaRoom | null = null
let loading: Promise<MediaRoom> | null = null
// "eu quero estar na voz". O disconnect pode chegar enquanto o chunk ainda baixa
// (sair da tela logo depois de clicar em entrar): sem esta flag a conexão subiria
// DEPOIS, com o microfone aberto e ninguém olhando.
let wanted = false

function load(): Promise<MediaRoom> {
  if (loading) return loading
  loading = import('./media.livekit')
    .then((module) => {
      impl = module.mediaRoom
      return impl
    })
    .catch((e) => {
      // sem zerar isto, uma falha de rede no chunk deixaria a voz quebrada até
      // o F5 — a promise rejeitada seria devolvida pra sempre
      loading = null
      throw e
    })
  return loading
}

// o `connecting` cobre o download do chunk também: sem isso o botão ficaria
// dizendo "entrar na voz" durante a baixa e aceitaria um segundo clique.
// É zerado antes de delegar porque o attemptConnect o liga de novo, de forma
// síncrona — e porque o caminho "já conectado" da impl retorna cedo sem mexer
// nele, o que deixaria o estado preso em "conectando" pra sempre.
async function start(run: (room: MediaRoom) => Promise<boolean>): Promise<boolean> {
  wanted = true
  state.connecting = true
  let room: MediaRoom
  try {
    room = await load()
  } catch {
    state.error = 'Não foi possível carregar a camada de voz'
    return false
  } finally {
    state.connecting = false
  }
  if (!wanted) return false
  return run(room)
}

export const media = {
  state,
  peers,
  videoElements,
  selfVideoElement,
  screenElements,
  selfScreenElement,
  screenStats,

  async connect(mapId: string): Promise<boolean> {
    return start((room) => room.connect(mapId))
  },

  async reconnect(mapId: string): Promise<boolean> {
    return start((room) => room.reconnect(mapId))
  },

  // nunca força o carregamento: desconectar sem nunca ter conectado é no-op
  async disconnect(): Promise<void> {
    wanted = false
    await impl?.disconnect()
  },

  async setMicMuted(muted: boolean): Promise<void> {
    await impl?.setMicMuted(muted)
  },

  async setCameraEnabled(on: boolean): Promise<boolean> {
    return (await impl?.setCameraEnabled(on)) ?? false
  },

  async startScreenShare(mode: ScreenMode): Promise<boolean> {
    return (await impl?.startScreenShare(mode)) ?? false
  },

  async stopScreenShare(): Promise<void> {
    await impl?.stopScreenShare()
  },

  setWatching(identity: string, on: boolean): void {
    impl?.setWatching(identity, on)
  },

  setPeerMuted(identity: string, muted: boolean): void {
    impl?.setPeerMuted(identity, muted)
  },

  // roda no ticker do Pixi, a cada frame: lê o estado compartilhado direto, sem
  // depender do SDK ter carregado
  isSubscribed(identity: string): boolean {
    return !!peers.get(identity)?.subscribed
  },

  syncSubscriptions(identities: Iterable<string>): void {
    impl?.syncSubscriptions(identities)
  },
}
