<template>
  <div class="gp-root" :class="{ 'gp-sidebar-open': gameStore.sidebarOpen }">
    <aside class="gp-sidebar" :class="{ 'gp-sidebar-open': gameStore.sidebarOpen }">
      <ServerSidebar
        ref="sidebar"
        v-model:open="gameStore.sidebarOpen"
        :maps="mundos"
        :current-map-id="MAPA_ATUAL"
        :player-name="playerName"
        :voice-on="voiceOn"
        :is-guest="auth.isGuest"
        @server-changed="onServerChanged"
        @open-panel="openPanel"
        @open-friends="openFriends"
        @open-dm="openDm()"
        @open-media="openMediaStage"
        @join-voice="joinVoice"
        @leave="leave"
      />
    </aside>

    <div class="gp-stage">
      <canvas ref="tela" class="gp-tela" />
      <div ref="camadaNomes" class="gp-nomes" />

      <div v-if="carregando" class="gp-aviso-centro k-card">
        <span class="k-chip">carregando</span>
        <p class="gp-aviso-texto">Montando o escritório…</p>
      </div>
      <div v-else-if="erroMundo" class="gp-aviso-centro k-card">
        <span class="k-chip">erro</span>
        <p class="gp-aviso-texto">{{ erroMundo }}</p>
      </div>

      <div v-if="salaAtual" class="gp-hud gp-sala">
        <PixelIcon v-if="salaTrancada" name="lock" size="0.625rem" />
        {{ salaAtual }}
        <button class="gp-sala-tranca" :title="`${salaTrancada ? 'destrancar' : 'trancar'} a sala (L)`" @click="alternarTranca">
          {{ salaTrancada ? 'destrancar' : 'trancar' }}
        </button>
      </div>

      <div v-if="screenNotices.length" class="gp-avisos-tela" aria-live="polite">
        <span v-for="aviso in screenNotices" :key="aviso.id" class="gp-aviso-tela">
          <PixelIcon name="monitor" size="0.75rem" />
          <b>{{ aviso.name }}</b> começou a compartilhar a tela
        </span>
      </div>

      <div v-if="interacao" class="gp-hud gp-agir">
        <span class="gp-agir-txt">aperte</span>
        <span class="k-key">E</span>
        <span class="gp-agir-txt gp-agir-acao">para {{ interacao.acao }}</span>
      </div>

      <div v-if="pertoDe && !interacao" class="gp-hud gp-perto">perto de <strong>{{ pertoDe }}</strong></div>

      <div class="gp-canto-esq">
        <ChatHud />
      </div>

      <MediaStage
        v-if="mediaStageOpen"
        ref="mediaStage"
        :self-name="playerName"
        :peer-looks="peerLooks"
        :connecting="voiceConnecting"
        @close="mediaStageOpen = false"
        @connect="joinVoice"
        @leave="leaveVoice"
        @reconnect="reconnectVoice"
      />

      <JukeboxPanel v-if="estacaoAberta?.estacao === 'jukebox'" :area-atual="salaAtualId" :jukebox-id="estacaoAberta.id" @close="closeModal" />
      <TaskPanel v-if="estacaoAberta?.estacao === 'tarefas'" :map-id="MAPA_ATUAL" :object-id="estacaoAberta.id" @close="closeModal" />
      <NotePanel v-if="estacaoAberta?.estacao === 'notas'" :map-id="MAPA_ATUAL" :object-id="estacaoAberta.id" @close="closeModal" />
      <WhiteboardPanel v-if="estacaoAberta?.estacao === 'lousa'" :object-id="estacaoAberta.id" @close="closeModal" />

      <PersonagemPanel v-if="panel === 'personagem'" :obrigatorio="personagemObrigatorio" @close="closeModal" @salvo="aoSalvarPersonagem" />
      <ServersPanel v-if="panel === 'servidores'" :invite="panelInvite" @close="closeModal" @server-changed="onServerChanged" />
      <AdminPanel
        v-if="panel === 'admin'"
        @close="closeModal"
        @server-changed="onServerChanged"
        @open-servers="openPanel('servidores')"
      />
      <FeedbackPanel v-if="panel === 'feedback'" @close="closeModal" />
      <FriendsPanel
        v-if="friendsOpen"
        :maps="mundos"
        @close="closeModal"
        @jump="jumpToFriend"
        @changed="sidebar?.reloadFriendRequests()"
        @dm="openDm"
      />

      <div class="touch-ctl gp-touch">
        <span />
        <button class="tbtn" aria-label="andar para cima" @pointerdown.prevent="tocar('w')" @pointerup="soltar('w')" @pointerleave="soltar('w')"><PixelIcon name="chevron-up" size="1.25rem" /></button>
        <button class="tbtn" aria-label="interagir" @pointerdown.prevent="interagir">E</button>
        <button class="tbtn" aria-label="andar para a esquerda" @pointerdown.prevent="tocar('a')" @pointerup="soltar('a')" @pointerleave="soltar('a')"><PixelIcon name="chevron-left" size="1.25rem" /></button>
        <button class="tbtn" aria-label="acenar" @pointerdown.prevent="mundo?.gesto('acenar')"><PixelIcon name="hand" size="1.25rem" /></button>
        <button class="tbtn" aria-label="andar para a direita" @pointerdown.prevent="tocar('d')" @pointerup="soltar('d')" @pointerleave="soltar('d')"><PixelIcon name="chevron-right" size="1.25rem" /></button>
        <span />
        <button class="tbtn" aria-label="andar para baixo" @pointerdown.prevent="tocar('s')" @pointerup="soltar('s')" @pointerleave="soltar('s')"><PixelIcon name="chevron-down" size="1.25rem" /></button>
        <button class="tbtn" aria-label="dançar" @pointerdown.prevent="mundo?.gesto('dancar')"><PixelIcon name="music" size="1.25rem" /></button>
      </div>

      <div v-if="sessionKicked" class="gp-modal-overlay">
        <div class="k-card gp-modal-card column q-gutter-md">
          <div class="row items-center justify-between">
            <span class="k-chip">sessão encerrada</span>
          </div>
          <div>
            <h2 class="gp-modal-title">Você entrou em outro lugar</h2>
            <p class="gp-modal-subtitle">Sua conta só pode ficar ativa numa aba/dispositivo por vez.</p>
          </div>
          <button class="k-btn k-btn-primary full-width" @click="router.go(0)">Recarregar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '@/stores/useGameStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { logoutApi, me } from '@/services/auth.api'
