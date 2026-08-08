<template>
  <PanelShell title="amigos" icon="users" size="lg" dock @close="emit('close')">
    <div class="fp-body">
      <section v-if="auth.isGuest" class="fp-section">
        <h3 class="fp-title"><PixelIcon name="lock" size="0.9375rem" />Amigos precisa de conta</h3>
        <p class="k-hint-text fp-hint">
          Convidado não tem lista de amigos: a conta é apagada quando você sai, e a amizade ficaria
          apontando pra alguém que deixou de existir. Com uma conta você ganha um <b>@nome</b> fixo,
          que é como as pessoas te encontram — e que ninguém mais pode usar.
        </p>
        <button class="k-btn k-btn-ghost k-btn-sm" @click="router.push('/register')">Criar conta →</button>
      </section>

      <template v-else>
        <section class="fp-section">
          <h3 class="fp-title"><PixelIcon name="user-plus" size="0.9375rem" />Adicionar amigo</h3>
          <p class="k-hint-text fp-hint">
            Procure pelo <b>@nome</b> de usuário. O nome que flutua sobre o personagem não serve:
            dois podem se chamar igual, o @nome é único.
          </p>
          <div class="fp-add">
            <input
              v-model.trim="alvo"
              class="k-input k-input-sm fp-add-input"
              maxlength="64"
              placeholder="@nome"
              autocomplete="off"
              @keyup.enter="request"
            />
            <button class="k-btn k-btn-primary k-btn-xs" :disabled="busy || !alvo" @click="request">
              {{ busy ? '…' : 'Enviar pedido' }}
            </button>
          </div>
          <!-- cor de desabilitado não comunica sozinha o que falta: sem esta linha,
               o botão cinza parece quebrado em vez de esperando entrada -->
          <p v-if="!alvo && !busy" class="k-hint-text fp-add-hint">
            Digite um @nome para habilitar o envio.
          </p>
          <p v-if="addError" class="fp-error">{{ addError }}</p>
          <p v-if="addOk" class="fp-ok"><PixelIcon name="check" size="0.875rem" />{{ addOk }}</p>
        </section>

        <nav class="fp-tabs">
          <button
            v-for="t in tabs" :key="t.id"
            class="k-btn k-btn-ghost k-btn-xs" :class="{ 'k-active': tab === t.id }"
            @click="tab = t.id"
          >
            {{ t.label }}
            <span v-if="t.count" class="fp-tab-count" :class="{ 'fp-tab-count-alert': t.alert }">{{ t.count }}</span>
          </button>

          <button class="k-btn k-btn-ghost k-btn-xs fp-dm" title="Abrir suas conversas" @click="emit('dm', '')">
            <PixelIcon name="message" size="0.75rem" />conversas
            <span v-if="dmUnreadTotal" class="fp-tab-count fp-tab-count-alert">{{ dmUnreadTotal }}</span>
          </button>
        </nav>

        <p v-if="error" class="fp-error">{{ error }}</p>
        <p v-if="notice" class="fp-ok"><PixelIcon name="check" size="0.875rem" />{{ notice }}</p>

        <section v-if="tab === 'online' || tab === 'todos'" class="fp-section">
          <ul class="fp-list">
            <li v-for="row in tab === 'online' ? online : todos" :key="row.id" class="fp-item">
              <span class="fp-who">
                <span class="fp-dot" :class="row.online ? 'fp-dot-on' : 'fp-dot-off'" />
                <span class="fp-who-text">
                  <span class="fp-name ellipsis">{{ row.nome }}</span>
                  <span class="fp-handle ellipsis">{{ row.handle }}</span>
                </span>
              </span>

              <span class="fp-state" :class="{ 'fp-state-on': row.online }">
                {{ row.online ? (row.lugar ? `online · ${row.lugar}` : 'online') : 'offline' }}
              </span>

              <span class="fp-acts">
                <button
                  v-if="row.userId"
                  class="k-btn k-btn-ghost k-btn-xs"
                  title="Abrir a conversa"
                  @click="emit('dm', row.userId)"
                ><PixelIcon name="message" size="0.75rem" />conversar</button>

                <button
                  v-if="row.local"
                  class="k-btn k-btn-ghost k-btn-xs"
                  :disabled="busy"
                  title="Ir para o servidor e o mundo em que ele está"
                  @click="jump(row)"
                ><PixelIcon name="login" size="0.75rem" />pular até</button>

                <button
                  v-if="adminServers.length"
                  class="k-btn k-btn-ghost k-btn-xs"
                  :disabled="busy"
                  title="Convidar para um servidor seu"
                  @click="toggleInvite(row.id)"
                ><PixelIcon name="server" size="0.75rem" />convidar</button>

                <button class="k-btn k-btn-ghost k-btn-xs fp-danger" :disabled="busy" @click="remove(row)">
                  <PixelIcon name="user-minus" size="0.75rem" />remover
                </button>
                <button class="k-btn k-btn-ghost k-btn-xs fp-danger" :disabled="busy" @click="block(row)">
                  <PixelIcon name="user-x" size="0.75rem" />bloquear
                </button>
              </span>

              <div v-if="inviting === row.id" class="fp-invite">
                <span class="fp-invite-label">Convidar {{ row.handle }} para:</span>
                <button
                  v-for="s in adminServers" :key="s.id"
                  class="k-btn k-btn-ghost k-btn-xs"
                  :disabled="busy"
                  @click="invite(row, s)"
                >{{ s.name }}</button>
              </div>
            </li>

            <li v-if="!(tab === 'online' ? online : todos).length" class="fp-empty">
              {{ todos.length ? 'Ninguém online agora.' : 'Você ainda não tem amigos. Procure alguém pelo @nome ali em cima.' }}
            </li>
          </ul>
        </section>

        <section v-if="tab === 'pendentes'" class="fp-section">
          <h3 class="fp-title">Esperando você ({{ recebidos.length }})</h3>
          <ul class="fp-list">
            <li v-for="row in recebidos" :key="row.id" class="fp-item">
              <span class="fp-who">
                <span class="fp-who-text">
                  <span class="fp-name ellipsis">{{ row.nome }}</span>
                  <span class="fp-handle ellipsis">{{ row.handle }}</span>
                </span>
              </span>
              <span class="fp-state">quer ser seu amigo</span>
              <span class="fp-acts">
                <button class="k-btn k-btn-primary k-btn-xs" :disabled="busy" @click="accept(row)">
                  <PixelIcon name="check" size="0.75rem" />aceitar
                </button>
                <button class="k-btn k-btn-ghost k-btn-xs" :disabled="busy" @click="reject(row)">
                  <PixelIcon name="close" size="0.75rem" />recusar
                </button>
                <button class="k-btn k-btn-ghost k-btn-xs fp-danger" :disabled="busy" @click="block(row)">
                  <PixelIcon name="user-x" size="0.75rem" />bloquear
                </button>
              </span>
            </li>
            <li v-if="!recebidos.length" class="fp-empty">Nenhum pedido esperando resposta.</li>
          </ul>

          <h3 class="fp-title">Você pediu ({{ enviados.length }})</h3>
          <ul class="fp-list">
            <li v-for="row in enviados" :key="row.id" class="fp-item">
              <span class="fp-who">
                <span class="fp-who-text">
                  <span class="fp-name ellipsis">{{ row.nome }}</span>
                  <span class="fp-handle ellipsis">{{ row.handle }}</span>
                </span>
              </span>
              <span class="fp-state">esperando resposta</span>
              <span class="fp-acts">
                <button class="k-btn k-btn-ghost k-btn-xs" :disabled="busy" @click="cancel(row)">
                  <PixelIcon name="close" size="0.75rem" />desistir
                </button>
              </span>
            </li>
            <li v-if="!enviados.length" class="fp-empty">Você não tem pedido nenhum em aberto.</li>
          </ul>

          <template v-if="convites.length">
            <h3 class="fp-title"><PixelIcon name="mail" size="0.9375rem" />Convites de servidor ({{ convites.length }})</h3>
            <p class="k-hint-text fp-hint">
              Aceitar o convite por aqui ainda não existe. Peça o link do servidor a quem te convidou
              e cole em "entrar com convite", no painel de servidores.
            </p>
            <ul class="fp-list">
              <li v-for="c in convites" :key="c.id" class="fp-item">
                <span class="fp-who">
                  <span class="fp-who-text">
                    <span class="fp-name ellipsis">{{ c.servidor || 'servidor' }}</span>
                    <span class="fp-handle ellipsis">de {{ handleOf(c.de) }}</span>
                  </span>
                </span>
                <span class="fp-state">convite aberto</span>
              </li>
            </ul>
          </template>
        </section>

        <section v-if="tab === 'bloqueados'" class="fp-section">
          <p class="k-hint-text fp-hint">
            Quem você bloqueia some da sua lista e não consegue mandar pedido de novo. A pessoa não é
            avisada. Desbloquear não devolve a amizade: vocês voltam a ser dois estranhos.
          </p>
          <ul class="fp-list">
            <li v-for="row in bloqueados" :key="row.id" class="fp-item">
              <span class="fp-who">
                <span class="fp-who-text">
                  <span class="fp-name ellipsis">{{ row.nome }}</span>
                  <span class="fp-handle ellipsis">{{ row.handle }}</span>
                </span>
              </span>
              <span class="fp-state">bloqueado</span>
              <span class="fp-acts">
                <button class="k-btn k-btn-ghost k-btn-xs" :disabled="busy" @click="unblock(row)">
                  <PixelIcon name="undo" size="0.75rem" />desbloquear
                </button>
              </span>
            </li>
            <li v-if="!bloqueados.length" class="fp-empty">Você não bloqueou ninguém.</li>
          </ul>
        </section>
      </template>
    </div>
  </PanelShell>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  acceptFriend, blockFriend, blockedFriends, inviteFriendToServer, listFriends,
  pendingFriends, receivedServerInvites, rejectFriend, removeFriend, requestFriend,
  unblockFriend, FriendError,
  type FriendServerInvite, type FriendUser, type FriendView,
} from '@/services/friend.api'
import { getMyServers, type MyServerSummary } from '@/services/server.api'
import { dmUnreadTotal, friendLocation, isFriendOnline, unwatchFriendPresence, watchFriendPresence } from '@/services/presence'
import { useAuthStore } from '@/stores/useAuthStore'
import type { MapDef } from '@/game/maps'
import PanelShell from '@/components/PanelShell.vue'
import PixelIcon from '@/components/PixelIcon.vue'

