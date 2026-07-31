import { PresenceGateway } from './presence.gateway'

// A regra em teste: online é de todo amigo aceito, LUGAR (servidor, mundo,
// microfone, tela) é só de quem também é membro daquele servidor. O teste olha o
// que o gateway EMITE, não o que a tela desenharia — é no emit que a privacidade
// vive ou morre.

interface Emitido {
  para: string
  evento: string
  payload: any
}

function makeGateway(amizades: Record<string, string[]> = {}) {
  const emitidos: Emitido[] = []
  const gateway = new PresenceGateway(
    {} as any,
    {} as any,
    { find: async () => [] } as any,
    {} as any,
    {
      acceptedFriendIds: async (ids: string[]) => {
        const mapa = new Map<string, Set<string>>()
        for (const id of ids) mapa.set(id, new Set(amizades[id] ?? []))
        return mapa
      },
    } as any,
    { register: () => undefined } as any,
  )
  gateway.server = {
    to: (para: string) => ({
      emit: (evento: string, payload: any) => emitidos.push({ para, evento, payload }),
    }),
    sockets: { sockets: new Map(), adapter: { rooms: new Map() } },
  } as any
  return { gateway, emitidos }
}

// põe uma pessoa conectada e dentro de um mundo, como o handleJoin faria
function entra(
  gateway: any,
  { socketId, userId, serverId, map }: { socketId: string; userId: string; serverId: string; map: string },
) {
  gateway.socketUserId.set(socketId, userId)
  gateway.userSocket.set(userId, socketId)
  gateway.players.set(socketId, {
    id: socketId,
    userId,
    name: 'Alguém',
    avatar: {},
    map,
    serverId,
    x: 0,
    y: 0,
    facing: 'down',
    pose: 'idle',
    boost: false,
  })
}

// alguém que abriu o painel de amigos: observa `amigos` e é membro de `servidores`
function observa(
  gateway: any,
  { socketId, userId, amigos, servidores }: { socketId: string; userId: string; amigos: string[]; servidores: string[] },
) {
  gateway.socketUserId.set(socketId, userId)
  gateway.userSocket.set(userId, socketId)
  gateway.friendWatchers.set(socketId, new Set(amigos))
  gateway.socketMemberships.set(socketId, new Set(servidores))
}

