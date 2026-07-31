<template>
  <PanelShell title="administração" icon="shield" size="lg" @close="emit('close')">
    <div class="ap-body">
      <div class="ap-top">
        <h2 class="ap-name ellipsis">{{ server ? server.name : 'Painel do servidor' }}</h2>
        <span v-if="server" class="k-badge" :class="isAdmin ? 'k-badge-info' : 'k-badge-dim'">{{ myRoleLabel }}</span>
        <nav class="ap-tabs">
          <button
            v-for="t in visibleTabs" :key="t"
            class="k-btn k-btn-ghost k-btn-xs" :class="{ 'k-active': tab === t }"
            @click="tab = t"
          >{{ t }}</button>
        </nav>
      </div>

      <p v-if="err.load" class="ap-error">{{ err.load }}</p>

      <!-- Membros -->
      <section v-if="tab === 'Membros'" class="ap-section">
        <h3 class="ap-title"><PixelIcon name="users" size="0.9375rem" />Membros ({{ members.length }})</h3>
        <ul class="ap-list">
          <li v-for="m in members" :key="m.id" class="ap-item">
            <span class="ap-member">
              <span class="ap-email">
                {{ m.name || m.email }}
                <span v-if="m.id === auth.userId" class="ap-dim">(você)</span>
              </span>
              <span class="ap-dim" :title="m.joinedAt ? '' : 'A API ainda não envia a data de entrada'">
                desde {{ joinedLabel(m) }}
              </span>
            </span>
            <span class="ap-actions">
              <span class="k-badge" :class="roleBadge(m)">{{ roleLabel(m) }}</span>
              <button v-if="canManage(m)" class="k-btn k-btn-ghost k-btn-xs" :disabled="busy" @click="toggleRole(m)">
                {{ m.serverRole === 'admin' ? 'rebaixar' : 'promover' }}
              </button>
              <button v-if="isOwner && m.id !== auth.userId" class="k-btn k-btn-ghost k-btn-xs" :disabled="busy" @click="transfer(m)">
                <PixelIcon name="crown" size="0.75rem" />passar posse
              </button>
              <button v-if="canManage(m)" class="k-btn k-btn-ghost k-btn-xs ap-danger" :disabled="busy" @click="kick(m)">remover</button>
            </span>
          </li>
          <li v-if="!members.length" class="ap-empty">Nenhum membro conectado a este servidor agora.</li>
        </ul>
        <p v-if="err.members" class="ap-error">{{ err.members }}</p>
      </section>

      <!-- Convite -->
      <section v-if="tab === 'Convite'" class="ap-section">
        <h3 class="ap-title"><PixelIcon name="link" size="0.9375rem" />Link de convite</h3>
        <p class="k-hint-text ap-hint">
          Este é o link do servidor. Ele não expira e não tem limite de usos — mande hoje ou daqui a
          seis meses que continua valendo. Quem abrir entra direto aqui (faz login ou cria conta e já cai no convite).
        </p>
        <div class="ap-invite-row">
          <input
            class="k-input k-input-xs ap-invite-input" :value="inviteUrl" readonly
            @focus="($event.target as HTMLInputElement).select()"
          />
          <button class="k-btn k-btn-primary k-btn-xs" :disabled="!invite" @click="copyInvite">
            <PixelIcon :name="copied ? 'check' : 'copy'" size="0.875rem" />{{ copied ? 'Copiado' : 'Copiar' }}
          </button>
        </div>
        <p v-if="invite" class="ap-dim">
          {{ invite.uses }} {{ invite.uses === 1 ? 'pessoa entrou' : 'pessoas entraram' }} por este link.
        </p>

        <div class="ap-zone">
          <h4 class="ap-zone-title"><PixelIcon name="square-alert" size="0.875rem" />Revogar</h4>
          <p class="k-hint-text ap-hint">
            Revogar troca o código por outro: o link atual para de funcionar na hora para todo mundo que
            o tiver. Quem já entrou continua membro. É a saída quando o link vaza.
          </p>
          <button class="k-btn k-btn-ghost k-btn-xs ap-danger" :disabled="busy || !invite" @click="revoke">
            <PixelIcon name="unlink" size="0.875rem" />Revogar link
          </button>
        </div>
        <p v-if="err.invite" class="ap-error">{{ err.invite }}</p>
      </section>

      <!-- Mundos -->
      <section v-if="tab === 'Mundos'" class="ap-section">
        <h3 class="ap-title">Mundos do servidor ({{ serverMaps.length }})</h3>
        <ul class="ap-list">
          <li v-for="w in serverMaps" :key="w.id" class="ap-item">
            <span>{{ w.name }} <span class="ap-dim">· {{ w.width }}×{{ w.height }}</span></span>
            <button class="k-btn k-btn-ghost k-btn-xs ap-danger" :disabled="busy" @click="del(w)">
              <PixelIcon name="trash" size="0.75rem" />apagar
            </button>
          </li>
          <li v-if="!serverMaps.length" class="ap-empty">Nenhum mundo criado ainda.</li>
        </ul>
        <p v-if="err.maps" class="ap-error">{{ err.maps }}</p>
      </section>

      <!-- Servidor -->
      <section v-if="tab === 'Servidor'" class="ap-section">
        <h3 class="ap-title">Configurações</h3>

        <template v-if="server && isAdmin">
          <label class="k-label" for="ap-name">Nome do servidor</label>
          <input id="ap-name" v-model.trim="serverNameEdit" maxlength="40" class="k-input k-input-sm" />
          <button class="k-btn k-btn-primary k-btn-xs" :disabled="busy || !serverNameEdit" @click="saveName">Salvar</button>
          <p v-if="saved" class="ap-ok"><PixelIcon name="check" size="0.875rem" />Salvo</p>
          <p v-if="err.name" class="ap-error">{{ err.name }}</p>
        </template>

        <div v-if="server" class="ap-zone">
          <h4 class="ap-zone-title"><PixelIcon name="logout" size="0.875rem" />Sair do servidor</h4>
          <p class="k-hint-text ap-hint">
            Você deixa de ver os mundos, os membros e o convite daqui. Nada é apagado, e dá pra voltar
            depois com um novo link de convite. O último administrador precisa transferir a posse antes de sair.
          </p>
          <button class="k-btn k-btn-ghost k-btn-xs ap-danger" :disabled="busy" @click="leave">Sair de {{ server.name }}</button>
          <p v-if="err.leave" class="ap-error">{{ err.leave }}</p>
        </div>

        <div v-if="server && isOwner" class="ap-zone">
          <h4 class="ap-zone-title"><PixelIcon name="archive" size="0.875rem" />Arquivar servidor</h4>
          <p class="k-hint-text ap-hint">
            O servidor some das listagens, do seletor e da barra lateral de todo mundo. Membros, mundos e
            o link de convite continuam salvos — nada é apagado, e dá pra restaurar aqui embaixo quando quiser.
          </p>
          <button v-if="!archiving" class="k-btn k-btn-ghost k-btn-xs ap-danger" @click="startArchive">Arquivar…</button>
          <template v-else>
            <label class="k-label" for="ap-archive">Para confirmar, digite <strong>{{ server.name }}</strong></label>
            <input id="ap-archive" v-model="archiveConfirm" class="k-input k-input-sm" :placeholder="server.name" autocomplete="off" />
            <div class="ap-zone-actions">
              <button class="k-btn k-btn-ghost k-btn-xs ap-danger" :disabled="busy || !archiveMatches" @click="archive">
                Arquivar servidor
              </button>
              <button class="k-btn k-btn-ghost k-btn-xs" :disabled="busy" @click="archiving = false">Cancelar</button>
            </div>
          </template>
          <p v-if="err.archive" class="ap-error">{{ err.archive }}</p>
        </div>

        <div class="ap-zone">
          <h4 class="ap-zone-title"><PixelIcon name="archive" size="0.875rem" />Arquivados</h4>
          <p v-if="!server" class="k-hint-text ap-hint">Você não está em nenhum servidor ativo no momento.</p>
          <ul class="ap-list">
            <li v-for="s in archivedServers" :key="s.id" class="ap-item">
              <span>{{ s.name }} <span class="ap-dim">· arquivado</span></span>
              <button v-if="s.role === 'admin'" class="k-btn k-btn-ghost k-btn-xs" :disabled="busy" @click="restore(s)">
                <PixelIcon name="undo" size="0.75rem" />restaurar
              </button>
            </li>
            <li v-if="!archivedServers.length" class="ap-empty">Nenhum servidor arquivado.</li>
          </ul>
          <p v-if="restored" class="ap-ok"><PixelIcon name="check" size="0.875rem" />{{ restored }}</p>
          <p v-if="err.restore" class="ap-error">{{ err.restore }}</p>
          <button v-if="!server" class="k-btn k-btn-primary k-btn-xs" @click="emit('open-servers')">Ir para meus servidores</button>
        </div>
      </section>
    </div>
  </PanelShell>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/useAuthStore'
