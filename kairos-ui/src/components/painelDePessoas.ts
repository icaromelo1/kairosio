export interface PessoaDoPainel {
  id: string
  userId: string
  nome: string
  x: number
  y: number
}

export interface PainelDePessoas {
  perto: PessoaDoPainel[]
  salas: { id: string; nome: string; trancada: boolean; gente: PessoaDoPainel[] }[]
  soltos: PessoaDoPainel[]
  sozinhoNaSala: string | null
}
