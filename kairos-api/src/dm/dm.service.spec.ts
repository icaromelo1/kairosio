import { BadRequestException, ForbiddenException, HttpException, NotFoundException } from '@nestjs/common'
import { FindOperator } from 'typeorm'
import { FriendService } from '../friend/friend.service'
import { DmService } from './dm.service'
import { DmDelivery, DmEntrega } from './dm-delivery'
import { DM_INTERVALO_MIN_MS, DM_TEXTO_MAX, decodeCursor } from './dm'

class FakeRepo {
  rows: any[] = []
  falhaNoProximoSave: any = null
  escondeNoProximoFindOne = false
  private seq = 0

  constructor(private prefix: string) {}

  create(data: any) {
    return { ...data }
  }

  async save(row: any) {
    if (this.falhaNoProximoSave) {
      const err = this.falhaNoProximoSave
      this.falhaNoProximoSave = null
      throw err
    }
    if (!row.id) {
      row.id = `${this.prefix}${String(++this.seq).padStart(4, '0')}`
      // createdAt da mensagem vem do serviço (é o cursor da paginação): só preenche o que
      // o banco preencheria sozinho
      if (row.createdAt === undefined) row.createdAt = new Date()
      this.rows.push(row)
    }
    return row
  }

  async findOne({ where, order }: any) {
    if (this.escondeNoProximoFindOne) {
      this.escondeNoProximoFindOne = false
      return null
    }
    return this.ordenar(this.filtrar(where), order)[0] ?? null
  }

  async find({ where, order, take }: any = {}) {
    const rows = this.ordenar(this.filtrar(where), order)
    return take ? rows.slice(0, take) : rows
  }

  async count({ where }: any) {
    return this.filtrar(where).length
  }

  async delete(id: string) {
    this.rows = this.rows.filter((row) => row.id !== id)
  }

  private filtrar(where: any) {
    return this.rows.filter((row) => this.match(row, where))
  }

  private ordenar(rows: any[], order: any) {
    if (!order) return rows
    const campos = Object.entries(order)
    return [...rows].sort((a, b) => {
      for (const [campo, direcao] of campos) {
        const c = cmp(a[campo], b[campo])
        if (c) return (direcao === 'DESC' ? -1 : 1) * c
      }
      return 0
    })
  }

  private match(row: any, where: any): boolean {
    if (!where) return true
    const alternativas = Array.isArray(where) ? where : [where]
    return alternativas.some((w) =>
      Object.entries(w).every(([campo, valor]) => this.eq(row[campo], valor)),
    )
  }

  private eq(atual: any, esperado: any): boolean {
    if (esperado instanceof FindOperator) {
      if (esperado.type === 'in') return (esperado.value as any[]).includes(atual)
      if (esperado.type === 'lessThan') return cmp(atual, esperado.value) < 0
      if (esperado.type === 'moreThan') return cmp(atual, esperado.value) > 0
      if (esperado.type === 'not') return !this.eq(atual, esperado.value)
      throw new Error(`operador não emulado no fake: ${esperado.type}`)
    }
    return cmp(atual, esperado) === 0
  }
}

function cmp(a: any, b: any): number {
  const x = a instanceof Date ? a.getTime() : a
  const y = b instanceof Date ? b.getTime() : b
  if (x === y) return 0
  return x < y ? -1 : 1
}

// o perfil sai de um join com characters; aqui basta id e @nome
class FakeUserRepo extends FakeRepo {
  createQueryBuilder() {
    let ids: string[] = []
    const qb: any = {
      leftJoin: () => qb,
      select: () => qb,
      addSelect: () => qb,
      where: (_sql: string, params: any) => ((ids = params?.ids ?? []), qb),
      getRawMany: async () =>
        this.rows
          .filter((r) => ids.includes(r.id))
          .map((r) => ({ id: r.id, username: r.username, nome: null })),
    }
    return qb
  }
}

// reproduz em JS a contagem de não-lidas que no banco é um GROUP BY com join na conversa;
// a SQL de verdade é exercitada contra o Postgres, não aqui
class FakeMessageRepo extends FakeRepo {
  conversas: FakeRepo

