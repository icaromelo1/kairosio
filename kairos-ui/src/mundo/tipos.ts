export type Estacao = 'tarefas' | 'notas' | 'lousa' | 'jukebox'

interface Porta {
  lado: 'norte' | 'sul' | 'leste' | 'oeste'
  centro: number
  largura: number
}

export interface Sala {
  id: string
  nome: string
  x: number
  y: number
  largura: number
  profundidade: number
  piso: string
  aberta?: boolean
  murada?: boolean
  textura?: string
  luz?: string
  portas: Porta[]
}

export interface Movel {
  id: string
  peca: string
  x: number
  y: number
  giro: 0 | 90 | 180 | 270
  estacao?: Estacao
  nome?: string
}

type TipoDeArea = 'caminho' | 'pedra' | 'deck' | 'agua' | 'terra' | 'grama'

export interface Area {
  id: string
  tipo: TipoDeArea
  forma: 'retangulo' | 'circulo'
  x: number
  y: number
  largura: number
  profundidade: number
}

export interface Mapa {
  id: string
  name: string
  largura: number
  profundidade: number
  piso: string
  spawn: { x: number; y: number }
  salas: Sala[]
  mobilia: Movel[]
  areas?: Area[]
}

export type Pose = 'parado' | 'andar' | 'sentar' | 'acenar' | 'dancar'