import {
  chatMundo, chatSala, connectPresence, disconnectPresence, emitAvatarUpdate, emitMove, emitSalaTrancar,
  emitScreenShare, estadoDoJukebox, onScreenShare, remotePlayers, salasTrancadas, sessionKicked, syncDmUnread,
  type ScreenShareState,
} from '@/services/presence'
import { media } from '@/services/media'
import { jukeboxAudio } from '@/services/jukeboxAudio'
import { getMyServers } from '@/services/server.api'
import { mostrarAviso } from '@/services/avisos'
import { MAPA_ATUAL, buscarMapa } from '@/services/mapa.api'
import { buscarPersonagem } from '@/services/personagem.api'
import { panelFromQuery, precisaCriarPersonagem, type GamePanel } from '@/services/postAuth'
import { historeseMidia } from '@/game/audio/calls'
import { APARENCIA_PADRAO, sanitizarAparencia, type Aparencia } from '@/mundo/personagem/catalogo'
import { callsDoMapa, ganhoDoPeer, salaFechadaDoPonto } from '@/mundo/audio'
import type { Mundo, Interacao } from '@/mundo/Mundo'
import type { Entrada } from '@/mundo/entrada'
import type { Estacao, Movel } from '@/mundo/tipos'
import type { AssetContainer } from '@babylonjs/core/assetContainer'
import ServerSidebar from '@/components/ServerSidebar.vue'
import ChatHud from '@/components/ChatHud.vue'
import PixelIcon from '@/components/PixelIcon.vue'
import ServersPanel from '@/components/ServersPanel.vue'
import AdminPanel from '@/components/AdminPanel.vue'
import FeedbackPanel from '@/components/FeedbackPanel.vue'
import FriendsPanel from '@/components/FriendsPanel.vue'
import JukeboxPanel from '@/components/JukeboxPanel.vue'
import TaskPanel from '@/components/TaskPanel.vue'
import NotePanel from '@/components/NotePanel.vue'
import WhiteboardPanel from '@/components/WhiteboardPanel.vue'
import MediaStage from '@/components/MediaStage.vue'

