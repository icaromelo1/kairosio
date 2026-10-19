export type Slot = 'cabelo' | 'chapeu' | 'rosto' | 'cima' | 'baixo' | 'sapato' | 'acessorio'

export interface Peca {
  id: string
  slot: Slot
  nome: string
  malha: string | null
  somemComChapeu?: boolean
}

export interface DefinicaoSlot {
  slot: Slot
  nome: string
  material: string
  colorivel: boolean
}

export interface Aparencia {
  v: 1
  pele: string
  corCabelo: string
  pecas: Record<Slot, { id: string; cor: string }>
}

export const SLOTS: DefinicaoSlot[] = [
  { slot: 'cabelo', nome: 'Cabelo', material: 'tinta_cabelo', colorivel: false },
  { slot: 'chapeu', nome: 'Chapéu', material: 'tinta_chapeu', colorivel: true },
  { slot: 'rosto', nome: 'Rosto', material: 'tinta_rosto', colorivel: true },
  { slot: 'cima', nome: 'Parte de cima', material: 'tinta_cima', colorivel: true },
  { slot: 'baixo', nome: 'Parte de baixo', material: 'tinta_baixo', colorivel: true },
  { slot: 'sapato', nome: 'Sapato', material: 'tinta_sapato', colorivel: true },
  { slot: 'acessorio', nome: 'Acessório', material: 'tinta_acessorio', colorivel: true },
]

export const PECAS: Peca[] = [
  { id: 'curto', slot: 'cabelo', nome: 'Curto', malha: 'cabelo_curto' },
  { id: 'topete', slot: 'cabelo', nome: 'Topete', malha: 'cabelo_topete' },
  { id: 'longo', slot: 'cabelo', nome: 'Longo', malha: 'cabelo_longo' },
  { id: 'coque', slot: 'cabelo', nome: 'Coque', malha: 'cabelo_coque', somemComChapeu: true },
  { id: 'cacheado', slot: 'cabelo', nome: 'Cacheado', malha: 'cabelo_cacheado', somemComChapeu: true },
  { id: 'moicano', slot: 'cabelo', nome: 'Moicano', malha: 'cabelo_moicano', somemComChapeu: true },
  { id: 'careca', slot: 'cabelo', nome: 'Careca', malha: null },
  { id: 'nenhum', slot: 'chapeu', nome: 'Nenhum', malha: null },
  { id: 'bone', slot: 'chapeu', nome: 'Boné', malha: 'chapeu_bone' },
  { id: 'gorro', slot: 'chapeu', nome: 'Gorro', malha: 'chapeu_gorro' },
  { id: 'fedora', slot: 'chapeu', nome: 'Chapéu', malha: 'chapeu_fedora' },
  { id: 'fones', slot: 'chapeu', nome: 'Fones', malha: 'chapeu_fones' },
  { id: 'nenhum', slot: 'rosto', nome: 'Nenhum', malha: null },
  { id: 'oculos', slot: 'rosto', nome: 'Óculos', malha: 'rosto_oculos' },
  { id: 'oculos_sol', slot: 'rosto', nome: 'Óculos escuros', malha: 'rosto_oculos_sol' },
  { id: 'barba', slot: 'rosto', nome: 'Barba', malha: 'rosto_barba' },
  { id: 'bigode', slot: 'rosto', nome: 'Bigode', malha: 'rosto_bigode' },
  { id: 'camiseta', slot: 'cima', nome: 'Camiseta', malha: 'cima_camiseta' },
  { id: 'moletom', slot: 'cima', nome: 'Moletom', malha: 'cima_moletom' },
  { id: 'camisa', slot: 'cima', nome: 'Camisa', malha: 'cima_camisa' },
  { id: 'regata', slot: 'cima', nome: 'Regata', malha: 'cima_regata' },
  { id: 'jaqueta', slot: 'cima', nome: 'Jaqueta', malha: 'cima_jaqueta' },
  { id: 'calca', slot: 'baixo', nome: 'Calça', malha: 'baixo_calca' },
  { id: 'bermuda', slot: 'baixo', nome: 'Bermuda', malha: 'baixo_bermuda' },
  { id: 'saia', slot: 'baixo', nome: 'Saia', malha: 'baixo_saia' },
  { id: 'tenis', slot: 'sapato', nome: 'Tênis', malha: 'sapato_tenis' },
  { id: 'bota', slot: 'sapato', nome: 'Bota', malha: 'sapato_bota' },
  { id: 'social', slot: 'sapato', nome: 'Social', malha: 'sapato_social' },
  { id: 'chinelo', slot: 'sapato', nome: 'Chinelo', malha: 'sapato_chinelo' },
  { id: 'nenhum', slot: 'acessorio', nome: 'Nenhum', malha: null },
  { id: 'mochila', slot: 'acessorio', nome: 'Mochila', malha: 'acessorio_mochila' },
  { id: 'cachecol', slot: 'acessorio', nome: 'Cachecol', malha: 'acessorio_cachecol' },
  { id: 'cracha', slot: 'acessorio', nome: 'Crachá', malha: 'acessorio_cracha' },
  { id: 'bolsa', slot: 'acessorio', nome: 'Bolsa', malha: 'acessorio_bolsa' },
]

