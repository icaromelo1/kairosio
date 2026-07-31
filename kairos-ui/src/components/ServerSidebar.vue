<template>
  <div class="ss-root">
    <nav class="ss-rail" aria-label="Servidores">
      <span class="ss-mark"><PixelK :scale="3" color="var(--primary-hi)" accent="var(--accent)" /></span>

      <button
        class="ss-toggle"
        :title="open ? 'Recolher o menu' : 'Expandir o menu'"
        :aria-label="open ? 'Recolher o menu' : 'Expandir o menu'"
        @click="emit('update:open', !open)"
      ><PixelIcon :name="open ? 'chevron-left' : 'chevron-right'" size="0.875rem" /></button>

      <div class="ss-rail-list">
        <button
          v-for="s in servers"
          :key="s.id"
          class="ss-server"
          :class="{ 'ss-server-shown': s.id === shownServerId, 'ss-server-here': s.id === activeServerId }"
          :title="serverTitle(s)"
          @click="showServer(s.id)"
        >
          <span class="ss-server-initials">{{ initials(s.name) }}</span>
          <span v-if="onlineCount(s.id)" class="ss-server-badge">{{ onlineCount(s.id) }}</span>
        </button>
      </div>

      <button
        class="ss-server ss-add"
        title="Entrar noutro servidor por convite"
        aria-label="Entrar noutro servidor por convite"
        @click="emit('open-panel', 'servidores')"
      ><PixelIcon name="plus" size="0.875rem" /></button>

      <!-- com a barra recolhida este é o único lugar onde o microfone aparece:
           some da lista de mundos, não do olho de quem está no ar -->
      <button
        v-if="!open"
        class="ss-rail-mic"
        :class="micLive ? 'ss-ctrl-live' : micOn ? 'ss-ctrl-on' : 'ss-ctrl-off'"
        :disabled="voiceLive && !micAvailable"
        :title="micTitle"
        :aria-label="micTitle"
        @click="toggleMic"
      ><PixelIcon :name="micOn ? 'mic' : 'mic-off'" size="0.875rem" /></button>
    </nav>

    <section v-if="open" class="ss-main">
      <header class="ss-head">
        <span class="ss-head-name ellipsis">{{ shownServer?.name || 'Mundos abertos' }}</span>
        <span v-if="showingHere" class="ss-head-tag">aqui</span>
      </header>

      <div v-if="!showingHere" class="ss-away">
        <span class="ss-away-text">Só olhando. Você está em <b>{{ activeServer?.name || 'nenhum servidor' }}</b>.</span>
        <button class="ss-away-back" @click="shownServerId = activeServerId">
          <PixelIcon name="corner-up-left" size="0.75rem" />voltar
        </button>
      </div>

      <div class="ss-body">
        <template v-if="showingHere">
          <div class="ss-label">Mundos</div>

          <div v-for="w in worlds" :key="w.id" class="ss-world">
            <div class="ss-world-row" :class="{ 'ss-world-row-here': w.current }">
              <button
                class="ss-world-caret"
                :title="w.collapsed ? 'Mostrar quem está aqui' : 'Esconder quem está aqui'"
                :aria-expanded="!w.collapsed"
                @click="toggleWorld(w)"
              ><PixelIcon :name="w.collapsed ? 'chevron-right' : 'chevron-down'" size="0.75rem" /></button>

              <button class="ss-world-name" :title="`Entrar em ${w.name}`" @click="emit('select-world', w.id)">
                <span class="ellipsis">{{ w.name }}</span>
              </button>

              <span v-if="w.current" class="ss-world-here">aqui</span>
              <span class="ss-world-count" :class="{ 'ss-world-count-zero': !w.people.length }">{{ w.people.length }}</span>
            </div>

            <ul v-if="!w.collapsed && w.people.length" class="ss-people">
              <li v-for="p in w.people" :key="p.id" class="ss-person">
                <span class="ss-person-dot">●</span>
                <span class="ellipsis">{{ p.name }}</span>
                <span v-if="p.userId === auth.userId" class="ss-person-you">você</span>
                <PixelIcon
                  v-if="p.micMuted"
                  name="mic"
                  :off="true"
                  size="0.75rem"
                  class="ss-person-icon"
                  title="microfone desligado"
                />
                <PixelIcon
                  v-if="p.sharingScreen"
                  name="monitor"
                  size="0.75rem"
                  class="ss-person-icon ss-person-screen"
                  title="transmitindo a tela"
                />
              </li>
            </ul>
          </div>
        </template>

        <div v-else class="ss-other">
          <div class="ss-other-count">
            {{ onlineCount(shownServerId) }} {{ onlineCount(shownServerId) === 1 ? 'pessoa online' : 'pessoas online' }}
          </div>
          <p class="k-hint-text">Os mundos de outro servidor ainda não chegam pela API. Entrar troca servidor e mundo de uma vez.</p>
          <button class="k-btn k-btn-primary k-btn-xs ss-other-enter" :disabled="busy" @click="enterServer(shownServerId)">
            {{ busy ? 'entrando…' : 'entrar neste servidor' }}
          </button>
        </div>

        <p v-if="error" class="ss-error">{{ error }}</p>

        <div class="ss-label">Ações</div>
        <div class="ss-acts">
          <button v-if="!isGuest" class="k-btn k-btn-ghost ss-act" @click="router.push('/editor/new')">
            <PixelIcon name="plus-box" size="0.75rem" /><span>Criar mundo</span>
          </button>
          <button v-if="canEditCurrentWorld" class="k-btn k-btn-ghost ss-act" @click="router.push(`/editor/${currentMapId}`)">
            <PixelIcon name="pen-square" size="0.75rem" /><span>Editar este mundo</span>
          </button>
          <button v-if="!isGuest" class="k-btn k-btn-ghost ss-act" @click="emit('open-panel', 'admin')">
            <PixelIcon name="shield" size="0.75rem" /><span>Administração</span>
          </button>
          <button class="k-btn k-btn-ghost ss-act" @click="emit('open-panel', 'feedback')">
            <PixelIcon name="bug" size="0.75rem" /><span>Feedback / Reportar</span>
          </button>
          <button class="k-btn k-btn-ghost ss-act" @click="emit('leave')">
            <PixelIcon name="logout" size="0.75rem" /><span>Sair</span>
          </button>
        </div>
      </div>

      <footer class="ss-foot">
        <!-- a voz sobe sozinha ao entrar num mundo: o estado do microfone fica
             escrito aqui o tempo todo, e é daqui que se desliga -->
        <div class="ss-voice" :class="{ 'ss-voice-live': micLive, 'ss-voice-down': !voiceLive }" aria-live="polite">
          <span class="ss-voice-dot" />
          <PixelIcon :name="micOn ? 'mic' : 'mic-off'" size="0.6875rem" />
          <span class="ss-voice-text ellipsis">{{ voiceLabel }}</span>

          <button
            v-if="voiceDown"
            class="ss-voice-join"
            :title="media.state.error || 'Entrar na voz deste mundo'"
            @click="emit('join-voice')"
          >entrar</button>

          <PixelIcon
            v-else-if="deafened"
            name="volume"
            :off="true"
            size="0.6875rem"
            class="ss-voice-deaf"
            title="som desligado — você não ouve ninguém"
          />
        </div>

        <div class="ss-foot-main">
          <button class="ss-me" title="Editar avatar" @click="emit('open-panel', 'personagem')">
            <span class="ss-me-avatar"><PixelAvatar :scale="1.4" v-bind="look" :shadow="false" /></span>
            <span class="ss-me-info">
              <span class="ss-me-name ellipsis">{{ playerName }}</span>
              <span class="ss-me-hint">editar avatar</span>
            </span>
          </button>

          <div class="ss-foot-ctrls">
            <button
              class="ss-ctrl"
              :class="micLive ? 'ss-ctrl-live' : micOn ? 'ss-ctrl-on' : 'ss-ctrl-off'"
              :disabled="voiceLive && !micAvailable"
              :title="micTitle"
              :aria-label="micTitle"
              @click="toggleMic"
            ><PixelIcon :name="micOn ? 'mic' : 'mic-off'" size="0.875rem" /></button>

            <button
              class="ss-ctrl"
              :class="deafened ? 'ss-ctrl-deaf' : 'ss-ctrl-on'"
              :title="deafened ? 'Ligar o som de quem fala' : 'Desligar o som de quem fala'"
              :aria-label="deafened ? 'Ligar o som' : 'Desligar o som'"
              @click="toggleSound"
            ><PixelIcon name="volume-2" :off="deafened" size="0.875rem" /></button>

            <button
              class="ss-ctrl"
              :class="{ 'ss-ctrl-on': voiceLive }"
              :title="voiceLive ? 'Abrir a sala de voz — você está no ar' : 'Abrir a sala de voz'"
              aria-label="Abrir a sala de voz"
              @click="emit('open-media')"
            ><PixelIcon name="headphone" size="0.875rem" /></button>
          </div>
        </div>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getMyServers, switchServer, type MyServerSummary } from '@/services/server.api'