const PersonagemPanel = defineAsyncComponent(() => import('@/components/PersonagemPanel.vue'))

const EU = 'eu'
const SELF_CALL_ID = '@eu'
const ALCANCE_JUKEBOX = 6
const SCREEN_NOTICE_MS = 6000

const router = useRouter()
const route = useRoute()
const gameStore = useGameStore()
const auth = useAuthStore()
media.loadPrefs(auth.userId)

const tela = ref<HTMLCanvasElement | null>(null)
const camadaNomes = ref<HTMLElement | null>(null)
const sidebar = ref<InstanceType<typeof ServerSidebar> | null>(null)
const mediaStage = ref<InstanceType<typeof MediaStage> | null>(null)
const mundo = shallowRef<Mundo | null>(null)
let entrada: Entrada | null = null
let conteinerPersonagem: AssetContainer | null = null
let criarAvatar: ((aparencia: Aparencia) => import('@/mundo/avatar').AvatarVisual) | null = null

const panel = ref<GamePanel | null>(null)
const panelInvite = ref('')
const friendsOpen = ref(false)
const carregando = ref(true)
const erroMundo = ref('')
const mundos = ref<{ id: string; name: string }[]>([])
const interacao = ref<Interacao | null>(null)
const salaAtual = ref('')
const salaAtualId = ref<string | null>(null)
const salaFechadaId = ref<string | null>(null)
const pertoDe = ref<string | null>(null)
const estacaoAberta = ref<{ id: string; estacao: Estacao } | null>(null)
const personagemObrigatorio = ref(false)
const minhaAparencia = ref<Aparencia>(structuredClone(APARENCIA_PADRAO))
const mediaStageOpen = ref(false)
const playerName = computed(() => auth.username || 'Sem nome')
const voiceOn = computed(() => media.state.connected)
const voiceConnecting = computed(() => media.state.connecting)
const salaTrancada = computed(() => !!salaFechadaId.value && salasTrancadas.value.has(salaFechadaId.value))
const aparenciasRemotas = new Map<string, string>()
let voiceOptOut = false

const peerLooks = computed(() => {
  const saida: Record<string, { name: string }> = {}
  for (const p of remotePlayers.values()) if (p.userId) saida[p.userId] = { name: p.name }
  return saida
})

function pausarMundo(pausado: boolean) {
  if (entrada) entrada.pausada = pausado
}

function closeModal() {
  if (personagemObrigatorio.value && panel.value === 'personagem') return
  gameStore.isModalOpen = false
  panel.value = null
  panelInvite.value = ''
  friendsOpen.value = false
  estacaoAberta.value = null
  pausarMundo(false)
}

function openPanel(next: GamePanel, invite = '') {
  if (personagemObrigatorio.value && next !== 'personagem') return
  closeModal()
  panel.value = next
  panelInvite.value = invite
  gameStore.isModalOpen = true
  pausarMundo(true)
}

function openFriends() {
  closeModal()
  friendsOpen.value = true
  gameStore.isModalOpen = true
  pausarMundo(true)
}

function openDm(friendId = '') {
  closeModal()
  gameStore.sidebarOpen = true
  void sidebar.value?.abrirConversas(friendId || undefined)
}

function jumpToFriend(serverId: string, mapId: string) {
  closeModal()
  void sidebar.value?.jumpTo(serverId, mapId)
}

function interagir() {
  const alvo = interacao.value
  if (alvo?.estacao) {
    closeModal()
    estacaoAberta.value = { id: alvo.movel.id, estacao: alvo.estacao }
    gameStore.isModalOpen = true
    pausarMundo(true)
    return
  }
  mundo.value?.interagir()
}

function alternarTranca() {
  const id = salaFechadaId.value
  if (id) emitSalaTrancar(id, !salasTrancadas.value.has(id))
}

function tocar(tecla: string) {
  entrada?.apertar(tecla)
}

function soltar(tecla: string) {
  entrada?.soltar(tecla)
}

function payloadDoAvatar() {
  return { aparencia: minhaAparencia.value }
}