type Tab = 'online' | 'todos' | 'pendentes' | 'bloqueados'

interface FriendRow {
  id: string
  userId: string
  nome: string
  handle: string
  online: boolean
  local: { serverId: string; map: string } | null
  lugar: string
}

const props = defineProps<{ maps: MapDef[] }>()

const emit = defineEmits<{
  close: []
  jump: [serverId: string, mapId: string]
  changed: []
  dm: [userId: string]
}>()

const router = useRouter()
const auth = useAuthStore()

const tab = ref<Tab>('online')
const aceitos = ref<FriendView[]>([])
const recebidosRaw = ref<FriendView[]>([])
const enviadosRaw = ref<FriendView[]>([])
const bloqueadosRaw = ref<FriendView[]>([])
const convites = ref<FriendServerInvite[]>([])
const servers = ref<MyServerSummary[]>([])
const alvo = ref('')
const inviting = ref('')
const busy = ref(false)
const error = ref('')
const notice = ref('')
const addError = ref('')
const addOk = ref('')

const MENSAGENS: Record<string, string> = {
  'user-not-found': 'Não existe ninguém com esse @nome. Confira a grafia — maiúscula e minúscula dão no mesmo.',
  'friend-already': 'Vocês já são amigos.',
  'friend-blocked-by-me': 'Você bloqueou essa pessoa. Desbloqueie na aba "bloqueados" antes.',
  'friend-pending-limit': 'Você tem pedidos demais esperando resposta. Espere alguém responder antes de mandar outro.',
  'amizade-consigo': 'Esse @nome é o seu.',
  'sem-username': 'Escolha o seu @nome de usuário antes de adicionar amigos.',
  'guest-no-friends': 'Convidado não tem lista de amigos. Crie uma conta pra adicionar amigos.',
  'friend-not-found': 'Essa amizade não existe mais.',
  'friend-request-not-found': 'Esse pedido não existe mais.',
  'friend-not-accepted': 'Você só pode convidar quem já é seu amigo.',
}

