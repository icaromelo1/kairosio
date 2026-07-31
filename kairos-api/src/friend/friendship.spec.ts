import { friendPair, isParty, otherSide, stripAt } from './friendship'

describe('friendPair', () => {
  it('guarda o par na mesma ordem, venha de que lado vier', () => {
    expect(friendPair('a', 'b')).toEqual({ userAId: 'a', userBId: 'b' })
    expect(friendPair('b', 'a')).toEqual({ userAId: 'a', userBId: 'b' })
  })

  it('produz a mesma chave pros dois sentidos do pedido', () => {
    const ida = friendPair('u9', 'u1')
    const volta = friendPair('u1', 'u9')
    expect(ida).toEqual(volta)
  })
})

describe('otherSide', () => {
  it('devolve sempre o outro, de qualquer lado do par', () => {
    const par = friendPair('u1', 'u2')
    expect(otherSide(par, 'u1')).toBe('u2')
    expect(otherSide(par, 'u2')).toBe('u1')
  })
})

describe('isParty', () => {
  it('reconhece só quem está no par', () => {
    const par = friendPair('u1', 'u2')
    expect(isParty(par, 'u1')).toBe(true)
    expect(isParty(par, 'u2')).toBe(true)
    expect(isParty(par, 'u3')).toBe(false)
  })
})

describe('stripAt', () => {
  it('aceita o nome com ou sem @', () => {
    expect(stripAt('@icaro')).toBe('icaro')
    expect(stripAt('icaro')).toBe('icaro')
    expect(stripAt('  @icaro  ')).toBe('icaro')
    expect(stripAt('@@icaro')).toBe('icaro')
  })

  it('não engole o @ do meio', () => {
    expect(stripAt('ica@ro')).toBe('ica@ro')
  })
})