function entrarNaPresenca() {
  const local = mundo.value?.local
  connectPresence({ avatar: payloadDoAvatar(), map: MAPA_ATUAL, x: local?.x ?? 0, y: local?.y ?? 0 })
  sidebar.value?.syncPresence()
}

function onServerChanged() {
  disconnectPresence()
  chatMundo.splice(0)
  chatSala.splice(0)
  entrarNaPresenca()
  void sidebar.value?.reloadServers()
  void enterVoice(true)
}

function aoSalvarPersonagem(aparencia: Aparencia) {
  personagemObrigatorio.value = false
  minhaAparencia.value = aparencia
  const instancia = mundo.value
  if (instancia && criarAvatar) {
    if (instancia.temPessoa(EU)) instancia.trocarVisual(EU, criarAvatar(aparencia))
    else instancia.adicionarPessoa(EU, criarAvatar(aparencia), playerName.value, instancia.local.x, instancia.local.y)
  }
  emitAvatarUpdate(payloadDoAvatar())
  closeModal()
  void enterVoice()
}

async function enterVoice(trocouServidor = false) {
  if (voiceOptOut || personagemObrigatorio.value) return
  if (trocouServidor && (media.state.connected || media.state.connecting)) {
    await media.reconnect(MAPA_ATUAL)
    return
  }
  await media.connect(MAPA_ATUAL)
}

function joinVoice() {
  voiceOptOut = false
  void enterVoice()
}

async function leaveVoice() {
  voiceOptOut = true
  await media.disconnect()
}

async function reconnectVoice() {
  if (voiceConnecting.value) return
  voiceOptOut = false
  await media.reconnect(MAPA_ATUAL)
}

function openMediaStage() {
  mediaStageOpen.value = true
  void nextTick(() => mediaStage.value?.restore())
}

function alternarMediaStage() {
  if (!mediaStageOpen.value) return openMediaStage()
  if (voiceOn.value) return mediaStage.value?.toggleMinimized()
  mediaStageOpen.value = false
}

const screenNotices = ref<{ id: number; userId: string; name: string }[]>([])
const screenNoticeTimers = new Set<number>()
let screenNoticeSeq = 0
let offScreenShare: (() => void) | null = null

function onScreenShareState(state: ScreenShareState) {
  if (state.userId && state.userId === auth.userId) return
  if (!state.on) {
    screenNotices.value = screenNotices.value.filter((n) => n.userId !== state.userId)
    return
  }
  const id = ++screenNoticeSeq
  screenNotices.value.push({ id, userId: state.userId, name: state.name || 'alguém' })
  const timer = window.setTimeout(() => {
    screenNoticeTimers.delete(timer)
    screenNotices.value = screenNotices.value.filter((n) => n.id !== id)
  }, SCREEN_NOTICE_MS)
  screenNoticeTimers.add(timer)
}

watch(() => media.state.screenOn, (on) => emitScreenShare(on))
watch(salasTrancadas, (trancadas) => { if (mundo.value) mundo.value.trancadas = trancadas }, { deep: true })

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeModal()
}

function sincronizarRemotos() {
  const instancia = mundo.value
  if (!instancia || !criarAvatar) return
  const vistos = new Set<string>([EU])
  for (const peer of remotePlayers.values()) {
    if (peer.map && peer.map !== MAPA_ATUAL) continue
    vistos.add(peer.id)
    const aparencia = sanitizarAparencia(peer.avatar?.aparencia)
    const assinatura = JSON.stringify(aparencia)
    if (!instancia.temPessoa(peer.id)) {
      instancia.adicionarPessoa(peer.id, criarAvatar(aparencia), peer.name, peer.x, peer.y)
      aparenciasRemotas.set(peer.id, assinatura)
    } else if (aparenciasRemotas.get(peer.id) !== assinatura) {
      instancia.trocarVisual(peer.id, criarAvatar(aparencia))
      aparenciasRemotas.set(peer.id, assinatura)
    }
    instancia.atualizarRemoto(peer.id, peer.x, peer.y, peer.direcao ?? 0, peer.pose ?? 'parado', peer.name)
  }
  for (const id of [...aparenciasRemotas.keys()]) {
    if (vistos.has(id)) continue
    instancia.removerPessoa(id)
    aparenciasRemotas.delete(id)
  }
}