function texto(e: unknown): string {
  const code = e instanceof FriendError ? e.code : ''
  return MENSAGENS[code] || (e as Error).message || 'Algo deu errado.'
}

function handleOf(user: FriendUser | null | undefined): string {
  return user?.username ? `@${user.username}` : '—'
}

const activeServerId = computed(() => servers.value.find((s) => s.active)?.id ?? null)
const adminServers = computed(() => servers.value.filter((s) => s.role === 'admin' && !s.archived))

function lugarLabel(local: { serverId: string; map: string }): string {
  const mundo = props.maps.find((m) => m.id === local.map)?.name || local.map
  if (local.serverId === activeServerId.value) return mundo
  const servidor = servers.value.find((s) => s.id === local.serverId)?.name
  return servidor ? `${servidor} · ${mundo}` : mundo
}

function toRow(view: FriendView): FriendRow {
  const userId = view.usuario?.id ?? null
  const local = userId ? friendLocation(userId) : null
  return {
    id: view.id,
    userId: userId ?? '',
    nome: view.usuario?.nome || 'sem nome',
    handle: handleOf(view.usuario),
    online: !!userId && isFriendOnline(userId),
    local,
    lugar: local ? lugarLabel(local) : '',
  }
}

const todos = computed(() =>
  aceitos.value
    .map(toRow)
    .sort((a, b) => Number(b.online) - Number(a.online) || a.nome.localeCompare(b.nome)),
)
const online = computed(() => todos.value.filter((r) => r.online))
const recebidos = computed(() => recebidosRaw.value.map(toRow))
const enviados = computed(() => enviadosRaw.value.map(toRow))
const bloqueados = computed(() => bloqueadosRaw.value.map(toRow))

