export const MAX_PEDIDOS_PENDENTES = 50

export type FriendshipStatus = 'pendente' | 'aceita' | 'bloqueada'

export interface FriendPair {
  userAId: string
  userBId: string
}

export function friendPair(x: string, y: string): FriendPair {
  return x < y ? { userAId: x, userBId: y } : { userAId: y, userBId: x }
}

export function isParty(pair: FriendPair, userId: string): boolean {
  return pair.userAId === userId || pair.userBId === userId
}

export function otherSide(pair: FriendPair, userId: string): string {
  return pair.userAId === userId ? pair.userBId : pair.userAId
}

export function stripAt(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/^@+/, '')
}
