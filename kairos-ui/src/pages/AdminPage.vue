<template>
  <div class="ad-root">
    <header class="ad-head">
      <button class="ad-back" @click="router.push('/game')">
        <PixelIcon name="chevron-left" size="0.875rem" />Voltar
      </button>
      <h1 class="ad-title">{{ server ? server.name : 'Painel do servidor' }}</h1>
      <span v-if="server" class="k-badge" :class="isAdmin ? 'k-badge-info' : 'k-badge-dim'">{{ myRoleLabel }}</span>
      <nav class="ad-tabs">
        <button
          v-for="t in visibleTabs" :key="t"
          :class="['ad-tab', tab === t && 'k-active']"
          @click="tab = t"
        >{{ t }}</button>
      </nav>
    </header>

    <p v-if="err.load" class="ad-card ad-error">{{ err.load }}</p>

    <!-- Membros -->
    <section v-if="tab === 'Membros'" class="ad-card">
      <h2><PixelIcon name="users" size="0.9375rem" />Membros ({{ members.length }})</h2>
      <ul class="ad-list">
        <li v-for="m in members" :key="m.id" class="ad-item">
          <span class="ad-member">
            <span class="ad-email">
              {{ m.name || m.email }}
              <span v-if="m.id === auth.userId" class="ad-you">(você)</span>
            </span>
            <span class="ad-dim" :title="m.joinedAt ? '' : 'A API ainda não envia a data de entrada'">
              desde {{ joinedLabel(m) }}
            </span>
          </span>
          <span class="ad-actions">
            <span class="k-badge" :class="roleBadge(m)">{{ roleLabel(m) }}</span>
            <button v-if="canManage(m)" class="ad-mini" :disabled="busy" @click="toggleRole(m)">
              {{ m.serverRole === 'admin' ? 'rebaixar' : 'promover' }}
            </button>
            <button v-if="isOwner && m.id !== auth.userId" class="ad-mini" :disabled="busy" @click="transfer(m)">
              <PixelIcon name="crown" size="0.75rem" />passar posse
            </button>
            <button v-if="canManage(m)" class="ad-mini ad-danger" :disabled="busy" @click="kick(m)">remover</button>
          </span>
        </li>
        <li v-if="!members.length" class="ad-empty">Nenhum membro conectado a este servidor agora.</li>
      </ul>
      <p v-if="err.members" class="ad-error">{{ err.members }}</p>
    </section>

    <!-- Convite -->
    <section v-if="tab === 'Convite'" class="ad-card">
      <h2><PixelIcon name="link" size="0.9375rem" />Link de convite</h2>
      <p class="k-hint-text">
        Este é o link do servidor. Ele não expira e não tem limite de usos — mande hoje ou daqui a
        seis meses que continua valendo. Quem abrir entra direto aqui (faz login ou cria conta e já cai no convite).
      </p>
      <div class="ad-invite-row">
        <input
          class="ad-input ad-invite-input" :value="inviteUrl" readonly
          @focus="($event.target as HTMLInputElement).select()"
        />
        <button class="ad-btn" :disabled="!invite" @click="copyInvite">
          <PixelIcon :name="copied ? 'check' : 'copy'" size="0.875rem" />{{ copied ? 'Copiado' : 'Copiar' }}
        </button>
      </div>
      <p v-if="invite" class="ad-dim">
        {{ invite.uses }} {{ invite.uses === 1 ? 'pessoa entrou' : 'pessoas entraram' }} por este link.
      </p>

      <div class="ad-zone">
        <h3 class="ad-zone-title"><PixelIcon name="square-alert" size="0.875rem" />Revogar</h3>
        <p class="k-hint-text">
          Revogar troca o código por outro: o link atual para de funcionar na hora para todo mundo que
          o tiver. Quem já entrou continua membro. É a saída quando o link vaza.
        </p>
        <button class="ad-btn ad-btn-danger" :disabled="busy || !invite" @click="revoke">
          <PixelIcon name="unlink" size="0.875rem" />Revogar link
        </button>
      </div>
      <p v-if="err.invite" class="ad-error">{{ err.invite }}</p>
    </section>

    <!-- Mundos -->
    <section v-if="tab === 'Mundos'" class="ad-card">
      <h2>Mundos do servidor ({{ serverMaps.length }})</h2>
      <ul class="ad-list">
        <li v-for="w in serverMaps" :key="w.id" class="ad-item">
          <span>{{ w.name }} <span class="ad-dim">· {{ w.width }}×{{ w.height }}</span></span>
          <button class="ad-mini ad-danger" :disabled="busy" @click="del(w)">
            <PixelIcon name="trash" size="0.75rem" />apagar
          </button>
        </li>
        <li v-if="!serverMaps.length" class="ad-empty">Nenhum mundo criado ainda.</li>
      </ul>
      <p v-if="err.maps" class="ad-error">{{ err.maps }}</p>
    </section>

    <!-- Servidor -->
    <section v-if="tab === 'Servidor'" class="ad-card">
      <h2>Configurações</h2>

      <template v-if="server && isAdmin">
        <label class="ad-label" for="ad-name">Nome do servidor</label>
        <input id="ad-name" v-model.trim="serverNameEdit" maxlength="40" class="ad-input" />
        <button class="ad-btn" :disabled="busy || !serverNameEdit" @click="saveName">Salvar</button>
        <p v-if="saved" class="ad-ok"><PixelIcon name="check" size="0.875rem" />Salvo</p>
        <p v-if="err.name" class="ad-error">{{ err.name }}</p>
      </template>

      <div v-if="server" class="ad-zone">
        <h3 class="ad-zone-title"><PixelIcon name="logout" size="0.875rem" />Sair do servidor</h3>
        <p class="k-hint-text">
          Você deixa de ver os mundos, os membros e o convite daqui. Nada é apagado, e dá pra voltar
          depois com um novo link de convite. O último administrador precisa transferir a posse antes de sair.
        </p>
        <button class="ad-btn ad-btn-danger" :disabled="busy" @click="leave">Sair de {{ server.name }}</button>
        <p v-if="err.leave" class="ad-error">{{ err.leave }}</p>
      </div>

      <div v-if="server && isOwner" class="ad-zone">
        <h3 class="ad-zone-title"><PixelIcon name="archive" size="0.875rem" />Arquivar servidor</h3>
        <p class="k-hint-text">
          O servidor some das listagens, do seletor e da barra lateral de todo mundo. Membros, mundos e
          o link de convite continuam salvos — nada é apagado, e dá pra restaurar aqui embaixo quando quiser.
        </p>
        <button v-if="!archiving" class="ad-btn ad-btn-danger" @click="startArchive">Arquivar…</button>
        <template v-else>
          <label class="ad-label" for="ad-archive">Para confirmar, digite <strong>{{ server.name }}</strong></label>
          <input id="ad-archive" v-model="archiveConfirm" class="ad-input" :placeholder="server.name" autocomplete="off" />
          <div class="ad-zone-actions">
            <button class="ad-btn ad-btn-danger" :disabled="busy || !archiveMatches" @click="archive">
              Arquivar servidor
            </button>
            <button class="ad-btn ad-btn-ghost" :disabled="busy" @click="archiving = false">Cancelar</button>
          </div>
        </template>
        <p v-if="err.archive" class="ad-error">{{ err.archive }}</p>
      </div>

      <div class="ad-zone">
        <h3 class="ad-zone-title"><PixelIcon name="archive" size="0.875rem" />Arquivados</h3>
        <p v-if="!server" class="k-hint-text">
          Você não está em nenhum servidor ativo no momento.
        </p>
        <ul class="ad-list">
          <li v-for="s in archivedServers" :key="s.id" class="ad-item">
            <span>{{ s.name }} <span class="ad-dim">· arquivado</span></span>
            <button v-if="s.role === 'admin'" class="ad-mini" :disabled="busy" @click="restore(s)">
              <PixelIcon name="undo" size="0.75rem" />restaurar
            </button>
          </li>
          <li v-if="!archivedServers.length" class="ad-empty">Nenhum servidor arquivado.</li>
        </ul>
        <p v-if="restored" class="ad-ok"><PixelIcon name="check" size="0.875rem" />{{ restored }}</p>
        <p v-if="err.restore" class="ad-error">{{ err.restore }}</p>
        <button v-if="!server" class="ad-btn" @click="router.push('/onboarding')">Ir para meus servidores</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore'