const tabs = computed(() => [
  { id: 'online' as Tab, label: 'online', count: online.value.length, alert: false },
  { id: 'todos' as Tab, label: 'todos', count: todos.value.length, alert: false },
  { id: 'pendentes' as Tab, label: 'pendentes', count: recebidos.value.length, alert: true },
  { id: 'bloqueados' as Tab, label: 'bloqueados', count: bloqueados.value.length, alert: false },
])

async function load() {
  if (auth.isGuest) return
  error.value = ''
  try {
    const [amigos, pendentes, bloqueios, invites, meus] = await Promise.all([
      listFriends(),
      pendingFriends(),
      blockedFriends(),
      receivedServerInvites(),
      getMyServers(),
    ])
    aceitos.value = amigos
    recebidosRaw.value = pendentes.recebidos
    enviadosRaw.value = pendentes.enviados
    bloqueadosRaw.value = bloqueios
    convites.value = invites
    servers.value = meus
  } catch (e) {
    error.value = texto(e)
  }
}

async function refresh() {
  await load()
  watchFriendPresence()
}

async function run(action: () => Promise<string>) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    notice.value = await action()
    await refresh()
    emit('changed')
  } catch (e) {
    error.value = texto(e)
  } finally {
    busy.value = false
  }
}

async function request() {
  const nome = alvo.value
  if (!nome || busy.value) return
  busy.value = true
  addError.value = ''
  addOk.value = ''
  try {
    const view = await requestFriend(nome)
    const quem = handleOf(view.usuario)
    alvo.value = ''
    addOk.value = view.status === 'aceita'
      ? `${quem} também tinha te pedido: vocês já são amigos.`
      : `Pedido enviado para ${quem}.`
    await refresh()
    emit('changed')
  } catch (e) {
    addError.value = texto(e)
  } finally {
    busy.value = false
  }
}

function accept(row: FriendRow) {
  void run(async () => {
    await acceptFriend(row.id)
    return `${row.handle} entrou na sua lista.`
  })
}

function reject(row: FriendRow) {
  void run(async () => {
    await rejectFriend(row.id)
    return 'Pedido recusado. A pessoa não é avisada.'
  })
}