  createQueryBuilder() {
    const params: any = {}
    const qb: any = {
      select: () => qb,
      addSelect: () => qb,
      innerJoin: () => qb,
      where: (_sql: string, p?: any) => (p && Object.assign(params, p), qb),
      andWhere: (_sql: string, p?: any) => (p && Object.assign(params, p), qb),
      groupBy: () => qb,
      getRawMany: async () => {
        const total = new Map<string, number>()
        for (const m of this.rows) {
          if (!params.ids?.includes(m.conversationId)) continue
          if (m.authorId === params.me) continue
          const conversa = this.conversas.rows.find((c) => c.id === m.conversationId)
          if (!conversa) continue
          const marca = conversa.userAId === params.me ? conversa.readAAt : conversa.readBAt
          if (marca && cmp(m.createdAt, marca) <= 0) continue
          total.set(m.conversationId, (total.get(m.conversationId) ?? 0) + 1)
        }
        return [...total].map(([id, t]) => ({ id, total: t }))
      },
    }
    return qb
  }
}

function makeService() {
  const friendships = new FakeRepo('f')
  const serverInvites = new FakeRepo('i')
  const users = new FakeUserRepo('u')
  const servers = new FakeRepo('s')
  const memberships = new FakeRepo('sm')
  const friends = new FriendService(
    friendships as any,
    serverInvites as any,
    users as any,
    servers as any,
    memberships as any,
  )

  const conversations = new FakeRepo('c')
  const messages = new FakeMessageRepo('m')
  messages.conversas = conversations
  const delivery = new DmDelivery()
  const entregues: DmEntrega[] = []
  delivery.register((e) => entregues.push(e))
  const service = new DmService(conversations as any, messages as any, friends, delivery)

  return { service, friends, friendships, users, conversations, messages, delivery, entregues }
}

type Ctx = ReturnType<typeof makeService>
type Dupla = Awaited<ReturnType<typeof dupla>>

async function novaConta(users: FakeRepo, username: string) {
  return users.save({
    email: `${username}@b.com`,
    username,
    usernameLower: username.toLowerCase(),
    isGuest: false,
  })
}

async function amizade(ctx: Ctx, de: any, paraUsername: string) {
  const alvo = ctx.users.rows.find((u) => u.usernameLower === paraUsername)
  const pedido = await ctx.friends.request(de.id, paraUsername)
  await ctx.friends.accept(alvo.id, pedido.id)
  return pedido.id
}

// relógio controlado: o intervalo mínimo entre envios é regra do serviço, e sem mexer no
// relógio dois envios seguidos cairiam no mesmo milissegundo — ordem de conversa e corte
// de não-lidas passariam a depender de empate de data
beforeEach(() => jest.useFakeTimers({ now: new Date('2026-07-31T12:00:00.000Z') }))
afterEach(() => jest.useRealTimers())

async function enviar(ctx: Ctx, de: string, para: string, texto: string) {
  jest.advanceTimersByTime(DM_INTERVALO_MIN_MS)
  return ctx.service.send(de, para, texto)
}

async function dupla() {
  const ctx = makeService()
  const a = await novaConta(ctx.users, 'icaro')
  const b = await novaConta(ctx.users, 'isabelle')
  const amizadeId = await amizade(ctx, a, 'isabelle')
  return { ...ctx, a, b, amizadeId }
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ response: { code } })
}

