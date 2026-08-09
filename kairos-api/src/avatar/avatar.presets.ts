// Vocabulário canônico dos corpos do acervo.
//
// Tem que ser IDÊNTICO a kairos-ui/src/game/furniture/avatar/presets.json, porque o
// front é quem tem os sprites e as máscaras: um `base` gravado aqui que não exista lá
// vira boneco sem arte. É o mesmo acoplamento que produziu o antigo hairStyle 'short'
// apontando pra corpo inexistente, e por isso scripts/restos.mjs compara os dois.
interface CorpoBase {
  id: string
  nome: string
}

export const CORPOS: CorpoBase[] = [
  { id: 'ruivo-verde', nome: 'Ruivo de camiseta verde' },
  { id: 'ruiva-vermelha', nome: 'Ruiva de blusa vermelha' },
  { id: 'cabelo-lilas', nome: 'Cabelo lilás' },
  { id: 'operario', nome: 'Capacete de operário' },
  { id: 'idoso', nome: 'Idoso de camisa azul' },
  { id: 'moletom-marrom', nome: 'Moletom marrom' },
]


export const IDS_DE_CORPO = new Set(CORPOS.map((c) => c.id))
