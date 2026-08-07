import { readFileSync } from 'fs'
import { join } from 'path'

// sanitizeAvatar não é exportada — o teste replica a única regra que importa
// aqui: qual formato de hairStyle sobrevive ao trânsito. Se alguém voltar a
// enumerar valores no gateway, isto quebra.
const FONTE = readFileSync(join(__dirname, 'presence.gateway.ts'), 'utf8')
const PRESETS_PATH = join(__dirname, '../../../kairos-ui/src/game/furniture/avatar/presets.json')

describe('sanitizeAvatar — hairStyle no trânsito', () => {
  const presets = JSON.parse(readFileSync(PRESETS_PATH, 'utf8')) as { id: string }[]

  it('encontra os presets do front', () => {
    expect(presets.length).toBeGreaterThan(0)
  })

  it('o gateway NÃO enumera estilos de cabelo', () => {
    // a lista fechada fazia todo mundo aparecer como o preset padrão pros outros
    expect(FONTE).not.toMatch(/new Set\(\[\s*'short'/)
    expect(FONTE).toMatch(/PRESET_ID\s*=\s*\/\^\[a-z0-9-\]/)
  })

  it.each(presets.map((p) => p.id))('o preset %s passa no formato aceito', (id) => {
    const m = /const PRESET_ID = (\/.*\/)\n/.exec(FONTE)
    expect(m).not.toBeNull()
    const re = new RegExp(m![1].slice(1, -1))
    expect(re.test(id)).toBe(true)
  })

  it('recusa id fora do formato', () => {
    const m = /const PRESET_ID = (\/.*\/)\n/.exec(FONTE)
    const re = new RegExp(m![1].slice(1, -1))
    for (const ruim of ['../../etc/passwd', 'COM MAIUSCULA', 'x'.repeat(41), '']) {
      expect(re.test(ruim)).toBe(false)
    }
  })
})