describe('PresenceGateway — presença de amigo', () => {
  it('amigo sem servidor em comum aparece só como online, sem lugar nenhum', () => {
    const { gateway } = makeGateway()
    entra(gateway, { socketId: 'sB', userId: 'B', serverId: 'servidor-do-B', map: 'studio' })
    observa(gateway, { socketId: 'sA', userId: 'A', amigos: ['B'], servidores: ['servidor-do-A'] })

    const [amigo] = (gateway as any).friendSnapshotFor('sA')
    expect(amigo).toEqual({ userId: 'B', online: true })
    expect(Object.keys(amigo)).toEqual(['userId', 'online'])
  })

  it('amigo do mesmo servidor entrega servidor, mundo e estado de mídia', () => {
    const { gateway } = makeGateway()
    entra(gateway, { socketId: 'sB', userId: 'B', serverId: 'compartilhado', map: 'agora' })
    observa(gateway, { socketId: 'sA', userId: 'A', amigos: ['B'], servidores: ['compartilhado'] })

    const [amigo] = (gateway as any).friendSnapshotFor('sA')
    expect(amigo).toEqual({
      userId: 'B',
      online: true,
      serverId: 'compartilhado',
      map: 'agora',
      micMuted: true,
      sharingScreen: false,
    })
  })

  it('o mesmo delta sai capado pra um e completo pro outro, na mesma emissão', () => {
    const { gateway, emitidos } = makeGateway()
    entra(gateway, { socketId: 'sB', userId: 'B', serverId: 'compartilhado', map: 'agora' })
    observa(gateway, { socketId: 'sA', userId: 'A', amigos: ['B'], servidores: ['outro'] })
    observa(gateway, { socketId: 'sC', userId: 'C', amigos: ['B'], servidores: ['compartilhado'] })

    ;(gateway as any).emitFriendPresence('B', (gateway as any).players.get('sB'))

    const paraA = emitidos.find((e) => e.para === 'sA')
    const paraC = emitidos.find((e) => e.para === 'sC')
    expect(paraA?.payload.friend).toEqual({ userId: 'B', online: true })
    expect(paraC?.payload.friend).toMatchObject({ serverId: 'compartilhado', map: 'agora' })
  })

  it('nada é emitido pra quem não é amigo', () => {
    const { gateway, emitidos } = makeGateway()
    entra(gateway, { socketId: 'sB', userId: 'B', serverId: 'compartilhado', map: 'agora' })
    observa(gateway, { socketId: 'sX', userId: 'X', amigos: [], servidores: ['compartilhado'] })

    ;(gateway as any).emitFriendPresence('B', (gateway as any).players.get('sB'))
    ;(gateway as any).emitFriendOffline('B')

    expect(emitidos).toHaveLength(0)
    expect((gateway as any).friendSnapshotFor('sX')).toEqual([])
  })

  it('amigo conectado que ainda não entrou em mundo nenhum é só online', () => {
    const { gateway } = makeGateway()
    gateway['socketUserId'].set('sB', 'B')
    gateway['userSocket'].set('B', 'sB')
    observa(gateway, { socketId: 'sA', userId: 'A', amigos: ['B'], servidores: ['compartilhado'] })

    expect((gateway as any).friendSnapshotFor('sA')).toEqual([{ userId: 'B', online: true }])
  })

  it('amigo offline não entra no snapshot', () => {
    const { gateway } = makeGateway()
    observa(gateway, { socketId: 'sA', userId: 'A', amigos: ['B'], servidores: ['compartilhado'] })
    expect((gateway as any).friendSnapshotFor('sA')).toEqual([])
  })

  it('o aviso de offline nunca carrega lugar', () => {
    const { gateway, emitidos } = makeGateway()
    entra(gateway, { socketId: 'sB', userId: 'B', serverId: 'compartilhado', map: 'agora' })
    observa(gateway, { socketId: 'sA', userId: 'A', amigos: ['B'], servidores: ['compartilhado'] })

    ;(gateway as any).emitFriendOffline('B')

    expect(emitidos[0].payload).toEqual({ friend: { userId: 'B', online: false } })
  })

  it('perder a membership tira o lugar do amigo sem tirar o online', async () => {
    const { gateway, emitidos } = makeGateway({ A: ['B'] })
    entra(gateway, { socketId: 'sB', userId: 'B', serverId: 'compartilhado', map: 'agora' })
    observa(gateway, { socketId: 'sA', userId: 'A', amigos: ['B'], servidores: ['compartilhado'] })

    // o sweep relê as memberships do banco, que agora não tem mais a de A
    await (gateway as any).sweepMemberships()

    const estado = emitidos.filter((e) => e.evento === 'friendPresenceState').pop()
    expect(estado?.para).toBe('sA')
    expect(estado?.payload.friends).toEqual([{ userId: 'B', online: true }])
  })

  it('deixar de ser amigo tira a pessoa da lista na varredura', async () => {
    const { gateway, emitidos } = makeGateway({ A: [] })
    entra(gateway, { socketId: 'sB', userId: 'B', serverId: 'compartilhado', map: 'agora' })
    observa(gateway, { socketId: 'sA', userId: 'A', amigos: ['B'], servidores: [] })

    await (gateway as any).sweepMemberships()

    expect([...(gateway as any).friendWatchers.get('sA')]).toEqual([])
    const estado = emitidos.filter((e) => e.evento === 'friendPresenceState').pop()
    expect(estado?.payload.friends).toEqual([])
  })

  it('convidado observa e recebe lista vazia, sem consultar amizade', async () => {
    const { gateway } = makeGateway()
    const emitidosNoSocket: Emitido[] = []
    gateway['socketUserId'].set('sG', 'G')
    gateway['socketGuest'].add('sG')
    const socket: any = {
      id: 'sG',
      emit: (evento: string, payload: any) => emitidosNoSocket.push({ para: 'sG', evento, payload }),
    }

    await gateway.handleFriendPresenceWatch(socket)

    expect(emitidosNoSocket).toEqual([{ para: 'sG', evento: 'friendPresenceState', payload: { friends: [] } }])
    expect([...(gateway as any).friendWatchers.get('sG')]).toEqual([])
  })
})
