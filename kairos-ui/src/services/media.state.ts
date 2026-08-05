// Estado reativo da mídia, isolado do livekit-client de propósito.
//
// Este módulo é leve e entra no bundle principal; o `media.livekit.ts` (que traz
// o SDK inteiro junto) só é baixado quando alguém entra na voz. A fachada em
// `media.ts` publica os containers daqui, então a UI consegue ler/observar o
// estado antes — e independentemente — de o SDK ter carregado.
//
// Tudo é chaveado por `identity` = uuid do usuário (o backend assina o token do
// LiveKit com req.user.sub e o PresenceGateway manda o mesmo uuid em
// RemotePlayer.userId). Não confundir com o socket.id (RemotePlayer.id), que
// continua sendo a chave de avatar/posição/nome no mapa.
import { reactive, shallowRef } from 'vue'

// chave do próprio usuário nos mapas de elemento/estatística (o LiveKit só dá
// identity pros remotos)
export const SELF_KEY = '@self'

export type ScreenMode = 'detail' | 'motion'

export interface ScreenStats {
  width: number
  height: number
  fps: number
}

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
  // está transmitindo a tela — sabido pela sinalização, sem assinar nada
  screen: boolean
  // eu cliquei em "assistir". A call decide quem PODE assistir; isto decide
  // quem de fato assiste, e é o que segura o custo de banda.
  watching: boolean
  videoWanted: boolean
}

export const state = reactive({
  connected: false,
  connecting: false,
  micAvailable: false,
  micMuted: true,
  // preferência lembrada da pessoa, NÃO o que está no ar: sobrevive à
  // desconexão e é ela que decide se o microfone abre ao entrar num mundo.
  // `micMuted` continua sendo a verdade — nunca dizer "aberto" antes de estar.
  micWanted: false,
  // deafen local: silencia todo mundo de uma vez, sem tocar no `mutedByMe`
  // (silenciar UMA pessoa), que é outra coisa e vive por participante
  deafened: false,
  cameraOn: false,
  selfSpeaking: false,
  screenOn: false,
  screenBusy: false,
  screenMode: 'detail' as ScreenMode,
  screenError: '',
  error: '',
})

export const peers = reactive(new Map<string, MediaPeer>())

export const videoElements = shallowRef(new Map<string, HTMLVideoElement>())

export const selfVideoElement = shallowRef<HTMLVideoElement | null>(null)

export const screenElements = shallowRef(new Map<string, HTMLVideoElement>())

export const selfScreenElement = shallowRef<HTMLVideoElement | null>(null)

// resolução e fps MEDIDOS (não os configurados) — chave = identity, ou SELF_KEY
export const screenStats = reactive(new Map<string, ScreenStats>())