describe('DmService — conversa entre amigos', () => {
  it('A manda e B acha a mensagem no histórico', async () => {
    const ctx = await dupla()
    const enviada = await enviar(ctx, ctx.a.id, ctx.b.id, 'oi, tudo bem?')
    expect(enviada).toMatchObject({ texto: 'oi, tudo bem?', autorId: ctx.a.id, minha: true })

    const historico = await ctx.service.history(ctx.b.id, enviada.conversaId)
    expect(historico.mensagens).toHaveLength(1)
    expect(historico.mensagens[0]).toMatchObject({ texto: 'oi, tudo bem?', minha: false })
    expect(historico.proximoCursor).toBeNull()
  })

  it('a conversa aparece nas duas listas, com a prévia da última mensagem', async () => {
    const ctx = await dupla()
    await enviar(ctx, ctx.a.id, ctx.b.id, 'primeira')
    await enviar(ctx, ctx.b.id, ctx.a.id, 'última')

    const deA = await ctx.service.list(ctx.a.id)
    const deB = await ctx.service.list(ctx.b.id)
    expect(deA).toHaveLength(1)
    expect(deA[0].usuario?.username).toBe('isabelle')
    expect(deA[0].ultimaMensagem).toMatchObject({ texto: 'última', minha: false })
    expect(deB[0].usuario?.username).toBe('icaro')
    expect(deB[0].ultimaMensagem).toMatchObject({ texto: 'última', minha: true })
  })

  it('conversa mais recente primeiro', async () => {
    const ctx = await dupla()
    const c = await novaConta(ctx.users, 'terceira')
    await amizade(ctx, ctx.a, 'terceira')
    const comB = await enviar(ctx, ctx.a.id, ctx.b.id, 'pra B')
    const comC = await enviar(ctx, ctx.a.id, c.id, 'pra C')

    expect((await ctx.service.list(ctx.a.id)).map((v) => v.id)).toEqual([
      comC.conversaId,
      comB.conversaId,
    ])
  })

  it('quem não é parte da conversa não lê o histórico', async () => {
    const ctx = await dupla()
    const c = await novaConta(ctx.users, 'terceira')
    await amizade(ctx, ctx.a, 'terceira')
    const enviada = await enviar(ctx, ctx.a.id, ctx.b.id, 'segredo')

    await expect(ctx.service.history(c.id, enviada.conversaId)).rejects.toBeInstanceOf(
      NotFoundException,
    )
    await expect(ctx.service.markRead(c.id, enviada.conversaId)).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })
})

describe('DmService — uma conversa por par', () => {
  it('mandar dos dois lados não cria segunda conversa', async () => {
    const ctx = await dupla()
    await enviar(ctx, ctx.a.id, ctx.b.id, 'de A pra B')
    await enviar(ctx, ctx.b.id, ctx.a.id, 'de B pra A')
    expect(ctx.conversations.rows).toHaveLength(1)
    expect((await ctx.service.history(ctx.a.id, ctx.conversations.rows[0].id)).mensagens).toHaveLength(2)
  })

  it('grava o par sempre na mesma ordem, venha de que lado vier', async () => {
    const ctx = await dupla()
    await enviar(ctx, ctx.b.id, ctx.a.id, 'de B primeiro')
    const [conversa] = ctx.conversations.rows
    expect(conversa.userAId < conversa.userBId).toBe(true)
    expect([conversa.userAId, conversa.userBId].sort()).toEqual([ctx.a.id, ctx.b.id].sort())
  })

  it('os dois mandando no mesmo instante: quem perde o UNIQUE escreve na conversa do outro', async () => {
    const ctx = await dupla()
    const primeira = await enviar(ctx, ctx.a.id, ctx.b.id, 'de A')
    // B passa pela busca antes de a linha de A existir e só descobre no INSERT
    ctx.conversations.escondeNoProximoFindOne = true
    ctx.conversations.falhaNoProximoSave = Object.assign(new Error('duplicate key'), {
      code: '23505',
    })
    const segunda = await enviar(ctx, ctx.b.id, ctx.a.id, 'de B')

    expect(ctx.conversations.rows).toHaveLength(1)
    expect(segunda.conversaId).toBe(primeira.conversaId)
    expect((await ctx.service.history(ctx.a.id, primeira.conversaId)).mensagens).toHaveLength(2)
  })

  it('erro de banco que não é o UNIQUE não vira conversa silenciosa', async () => {
    const ctx = await dupla()
    ctx.conversations.falhaNoProximoSave = Object.assign(new Error('conexão caiu'), {
      code: '08006',
    })
    await expect(enviar(ctx, ctx.a.id, ctx.b.id, 'oi')).rejects.toThrow('conexão caiu')
    expect(ctx.messages.rows).toHaveLength(0)
  })
})