import {
  emitMicState,
  peopleInWorld,
  presenceByServer,
  serverOnlineCount,
  watchServerPresence,
  type PresencePerson,
} from '@/services/presence'
import { media } from '@/services/media'
import type { GamePanel } from '@/services/postAuth'
import { useAuthStore } from '@/stores/useAuthStore'
import type { MapDef } from '@/game/maps'
import type { AvatarLook } from '@/game/pixi/avatar'
import PixelAvatar from '@/components/pixel/PixelAvatar.vue'
import PixelIcon from '@/components/PixelIcon.vue'
import PixelK from '@/components/pixel/PixelK.vue'

interface WorldRow {
  id: string
  name: string
  current: boolean
  collapsed: boolean
  people: PresencePerson[]
}

const props = defineProps<{
  open: boolean
  maps: MapDef[]
  currentMapId: string
  playerName: string
  look: AvatarLook
  voiceOn: boolean
  canEditCurrentWorld: boolean
  isGuest: boolean
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  'select-world': [mapId: string]
  'server-changed': [serverId: string]
  'open-media': []
  'open-panel': [panel: GamePanel]
  'join-voice': []
  leave: []
}>()

const router = useRouter()
const auth = useAuthStore()

const servers = ref<MyServerSummary[]>([])
// onde estou (vem do backend) x o que estou olhando (só aqui) — enquanto
// divergirem, a lista é de outro servidor e não muda nada do meu personagem
const activeServerId = ref<string | null>(null)
const shownServerId = ref<string | null>(null)
const busy = ref(false)
const error = ref('')

