import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
import { FriendService } from './friend.service'
import { MAX_PEDIDOS_PENDENTES, friendPair } from './friendship'
import { NoGuestGuard } from './no-guest.guard'

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
      row.id = `${this.prefix}${++this.seq}`
      row.createdAt = new Date()
      this.rows.push(row)
    }
    return row
  }

  async findOne({ where }: any) {
    if (this.escondeNoProximoFindOne) {
      this.escondeNoProximoFindOne = false
      return null
    }
    return this.rows.find((row) => this.match(row, where)) ?? null
  }

  async find({ where }: any = {}) {
    return this.rows.filter((row) => this.match(row, where))
  }

  async count({ where }: any) {
    return (await this.find({ where })).length
  }

  async delete(id: string) {
    this.rows = this.rows.filter((row) => row.id !== id)
  }

  private match(row: any, where: any): boolean {
    if (!where) return true
    const alternativas = Array.isArray(where) ? where : [where]
    return alternativas.some((w) =>
      Object.entries(w).every(([campo, valor]) => this.eq(row[campo], valor)),
    )
  }

  private eq(atual: any, esperado: any): boolean {
    if (esperado && typeof esperado === 'object' && Array.isArray(esperado.value)) {
      return esperado.value.includes(atual)
    }
    return atual === esperado
  }
}

// o perfil sai de um join com characters; o teste olha id e @nome, não o nome do avatar
class FakeUserRepo extends FakeRepo {
  createQueryBuilder() {
    const qb: any = {
      leftJoin: () => qb,
      select: () => qb,
      addSelect: () => qb,
      where: () => qb,
      getRawMany: async () =>
        this.rows.map((r) => ({ id: r.id, username: r.username, nome: null })),
    }
    return qb
  }
}

function makeService() {
  const friendships = new FakeRepo('f')
  const serverInvites = new FakeRepo('i')
  const users = new FakeUserRepo('u')
  const servers = new FakeRepo('s')
  const memberships = new FakeRepo('m')
  const service = new FriendService(
    friendships as any,
    serverInvites as any,
    users as any,
    servers as any,
    memberships as any,
    { joinFromFriendInvite: async () => ({}) } as any,
  )
  return { service, friendships, serverInvites, users, servers, memberships }
}

async function novaConta(users: FakeRepo, username: string) {
  return users.save({
    email: `${username}@b.com`,
    username,
    usernameLower: username.toLowerCase(),
    isGuest: false,
  })
}

async function erro(promise: Promise<unknown>) {
  return promise.then(
    () => null,
    (err) => err,
  )
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ response: { code } })
}

describe('FriendService — pedido e aceite', () => {
  it('pedido nasce pendente e aparece como enviado pra um e recebido pro outro', async () => {
    const { service, users } = makeService()
    const a = await novaConta(users, 'icaro')
    const b = await novaConta(users, 'isabelle')

    const pedido = await service.request(a.id, '@isabelle')
    expect(pedido.status).toBe('pendente')
    expect(pedido.usuario.username).toBe('isabelle')

    const deA = await service.pending(a.id)
    expect(deA.enviados).toHaveLength(1)
    expect(deA.recebidos).toHaveLength(0)

    const deB = await service.pending(b.id)
    expect(deB.recebidos).toHaveLength(1)
    expect(deB.recebidos[0].usuario.username).toBe('icaro')
    expect(deB.enviados).toHaveLength(0)
  })

  it('aceito, cada um aparece na lista do outro', async () => {
    const { service, users } = makeService()
    const a = await novaConta(users, 'icaro')
    const b = await novaConta(users, 'isabelle')

    const pedido = await service.request(a.id, 'isabelle')
    await service.accept(b.id, pedido.id)

    const listaA = await service.list(a.id)
    const listaB = await service.list(b.id)
    expect(listaA.map((f) => f.usuario.username)).toEqual(['isabelle'])
    expect(listaB.map((f) => f.usuario.username)).toEqual(['icaro'])
    expect((await service.pending(a.id)).enviados).toHaveLength(0)
  })

  it('quem pediu não pode aceitar o próprio pedido', async () => {
    const { service, users } = makeService()
    const a = await novaConta(users, 'icaro')
    await novaConta(users, 'isabelle')
    const pedido = await service.request(a.id, 'isabelle')
    await expectCode(service.accept(a.id, pedido.id), 'friend-request-not-found')
  })
})