import {
  getMyServer, getArchivedServers, getInvite, revokeInvite, inviteLink,
  leaveServer, transferServer, archiveServer, restoreServer,
  setMemberRole, removeMember, updateServer,
  type Server, type ServerMember, type ServerInvite, type MyServerSummary,
} from '@/services/server.api'
import { fetchMaps, deleteMap } from '@/services/maps.api'
import type { MapDef } from '@/game/maps'
import PanelShell from '@/components/PanelShell.vue'
import PixelIcon from '@/components/PixelIcon.vue'

type Tab = 'Membros' | 'Convite' | 'Mundos' | 'Servidor'

// server-changed: sair/arquivar mudam o servidor ativo no back, e o jogo atrás
// precisa recarregar mundos e presença
const emit = defineEmits<{ close: []; 'server-changed': []; 'open-servers': [] }>()

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
  if (!server.value && !archivedServers.value.length) { emit('open-servers'); return }

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
  void run('invite', async () => {
    invite.value = await revokeInvite(id)
    copied.value = false
  })
}

function toggleRole(m: ServerMember) {
  void run('members', async () => {
    await setMemberRole(m.id, m.serverRole === 'admin' ? 'member' : 'admin')
    await load()
  })
}

function transfer(m: ServerMember) {
  if (!server.value) return
  if (!confirm(`Passar a posse de ${server.value.name} para ${m.name || m.email}? Essa pessoa vira dona e administradora do servidor, e você fica como membro comum.`)) return
  const id = server.value.id
  void run('members', async () => {
    await transferServer(id, m.id)
    await load()
  })
}