const shownServer = computed(() => servers.value.find((s) => s.id === shownServerId.value) || null)
const activeServer = computed(() => servers.value.find((s) => s.id === activeServerId.value) || null)
const showingHere = computed(() => shownServerId.value === activeServerId.value)

const worlds = computed<WorldRow[]>(() =>
  props.maps.map((m) => {
    const people = activeServerId.value ? peopleInWorld(activeServerId.value, m.id) : []
    return {
      id: m.id,
      name: m.name,
      current: m.id === props.currentMapId,
      collapsed: collapsedFor(m.id, people.length),
      people,
    }
  }),
)

function onlineCount(serverId: string | null): number {
  return serverId ? serverOnlineCount(serverId) : 0
}

function serverTitle(s: MyServerSummary): string {
  if (s.id === activeServerId.value) return `${s.name} — você está aqui`
  return `${s.name} — ver sem sair de onde você está`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '??'
  const second = parts.length > 1 ? parts[1][0] : parts[0][1] || ''
  return (parts[0][0] + second).toUpperCase()
}

function showServer(serverId: string) {
  shownServerId.value = serverId
  if (!props.open) emit('update:open', true)
}

async function enterServer(serverId: string | null) {
  if (!serverId || busy.value || serverId === activeServerId.value) return
  busy.value = true
  error.value = ''
  try {
    await switchServer(serverId)
    for (const s of servers.value) s.active = s.id === serverId
    activeServerId.value = serverId
    shownServerId.value = serverId
    // quem recarrega mundos, presença e mídia é o GamePage: o socket carrega o
    // servidor do handshake e precisa reconectar pra sair da sala antiga
    emit('server-changed', serverId)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

async function loadServers() {
  try {
    servers.value = await getMyServers()
  } catch {
    servers.value = []
  }
  activeServerId.value = servers.value.find((s) => s.active)?.id ?? null
  if (!servers.value.some((s) => s.id === shownServerId.value)) shownServerId.value = activeServerId.value
  syncPresence()
}

// watchServerPresence SUBSTITUI a lista observada: mandar menos que todos os
// servidores apaga o badge dos demais. Lista ainda vazia (a carga não voltou)
// não emite nada: o gateway descarta um presenceWatch por 500ms, e um [] à toa
// engoliria a lista de verdade chegando logo atrás.
function syncPresence() {
  const ids = servers.value.map((s) => s.id)
  if (ids.length) watchServerPresence(ids)
  // socket novo (troca de servidor) nasce me considerando mudo
  pushMic(true)
}

// syncPresence: o GamePage chama depois de (re)conectar a presença — o connectPresence
// nasce sem nenhum servidor observado e sem saber do microfone.
// reloadServers: a barra não desmonta mais quando o servidor muda (virou painel), então
// a lista precisa ser buscada de novo — senão fica sem o servidor criado e com o "aqui"
// no lugar errado
defineExpose({ syncPresence, reloadServers: () => loadServers() })

// ---- colapsar por mundo ----
const COLLAPSE_KEY = 'kairos_worlds_collapsed'

function loadCollapsed(): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return out
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'boolean') out[id] = value
    }
  } catch {
    // preferência corrompida não pode impedir a lista de aparecer
  }
  return out
}

