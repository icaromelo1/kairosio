import type { Estacao, Movel } from './tipos'

export interface Peca {
  largura: number
  profundidade: number
  solida: boolean
  sentavel?: boolean
  estacao?: Estacao
  nome: string
}

export const PECAS: Record<string, Peca> = {
  mesa_trabalho: { largura: 1.4, profundidade: 0.7, solida: true, estacao: 'tarefas', nome: 'mesa de trabalho' },
  cadeira: { largura: 0.55, profundidade: 0.55, solida: true, sentavel: true, nome: 'cadeira' },
  mesa_reuniao: { largura: 3.2, profundidade: 1.3, solida: true, nome: 'mesa de reunião' },
  sofa: { largura: 2.0, profundidade: 0.85, solida: true, sentavel: true, nome: 'sofá' },
  poltrona: { largura: 0.9, profundidade: 0.9, solida: true, sentavel: true, nome: 'poltrona' },
  mesa_centro: { largura: 1.1, profundidade: 0.6, solida: true, nome: 'mesa de centro' },
  mesa_redonda: { largura: 1.1, profundidade: 1.1, solida: true, nome: 'mesa redonda' },
  banqueta: { largura: 0.45, profundidade: 0.45, solida: true, sentavel: true, nome: 'banqueta' },
  puff: { largura: 0.7, profundidade: 0.7, solida: true, sentavel: true, nome: 'puff' },
  planta: { largura: 0.5, profundidade: 0.5, solida: true, nome: 'planta' },
  planta_grande: { largura: 0.8, profundidade: 0.8, solida: true, nome: 'planta' },
  estante: { largura: 1.6, profundidade: 0.45, solida: true, estacao: 'notas', nome: 'estante' },
  lousa: { largura: 2.2, profundidade: 0.3, solida: true, estacao: 'lousa', nome: 'lousa' },
  jukebox: { largura: 0.9, profundidade: 0.6, solida: true, estacao: 'jukebox', nome: 'jukebox' },
  balcao: { largura: 2.6, profundidade: 0.8, solida: true, nome: 'balcão' },
  geladeira: { largura: 0.8, profundidade: 0.7, solida: true, nome: 'geladeira' },
  bebedouro: { largura: 0.45, profundidade: 0.45, solida: true, nome: 'bebedouro' },
  rack_servidor: { largura: 0.7, profundidade: 1.0, solida: true, nome: 'rack de servidores' },
  luminaria: { largura: 0.4, profundidade: 0.4, solida: true, nome: 'luminária' },
  tapete: { largura: 3.0, profundidade: 2.0, solida: false, nome: 'tapete' },
  tapete_redondo: { largura: 2.2, profundidade: 2.2, solida: false, nome: 'tapete' },
}

export function pecaDe(movel: Movel): Peca | null {
  return PECAS[movel.peca] ?? null
}

export function pegadaDe(movel: Movel): { largura: number; profundidade: number } {
  const peca = pecaDe(movel)
  if (!peca) return { largura: 0, profundidade: 0 }
  const deitado = movel.giro === 90 || movel.giro === 270
  return deitado
    ? { largura: peca.profundidade, profundidade: peca.largura }
    : { largura: peca.largura, profundidade: peca.profundidade }
}

export function estacaoDe(movel: Movel): Estacao | null {
  return movel.estacao ?? pecaDe(movel)?.estacao ?? null
}

export function nomeDe(movel: Movel): string {
  return movel.nome ?? pecaDe(movel)?.nome ?? movel.peca
}
