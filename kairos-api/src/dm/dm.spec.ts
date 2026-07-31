import { DM_PREVIA_MAX, decodeCursor, encodeCursor, normalizeTexto, previa } from './dm'

describe('cursor da paginação', () => {
  it('volta exatamente a data e o id que entraram', () => {
    const enviadaEm = new Date('2026-07-31T12:00:00.123Z')
    const id = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
    const cursor = decodeCursor(encodeCursor(enviadaEm, id))
    expect(cursor?.enviadaEm.getTime()).toBe(enviadaEm.getTime())
    expect(cursor?.id).toBe(id)
  })

  it('não usa caractere que precise de escape na query string', () => {
    const cursor = encodeCursor(new Date('2026-07-31T12:00:00.123Z'), 'abc-123')
    expect(encodeURIComponent(cursor)).toBe(cursor)
  })

  it('recusa cursor quebrado em vez de virar página um', () => {
    expect(decodeCursor('')).toBeNull()
    expect(decodeCursor('sem-separador')).toBeNull()
    expect(decodeCursor('_sem-data')).toBeNull()
    expect(decodeCursor('ontem_id')).toBeNull()
    expect(decodeCursor('2026-13-45T99:99:99Z_id')).toBeNull()
    expect(decodeCursor('1785513600123_')).toBeNull()
    expect(decodeCursor(undefined)).toBeNull()
  })
})

describe('texto', () => {
  it('só espaço não é mensagem', () => {
    expect(normalizeTexto('   \n ')).toBe('')
    expect(normalizeTexto('  oi  ')).toBe('oi')
    expect(normalizeTexto(undefined)).toBe('')
  })

  it('a prévia da lista de conversas não carrega a mensagem inteira', () => {
    expect(previa('x'.repeat(500))).toHaveLength(DM_PREVIA_MAX)
    expect(previa('curta')).toBe('curta')
  })
})