const collapsed = reactive<Record<string, boolean>>(loadCollapsed())

function collapsedFor(mapId: string, people: number): boolean {
  const saved = collapsed[mapId]
  if (typeof saved === 'boolean') return saved
  return mapId !== props.currentMapId && people === 0
}

function toggleWorld(world: WorldRow) {
  collapsed[world.id] = !world.collapsed
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed))
  } catch {
    // storage cheio/bloqueado não pode travar o clique
  }
}

// ---- microfone e som ----
const voiceLive = computed(() => props.voiceOn)
const voiceBusy = computed(() => media.state.connecting)
const voiceDown = computed(() => !voiceLive.value && !voiceBusy.value)
const micMuted = computed(() => media.state.micMuted)
const micAvailable = computed(() => media.state.micAvailable)
const deafened = computed(() => media.state.deafened)

// estar sendo ouvido de verdade. É este — não a preferência — que pinta o botão
// de verde e que a presença anuncia.
const micLive = computed(() => voiceLive.value && micAvailable.value && !micMuted.value)
// com a voz no ar o botão fala do estado real; sem ela, fala da intenção, que é
// o que vai valer assim que a sala subir
const micOn = computed(() => (voiceLive.value ? micLive.value : media.state.micWanted))

const voiceLabel = computed(() => {
  if (voiceBusy.value) return 'conectando à voz…'
  if (!voiceLive.value) return 'voz desligada'
  if (!micAvailable.value) return 'só ouvindo · sem microfone'
  return micMuted.value ? 'microfone desligado' : 'microfone aberto'
})

const micTitle = computed(() => {
  if (!voiceLive.value) {
    return micOn.value ? 'Microfone ligado — abre quando a voz conectar' : 'Ligar seu microfone e entrar na voz'
  }
  if (!micAvailable.value) return 'Sem acesso ao microfone — você só ouve'
  return micMuted.value ? 'Ligar seu microfone' : 'Desligar seu microfone — você está sendo ouvido'
})