function cancel(row: FriendRow) {
  void run(async () => {
    await removeFriend(row.id)
    return `Pedido para ${row.handle} cancelado.`
  })
}

function remove(row: FriendRow) {
  if (!confirm(`Remover ${row.handle} da sua lista? Vocês somem da lista um do outro, sem aviso.`)) return
  void run(async () => {
    await removeFriend(row.id)
    return `${row.handle} saiu da sua lista.`
  })
}

function block(row: FriendRow) {
  if (!confirm(`Bloquear ${row.handle}? Ele some da sua lista e não consegue mandar pedido de novo. Não é avisado.`)) return
  void run(async () => {
    await blockFriend(row.id)
    return `${row.handle} foi bloqueado.`
  })
}

function unblock(row: FriendRow) {
  void run(async () => {
    await unblockFriend(row.id)
    return `${row.handle} foi desbloqueado. Vocês não voltam a ser amigos: é preciso pedir de novo.`
  })
}

function toggleInvite(id: string) {
  inviting.value = inviting.value === id ? '' : id
}

function invite(row: FriendRow, server: MyServerSummary) {
  void run(async () => {
    await inviteFriendToServer(row.id, server.id)
    inviting.value = ''
    return `${row.handle} foi convidado para ${server.name}.`
  })
}

function jump(row: FriendRow) {
  if (!row.local) return
  emit('jump', row.local.serverId, row.local.map)
}

const REARM_MS = 1200
let rearmTimer = 0

onMounted(() => {
  watchFriendPresence()
  rearmTimer = window.setTimeout(watchFriendPresence, REARM_MS)
  void load()
})

onUnmounted(() => {
  window.clearTimeout(rearmTimer)
  unwatchFriendPresence()
})
</script>

<style scoped>
.fp-body {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.fp-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  background: var(--bg-1);
  border: 0.0625rem solid var(--border);
  padding: 0.875rem;
}

.fp-title {
  font-size: 0.9375rem;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.fp-hint { margin: 0; }

.fp-add {
  display: flex;
  gap: 0.5rem;
  width: 100%;
  align-items: center;
  flex-wrap: wrap;
}
.k-input.fp-add-input { flex: 1; min-width: 10rem; font-family: var(--f-mono); }

.fp-tabs {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.fp-tab-count {
  font-family: var(--f-num);
  font-size: 0.75rem;
  color: var(--text-3);
}
.fp-tab-count-alert { color: var(--accent-texto); }

.fp-dm { margin-left: auto; }

.fp-list {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.fp-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  background: var(--bg-2);
  border: 0.0625rem solid var(--border);
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
}

.fp-who {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  flex: 1;
}

.fp-who-text {
  display: flex;
  flex-direction: column;
  gap: 0.0625rem;
  min-width: 0;
}
.fp-name { color: var(--text); font-weight: 600; }
.fp-handle { font-family: var(--f-sans); font-size: 0.75rem;
  font-weight: 600; color: var(--text-3); }

.fp-dot {
  width: 0.5rem;
  height: 0.5rem;
  flex: none;
  background: var(--text-4);
}
.fp-dot-on { background: var(--ok); }
.fp-dot-off { background: var(--text-4); }

.fp-state {
  font-family: var(--f-sans);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-3);
  letter-spacing: 0.02em;
  min-width: 0;
  overflow-wrap: anywhere;
}
.fp-state-on { color: var(--ok); }

.fp-acts {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  flex-wrap: wrap;
  margin-left: auto;
}

.fp-invite {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
  padding-top: 0.5rem;
  border-top: 0.0625rem solid var(--border);
}
.fp-invite-label { font-size: 0.75rem; color: var(--text-3); }

.fp-empty { color: var(--text-3); font-size: 0.8125rem; }

.fp-danger { color: var(--err); border-color: color-mix(in srgb, var(--err) 40%, transparent); }
.fp-danger:hover:not(:disabled) { border-color: var(--err); color: var(--err); }

.fp-error { color: var(--err); font-size: 0.8125rem; margin: 0; }
.fp-ok {
  color: var(--ok);
  font-size: 0.8125rem;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

button:disabled { opacity: 0.5; cursor: default; }
</style>