import {
  getMyServer, getArchivedServers, getInvite, revokeInvite, inviteLink,
  leaveServer, transferServer, archiveServer, restoreServer,
  setMemberRole, removeMember, updateServer,
  type Server, type ServerMember, type ServerInvite, type MyServerSummary,
} from '@/services/server.api'
import { fetchMaps, deleteMap } from '@/services/maps.api'
import type { MapDef } from '@/game/maps'
import PixelIcon from '@/components/PixelIcon.vue'

type Tab = 'Membros' | 'Convite' | 'Mundos' | 'Servidor'

const router = useRouter()
const auth = useAuthStore()
const tab = ref<Tab>('Membros')

const server = ref<Server | null>(null)
const members = ref<ServerMember[]>([])
const archivedServers = ref<MyServerSummary[]>([])
const serverMaps = ref<MapDef[]>([])
const invite = ref<ServerInvite | null>(null)
const serverNameEdit = ref('')
const archiveConfirm = ref('')
const archiving = ref(false)
const copied = ref(false)
const saved = ref(false)
const restored = ref('')
const busy = ref(false)
const err = ref<Record<string, string>>({})

const me = computed(() => members.value.find((m) => m.id === auth.userId))
const isAdmin = computed(() => me.value?.serverRole === 'admin')
const isOwner = computed(() => !!server.value && server.value.ownerId === auth.userId)
const myRoleLabel = computed(() => (isOwner.value ? 'dono' : isAdmin.value ? 'admin' : 'membro'))
const inviteUrl = computed(() => (invite.value ? inviteLink(invite.value.code) : ''))
const archiveMatches = computed(() => archiveConfirm.value.trim() === server.value?.name)

