export type Estacao = 'tarefas' | 'notas' | 'lousa' | 'jukebox'

export interface Porta {
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

export interface Mapa {
  id: string
  name: string
  largura: number
  profundidade: number
  piso: string
  spawn: { x: number; y: number }
  salas: Sala[]
  mobilia: Movel[]
}

export interface Ponto {
  x: number
  y: number
}

export type Pose = 'parado' | 'andar' | 'sentar' | 'acenar' | 'dancar'