describe('FriendService — o par nunca duplica', () => {
  it('B pedindo a A depois de A ter pedido a B vira aceite, não linha nova', async () => {
    const { service, users, friendships } = makeService()
    const a = await novaConta(users, 'icaro')
    const b = await novaConta(users, 'isabelle')

    await service.request(a.id, 'isabelle')
    const volta = await service.request(b.id, 'icaro')

    expect(volta.status).toBe('aceita')
    expect(friendships.rows).toHaveLength(1)
    expect(await service.list(a.id)).toHaveLength(1)
    expect(await service.list(b.id)).toHaveLength(1)
  })

  it('grava o par sempre na mesma ordem, venha de que lado vier', async () => {
    const { service, users, friendships } = makeService()
    const a = await novaConta(users, 'icaro')
    const b = await novaConta(users, 'isabelle')
    await service.request(b.id, 'icaro')
    expect(friendships.rows[0]).toMatchObject(friendPair(a.id, b.id))
  })

  it('repetir o próprio pedido não cria segunda linha', async () => {
    const { service, users, friendships } = makeService()
    const a = await novaConta(users, 'icaro')
    await novaConta(users, 'isabelle')
    const primeiro = await service.request(a.id, 'isabelle')
    const segundo = await service.request(a.id, 'isabelle')
    expect(segundo.id).toBe(primeiro.id)
    expect(friendships.rows).toHaveLength(1)
  })

  it('os dois pedindo no mesmo instante: quem perde o UNIQUE aceita a linha do outro', async () => {
    const { service, users, friendships } = makeService()
    const a = await novaConta(users, 'icaro')
    const b = await novaConta(users, 'isabelle')

    await service.request(a.id, 'isabelle')
    // os dois passam juntos pela consulta (a linha do outro ainda não é visível) e
    // quem chega depois no INSERT bate no UNIQUE
    friendships.escondeNoProximoFindOne = true
    friendships.falhaNoProximoSave = Object.assign(new Error('duplicate key'), { code: '23505' })
    const perdedor = await service.request(b.id, 'icaro')

    expect(perdedor.status).toBe('aceita')
    expect(friendships.rows).toHaveLength(1)
  })

  it('já amigos, pedir de novo é erro claro', async () => {
    const { service, users } = makeService()
    const a = await novaConta(users, 'icaro')
    const b = await novaConta(users, 'isabelle')
    const pedido = await service.request(a.id, 'isabelle')
    await service.accept(b.id, pedido.id)

    const p = service.request(a.id, 'isabelle')
    await expect(p).rejects.toBeInstanceOf(ConflictException)
    await expectCode(p, 'friend-already')
  })
})

describe('FriendService — recusas', () => {
  it('não dá pra pedir amizade a si mesmo', async () => {
    const { service, users } = makeService()
    const a = await novaConta(users, 'icaro')
    const p = service.request(a.id, '@Icaro')
    await expect(p).rejects.toBeInstanceOf(BadRequestException)
    await expectCode(p, 'amizade-consigo')
  })

  it('nome que não existe é 404', async () => {
    const { service, users } = makeService()
    const a = await novaConta(users, 'icaro')
    await expectCode(service.request(a.id, 'ninguem'), 'user-not-found')
  })

  it('convidado não é alvo de pedido', async () => {
    const { service, users } = makeService()
    const a = await novaConta(users, 'icaro')
    await users.save({ username: 'fantasma', usernameLower: 'fantasma', isGuest: true })
    await expectCode(service.request(a.id, 'fantasma'), 'user-not-found')
  })

  it('quem ainda não escolheu @nome não manda pedido', async () => {
    const { service, users } = makeService()
    const sem = await users.save({ email: 'oauth@b.com', username: null, usernameLower: null })
    await novaConta(users, 'isabelle')
    const p = service.request(sem.id, 'isabelle')
    await expect(p).rejects.toBeInstanceOf(ForbiddenException)
    await expectCode(p, 'sem-username')
  })
})

