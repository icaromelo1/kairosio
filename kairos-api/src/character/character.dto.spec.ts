import { readFileSync } from 'fs'
import { join } from 'path'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { SaveCharacterDto } from './character.dto'

// A fonte de verdade dos presets vive no front. Este teste LÊ esse arquivo em vez
// de repetir a lista aqui: foi exatamente uma segunda lista, mantida à mão neste
// pacote, que fez todo salvamento de avatar voltar 400 quando o avatar procedural
// virou sprite. Se alguém acrescentar um preset lá, isto passa sozinho; se alguém
// apertar a validação aqui, isto quebra.
const PRESETS_PATH = join(
  __dirname,
  '../../../kairos-ui/src/game/furniture/avatar/presets.json',
)

function erros(payload: Record<string, unknown>): string[] {
  const dto = plainToInstance(SaveCharacterDto, payload)
  return validateSync(dto).flatMap((e) => Object.values(e.constraints ?? {}))
}

describe('SaveCharacterDto', () => {
  const presets = JSON.parse(readFileSync(PRESETS_PATH, 'utf8')) as { id: string }[]

  it('encontra os presets do front', () => {
    expect(presets.length).toBeGreaterThan(0)
  })

  it.each(presets.map((p) => p.id))('aceita o preset %s', (id) => {
    expect(erros({ hairStyle: id })).toEqual([])
  })

  it('aceita os estilos antigos que já estão gravados no banco', () => {
    for (const antigo of ['short', 'curly', 'ponytail', 'mohawk', 'helmet', 'buzz', 'long']) {
      expect(erros({ hairStyle: antigo })).toEqual([])
    }
  })

  it('recusa id fora do formato', () => {
    expect(erros({ hairStyle: '../../etc/passwd' })).not.toEqual([])
    expect(erros({ hairStyle: 'COM MAIUSCULA' })).not.toEqual([])
    expect(erros({ hairStyle: 'x'.repeat(41) })).not.toEqual([])
  })

  it('aceita um payload completo do painel de personagem', () => {
    expect(
      erros({
        hairStyle: presets[0].id,
        hairColor: '#c0632a',
        skin: '#f0c8a0',
        topColor: '#3aa76d',
        pantsColor: '#4a5568',
      }),
    ).toEqual([])
  })

  it('segue recusando cor que não é hex', () => {
    expect(erros({ hairColor: 'vermelho' })).not.toEqual([])
  })
})