function jukeboxAtiva(mapaMobilia: Movel[], x: number, y: number): Movel | null {
  const caixas = mapaMobilia.filter((m) => m.peca === 'jukebox')
  const global = caixas.find((c) => estadoDoJukebox(c.id)?.alcanceGlobal)
  if (global) return global
  const mapa = mundo.value?.mapa
  if (!mapa) return null
  const minha = salaFechadaDoPonto(mapa, x, y)
  if (minha) return caixas.find((c) => salaFechadaDoPonto(mapa, c.x, c.y)?.id === minha.id) ?? null
  let melhor: Movel | null = null
  let distancia = Infinity
  for (const c of caixas) {
    if (estadoDoJukebox(c.id)?.areaId) continue
    const d = Math.hypot(c.x - x, c.y - y)
    if (d < distancia) { distancia = d; melhor = c }
  }
  return melhor
}

function aoQuadro() {
  const instancia = mundo.value
  const mapa = instancia?.mapa
  if (!instancia || !mapa) return
  sincronizarRemotos()
  const eu = instancia.local
  const pessoas = [{ id: SELF_CALL_ID, x: eu.x, y: eu.y }]
  for (const p of remotePlayers.values()) if (p.userId && (!p.map || p.map === MAPA_ATUAL)) pessoas.push({ id: p.userId, x: p.x, y: p.y })
  const calls = callsDoMapa(mapa, pessoas)
  const minhaCall = calls.get(SELF_CALL_ID) ?? null
  const minhaSala = salaFechadaDoPonto(mapa, eu.x, eu.y)?.id ?? null
  const vozAtiva = media.state.connected
  const voz: string[] = []
  const video: string[] = []
  let maisPerto: string | null = null
  let menor = 3
  for (const peer of remotePlayers.values()) {
    if (peer.map && peer.map !== MAPA_ATUAL) continue
    const d = Math.hypot(peer.x - eu.x, peer.y - eu.y)
    if (d < menor) { menor = d; maisPerto = peer.name }
    if (!peer.userId) continue
    const callDoPeer = calls.get(peer.userId) ?? null
    media.setPeerGain(peer.userId, ganhoDoPeer({ mapa, falante: peer, ouvinte: eu, trancadas: salasTrancadas.value, callFalante: callDoPeer, callOuvinte: minhaCall }))
    const mesmaCall = minhaCall !== null && minhaCall === callDoPeer
    if (d <= 4 || mesmaCall || (vozAtiva && media.isSubscribed(peer.userId) && d <= 5)) voz.push(peer.userId)
    const salaDoPeer = salaFechadaDoPonto(mapa, peer.x, peer.y)?.id ?? null
    const querVideo = minhaSala || salaDoPeer ? minhaSala !== null && minhaSala === salaDoPeer : historeseMidia(vozAtiva && media.isVideoWanted(peer.userId), d)
    if (querVideo) video.push(peer.userId)
  }
  if (pertoDe.value !== maisPerto) pertoDe.value = maisPerto
  if (vozAtiva) {
    media.syncSubscriptions(voz)
    media.syncVideoSubscriptions(video)
  }
  const caixa = jukeboxAtiva(mapa.mobilia, eu.x, eu.y)
  const estado = estadoDoJukebox(caixa?.id ?? null)
  jukeboxAudio.setAreaDoOuvinte(salaAtualId.value)
  jukeboxAudio.sync(estado)
  if (estado?.current) {
    if (estado.alcanceGlobal || estado.areaId) jukeboxAudio.setVolume(1, estado)
    else if (caixa) jukeboxAudio.setVolume(Math.max(0, 1 - Math.hypot(caixa.x - eu.x, caixa.y - eu.y) / ALCANCE_JUKEBOX), estado)
  }
}