function toggleMic() {
  const on = micOn.value
  void media.setMicMuted(on)
  // pedir o microfone com a voz fora do ar traz a voz junto — senão o clique não
  // faria nada visível
  if (!on && !voiceLive.value) emit('join-voice')
}

// desligar TODO o som é da camada de mídia (silencia os elementos de áudio);
// silenciar UMA pessoa continua sendo o clique no tile da janela de voz
function toggleSound() {
  media.setDeafened(!media.state.deafened)
}

// O indicador ao lado do nome não vem do LiveKit (que só alcança a sala de
// mídia): quem avisa a presença é o próprio dono. O gateway descarta dois
// avisos em menos de 500ms, e uma troca de mundo derruba e sobe o microfone em
// sequência — a espera junta o vai-e-vem num aviso só, com o valor final.
const MIC_PUSH_MS = 600
let micPushTimer = 0
let micPushed: boolean | null = null

function pushMic(now = false) {
  const muted = !micLive.value
  window.clearTimeout(micPushTimer)
  if (now) {
    micPushed = muted
    emitMicState(muted)
    return
  }
  micPushTimer = window.setTimeout(() => {
    if (muted === micPushed) return
    micPushed = muted
    emitMicState(muted)
  }, MIC_PUSH_MS)
}

watch(micLive, () => pushMic())

// socket novo esquece o microfone, e o presence.ts só reemite join e
// presenceWatch ao reconectar: a lista voltando a encher é o sinal de que há
// socket novo (primeira carga inclusive)
watch(
  () => presenceByServer.size,
  (size, before) => {
    if (size && !before) pushMic(true)
  },
)

onMounted(() => {
  void loadServers()
})

onUnmounted(() => {
  watchServerPresence([])
  window.clearTimeout(micPushTimer)
})
</script>

<style scoped>
.ss-root {
  display: flex;
  flex: 1;
  width: 100%;
  height: 100%;
  min-width: 0;
  overflow: hidden;
}

/* ---- coluna de servidores ---- */
.ss-rail {
  width: 3.5rem;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0;
  background: var(--bg-1);
  border-right: 0.0625rem solid var(--border);
  overflow: hidden;
}

.ss-mark {
  display: grid;
  place-items: center;
  padding-bottom: 0.125rem;
}

