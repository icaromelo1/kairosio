import { checkUsername, nextUsernameChangeAt, normalizeUsername } from './username'

describe('checkUsername', () => {
  it('aceita nome comum', () => {
    expect(checkUsername('icaro')).toBeNull()
    expect(checkUsername('ica.ro')).toBeNull()
    expect(checkUsername('ica_ro_99')).toBeNull()
    expect(checkUsername('abc')).toBeNull()
    expect(checkUsername('a'.repeat(20))).toBeNull()
  })

  it('aceita maiúscula, que é guardada como digitada', () => {
    expect(checkUsername('Icaro')).toBeNull()
    expect(normalizeUsername('Icaro')).toBe('icaro')
  })

  it('recusa fora de 3 a 20 caracteres', () => {
    expect(checkUsername('ab')).toBe('formato')
    expect(checkUsername('a'.repeat(21))).toBe('formato')
    expect(checkUsername('')).toBe('formato')
  })

  it('recusa caractere de fora do conjunto', () => {
    expect(checkUsername('Icaro Melo')).toBe('formato')
    expect(checkUsername('icaro-melo')).toBe('formato')
    expect(checkUsername('@icaro')).toBe('formato')
    expect(checkUsername('içaro')).toBe('formato')
  })

  it('recusa ponto na ponta e pontos seguidos', () => {
    expect(checkUsername('.icaro')).toBe('formato')
    expect(checkUsername('icaro.')).toBe('formato')
    expect(checkUsername('ica..ro')).toBe('formato')
  })

  it('recusa reservado em qualquer grafia', () => {
    expect(checkUsername('admin')).toBe('reservado')
    expect(checkUsername('ADMIN')).toBe('reservado')
    expect(checkUsername('kairos')).toBe('reservado')
    expect(checkUsername('suporte')).toBe('reservado')
    expect(checkUsername('sistema')).toBe('reservado')
    expect(checkUsername('moderador')).toBe('reservado')
  })

  it('ignora espaço em volta', () => {
    expect(checkUsername('  icaro  ')).toBeNull()
    expect(normalizeUsername('  Icaro  ')).toBe('icaro')
  })
})

describe('nextUsernameChangeAt', () => {
  it('não existe pra quem nunca trocou', () => {
    expect(nextUsernameChangeAt(null)).toBeNull()
  })

  it('cai 30 dias depois da última troca', () => {
    const trocou = new Date('2026-07-31T12:00:00.000Z')
    expect(nextUsernameChangeAt(trocou)?.toISOString()).toBe('2026-08-30T12:00:00.000Z')
  })
})