async function montarMundo() {
  if (!tela.value || !camadaNomes.value) return
  try {
    const [{ Mundo: ClasseMundo }, { Entrada: ClasseEntrada }, { AvatarModelo, carregarPersonagem }, mapa, personagem] = await Promise.all([
      import('@/mundo/Mundo'),
      import('@/mundo/entrada'),
      import('@/mundo/personagem/AvatarModelo'),
      buscarMapa(MAPA_ATUAL),
      buscarPersonagem().catch(() => null),
    ])
    if (personagem?.aparencia) minhaAparencia.value = sanitizarAparencia(personagem.aparencia)
    mundos.value = [{ id: mapa.id, name: mapa.name }]
    entrada = new ClasseEntrada()
    const instancia = new ClasseMundo(tela.value, camadaNomes.value, {
      aoMudarInteracao: (alvo) => { interacao.value = alvo },
      aoMudarSala: (sala) => {
        salaAtual.value = sala && !sala.aberta ? sala.nome : ''
        salaAtualId.value = sala?.id ?? null
        salaFechadaId.value = sala && !sala.aberta ? sala.id : null
      },
      aoMover: (estado) => emitMove(estado.x, estado.y, estado.direcao, estado.pose),
      aoQuadro,
    })
    instancia.direcaoDesejada = () => entrada!.direcao()
    instancia.trancadas = salasTrancadas.value
    entrada.aoTeclar('e', interagir)
    entrada.aoTeclar('g', () => instancia.gesto('acenar'))
    entrada.aoTeclar('b', () => instancia.gesto('dancar'))
    entrada.aoTeclar('l', alternarTranca)
    entrada.aoTeclar('v', alternarMediaStage)
    mundo.value = instancia
    await instancia.definirMapa(mapa)
    conteinerPersonagem = await carregarPersonagem(instancia.cena)
    criarAvatar = (aparencia) => new AvatarModelo(instancia.cena, conteinerPersonagem!, aparencia)
    if (!personagemObrigatorio.value) {
      instancia.adicionarPessoa(EU, criarAvatar(minhaAparencia.value), playerName.value, instancia.local.x, instancia.local.y)
    }
    entrarNaPresenca()
    void enterVoice()
  } catch {
    erroMundo.value = 'Não deu pra montar o escritório. Recarregue a página.'
  } finally {
    carregando.value = false
  }
}

async function leave() {
  disconnectPresence()
  await logoutApi()
  auth.logout()
  syncDmUnread([])
  jukeboxAudio.stop()
  router.push('/login')
}

onMounted(async () => {
  const asked = panelFromQuery(route.query)
  const invite = route.query.invite
  if (asked || invite) void router.replace({ path: '/game' })

  const perfil = await me().catch(() => null)
  auth.setUsername(perfil?.username ?? null)
  if (await precisaCriarPersonagem().catch(() => false)) {
    personagemObrigatorio.value = true
    panel.value = 'personagem'
    gameStore.isModalOpen = true
  } else if (asked) {
    openPanel(asked, typeof invite === 'string' ? invite : '')
  } else {
    getMyServers()
      .then((lista) => { if (lista.length === 0) openPanel('servidores') })
      .catch(() => mostrarAviso('Não deu pra carregar seus servidores. Recarregue a página.'))
  }

  await montarMundo()
  pausarMundo(gameStore.isModalOpen)
  offScreenShare = onScreenShare(onScreenShareState)
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  offScreenShare?.()
  for (const timer of screenNoticeTimers) clearTimeout(timer)
  entrada?.destruir()
  entrada = null
  mundo.value?.destruir()
  mundo.value = null
  void media.disconnect()
  disconnectPresence()
  jukeboxAudio.stop()
})
</script>

<style scoped>
.gp-root {
  --barra-larg: 3.5rem;
  height: 100vh;
  position: relative;
  background: var(--bg-0);
  overflow: hidden;
}

.gp-sidebar {
  position: absolute;
  left: 0.875rem;
  top: 0.875rem;
  bottom: 0.875rem;
  width: 3.5rem;
  z-index: 20;
  display: flex;
  min-width: 0;
  overflow: hidden;
  background: var(--bg-1);
  border: var(--ui-border-style);
  box-shadow: var(--contorno-duplo), var(--sombra-solida);
}

.gp-root.gp-sidebar-open { --barra-larg: 18rem; }
.gp-sidebar.gp-sidebar-open { width: 18rem; }

.gp-stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--bg-0);
}

.gp-tela {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  outline: none;
  touch-action: none;
}

