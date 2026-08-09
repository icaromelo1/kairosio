import { AVATAR_PRESETS } from '@/game/pixi/avatar'
import { acervo as lerAcervo, aleatorio, catalogo, criar, type Avatar } from './avatares.api'

/** Um avatar do acervo já com o nome legível do corpo, que é o que a tela mostra. */
export interface OpcaoDeAvatar {
  id: string
  base: string
  nome: string
  pele: string | null
  cabelo: string | null
  roupa: string | null
}

const NOME_DO_CORPO = new Map(AVATAR_PRESETS.map((p) => [p.id, p.nome]))

function comNome(a: Avatar): OpcaoDeAvatar {
  return {
    id: a.id,
    base: a.base,
    nome: NOME_DO_CORPO.get(a.base) ?? a.base,
    pele: a.pele,
    cabelo: a.cabelo,
    roupa: a.roupa,
  }
}

export async function acervoDoSeletor(): Promise<OpcaoDeAvatar[]> {
  return (await catalogo()).map(comNome)
}

export async function aleatorioDoAcervo(): Promise<OpcaoDeAvatar | null> {
  const a = await aleatorio()
  return a ? comNome(a) : null
}

export interface Rascunho {
  base: string
  pele: string | null
  cabelo: string | null
  roupa: string | null
}

const mesmo = (a: Rascunho, b: { base: string; pele: string | null; cabelo: string | null; roupa: string | null }) =>
  a.base === b.base && a.pele === b.pele && a.cabelo === b.cabelo && a.roupa === b.roupa

/**
 * Devolve o id do avatar correspondente ao rascunho, criando um só se ainda não
 * existir igual.
 *
 * É aqui que "escolher um pronto" e "editar" se separam: escolher um pronto sem
 * mexer reaproveita a linha que já existe, e só a combinação inédita vira avatar
 * novo com dono. Sem essa comparação, entrar no jogo sem tocar em nada criaria uma
 * linha por pessoa e o sorteio ficaria cheio de cópias do mesmo boneco.
 */
export async function garantirAvatar(rascunho: Rascunho): Promise<string> {
  const oferecidos = await catalogo()
  const pronto = oferecidos.find((a) => mesmo(rascunho, a))
  if (pronto) return pronto.id
  const novo = await criar({
    base: rascunho.base,
    pele: rascunho.pele,
    cabelo: rascunho.cabelo,
    roupa: rascunho.roupa,
  })
  return novo.id
}

export { lerAcervo }