export const TONS_DE_PELE = ['#f6d5b8', '#e8b894', '#d49a6a', '#b07850', '#8a5a3b', '#5e3b26']
export const CORES_DE_CABELO = ['#1f1a17', '#3d2817', '#7a4a26', '#c98a3a', '#e3c27a', '#b5462e', '#9a9a9a', '#6b4fa8', '#2f7f9e']
export const CORES_DE_ROUPA = [
  '#2c7441', '#2f3d5c', '#4d6fa3', '#c0392b', '#d9a441', '#9b4a5a', '#f0eee8', '#26262b', '#7a5232', '#e07a5f', '#6b4fa8', '#3aa4a0',
]

export function pecasDo(slot: Slot): Peca[] {
  return PECAS.filter((p) => p.slot === slot)
}

export function pecaDe(slot: Slot, id: string): Peca | null {
  return PECAS.find((p) => p.slot === slot && p.id === id) ?? null
}

export const APARENCIA_PADRAO: Aparencia = {
  v: 1,
  pele: '#e8b894',
  corCabelo: '#3d2817',
  pecas: {
    cabelo: { id: 'curto', cor: '#3d2817' },
    chapeu: { id: 'nenhum', cor: '#c0392b' },
    rosto: { id: 'nenhum', cor: '#26262b' },
    cima: { id: 'camiseta', cor: '#2c7441' },
    baixo: { id: 'calca', cor: '#2f3d5c' },
    sapato: { id: 'tenis', cor: '#f0eee8' },
    acessorio: { id: 'nenhum', cor: '#d9a441' },
  },
}

const HEX = /^#[0-9a-fA-F]{6}$/

export function sanitizarAparencia(bruta: unknown): Aparencia {
  const base = structuredClone(APARENCIA_PADRAO)
  if (!bruta || typeof bruta !== 'object') return base
  const a = bruta as Partial<Aparencia>
  if (typeof a.pele === 'string' && HEX.test(a.pele)) base.pele = a.pele
  if (typeof a.corCabelo === 'string' && HEX.test(a.corCabelo)) base.corCabelo = a.corCabelo
  const pecas = (a.pecas ?? {}) as Partial<Aparencia['pecas']>
  for (const { slot } of SLOTS) {
    const item = pecas[slot]
    if (!item || typeof item !== 'object') continue
    if (typeof item.id === 'string' && pecaDe(slot, item.id)) base.pecas[slot].id = item.id
    if (typeof item.cor === 'string' && HEX.test(item.cor)) base.pecas[slot].cor = item.cor
  }
  return base
}

function sortear<T>(lista: T[]): T {
  return lista[Math.floor(Math.random() * lista.length)]
}

export function aparenciaAleatoria(): Aparencia {
  const corCabelo = sortear(CORES_DE_CABELO)
  const aparencia: Aparencia = { v: 1, pele: sortear(TONS_DE_PELE), corCabelo, pecas: structuredClone(APARENCIA_PADRAO.pecas) }
  for (const { slot } of SLOTS) {
    const opcoes = pecasDo(slot)
    const vazio = opcoes.find((p) => p.id === 'nenhum')
    const peca = vazio && Math.random() < 0.55 ? vazio : sortear(opcoes)
    aparencia.pecas[slot] = { id: peca.id, cor: sortear(CORES_DE_ROUPA) }
  }
  aparencia.pecas.cabelo.cor = corCabelo
  return aparencia
}

function preset(pele: string, corCabelo: string, pecas: Partial<Record<Slot, [string, string]>>): Aparencia {
  const aparencia: Aparencia = { v: 1, pele, corCabelo, pecas: structuredClone(APARENCIA_PADRAO.pecas) }
  for (const [slot, [id, cor]] of Object.entries(pecas) as [Slot, [string, string]][]) aparencia.pecas[slot] = { id, cor }
  return aparencia
}

export const PRESETS: { nome: string; aparencia: Aparencia }[] = [
  { nome: 'Dev', aparencia: preset('#e8b894', '#3d2817', { cabelo: ['curto', '#3d2817'], chapeu: ['fones', '#26262b'], cima: ['moletom', '#26262b'], baixo: ['calca', '#2f3d5c'], sapato: ['tenis', '#f0eee8'] }) },
  { nome: 'Design', aparencia: preset('#d49a6a', '#6b4fa8', { cabelo: ['coque', '#6b4fa8'], rosto: ['oculos', '#c0392b'], cima: ['camiseta', '#e07a5f'], baixo: ['saia', '#26262b'], sapato: ['bota', '#7a5232'], acessorio: ['bolsa', '#d9a441'] }) },
  { nome: 'Gestão', aparencia: preset('#8a5a3b', '#1f1a17', { cabelo: ['curto', '#1f1a17'], rosto: ['barba', '#26262b'], cima: ['jaqueta', '#2f3d5c'], baixo: ['calca', '#26262b'], sapato: ['social', '#26262b'], acessorio: ['cracha', '#2c7441'] }) },
  { nome: 'Estagiário', aparencia: preset('#f6d5b8', '#c98a3a', { cabelo: ['topete', '#c98a3a'], chapeu: ['bone', '#4d6fa3'], cima: ['regata', '#d9a441'], baixo: ['bermuda', '#3aa4a0'], sapato: ['chinelo', '#c0392b'], acessorio: ['mochila', '#2c7441'] }) },
]