describe('FriendService — remover e recusar são silenciosos', () => {
  it('remover tira dos dois lados', async () => {
    const { service, users, friendships } = makeService()
    const a = await novaConta(users, 'icaro')
    const b = await novaConta(users, 'isabelle')
    const pedido = await service.request(a.id, 'isabelle')
    await service.accept(b.id, pedido.id)

    await service.remove(a.id, pedido.id)
    expect(await service.list(a.id)).toHaveLength(0)
    expect(await service.list(b.id)).toHaveLength(0)
    expect(friendships.rows).toHaveLength(0)
  })

  it('quem pediu pode desistir antes da resposta', async () => {
    const { service, users } = makeService()
    const a = await novaConta(users, 'icaro')
    const b = await novaConta(users, 'isabelle')
    const pedido = await service.request(a.id, 'isabelle')

    await service.remove(a.id, pedido.id)
    expect((await service.pending(b.id)).recebidos).toHaveLength(0)
  })

  it('recusar apaga a linha e deixa pedir de novo depois', async () => {
    const { service, users, friendships } = makeService()
    const a = await novaConta(users, 'icaro')
    const b = await novaConta(users, 'isabelle')
    const pedido = await service.request(a.id, 'isabelle')

    await service.reject(b.id, pedido.id)
    expect(friendships.rows).toHaveLength(0)
    expect((await service.pending(a.id)).enviados).toHaveLength(0)

    const denovo = await service.request(a.id, 'isabelle')
    expect(denovo.status).toBe('pendente')
  })

  it('quem pediu não pode recusar o próprio pedido', async () => {
    const { service, users } = makeService()
    const a = await novaConta(users, 'icaro')
    await novaConta(users, 'isabelle')
    const pedido = await service.request(a.id, 'isabelle')
    await expectCode(service.reject(a.id, pedido.id), 'friend-request-not-found')
  })
})

