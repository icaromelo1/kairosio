import { ref, watch } from 'vue'

export type Qualidade = 'nitido' | 'leve' | 'pixel' | 'retro'

export const QUALIDADES: { id: Qualidade; nome: string; descricao: string; pixel: number; paleta: boolean }[] = [
  { id: 'nitido', nome: 'Nítido', descricao: 'Resolução cheia e bordas suaves. A melhor imagem.', pixel: 1, paleta: false },
  { id: 'leve', nome: 'Pixel leve', descricao: 'Pixels de 2×, cores completas.', pixel: 2, paleta: false },
  { id: 'pixel', nome: 'Pixel art', descricao: 'Pixels de 3× e paleta reduzida.', pixel: 3, paleta: true },
  { id: 'retro', nome: 'Retrô', descricao: 'Pixels de 4× e paleta reduzida. O mais pixelado.', pixel: 4, paleta: true },
]

const CHAVE = 'kairos_grafico'

function ler(): Qualidade {
  try {
    const salvo = localStorage.getItem(CHAVE)
    return QUALIDADES.some((q) => q.id === salvo) ? (salvo as Qualidade) : 'nitido'
  } catch {
    return 'nitido'
  }
}

export const qualidade = ref<Qualidade>(ler())

watch(qualidade, (valor) => {
  try {
    localStorage.setItem(CHAVE, valor)
  } catch {
    return
  }
})

export function configuracaoDe(id: Qualidade) {
  return QUALIDADES.find((q) => q.id === id) ?? QUALIDADES[0]
}