function kick(m: ServerMember) {
  if (!confirm(`Remover ${m.name || m.email} do servidor?`)) return
  void run('members', async () => {
    await removeMember(m.id)
    await load()
  })
}

function leave() {
  if (!server.value) return
  if (!confirm(`Sair de ${server.value.name}? Você perde o acesso aos mundos e aos membros daqui até receber um novo convite.`)) return
  const id = server.value.id
  void run('leave', async () => {
    await leaveServer(id)
    emit('server-changed')
    emit('open-servers')
  })
}

function startArchive() {
  archiveConfirm.value = ''
  archiving.value = true
}

function archive() {
  if (!server.value || !archiveMatches.value) return
  const id = server.value.id
  void run('archive', async () => {
    await archiveServer(id)
    emit('server-changed')
    emit('open-servers')
  })
}

function restore(s: MyServerSummary) {
  restored.value = ''
  void run('restore', async () => {
    await restoreServer(s.id)
    restored.value = `${s.name} voltou para a sua lista de servidores.`
    await load()
  })
}

function saveName() {
  void run('name', async () => {
    await updateServer(serverNameEdit.value)
    saved.value = true
    setTimeout(() => (saved.value = false), 2000)
    await load()
  })
}

function del(w: MapDef) {
  if (!confirm(`Apagar o mundo "${w.name}"? Não dá pra desfazer.`)) return
  void run('maps', async () => {
    await deleteMap(w.id)
    serverMaps.value = serverMaps.value.filter((m) => m.id !== w.id)
  })
}

onMounted(() => run('load', load))
</script>

<style scoped>
.ap-body {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.ap-top {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-wrap: wrap;
}

.ap-name {
  font-size: 1.0625rem;
  margin: 0;
  min-width: 0;
}

.ap-tabs {
  display: flex;
  gap: 0.375rem;
  margin-left: auto;
  flex-wrap: wrap;
}

.ap-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  background: var(--bg-1);
  border: 0.0625rem solid var(--border);
  padding: 0.875rem;
}

.ap-title {
  font-size: 0.9375rem;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.4375rem;
}

.ap-hint { margin: 0; }

.ap-list {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ap-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  background: var(--bg-2);
  border: 0.0625rem solid var(--border);
  padding: 0.5625rem 0.75rem;
  font-size: 0.875rem;
  flex-wrap: wrap;
}

.ap-member { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
.ap-email { color: var(--text); overflow-wrap: anywhere; }
.ap-actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }

.ap-dim { color: var(--text-3); font-size: 0.75rem; }
.ap-empty { color: var(--text-3); font-size: 0.8125rem; }

.ap-danger { color: var(--err); border-color: color-mix(in srgb, var(--err) 40%, transparent); }
.ap-danger:hover:not(:disabled) { border-color: var(--err); color: var(--err); }

.ap-invite-row {
  display: flex;
  gap: 0.5rem;
  width: 100%;
  align-items: center;
}
.k-input.ap-invite-input { flex: 1; min-width: 0; font-family: var(--f-mono); }

.ap-zone {
  width: 100%;
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 0.0625rem solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}
.ap-zone-title {
  font-size: 0.8125rem;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--text-2);
}
.ap-zone-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

.ap-error { color: var(--err); font-size: 0.8125rem; margin: 0; }
.ap-ok { color: var(--ok); font-size: 0.8125rem; display: flex; align-items: center; gap: 0.375rem; margin: 0; }

button:disabled { opacity: 0.5; cursor: default; }
</style>