describe('FriendService — bloqueio é silencioso e assimétrico', () => {
  async function bloqueado() {
    const ctx = makeService()
    const a = await novaConta(ctx.users, 'icaro')
    const b = await novaConta(ctx.users, 'isabelle')
    const pedido = await ctx.service.request(a.id, 'isabelle')
    await ctx.service.accept(b.id, pedido.id)
    await ctx.service.block(b.id, pedido.id)
    return { ...ctx, a, b, amizadeId: pedido.id }
  }

  it('bloqueado não consegue pedir de novo', async () => {
    const { service, a } = await bloqueado()
    await expect(service.request(a.id, 'isabelle')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('a resposta ao bloqueado é idêntica à de um nome que não existe', async () => {
    const { service, a } = await bloqueado()
    const doBloqueio: any = await erro(service.request(a.id, 'isabelle'))
    const doInexistente: any = await erro(service.request(a.id, 'ninguem'))
    expect(doBloqueio.getStatus()).toBe(doInexistente.getStatus())
    expect(doBloqueio.getResponse()).toEqual(doInexistente.getResponse())
  })

  it('a amizade some das listas dos dois', async () => {
    const { service, a, b } = await bloqueado()
    expect(await service.list(a.id)).toHaveLength(0)
    expect(await service.list(b.id)).toHaveLength(0)
    expect((await service.pending(a.id)).recebidos).toHaveLength(0)
  })

  it('pro bloqueado a linha nem existe: mesma resposta de um id inventado', async () => {
    const { service, a, amizadeId } = await bloqueado()
    const naLinhaReal: any = await erro(service.remove(a.id, amizadeId))
    const numIdQualquer: any = await erro(service.remove(a.id, 'f999'))
    expect(naLinhaReal.getResponse()).toEqual(numIdQualquer.getResponse())
    await expectCode(service.accept(a.id, amizadeId), 'friend-not-found')
    await expectCode(service.block(a.id, amizadeId), 'friend-not-found')
    await expectCode(service.unblock(a.id, amizadeId), 'friend-not-found')
  })

  it('só quem bloqueou enxerga o bloqueio e pode desfazer', async () => {
    const { service, a, b, amizadeId, friendships } = await bloqueado()
    expect(await service.blocked(a.id)).toHaveLength(0)
    const listaB = await service.blocked(b.id)
    expect(listaB).toHaveLength(1)
    expect(listaB[0].usuario.username).toBe('icaro')

    await service.unblock(b.id, amizadeId)
    expect(friendships.rows).toHaveLength(0)

    const denovo = await service.request(a.id, 'isabelle')
    expect(denovo.status).toBe('pendente')
  })

  it('quem bloqueou sabe que bloqueou ao tentar adicionar de novo', async () => {
    const { service, b } = await bloqueado()
    await expectCode(service.request(b.id, 'icaro'), 'friend-blocked-by-me')
  })

  it('bloquear um pedido recebido em vez de recusar também funciona', async () => {
    const { service, users } = makeService()
    const a = await novaConta(users, 'icaro')
    const b = await novaConta(users, 'isabelle')
    const pedido = await service.request(a.id, 'isabelle')

    const bloqueio = await service.block(b.id, pedido.id)
    expect(bloqueio.status).toBe('bloqueada')
    expect((await service.pending(a.id)).enviados).toHaveLength(0)
  })
})

describe('FriendService — teto de pedidos pendentes', () => {
  async function comPendentes(quantos: number) {
    const ctx = makeService()
    const a = await novaConta(ctx.users, 'icaro')
    for (let i = 0; i < quantos; i++) {
      const alvo = await novaConta(ctx.users, `pessoa${i}`)
      ctx.friendships.rows.push({
        id: `f${i}`,
        ...friendPair(a.id, alvo.id),
        status: 'pendente',
        requestedBy: a.id,
      })
    }
    return { ...ctx, a }
  }

  it('deixa passar até o teto e barra o seguinte', async () => {
    const { service, users, a } = await comPendentes(MAX_PEDIDOS_PENDENTES - 1)
    await novaConta(users, 'ultima')
    expect((await service.request(a.id, 'ultima')).status).toBe('pendente')

    await novaConta(users, 'gota.dagua')
    const p = service.request(a.id, 'gota.dagua')
    await expect(p).rejects.toBeInstanceOf(ForbiddenException)
    await expectCode(p, 'friend-pending-limit')
  })

  it('só conta o que EU pedi, não o que me pediram', async () => {
    const { service, users, friendships, a } = await comPendentes(0)
    for (let i = 0; i < MAX_PEDIDOS_PENDENTES; i++) {
      const outro = await novaConta(users, `manda${i}`)
      friendships.rows.push({
        id: `r${i}`,
        ...friendPair(a.id, outro.id),
        status: 'pendente',
        requestedBy: outro.id,
      })
    }
    await novaConta(users, 'alvo.novo')
    expect((await service.request(a.id, 'alvo.novo')).status).toBe('pendente')
  })

  // no teto, responder 404 pra nome inexistente e "teto" pra nome existente diria
  // quais contas existem
  it('barra pelo teto antes de olhar quem é o alvo', async () => {
    const { service, a } = await comPendentes(MAX_PEDIDOS_PENDENTES)
    await expectCode(service.request(a.id, 'ninguem.existe'), 'friend-pending-limit')
  })
})

describe('FriendService — convite de servidor pra amigo', () => {
  async function amigos() {
    const ctx = makeService()
    const a = await novaConta(ctx.users, 'icaro')
    const b = await novaConta(ctx.users, 'isabelle')
    const pedido = await ctx.service.request(a.id, 'isabelle')
    await ctx.service.accept(b.id, pedido.id)
    const server = await ctx.servers.save({ name: 'Estúdio', slug: 'estudio', ownerId: a.id })
    await ctx.memberships.save({ userId: a.id, serverId: server.id, role: 'admin' })
    return { ...ctx, a, b, server, amizadeId: pedido.id }
  }

  it('admin convida o amigo e o convite chega pra ele', async () => {
    const { service, a, b, server, amizadeId } = await amigos()
    const convite = await service.inviteToServer(a.id, amizadeId, server.id)
    expect(convite).toMatchObject({ serverId: server.id, servidor: 'Estúdio', status: 'pendente' })

    const recebidos = await service.serverInvitesFor(b.id)
    expect(recebidos).toHaveLength(1)
    expect(recebidos[0].de.username).toBe('icaro')
    expect(await service.serverInvitesFor(a.id)).toHaveLength(0)
  })

  it('não duplica o aviso quando convida duas vezes', async () => {
    const { service, a, b, server, amizadeId, serverInvites } = await amigos()
    await service.inviteToServer(a.id, amizadeId, server.id)
    await service.inviteToServer(a.id, amizadeId, server.id)
    expect(serverInvites.rows).toHaveLength(1)
    expect(await service.serverInvitesFor(b.id)).toHaveLength(1)
  })

  it('membro comum não convida', async () => {
    const { service, b, server, amizadeId, memberships } = await amigos()
    await memberships.save({ userId: b.id, serverId: server.id, role: 'member' })
    await expect(service.inviteToServer(b.id, amizadeId, server.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('quem não é membro não convida', async () => {
    const { service, b, server, amizadeId } = await amigos()
    await expect(service.inviteToServer(b.id, amizadeId, server.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('servidor arquivado não recebe convite', async () => {
    const { service, a, server, amizadeId, servers } = await amigos()
    servers.rows[0].archivedAt = new Date()
    await expect(service.inviteToServer(a.id, amizadeId, server.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
    expect(servers.rows[0].archivedAt).toBeInstanceOf(Date)
  })

  it('não convida quem já é membro', async () => {
    const { service, a, b, server, amizadeId, memberships } = await amigos()
    await memberships.save({ userId: b.id, serverId: server.id, role: 'member' })
    await expect(service.inviteToServer(a.id, amizadeId, server.id)).rejects.toBeInstanceOf(
      ConflictException,
    )
  })

  it('não convida quem ainda não aceitou a amizade', async () => {
    const { service, users, servers, memberships } = makeService()
    const a = await novaConta(users, 'icaro')
    await novaConta(users, 'isabelle')
    const pedido = await service.request(a.id, 'isabelle')
    const server = await servers.save({ name: 'Estúdio', ownerId: a.id })
    await memberships.save({ userId: a.id, serverId: server.id, role: 'admin' })

    await expectCode(service.inviteToServer(a.id, pedido.id, server.id), 'friend-not-accepted')
  })
})

describe('NoGuestGuard', () => {
  const guard = new NoGuestGuard()
  const contexto = (user: any) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as any

  it('barra convidado com mensagem que explica o caminho', () => {
    try {
      guard.canActivate(contexto({ sub: 'u1', isGuest: true }))
      throw new Error('devia ter barrado')
    } catch (err: any) {
      expect(err).toBeInstanceOf(ForbiddenException)
      expect(err.getResponse().code).toBe('guest-no-friends')
      expect(err.getResponse().message).toContain('Crie uma conta')
    }
  })

  it('deixa passar conta de verdade', () => {
    expect(guard.canActivate(contexto({ sub: 'u1', isGuest: false }))).toBe(true)
  })
})