.gp-nomes {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.gp-nomes :deep(.mundo-nome) {
  position: absolute;
  left: 0;
  top: 0;
  padding: 0.125rem 0.375rem;
  background: var(--bg-2);
  border: 0.125rem solid var(--tinta);
  color: var(--text);
  font-size: 0.6875rem;
  font-weight: 700;
  white-space: nowrap;
  will-change: transform;
}

.gp-aviso-centro {
  position: absolute;
  top: 50%;
  left: calc(50% + var(--barra-larg) / 2);
  transform: translate(-50%, -50%);
  width: min(22rem, calc(100% - 2rem));
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.625rem;
  z-index: 5;
}

.gp-aviso-texto {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-2);
}

.gp-hud {
  position: absolute;
  z-index: 10;
}

.gp-sala {
  top: 1rem;
  left: calc(50% + var(--barra-larg) / 2);
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.375rem 0.375rem 0.75rem;
  background: var(--bg-1);
  border: 0.125rem solid var(--tinta);
  box-shadow: var(--ui-shadow);
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.gp-sala-tranca {
  appearance: none;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  background: var(--bg-2);
  border: 0.125rem dashed var(--tinta);
  font: inherit;
  color: var(--text-2);
}

.gp-sala-tranca:hover { background: var(--bg-3); }

.gp-avisos-tela {
  position: absolute;
  top: 3.75rem;
  left: calc(50% + var(--barra-larg) / 2);
  transform: translateX(-50%);
  z-index: 20;
  display: grid;
  justify-items: center;
  gap: 0.25rem;
  pointer-events: none;
}

.gp-aviso-tela {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: var(--bg-2);
  border: 0.125rem solid var(--accent-lo);
  box-shadow: var(--ui-shadow);
  font-size: 0.75rem;
  color: var(--text-2);
}

.gp-aviso-tela b { color: var(--accent-texto); }

.gp-agir, .gp-perto {
  bottom: 1rem;
  left: calc(50% + var(--barra-larg) / 2);
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-1);
  border: 0.125rem solid var(--tinta);
  box-shadow: var(--ui-shadow);
  font-size: 0.8125rem;
  color: var(--text-2);
}

.gp-agir-txt {
  font-size: 0.8125rem;
  color: var(--text-2);
}

.gp-agir-acao { color: var(--accent-texto); font-weight: 700; }

.gp-canto-esq {
  position: absolute;
  bottom: 0.875rem;
  left: calc(0.875rem + var(--barra-larg, 3.5rem) + 0.75rem);
  transition: left 0.2s ease;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  max-width: calc(100% - 2rem);
}

.gp-touch {
  position: absolute;
  bottom: 5rem;
  right: 1.5rem;
  z-index: 20;
  display: grid;
  grid-template-columns: repeat(3, 2.75rem);
  grid-template-rows: repeat(3, 2.75rem);
  gap: 0.25rem;
  touch-action: none;
  user-select: none;
}

.tbtn {
  background: var(--bg-1);
  border: 0.125rem solid var(--tinta);
  color: var(--text);
  font-size: 1rem;
  font-weight: 700;
  display: grid;
  place-items: center;
  cursor: pointer;
  border-radius: 0.375rem;
  touch-action: none;
}

.tbtn:active { background: rgba(44, 116, 65, 0.32); }

@media (hover: hover) and (pointer: fine) {
  .touch-ctl { display: none !important; }
}

.gp-modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(0.375rem);
  display: grid;
  place-items: center;
  z-index: 50;
  padding: 1.5rem;
}

.gp-modal-card {
  padding: 1.75rem;
  width: min(32.5rem, 100%);
}

.gp-modal-title {
  margin: 0 0 0.375rem;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.gp-modal-subtitle {
  margin: 0;
  color: var(--text-3);
  font-size: 0.875rem;
}

@media (max-width: 48rem) {
  .gp-sidebar.gp-sidebar-open {
    left: 0;
    top: 0;
    bottom: 0;
    width: min(18rem, 80vw);
    z-index: 100;
    box-shadow: 0.5rem 0 1.5rem rgba(0, 0, 0, 0.5);
  }

  .gp-aviso-centro, .gp-sala, .gp-agir, .gp-perto, .gp-avisos-tela { left: 50%; }
}
</style>