.ss-toggle {
  appearance: none;
  background: transparent;
  border: 0.0625rem solid var(--border);
  color: var(--text-3);
  width: 1.75rem;
  height: 1.75rem;
  flex: none;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.ss-toggle:hover { color: var(--text); border-color: var(--border-strong); }

.ss-rail-list {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
}
.ss-rail-list::-webkit-scrollbar { width: 0; }

.ss-server {
  position: relative;
  appearance: none;
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  cursor: pointer;
  display: grid;
  place-items: center;
  background: var(--bg-3);
  border: 0.125rem solid var(--border-strong);
  color: var(--text-2);
  font-family: var(--f-pixel);
  font-size: 0.625rem;
  letter-spacing: 0.04em;
}
.ss-server:hover { border-color: var(--text-3); color: var(--text); }
/* onde estou de fato x o que estou olhando: a barra lateral (dourada) marca o
   servidor ativo mesmo enquanto a lista mostra outro */
.ss-server-here::before {
  content: '';
  position: absolute;
  left: -0.125rem;
  top: 0.375rem;
  bottom: 0.375rem;
  width: 0.1875rem;
  background: var(--accent);
}
.ss-server-shown {
  border-color: var(--primary-hi);
  background: rgba(124, 58, 237, 0.18);
  color: var(--text);
}

.ss-server-initials { line-height: 1; }

.ss-server-badge {
  position: absolute;
  right: -0.25rem;
  bottom: -0.25rem;
  min-width: 1rem;
  padding: 0 0.1875rem;
  background: var(--ok);
  color: var(--bg-0);
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  line-height: 1rem;
  text-align: center;
  border: 0.0625rem solid var(--bg-1);
}

.ss-add {
  color: var(--text-3);
  background: transparent;
  border-style: dashed;
}
.ss-add:hover { color: var(--primary-hi); border-color: var(--primary-hi); }

.ss-rail-mic {
  appearance: none;
  width: 2.5rem;
  height: 2rem;
  flex: none;
  cursor: pointer;
  display: grid;
  place-items: center;
  background: var(--bg-3);
  border: 0.125rem solid var(--border-strong);
  color: var(--text-2);
}
.ss-rail-mic:disabled { opacity: 0.5; cursor: default; }

/* ---- lista de mundos ---- */
.ss-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ss-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0.75rem 0.625rem;
  border-bottom: 0.0625rem solid var(--border);
}
.ss-head-name {
  flex: 1;
  min-width: 0;
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.ss-head-tag {
  flex: none;
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  color: var(--ok);
  letter-spacing: 0.08em;
}

.ss-away {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: rgba(251, 191, 36, 0.1);
  border-bottom: 0.0625rem solid var(--accent-lo);
}
.ss-away-text { font-size: 0.6875rem; color: var(--text-2); line-height: 1.4; }
.ss-away-text b { color: var(--accent); }
.ss-away-back {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: transparent;
  border: 0.0625rem solid var(--accent-lo);
  color: var(--accent);
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.25rem 0.375rem;
  cursor: pointer;
}
.ss-away-back:hover { background: rgba(251, 191, 36, 0.16); }

.ss-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.5rem 0.5rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.ss-label {
  font-size: 0.5625rem;
  letter-spacing: 0.18em;
  color: var(--text-3);
  text-transform: uppercase;
  font-weight: 700;
  padding: 0.5rem 0.375rem 0.25rem;
}

.ss-world { display: flex; flex-direction: column; }

.ss-world-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  border: 0.0625rem solid transparent;
  padding: 0.125rem 0.25rem 0.125rem 0;
}
.ss-world-row:hover { background: var(--bg-1); }
.ss-world-row-here { border-color: var(--primary-hi); background: rgba(124, 58, 237, 0.14); }

