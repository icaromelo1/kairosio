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

// Preferência de áudio da pessoa, entre sessões. Ausência da chave = primeira
// vez de todas = microfone DESLIGADO: ninguém é ouvido sem ter clicado uma vez.
// Por isso o padrão nunca é gravado — só o que foge dele ocupa espaço.
const PREFS_KEY = 'kairos_audio'

let prefsKey = PREFS_KEY
let impl: MediaRoom | null = null
let loading: Promise<MediaRoom> | null = null
// "eu quero estar na voz". O disconnect pode chegar enquanto o chunk ainda baixa
// (sair da tela logo depois de clicar em entrar): sem esta flag a conexão subiria
// DEPOIS, com o microfone aberto e ninguém olhando.
let wanted = false

function readPrefs(key: string): { mic: boolean; deaf: boolean } {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) || 'null')
    if (!parsed || typeof parsed !== 'object') return { mic: false, deaf: false }
    const saved = parsed as Record<string, unknown>
    // qualquer coisa que não seja exatamente `true` cai no padrão: preferência
    // corrompida nunca pode virar microfone aberto
    return { mic: saved.mic === true, deaf: saved.deaf === true }
  } catch {
    return { mic: false, deaf: false }
  }
}

function savePrefs(): void {
  try {
    if (!state.micWanted && !state.deafened) localStorage.removeItem(prefsKey)
    else localStorage.setItem(prefsKey, JSON.stringify({ mic: state.micWanted, deaf: state.deafened }))
  } catch {
    // storage cheio/bloqueado não pode travar o controle
  }
}

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
// dizendo "entrar na voz" durante a baixa e aceitaria um segundo clique. Só é
// zerado no fim de tudo, e por AQUI — o caminho "já conectado" da impl retorna
// cedo sem tocar nele, e sem este finally o estado ficaria preso em "conectando".
async function start(run: (room: MediaRoom) => Promise<boolean>): Promise<boolean> {
  wanted = true
  state.connecting = true
  try {
    let room: MediaRoom
    try {
      room = await load()
    } catch {
      state.error = 'Não foi possível carregar a camada de voz'
      return false
    }
    if (!wanted) return false
    // o `connecting` fica de pé até a impl terminar: ela o desliga entre o
    // disconnect e o reconnect da troca de mundo, e nesse buraco o rodapé
    // anunciaria "voz desligada" no meio de uma troca que está indo bem
    return await run(room)
  } finally {
    state.connecting = false
  }
}

export const media = {
  state,
  peers,
  videoElements,
  selfVideoElement,
  screenElements,
  selfScreenElement,
  screenStats,

  // chamada por quem entra no mundo ANTES de conectar: a preferência é por
  // pessoa, e a da conta anterior no mesmo navegador não vale pra esta
  loadPrefs(userId: string | null): void {
    prefsKey = userId ? `${PREFS_KEY}:${userId}` : PREFS_KEY
    const prefs = readPrefs(prefsKey)
    state.micWanted = prefs.mic
    state.deafened = prefs.deaf
    impl?.setDeafened(prefs.deaf)
  },

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

  // a intenção é gravada mesmo com a voz fora do ar: é ela que o attemptConnect
  // aplica quando a sala sobe
  async setMicMuted(muted: boolean): Promise<void> {
    state.micWanted = !muted
    savePrefs()
    await impl?.setMicMuted(muted)
  },

  // vale mesmo antes do SDK carregar: o impl lê `state.deafened` ao anexar cada
  // elemento de áudio
  setDeafened(on: boolean): void {
    state.deafened = on
    savePrefs()
    impl?.setDeafened(on)
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

  setPeerGain(identity: string, gain: number): void {
    impl?.setPeerGain(identity, gain)
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