describe('DmService — só amigo aceito conversa', () => {
  it('estranho é recusado', async () => {
    const ctx = await dupla()
    const c = await novaConta(ctx.users, 'estranho')
    await expectCode(ctx.service.send(c.id, ctx.a.id, 'oi'), 'dm-sem-amizade')
    await expect(ctx.service.send(c.id, ctx.a.id, 'oi')).rejects.toBeInstanceOf(ForbiddenException)
    expect(ctx.conversations.rows).toHaveLength(0)
  })

  it('pedido de amizade ainda pendente não abre conversa', async () => {
    const ctx = makeService()
    const a = await novaConta(ctx.users, 'icaro')
    const b = await novaConta(ctx.users, 'isabelle')
    await ctx.friends.request(a.id, 'isabelle')
    await expectCode(ctx.service.send(a.id, b.id, 'oi'), 'dm-sem-amizade')
  })

  it('não dá pra mandar mensagem pra si mesmo', async () => {
    const ctx = await dupla()
    const p = ctx.service.send(ctx.a.id, ctx.a.id, 'oi eu')
    await expect(p).rejects.toBeInstanceOf(BadRequestException)
    await expectCode(p, 'dm-consigo')
  })

  it('a amizade é conferida a cada mensagem: desfeita no meio, a seguinte é recusada', async () => {
    const ctx = await dupla()
    await enviar(ctx, ctx.a.id, ctx.b.id, 'antes')
    await ctx.friends.remove(ctx.b.id, ctx.amizadeId)

    await expectCode(enviar(ctx, ctx.a.id, ctx.b.id, 'depois'), 'dm-sem-amizade')
    expect(ctx.messages.rows).toHaveLength(1)
  })

  it('bloqueio no meio também para as mensagens seguintes, dos dois lados', async () => {
    const ctx = await dupla()
    const conversa = await enviar(ctx, ctx.a.id, ctx.b.id, 'antes')
    await ctx.friends.block(ctx.b.id, ctx.amizadeId)

    await expectCode(enviar(ctx, ctx.a.id, ctx.b.id, 'depois'), 'dm-sem-amizade')
    await expectCode(enviar(ctx, ctx.b.id, ctx.a.id, 'depois'), 'dm-sem-amizade')
    await expectCode(ctx.service.history(ctx.a.id, conversa.conversaId), 'dm-sem-amizade')
  })

  it('sem amizade a conversa some da lista, mas o histórico volta se a amizade voltar', async () => {
    const ctx = await dupla()
    const enviada = await enviar(ctx, ctx.a.id, ctx.b.id, 'oi')
    await ctx.friends.remove(ctx.b.id, ctx.amizadeId)
    expect(await ctx.service.list(ctx.a.id)).toEqual([])
    await expectCode(ctx.service.history(ctx.a.id, enviada.conversaId), 'dm-sem-amizade')

    await amizade(ctx, ctx.a, 'isabelle')
    expect(await ctx.service.list(ctx.a.id)).toHaveLength(1)
    expect((await ctx.service.history(ctx.a.id, enviada.conversaId)).mensagens).toHaveLength(1)
    expect(ctx.conversations.rows).toHaveLength(1)
  })
})

describe('DmService — não-lidas', () => {
  it('conta só o que o outro mandou depois da minha última leitura', async () => {
    const ctx = await dupla()
    const enviada = await enviar(ctx, ctx.a.id, ctx.b.id, 'uma')
    await enviar(ctx, ctx.a.id, ctx.b.id, 'duas')

    expect((await ctx.service.list(ctx.b.id))[0].naoLidas).toBe(2)
    // o que eu mesmo mandei nunca conta como não lido
    expect((await ctx.service.list(ctx.a.id))[0].naoLidas).toBe(0)

    await ctx.service.markRead(ctx.b.id, enviada.conversaId)
    expect((await ctx.service.list(ctx.b.id))[0].naoLidas).toBe(0)

    await enviar(ctx, ctx.a.id, ctx.b.id, 'três')
    expect((await ctx.service.list(ctx.b.id))[0].naoLidas).toBe(1)
  })

  it('marcar como lida não mexe na marca do outro lado', async () => {
    const ctx = await dupla()
    const enviada = await enviar(ctx, ctx.a.id, ctx.b.id, 'oi')
    await enviar(ctx, ctx.b.id, ctx.a.id, 'oi de volta')
    await ctx.service.markRead(ctx.b.id, enviada.conversaId)

    expect((await ctx.service.list(ctx.a.id))[0].naoLidas).toBe(1)
    expect((await ctx.service.list(ctx.b.id))[0].naoLidas).toBe(0)
  })
})

