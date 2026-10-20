import type { Estacao, Movel } from './tipos'

export interface Peca {
  largura: number
  profundidade: number
  solida: boolean
  sentavel?: boolean
  alturaAssento?: number
  deParede?: boolean
  assentos?: { x: number; y: number; giro: number }[]
  estacao?: Estacao
  nome: string
}

export const PECAS: Record<string, Peca> = {
  mesa_trabalho: { largura: 1.4, profundidade: 0.7, solida: true, estacao: 'tarefas', nome: 'mesa de trabalho' },
  cadeira: { largura: 0.55, profundidade: 0.55, solida: true, sentavel: true, alturaAssento: 0.52, nome: 'cadeira' },
  mesa_reuniao: { largura: 3.2, profundidade: 1.3, solida: true, nome: 'mesa de reunião' },
  sofa: { largura: 2.0, profundidade: 0.85, solida: true, sentavel: true, alturaAssento: 0.455, assentos: [{ x: -0.4, y: 0.06, giro: 0 }, { x: 0.4, y: 0.06, giro: 0 }], nome: 'sofá' },
  poltrona: { largura: 0.9, profundidade: 0.9, solida: true, sentavel: true, alturaAssento: 0.455, assentos: [{ x: 0, y: 0.06, giro: 0 }], nome: 'poltrona' },
  mesa_centro: { largura: 1.1, profundidade: 0.6, solida: true, nome: 'mesa de centro' },
  mesa_redonda: { largura: 1.1, profundidade: 1.1, solida: true, nome: 'mesa redonda' },
  banqueta: { largura: 0.45, profundidade: 0.45, solida: true, sentavel: true, alturaAssento: 0.65, nome: 'banqueta' },
  puff: { largura: 0.7, profundidade: 0.7, solida: true, sentavel: true, alturaAssento: 0.425, nome: 'puff' },
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
  arvore: { largura: 1.0, profundidade: 1.0, solida: true, nome: 'árvore' },
  arvore_pinheiro: { largura: 1.0, profundidade: 1.0, solida: true, nome: 'pinheiro' },
  arbusto: { largura: 0.8, profundidade: 0.8, solida: true, nome: 'arbusto' },
  canteiro: { largura: 1.8, profundidade: 0.8, solida: true, nome: 'canteiro' },
  banco_jardim: { largura: 1.6, profundidade: 0.5, solida: true, sentavel: true, alturaAssento: 0.48, nome: 'banco' },
  mesa_picnic: { largura: 1.8, profundidade: 1.7, solida: true, sentavel: true, alturaAssento: 0.465, assentos: [{ x: -0.45, y: -0.68, giro: 0 }, { x: 0.45, y: -0.68, giro: 0 }, { x: -0.45, y: 0.68, giro: 180 }, { x: 0.45, y: 0.68, giro: 180 }], nome: 'mesa de piquenique' },
  fonte: { largura: 2.5, profundidade: 2.5, solida: true, nome: 'fonte' },
  poste: { largura: 0.3, profundidade: 0.3, solida: true, nome: 'poste' },
  pedra: { largura: 0.8, profundidade: 0.6, solida: true, nome: 'pedra' },
  tv: { largura: 1.6, profundidade: 0.45, solida: true, nome: 'TV' },
  mesa_pingpong: { largura: 2.6, profundidade: 1.5, solida: true, nome: 'pingue-pongue' },
  arcade: { largura: 0.7, profundidade: 0.7, solida: true, nome: 'fliperama' },
  sinuca: { largura: 2.3, profundidade: 1.3, solida: true, nome: 'sinuca' },
  impressora: { largura: 0.7, profundidade: 0.55, solida: true, nome: 'impressora' },
  armario: { largura: 1.6, profundidade: 0.5, solida: true, nome: 'armário' },
  divisoria: { largura: 1.8, profundidade: 0.1, solida: true, nome: 'divisória' },
  notebook: { largura: 0.35, profundidade: 0.3, solida: false, nome: 'notebook' },
  planta_mesa: { largura: 0.2, profundidade: 0.2, solida: false, nome: 'planta' },
  pilha_livros: { largura: 0.25, profundidade: 0.2, solida: false, nome: 'livros' },
  quadro_a: { largura: 0.7, profundidade: 0.05, solida: false, deParede: true, nome: 'quadro' },
  quadro_b: { largura: 0.7, profundidade: 0.05, solida: false, deParede: true, nome: 'quadro' },
  relogio: { largura: 0.35, profundidade: 0.05, solida: false, deParede: true, nome: 'relógio' },
  janela: { largura: 1.3, profundidade: 0.15, solida: false, deParede: true, nome: 'janela' },
  quadro_avisos: { largura: 1.1, profundidade: 0.05, solida: false, deParede: true, nome: 'quadro de avisos' },
  lixeira: { largura: 0.32, profundidade: 0.32, solida: true, nome: 'lixeira' },
  cabideiro: { largura: 0.4, profundidade: 0.4, solida: true, nome: 'cabideiro' },
  vaso_alto: { largura: 0.4, profundidade: 0.4, solida: true, nome: 'cacto' },
  tapete_grande: { largura: 5.2, profundidade: 3.6, solida: false, nome: 'tapete' },
  tufo: { largura: 0.3, profundidade: 0.3, solida: false, nome: 'grama' },
  flores: { largura: 0.35, profundidade: 0.35, solida: false, nome: 'flores' },
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