const visibleTabs = computed<Tab[]>(() => {
  if (!server.value) return ['Servidor']
  return isAdmin.value ? ['Membros', 'Convite', 'Mundos', 'Servidor'] : ['Membros', 'Servidor']
})

function fail(key: string, e: unknown) {
  err.value = { ...err.value, [key]: (e as Error).message }
}

// o back só impede o admin de mexer em si mesmo; rebaixar/remover o dono deixaria
// o servidor sem dono administrador, então o dono fica fora do alcance por aqui
function canManage(m: ServerMember) {
  return isAdmin.value && m.id !== auth.userId && m.id !== server.value?.ownerId
}

function roleLabel(m: ServerMember) {
  if (m.id === server.value?.ownerId) return 'dono'
  return m.serverRole === 'admin' ? 'admin' : 'membro'
}
function roleBadge(m: ServerMember) {
  if (m.id === server.value?.ownerId) return 'k-badge-warning'
  return m.serverRole === 'admin' ? 'k-badge-info' : 'k-badge-dim'
}
function joinedLabel(m: ServerMember) {
  if (!m.joinedAt) return '—'
  return new Date(m.joinedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function load() {
  err.value = {}
  server.value = await getMyServer()
  members.value = server.value?.members || []
  serverNameEdit.value = server.value?.name || ''
  archivedServers.value = await getArchivedServers()

  // sem servidor ativo e sem arquivado pra restaurar, o painel não tem o que mostrar
  if (!server.value && !archivedServers.value.length) { router.replace('/onboarding'); return }

  if (!visibleTabs.value.includes(tab.value)) tab.value = visibleTabs.value[0]
  if (!server.value || !isAdmin.value) return

  try { invite.value = await getInvite(server.value.id) } catch (e) { fail('invite', e) }
  try { serverMaps.value = (await fetchMaps()).filter((m) => !m.isTemplate) } catch (e) { fail('load', e) }
}

async function run(key: string, action: () => Promise<void>) {
  err.value = {}
  busy.value = true
  try { await action() } catch (e) { fail(key, e) } finally { busy.value = false }
}

async function copyInvite() {
  try {
    await navigator.clipboard.writeText(inviteUrl.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch { /* navegador sem clipboard: o input fica selecionável pra cópia manual */ }
}

function revoke() {
  if (!server.value) return
  if (!confirm('Revogar o link de convite? O link atual para de funcionar na hora para todo mundo que o tiver, e um novo nasce no lugar.')) return
  const id = server.value.id
  run('invite', async () => {
    invite.value = await revokeInvite(id)
    copied.value = false
  })
}

function toggleRole(m: ServerMember) {
  run('members', async () => {
    await setMemberRole(m.id, m.serverRole === 'admin' ? 'member' : 'admin')
    await load()
  })
}

function transfer(m: ServerMember) {
  if (!server.value) return
  if (!confirm(`Passar a posse de ${server.value.name} para ${m.name || m.email}? Essa pessoa vira dona e administradora do servidor, e você fica como membro comum.`)) return
  const id = server.value.id
  run('members', async () => {
    await transferServer(id, m.id)
    await load()
  })
}

function kick(m: ServerMember) {
  if (!confirm(`Remover ${m.name || m.email} do servidor?`)) return
  run('members', async () => {
    await removeMember(m.id)
    await load()
  })
}

function leave() {
  if (!server.value) return
  if (!confirm(`Sair de ${server.value.name}? Você perde o acesso aos mundos e aos membros daqui até receber um novo convite.`)) return
  const id = server.value.id
  run('leave', async () => {
    await leaveServer(id)
    router.push('/onboarding')
  })
}

function startArchive() {
  archiveConfirm.value = ''
  archiving.value = true
}

function archive() {
  if (!server.value || !archiveMatches.value) return
  const id = server.value.id
  run('archive', async () => {
    await archiveServer(id)
    router.push('/onboarding')
  })
}

function restore(s: MyServerSummary) {
  restored.value = ''
  run('restore', async () => {
    await restoreServer(s.id)
    restored.value = `${s.name} voltou para a sua lista de servidores.`
    await load()
  })
}

function saveName() {
  run('name', async () => {
    await updateServer(serverNameEdit.value)
    saved.value = true
    setTimeout(() => (saved.value = false), 2000)
    await load()
  })
}

function del(w: MapDef) {
  if (!confirm(`Apagar o mundo "${w.name}"? Não dá pra desfazer.`)) return
  run('maps', async () => {
    await deleteMap(w.id)
    serverMaps.value = serverMaps.value.filter((m) => m.id !== w.id)
  })
}

onMounted(() => run('load', load))
</script>

<style scoped>
.ad-root { min-height: 100vh; background: var(--bg-1); color: var(--text); font-family: var(--f-sans); padding: 0 0 2.5rem; }
.ad-head { padding: 1.125rem 1.5rem; border-bottom: 0.0625rem solid var(--border-strong); display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.ad-title { font-size: 1.125rem; margin: 0; }
.ad-back { display: inline-flex; align-items: center; gap: 0.25rem; background: transparent; border: 0.0625rem solid var(--border-strong); color: var(--text-2); font-family: inherit; font-size: 0.8125rem; padding: 0.3125rem 0.75rem; cursor: pointer; border-radius: var(--r-sm); }
.ad-back:hover { border-color: var(--primary-hi); color: var(--primary-hi); }
.ad-tabs { display: flex; gap: 0.375rem; margin-left: auto; flex-wrap: wrap; }
.ad-tab { background: var(--bg-3); border: 0.0625rem solid var(--border-strong); color: var(--text-2); font-family: inherit; font-size: 0.8125rem; padding: 0.375rem 0.875rem; cursor: pointer; border-radius: var(--r-sm); }
.ad-tab.k-active { color: var(--text); }

.ad-card { max-width: 47.5rem; margin: 1.5rem auto; padding: 1.25rem; background: var(--bg-2); border: 0.0625rem solid var(--border-strong); border-radius: var(--r-sm); }
.ad-card h2 { font-size: 0.9375rem; margin: 0 0 0.75rem; display: flex; align-items: center; gap: 0.4375rem; }

.ad-list { list-style: none; margin: 0.75rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.ad-item { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; background: var(--bg-1); border: 0.0625rem solid var(--border); padding: 0.5625rem 0.75rem; border-radius: var(--r-sm); font-size: 0.875rem; flex-wrap: wrap; }
.ad-member { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
.ad-email { color: var(--text); overflow-wrap: anywhere; }
.ad-you { color: var(--text-3); font-size: 0.75rem; }
.ad-actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.ad-mini { display: inline-flex; align-items: center; gap: 0.25rem; background: transparent; border: 0.0625rem solid var(--border-strong); color: var(--text-2); font-family: inherit; padding: 0.1875rem 0.5rem; cursor: pointer; border-radius: var(--r-sm); font-size: 0.75rem; }
.ad-mini:hover:not(:disabled) { border-color: var(--primary-hi); color: var(--primary-hi); }
.ad-mini:disabled, .ad-btn:disabled { opacity: 0.5; cursor: default; }
.ad-danger { color: var(--err); border-color: rgba(248, 113, 113, 0.4); }
.ad-danger:hover:not(:disabled) { border-color: var(--err); color: var(--err); }
.ad-dim { color: var(--text-3); font-size: 0.75rem; }
.ad-empty { color: var(--text-3); font-size: 0.8125rem; }

.ad-btn { background: var(--primary); border: 0.0625rem solid var(--primary-hi); color: white; font-family: inherit; font-size: 0.8125rem; padding: 0.5rem 0.875rem; cursor: pointer; border-radius: var(--r-sm); font-weight: 600; display: inline-flex; align-items: center; gap: 0.375rem; align-self: flex-start; }
.ad-btn:hover:not(:disabled) { background: var(--primary-hi); }
.ad-btn-ghost { background: transparent; border-color: var(--border-strong); color: var(--text-2); }
.ad-btn-ghost:hover:not(:disabled) { background: var(--bg-3); color: var(--text); }
.ad-btn-danger { background: transparent; border-color: rgba(248, 113, 113, 0.5); color: var(--err); }
.ad-btn-danger:hover:not(:disabled) { background: rgba(248, 113, 113, 0.12); }

.ad-invite-row { display: flex; gap: 0.5rem; margin: 0.75rem 0 0.375rem; }
.ad-invite-input { flex: 1; min-width: 0; margin: 0; font-family: var(--f-mono); font-size: 0.8125rem; }

.ad-input { width: 100%; box-sizing: border-box; background: var(--bg-1); border: 0.0625rem solid var(--border-strong); color: var(--text); font-family: inherit; font-size: 0.875rem; padding: 0.5625rem; border-radius: var(--r-sm); margin-bottom: 0.75rem; }
.ad-input:focus { outline: none; border-color: var(--primary-hi); }
.ad-label { font-size: 0.75rem; color: var(--text-3); display: block; margin-bottom: 0.3125rem; }

.ad-zone { margin-top: 1.25rem; padding-top: 1.25rem; border-top: 0.0625rem solid var(--border); display: flex; flex-direction: column; gap: 0.5rem; }
.ad-zone-title { font-size: 0.8125rem; margin: 0; display: flex; align-items: center; gap: 0.375rem; color: var(--text-2); }
.ad-zone-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

.ad-error { color: var(--err); font-size: 0.8125rem; margin: 0.25rem 0 0; }
.ad-ok { color: var(--ok); font-size: 0.8125rem; display: flex; align-items: center; gap: 0.375rem; margin: 0.25rem 0 0; }
</style>
