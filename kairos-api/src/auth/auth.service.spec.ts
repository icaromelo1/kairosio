import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { User } from '../user/user.entity'

class FakeUserRepo {
  rows: any[] = []
  private seq = 0

  create(data: Partial<User>) {
    return { username: null, usernameLower: null, usernameChangedAt: null, isGuest: false, ...data }
  }

  async findOne({ where }: any) {
    return this.rows.find((row) => Object.entries(where).every(([k, v]) => row[k] === v)) ?? null
  }

  async save(row: any) {
    if (!row.id) {
      row.id = `u${++this.seq}`
      this.rows.push(row)
    }
    return row
  }

  async delete() {}
}

function makeService() {
  const users = new FakeUserRepo()
  const service = new AuthService(users as any, { delete: async () => {} } as any, {
    sign: () => 'token',
  } as any)
  return { service, users }
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ response: { code } })
}

describe('AuthService — cadastro com @nome', () => {
  it('guarda o nome como digitado e o normalizado pra unicidade', async () => {
    const { service, users } = makeService()
    await service.register('a@b.com', 'segredo', 'Icaro')
    expect(users.rows[0].username).toBe('Icaro')
    expect(users.rows[0].usernameLower).toBe('icaro')
    expect(users.rows[0].usernameChangedAt).toBeNull()
  })

  it('recusa o mesmo nome em outra grafia', async () => {
    const { service } = makeService()
    await service.register('a@b.com', 'segredo', 'icaro')
    const outro = service.register('c@d.com', 'segredo', 'ICARO')
    await expect(outro).rejects.toBeInstanceOf(ConflictException)
    await expectCode(outro, 'username-taken')
  })

  it('distingue email repetido de nome repetido', async () => {
    const { service } = makeService()
    await service.register('a@b.com', 'segredo', 'icaro')
    await expectCode(service.register('a@b.com', 'segredo', 'outro'), 'email-exists')
  })

  it('recusa nome reservado', async () => {
    const { service } = makeService()
    const p = service.register('a@b.com', 'segredo', 'admin')
    await expect(p).rejects.toBeInstanceOf(BadRequestException)
    await expectCode(p, 'username-reserved')
  })

  it('recusa nome inválido', async () => {
    const { service } = makeService()
    for (const nome of ['ab', '.icaro', 'icaro.', 'ica..ro', 'Icaro Melo']) {
      await expectCode(service.register(`${nome}@b.com`.replace(/[^\w@.]/g, ''), 'segredo', nome), 'username-invalid')
    }
  })

  it('convidado nasce sem nome', async () => {
    const { service, users } = makeService()
    await service.loginAsGuest()
    expect(users.rows[0].isGuest).toBe(true)
    expect(users.rows[0].username).toBeNull()
  })
})

describe('AuthService — disponibilidade', () => {
  it('responde livre, em uso, formato e reservado', async () => {
    const { service } = makeService()
    await service.register('a@b.com', 'segredo', 'icaro')
    expect(await service.usernameStatus('outro')).toEqual({ disponivel: true })
    expect(await service.usernameStatus('ICARO')).toEqual({ disponivel: false, motivo: 'em-uso' })
    expect(await service.usernameStatus('ab')).toEqual({ disponivel: false, motivo: 'formato' })
    expect(await service.usernameStatus('admin')).toEqual({ disponivel: false, motivo: 'reservado' })
  })
})

describe('AuthService — troca de @nome', () => {
  it('troca uma vez e barra a segunda por 30 dias', async () => {
    const { service, users } = makeService()
    await service.register('a@b.com', 'segredo', 'icaro')
    const id = users.rows[0].id

    const primeira = await service.changeUsername(id, 'icaro.melo')
    expect(primeira.username).toBe('icaro.melo')
    expect(primeira.proximaTrocaEm).not.toBeNull()

    await expectCode(service.changeUsername(id, 'outronome'), 'username-cooldown')
    expect(users.rows[0].username).toBe('icaro.melo')
  })

  it('libera a troca quando os 30 dias passam', async () => {
    const { service, users } = makeService()
    await service.register('a@b.com', 'segredo', 'icaro')
    users.rows[0].usernameChangedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    const trocou = await service.changeUsername(users.rows[0].id, 'icaro.melo')
    expect(trocou.username).toBe('icaro.melo')
  })

  it('conta antiga sem nome adota o primeiro sem começar a espera', async () => {
    const { service, users } = makeService()
    const antiga = await users.save(users.create({ email: 'velha@b.com' }))
    const adotou = await service.changeUsername(antiga.id, 'velhaguarda')
    expect(adotou.username).toBe('velhaguarda')
    expect(adotou.proximaTrocaEm).toBeNull()
  })

  it('corrigir só a grafia não gasta a troca', async () => {
    const { service, users } = makeService()
    await service.register('a@b.com', 'segredo', 'icaro')
    const ajustou = await service.changeUsername(users.rows[0].id, 'Icaro')
    expect(ajustou.username).toBe('Icaro')
    expect(ajustou.proximaTrocaEm).toBeNull()
  })

  it('recusa trocar pro nome de outra pessoa', async () => {
    const { service, users } = makeService()
    await service.register('a@b.com', 'segredo', 'icaro')
    await service.register('c@d.com', 'segredo', 'isabelle')
    await expectCode(service.changeUsername(users.rows[0].id, 'Isabelle'), 'username-taken')
  })

  it('convidado não tem nome pra trocar', async () => {
    const { service, users } = makeService()
    await service.loginAsGuest()
    const p = service.changeUsername(users.rows[0].id, 'convidadinho')
    await expect(p).rejects.toBeInstanceOf(ForbiddenException)
    await expectCode(p, 'guest-no-username')
  })
})
