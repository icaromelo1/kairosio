export const MAX_PEDIDOS_PENDENTES = 50

export type FriendshipStatus = 'pendente' | 'aceita' | 'bloqueada'

export interface FriendPair {
  userAId: string
  userBId: string
}

// o par de ids vira uma chave só, sempre na mesma ordem: sem isso "A pede a B" e
// "B pede a A" nasceriam como duas linhas diferentes e o UNIQUE não pegaria nenhuma
export function friendPair(x: string, y: string): FriendPair {
  return x < y ? { userAId: x, userBId: y } : { userAId: y, userBId: x }
}

export function isParty(pair: FriendPair, userId: string): boolean {
  return pair.userAId === userId || pair.userBId === userId
}

export function otherSide(pair: FriendPair, userId: string): string {
  return pair.userAId === userId ? pair.userBId : pair.userAId
}

// o "@" é enfeite da interface; o que existe no banco é o nome sem ele
export function stripAt(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/^@+/, '')
}