describe('DmService — paginação do histórico', () => {
  async function comMensagens(quantas: number) {
    const ctx = await dupla()
    let conversaId = ''
    for (let i = 1; i <= quantas; i++) {
      const enviada = await enviar(ctx, ctx.a.id, ctx.b.id, `mensagem ${i}`)
      conversaId = enviada.conversaId
    }
    return { ...ctx, conversaId }
  }

  async function paginar(ctx: Dupla & { conversaId: string }, limit: number) {
    const paginas: string[][] = []
    let cursor: string | null | undefined
    do {
      const pagina = await ctx.service.history(ctx.a.id, ctx.conversaId, cursor ?? undefined, limit)
      paginas.push(pagina.mensagens.map((m) => m.id))
      cursor = pagina.proximoCursor
    } while (cursor)
    return paginas
  }

  it('anda do mais recente para o mais antigo sem repetir nem pular', async () => {
    const ctx = await comMensagens(30)
    const paginas = await paginar(ctx, 12)

    expect(paginas.map((p) => p.length)).toEqual([12, 12, 6])
    const ids = paginas.flat()
    expect(new Set(ids).size).toBe(30)
    const esperado = [...ctx.messages.rows]
      .sort((x, y) => cmp(y.createdAt, x.createdAt) || (y.id < x.id ? -1 : 1))
      .map((m) => m.id)
    expect(ids).toEqual(esperado)
  })

  it('a primeira página traz a mensagem mais nova', async () => {
    const ctx = await comMensagens(30)
    const pagina = await ctx.service.history(ctx.a.id, ctx.conversaId, undefined, 5)
    expect(pagina.mensagens[0].texto).toBe('mensagem 30')
    expect(pagina.mensagens[4].texto).toBe('mensagem 26')
    expect(pagina.proximoCursor).not.toBeNull()
  })

  it('mensagens no mesmo milissegundo não se perdem entre páginas', async () => {
    const ctx = await dupla()
    const enviada = await enviar(ctx, ctx.a.id, ctx.b.id, 'primeira')
    await enviar(ctx, ctx.a.id, ctx.b.id, 'segunda')
    await enviar(ctx, ctx.a.id, ctx.b.id, 'terceira')
    const empate = new Date('2026-07-31T12:00:00.123Z')
    for (const m of ctx.messages.rows) m.createdAt = empate

    const paginas = await paginar({ ...ctx, conversaId: enviada.conversaId }, 1)
    expect(paginas.flat()).toHaveLength(3)
    expect(new Set(paginas.flat()).size).toBe(3)
  })

  it('cursor inventado é recusado em vez de devolver a primeira página', async () => {
    const ctx = await comMensagens(2)
    await expectCode(
      ctx.service.history(ctx.a.id, ctx.conversaId, 'nada-a-ver'),
      'dm-cursor-invalido',
    )
  })

  it('o cursor aponta pra mensagem mais antiga da página', async () => {
    const ctx = await comMensagens(4)
    const pagina = await ctx.service.history(ctx.a.id, ctx.conversaId, undefined, 2)
    const cursor = decodeCursor(pagina.proximoCursor as string)
    expect(cursor?.id).toBe(pagina.mensagens[1].id)
  })
})