.ss-world-caret {
  appearance: none;
  background: transparent;
  border: none;
  color: var(--text-4);
  width: 1.25rem;
  height: 1.5rem;
  flex: none;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.ss-world-caret:hover { color: var(--text-2); }

.ss-world-name {
  appearance: none;
  flex: 1;
  min-width: 0;
  text-align: left;
  background: transparent;
  border: none;
  color: var(--text-2);
  font-family: inherit;
  font-size: 0.8125rem;
  padding: 0.25rem 0;
  cursor: pointer;
}
.ss-world-name:hover { color: var(--text); }
.ss-world-row-here .ss-world-name { color: var(--text); }

.ss-world-here {
  flex: none;
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  color: var(--accent);
  letter-spacing: 0.06em;
}

.ss-world-count {
  flex: none;
  font-family: var(--f-mono);
  font-size: 0.6875rem;
  color: var(--text-2);
  min-width: 1rem;
  text-align: right;
}
.ss-world-count-zero { color: var(--text-4); }

.ss-people {
  list-style: none;
  margin: 0;
  padding: 0 0 0.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.0625rem;
}

.ss-person {
  display: flex;
  align-items: center;
  gap: 0.3125rem;
  font-size: 0.75rem;
  color: var(--text-2);
  min-width: 0;
  padding: 0.0625rem 0.25rem 0.0625rem 0;
}
.ss-person-dot { color: var(--ok); font-size: 0.5rem; flex: none; }
.ss-person-you { flex: none; color: var(--text-4); font-size: 0.625rem; }
.ss-person-icon { flex: none; color: var(--text-3); margin-left: auto; }
.ss-person-icon + .ss-person-icon { margin-left: 0; }
.ss-person-screen { color: var(--accent); }

.ss-other {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
  padding: 0.75rem 0.5rem;
  background: var(--bg-1);
  border: 0.0625rem solid var(--border);
}
.ss-other-count {
  font-family: var(--f-mono);
  font-size: 0.75rem;
  color: var(--accent);
  letter-spacing: 0.06em;
}
.ss-other-enter { width: 100%; }

.ss-error {
  margin: 0.375rem 0.25rem 0;
  font-size: 0.75rem;
  color: var(--err);
}

.ss-acts { display: flex; flex-direction: column; gap: 0.25rem; }

.ss-act {
  width: 100%;
  justify-content: flex-start;
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.25;
  min-width: 0;
  font-size: 0.625rem;
  padding: 0.4375rem 0.5rem;
  gap: 0.375rem;
}

/* ---- rodapé: estado da voz + personagem + controles ---- */
.ss-foot {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.5rem;
  background: var(--bg-1);
  border-top: 0.0625rem solid var(--border);
}

.ss-foot-main {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
}

.ss-voice {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
  padding: 0.25rem 0.375rem;
  background: var(--bg-3);
  border: 0.0625rem solid var(--border-strong);
  color: var(--text-2);
}
.ss-voice-live {
  color: var(--ok);
  border-color: var(--ok);
}
.ss-voice-down { color: var(--text-3); }

.ss-voice-dot {
  width: 0.375rem;
  height: 0.375rem;
  flex: none;
  background: var(--text-4);
}
.ss-voice-live .ss-voice-dot { background: var(--ok); }

.ss-voice-text {
  flex: 1;
  min-width: 0;
  font-family: var(--f-mono);
  font-size: 0.625rem;
  letter-spacing: 0.02em;
}

.ss-voice-join {
  appearance: none;
  flex: none;
  cursor: pointer;
  background: transparent;
  border: 0.0625rem solid var(--primary-hi);
  color: var(--primary-hi);
  font-family: var(--f-pixel);
  font-size: 0.4375rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.1875rem 0.3125rem;
}
.ss-voice-join:hover { background: rgba(124, 58, 237, 0.18); }

.ss-voice-deaf { flex: none; color: var(--err); }

.ss-me {
  appearance: none;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  border: 0.0625rem solid transparent;
  color: var(--text);
  font-family: inherit;
  text-align: left;
  padding: 0.25rem;
  cursor: pointer;
}
.ss-me:hover { border-color: var(--border-strong); background: var(--bg-2); }

.ss-me-avatar {
  width: 1.75rem;
  height: 1.75rem;
  flex: none;
  display: grid;
  place-items: center;
  background: var(--bg-3);
  overflow: hidden;
}

.ss-me-info { display: flex; flex-direction: column; min-width: 0; line-height: 1.15; }
.ss-me-name { font-size: 0.75rem; font-weight: 600; }
.ss-me-hint {
  font-family: var(--f-pixel);
  font-size: 0.4375rem;
  color: var(--text-4);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ss-foot-ctrls { display: flex; gap: 0.25rem; flex: none; }

.ss-ctrl {
  appearance: none;
  width: 1.75rem;
  height: 1.75rem;
  display: grid;
  place-items: center;
  cursor: pointer;
  background: var(--bg-3);
  border: 0.0625rem solid var(--border-strong);
  color: var(--text-2);
}
.ss-ctrl:hover { border-color: var(--text-3); color: var(--text); }
.ss-ctrl:disabled { opacity: 0.5; cursor: default; }
.ss-ctrl-on { color: var(--ok); border-color: var(--ok); }
.ss-ctrl-off { color: var(--text-3); }
/* microfone REALMENTE aberto é o único controle preenchido: conectar sozinho
   aumenta a chance de alguém não perceber que está sendo ouvido */
.ss-ctrl-live {
  color: var(--bg-0);
  background: var(--ok);
  border-color: var(--ok);
}
.ss-ctrl-live:hover { color: var(--bg-0); border-color: var(--ok); }
.ss-ctrl-deaf { color: var(--err); border-color: var(--err); }

@media (prefers-reduced-motion: no-preference) {
  .ss-voice-live .ss-voice-dot {
    animation: ssMicLive 1.6s steps(2, jump-none) infinite;
  }
  @keyframes ssMicLive {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.25; }
  }
}
</style>