describe('DmService — limites de envio', () => {
  it('mensagem acima do teto é recusada', async () => {
    const ctx = await dupla()
    const p = enviar(ctx, ctx.a.id, ctx.b.id, 'x'.repeat(DM_TEXTO_MAX + 1))
    await expect(p).rejects.toBeInstanceOf(BadRequestException)
    await expectCode(p, 'dm-texto-longo')
    expect(ctx.messages.rows).toHaveLength(0)
  })

  it('mensagem no teto exato passa', async () => {
    const ctx = await dupla()
    const enviada = await enviar(ctx, ctx.a.id, ctx.b.id, 'x'.repeat(DM_TEXTO_MAX))
    expect(enviada.texto).toHaveLength(DM_TEXTO_MAX)
  })

  it('mensagem só de espaço não vira mensagem', async () => {
    const ctx = await dupla()
    await expectCode(enviar(ctx, ctx.a.id, ctx.b.id, '   \n  '), 'dm-vazia')
    expect(ctx.messages.rows).toHaveLength(0)
  })

  it('duas em sequência rápida demais: a segunda é recusada', async () => {
    const ctx = await dupla()
    await ctx.service.send(ctx.a.id, ctx.b.id, 'primeira')
    const p = ctx.service.send(ctx.a.id, ctx.b.id, 'segunda')
    await expect(p).rejects.toBeInstanceOf(HttpException)
    await expectCode(p, 'dm-rapido-demais')
    expect(ctx.messages.rows).toHaveLength(1)
  })

  it('o freio é por pessoa, não por conversa', async () => {
    const ctx = await dupla()
    const c = await novaConta(ctx.users, 'terceira')
    await amizade(ctx, ctx.a, 'terceira')
    await ctx.service.send(ctx.a.id, ctx.b.id, 'pra B')
    // conversa diferente, mesma pessoa mandando: continua barrado
    await expectCode(ctx.service.send(ctx.a.id, c.id, 'pra C'), 'dm-rapido-demais')
    // pessoa diferente não paga pelo envio de quem quer que seja
    await expect(ctx.service.send(ctx.b.id, ctx.a.id, 'resposta')).resolves.toMatchObject({
      texto: 'resposta',
    })
  })

  it('passado o intervalo, manda de novo', async () => {
    const ctx = await dupla()
    await enviar(ctx, ctx.a.id, ctx.b.id, 'primeira')
    await expect(enviar(ctx, ctx.a.id, ctx.b.id, 'segunda')).resolves.toMatchObject({
      texto: 'segunda',
    })
  })
})

describe('DmService — entrega em tempo real', () => {
  it('anuncia pro destinatário com o autor e o total de não-lidas dele', async () => {
    const ctx = await dupla()
    await enviar(ctx, ctx.a.id, ctx.b.id, 'oi')
    await enviar(ctx, ctx.a.id, ctx.b.id, 'de novo')

    expect(ctx.entregues).toHaveLength(2)
    expect(ctx.entregues[1]).toMatchObject({
      paraUserId: ctx.b.id,
      naoLidas: 2,
      de: { id: ctx.a.id, username: 'icaro' },
      mensagem: { texto: 'de novo', autorId: ctx.a.id, minha: false },
    })
    expect(ctx.entregues[1].conversaId).toBe(ctx.conversations.rows[0].id)
  })

  it('nada é anunciado quando a mensagem é recusada', async () => {
    const ctx = await dupla()
    await ctx.friends.remove(ctx.a.id, ctx.amizadeId)
    await expect(enviar(ctx, ctx.a.id, ctx.b.id, 'oi')).rejects.toBeInstanceOf(ForbiddenException)
    expect(ctx.entregues).toHaveLength(0)
  })

  it('ouvinte que estoura não desfaz a mensagem já gravada', async () => {
    const ctx = await dupla()
    ctx.delivery.register(() => {
      throw new Error('socket caiu')
    })
    await expect(enviar(ctx, ctx.a.id, ctx.b.id, 'oi')).resolves.toMatchObject({ texto: 'oi' })
    expect(ctx.messages.rows).toHaveLength(1)
  })

  it('sem ninguém registrado, a mensagem continua sendo gravada', async () => {
    const ctx = await dupla()
    const semOuvinte = new DmDelivery()
    const service = new DmService(
      ctx.conversations as any,
      ctx.messages as any,
      ctx.friends,
      semOuvinte,
    )
    await expect(service.send(ctx.a.id, ctx.b.id, 'oi')).resolves.toMatchObject({ texto: 'oi' })
    expect(ctx.messages.rows).toHaveLength(1)
  })
})
