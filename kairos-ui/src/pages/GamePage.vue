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
        :painel="painelPessoas"
        @ir-para-sala="irParaSala"
        @andar-ate="(x: number, y: number) => irPara(x, y, 'a conversa')"
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
      <canvas
        ref="tela" class="gp-tela" :class="{ 'gp-arrastando': arrastando, 'gp-pode-arrastar': podeArrastar, 'gp-pixel': grafico.pixel > 1 }"
        @pointerdown="aoApertarTela" @pointermove="aoMoverTela" @pointerup="aoSoltarTela" @pointerleave="aoSoltarTela"
      />
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

      <div v-if="rota || avisoRota" class="gp-hud gp-rota">
        <span v-if="rota">indo para <b>{{ rota.nome }}</b> · qualquer tecla cancela</span>
        <span v-else>{{ avisoRota }}</span>
      </div>

      <div class="gp-canto-dir">
        <div v-if="minimapaVisivel && mapaAtual" class="gp-minimapa">
          <Minimapa
            :mapa="mapaAtual" :lado-maximo="minimapaGrande ? 360 : 200" :posicoes="posicoesParaMapa"
            :trancadas="salasTrancadas" :sudo="ehSudo" @ir="irPara" @teleportar="teleportarSudo"
          />
        </div>
        <div class="gp-controles">
          <span class="gp-hora" :title="horaTravada !== null ? 'hora travada por um sudo' : 'hora de São Paulo'">
            <PixelIcon :name="periodo === 'noite' || periodo === 'madrugada' ? 'cloud-moon' : 'cloud-sun'" size="0.75rem" />{{ horaTexto }}
          </span>
          <button class="gp-botao" :class="{ 'gp-botao-on': minimapaVisivel }" title="minimapa (M)" @click="minimapaVisivel = !minimapaVisivel"><PixelIcon name="map-pin" size="0.875rem" /></button>
          <button v-if="minimapaVisivel" class="gp-botao" :title="minimapaGrande ? 'diminuir o minimapa' : 'aumentar o minimapa'" @click="minimapaGrande = !minimapaGrande"><PixelIcon :name="minimapaGrande ? 'zoom-out' : 'zoom-in'" size="0.875rem" /></button>
          <button class="gp-botao" title="mapa grande (N)" @click="mapaExpandido = true"><PixelIcon name="globe" size="0.875rem" /></button>
          <button class="gp-botao" :class="{ 'gp-botao-on': atalhosAbertos }" title="atalhos (?)" @click="atalhosAbertos = !atalhosAbertos">?</button>
          <button v-if="ehSudo" class="gp-botao" :class="{ 'gp-botao-on': sudoAberto }" title="poderes de sudo" @click="sudoAberto = !sudoAberto"><PixelIcon name="crown" size="0.875rem" /></button>
        </div>
      </div>

      <div v-if="atalhosAbertos" class="k-card gp-cartao gp-atalhos">
        <div class="gp-cartao-topo">
          <span class="k-chip">atalhos</span>
          <button class="k-btn k-btn-ghost k-btn-sm" @click="atalhosAbertos = false">esc<PixelIcon name="close" size="0.75rem" /></button>
        </div>
        <ul class="gp-atalhos-lista">
          <li v-for="a in ATALHOS" :key="a.tecla"><span class="k-key">{{ a.tecla }}</span>{{ a.oque }}</li>
        </ul>
      </div>

      <div v-if="ehSudo && sudoAberto" class="k-card gp-cartao gp-sudo">
        <div class="gp-cartao-topo">
          <span class="k-chip"><PixelIcon name="crown" size="0.6875rem" />poderes</span>
          <button class="k-btn k-btn-ghost k-btn-sm" @click="sudoAberto = false">esc<PixelIcon name="close" size="0.75rem" /></button>
        </div>
        <label class="gp-sudo-linha"><input v-model="sudoNoclip" type="checkbox" /> noclip <small>atravessa paredes</small></label>
        <label class="gp-sudo-linha"><input :checked="sudoInvisivel" type="checkbox" @change="alternarInvisivel(($event.target as HTMLInputElement).checked)" /> invisível <small>some para os outros</small></label>
        <label class="gp-sudo-linha"><input v-model="sudoEspectador" type="checkbox" /> espectador <small>sem avatar, câmera livre</small></label>
        <label class="gp-sudo-linha gp-sudo-faixa">escala {{ sudoEscala.toFixed(1) }}×
          <input v-model.number="sudoEscala" type="range" min="0.5" max="3" step="0.1" data-captura-teclado />
        </label>
        <label class="gp-sudo-linha gp-sudo-faixa">hora do mundo {{ horaTravada === null ? 'automática' : horaTexto }}
          <input :value="horaTravada ?? horaAtual" type="range" min="0" max="23.5" step="0.5" data-captura-teclado @change="emitDefinirHora(Number(($event.target as HTMLInputElement).value))" />
        </label>
        <div class="gp-sudo-acoes">
          <button v-if="horaTravada !== null" class="k-btn k-btn-ghost k-btn-xs" @click="emitDefinirHora(null)">voltar à hora real</button>
          <button class="k-btn k-btn-accent k-btn-xs" @click="emitSudoFesta()">festa</button>
        </div>
        <div v-if="pessoasNaSala.length" class="gp-sudo-pessoas">
          <span class="k-label">pessoas aqui</span>
          <div v-for="p in pessoasNaSala" :key="p.id" class="gp-sudo-pessoa">
            <span class="ellipsis">{{ p.name }}</span>
            <button class="k-btn k-btn-ghost k-btn-xs" @click="emitSudoPuxar(p.id)">puxar</button>
            <button class="k-btn k-btn-ghost k-btn-xs" @click="irPara(p.x, p.y, p.name)">ir até</button>
          </div>
        </div>
      </div>

      <div v-if="mapaExpandido && mapaAtual" class="gp-modal-overlay" @click="mapaExpandido = false">
        <div class="k-card gp-mapa-grande" @click.stop>
          <div class="gp-cartao-topo">
            <span class="k-chip"><PixelIcon name="globe" size="0.6875rem" />{{ mapaAtual.name }}</span>
            <button class="k-btn k-btn-ghost k-btn-sm" @click="mapaExpandido = false">esc<PixelIcon name="close" size="0.75rem" /></button>
          </div>
          <div class="gp-mapa-grande-corpo">
            <Minimapa
              :mapa="mapaAtual" :lado-maximo="ladoDoMapaGrande" :posicoes="posicoesParaMapa" :trancadas="salasTrancadas"
              :sudo="ehSudo" @ir="(x: number, y: number) => { mapaExpandido = false; irPara(x, y) }"
              @teleportar="(x: number, y: number) => { mapaExpandido = false; teleportarSudo(x, y) }"
            />
            <ul class="gp-mapa-salas">
              <li v-for="sala in salasDoMapa" :key="sala.id">
                <button class="gp-mapa-sala" @click="mapaExpandido = false; irParaSala(sala.id)">
                  <PixelIcon v-if="salasTrancadas.has(sala.id)" name="lock" size="0.625rem" />
                  <span class="ellipsis">{{ sala.nome }}</span>
                  <span class="gp-mapa-sala-gente">{{ genteNaSala(sala.id) }}</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

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

      <DispositivosPanel v-if="panel === 'dispositivos'" @close="closeModal" />
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
  chatMundo, chatSala, connectPresence, disconnectPresence, emitAvatarUpdate, emitDefinirHora, emitMove, emitSalaTrancar,
  emitScreenShare, emitSudoFesta, emitSudoInvisivel, emitSudoPuxar, emitSudoTeleporte, estadoDoJukebox, horaDoMundo,
  onFesta, onPuxado, onScreenShare, remotePlayers, salasTrancadas, sessionKicked, syncDmUnread,
  type ScreenShareState,
} from '@/services/presence'
import { media } from '@/services/media'
import { jukeboxAudio } from '@/services/jukeboxAudio'
import { configuracaoDe, qualidade } from '@/services/graficos'
import { consumePendingInvite, getMyServers, setPendingInvite } from '@/services/server.api'
import { mostrarAviso } from '@/services/avisos'
import { MAPA_ATUAL, buscarMapa } from '@/services/mapa.api'
import { buscarPersonagem } from '@/services/personagem.api'
import { panelFromQuery, precisaCriarPersonagem, type GamePanel } from '@/services/postAuth'
import { historeseMidia } from '@/mundo/bolhas'
import { APARENCIA_PADRAO, sanitizarAparencia, type Aparencia } from '@/mundo/personagem/catalogo'
import { callsDoMapa, ganhoDoPeer, salaFechadaDoPonto } from '@/mundo/audio'
import { horaDeSaoPaulo, periodoDaHora } from '@/mundo/luz'
import { salaDoPonto } from '@/mundo/grade'
import type { Mundo, Interacao, Rota } from '@/mundo/Mundo'
import type { Entrada } from '@/mundo/entrada'
import type { Estacao, Mapa, Movel } from '@/mundo/tipos'
import type { AssetContainer } from '@babylonjs/core/assetContainer'
import ServerSidebar from '@/components/ServerSidebar.vue'
import type { PainelDePessoas, PessoaDoPainel } from '@/components/painelDePessoas'
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
import Minimapa from '@/components/Minimapa.vue'

const DispositivosPanel = defineAsyncComponent(() => import('@/components/DispositivosPanel.vue'))
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
  return { aparencia: minhaAparencia.value, ...(sudoEscala.value !== 1 ? { escala: sudoEscala.value } : {}) }
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
  const convite = consumePendingInvite()
  if (convite) openPanel('servidores', convite)
  else void getMyServers().then((lista) => { if (lista.length === 0) openPanel('servidores') }).catch(() => undefined)
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
  if (e.key !== 'Escape') return
  if (mapaExpandido.value) mapaExpandido.value = false
  else if (atalhosAbertos.value) atalhosAbertos.value = false
  else if (sudoAberto.value) sudoAberto.value = false
  else closeModal()
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
    const escala = peer.avatar?.escala
    instancia.definirEscala(peer.id, typeof escala === 'number' && escala > 0 ? escala : 1)
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

const ATALHOS = [
  { tecla: 'WASD', oque: 'andar (Shift corre)' },
  { tecla: 'E', oque: 'interagir: sentar ou abrir a estação' },
  { tecla: 'G', oque: 'acenar' },
  { tecla: 'B', oque: 'dançar' },
  { tecla: 'L', oque: 'trancar ou destrancar a sala em que você está' },
  { tecla: 'V', oque: 'abrir a sala de voz' },
  { tecla: 'M', oque: 'mostrar ou esconder o minimapa' },
  { tecla: 'N', oque: 'abrir o mapa grande' },
  { tecla: 'Espaço', oque: 'segurar e arrastar para olhar em volta' },
  { tecla: 'roda', oque: 'aproximar ou afastar a câmera' },
  { tecla: '?', oque: 'mostrar estes atalhos' },
]

function lerPreferencia(chave: string, padrao: boolean): boolean {
  try {
    const valor = localStorage.getItem(chave)
    return valor === null ? padrao : valor === 'on'
  } catch {
    return padrao
  }
}

function gravarPreferencia(chave: string, valor: boolean) {
  try {
    localStorage.setItem(chave, valor ? 'on' : 'off')
  } catch {
    return
  }
}

const ehSudo = ref(false)
const mapaAtual = shallowRef<Mapa | null>(null)
const minimapaVisivel = ref(lerPreferencia('kairos_minimapa', true))
const minimapaGrande = ref(lerPreferencia('kairos_minimapa_grande', false))
const mapaExpandido = ref(false)
const atalhosAbertos = ref(false)
const grafico = computed(() => configuracaoDe(qualidade.value))
const sudoAberto = ref(false)
const sudoNoclip = ref(false)
const sudoInvisivel = ref(false)
const sudoEspectador = ref(false)
const sudoEscala = ref(1)
const rota = ref<Rota | null>(null)
const avisoRota = ref('')
const horaAtual = ref(horaDeSaoPaulo())
const horaTravada = computed(() => horaDoMundo.value)
const horaEfetiva = computed(() => horaTravada.value ?? horaAtual.value)
const periodo = computed(() => periodoDaHora(horaEfetiva.value))
const horaTexto = computed(() => {
  const h = horaEfetiva.value
  return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`
})
const painelPessoas = ref<PainelDePessoas>({ perto: [], salas: [], soltos: [], sozinhoNaSala: null })
const salasComGente = ref<{ id: string; nome: string; trancada: boolean; aqui: boolean; gente: { id: string; nome: string; eu: boolean }[] }[]>([])
const salasDoMapa = computed(() => (mapaAtual.value?.salas ?? []).filter((s) => !s.aberta))
const pessoasNaSala = computed(() => [...remotePlayers.values()].filter((p) => !p.map || p.map === MAPA_ATUAL))
const ladoDoMapaGrande = computed(() => Math.min(window.innerWidth - 360, window.innerHeight - 160, 760))
const arrastando = ref(false)
const podeArrastar = ref(false)
let ultimoPonteiro = { x: 0, y: 0 }
let avisoTimer = 0
let relogio = 0
let salasTimer = 0
let posicaoTimer = 0
let offPuxado: (() => void) | null = null
let offFesta: (() => void) | null = null

watch(minimapaVisivel, (v) => gravarPreferencia('kairos_minimapa', v))
watch(grafico, (g) => mundo.value?.definirPixel(g.pixel, g.paleta))
watch(minimapaGrande, (v) => gravarPreferencia('kairos_minimapa_grande', v))
watch(horaEfetiva, (h) => mundo.value?.definirHora(h))
watch(sudoNoclip, (v) => { if (mundo.value) mundo.value.noclip = v || sudoEspectador.value })
watch(sudoEspectador, (v) => {
  if (!mundo.value) return
  mundo.value.noclip = v || sudoNoclip.value
  mundo.value.definirVisivel(EU, !v)
  if (v !== sudoInvisivel.value) alternarInvisivel(v)
})
watch(sudoEscala, (v) => {
  mundo.value?.definirEscala(EU, v)
  emitAvatarUpdate(payloadDoAvatar())
})

function chavePosicao(): string {
  return `kairos_posicao_${auth.userId ?? 'anonimo'}_${MAPA_ATUAL}`
}

function salvarPosicao() {
  const local = mundo.value?.local
  if (!local) return
  try {
    localStorage.setItem(chavePosicao(), JSON.stringify({ x: local.x, y: local.y }))
  } catch {
    return
  }
}

function posicaoSalva(): { x: number; y: number } | null {
  try {
    const bruta = JSON.parse(localStorage.getItem(chavePosicao()) ?? 'null')
    return bruta && Number.isFinite(bruta.x) && Number.isFinite(bruta.y) ? bruta : null
  } catch {
    return null
  }
}

function mostrarAvisoRota(texto: string) {
  avisoRota.value = texto
  window.clearTimeout(avisoTimer)
  avisoTimer = window.setTimeout(() => { if (!rota.value) avisoRota.value = '' }, 3000)
}

function irPara(x: number, y: number, nome?: string) {
  const mapa = mapaAtual.value
  const sala = mapa ? salaDoPonto(mapa, x, y) : null
  mundo.value?.irPara(x, y, nome ?? (sala && !sala.aberta ? sala.nome : 'lá'))
}

function irParaSala(salaId: string) {
  mundo.value?.irParaSala(salaId)
}

function teleportarSudo(x: number, y: number) {
  if (!ehSudo.value || !mundo.value) return
  mundo.value.cancelarRota()
  mundo.value.teleportar(x, y)
  emitSudoTeleporte(x, y)
}

function alternarInvisivel(valor: boolean) {
  sudoInvisivel.value = valor
  emitSudoInvisivel(valor)
}

function posicoesParaMapa() {
  const local = mundo.value?.local ?? { x: 0, y: 0 }
  const outros = [...remotePlayers.values()]
    .filter((p) => !p.map || p.map === MAPA_ATUAL)
    .map((p) => ({ x: p.x, y: p.y, falando: !!media.peers.get(p.userId)?.speaking }))
  return { eu: { x: local.x, y: local.y }, outros }
}

function genteNaSala(salaId: string): number {
  return salasComGente.value.find((s) => s.id === salaId)?.gente.length ?? 0
}

function atualizarSalasComGente() {
  const mapa = mapaAtual.value
  const local = mundo.value?.local
  if (!mapa || !local) return
  const grupos = new Map<string, { id: string; nome: string; eu: boolean }[]>()
  const colocar = (id: string, nome: string, x: number, y: number, eu: boolean) => {
    const sala = salaDoPonto(mapa, x, y)
    if (!sala || sala.aberta) return
    grupos.set(sala.id, [...(grupos.get(sala.id) ?? []), { id, nome, eu }])
  }
  colocar(EU, playerName.value, local.x, local.y, true)
  for (const p of remotePlayers.values()) if (!p.map || p.map === MAPA_ATUAL) colocar(p.id, p.name, p.x, p.y, false)
  const minha = salaDoPonto(mapa, local.x, local.y)?.id
  salasComGente.value = mapa.salas
    .filter((s) => grupos.has(s.id))
    .map((s) => ({ id: s.id, nome: s.nome, trancada: salasTrancadas.value.has(s.id), aqui: s.id === minha, gente: grupos.get(s.id)! }))
    .sort((a, b) => b.gente.length - a.gente.length || a.nome.localeCompare(b.nome))
  atualizarPainelDePessoas()
}

function atualizarPainelDePessoas() {
  const mapa = mapaAtual.value
  const local = mundo.value?.local
  if (!mapa || !local) return
  const remotos = [...remotePlayers.values()].filter((p) => p.userId && (!p.map || p.map === MAPA_ATUAL))
  const calls = callsDoMapa(mapa, [{ id: SELF_CALL_ID, x: local.x, y: local.y }, ...remotos.map((p) => ({ id: p.userId, x: p.x, y: p.y }))])
  const minhaCall = calls.get(SELF_CALL_ID)
  const pessoa = (p: (typeof remotos)[number]): PessoaDoPainel => ({ id: p.id, userId: p.userId, nome: p.name, x: p.x, y: p.y })
  const perto: PessoaDoPainel[] = []
  const porSala = new Map<string, PessoaDoPainel[]>()
  const soltos: PessoaDoPainel[] = []
  for (const p of remotos) {
    if (minhaCall && calls.get(p.userId) === minhaCall) {
      perto.push(pessoa(p))
      continue
    }
    const sala = salaFechadaDoPonto(mapa, p.x, p.y)
    if (sala) porSala.set(sala.id, [...(porSala.get(sala.id) ?? []), pessoa(p)])
    else soltos.push(pessoa(p))
  }
  const minha = salaFechadaDoPonto(mapa, local.x, local.y)
  painelPessoas.value = {
    perto,
    salas: mapa.salas
      .filter((s) => porSala.has(s.id))
      .map((s) => ({ id: s.id, nome: s.nome, trancada: salasTrancadas.value.has(s.id), gente: porSala.get(s.id)! }))
      .sort((a, b) => b.gente.length - a.gente.length || a.nome.localeCompare(b.nome)),
    soltos,
    sozinhoNaSala: minha && !perto.length ? minha.nome : null,
  }
}

function aoApertarTela(e: PointerEvent) {
  if (!entrada?.segurando(' ') || e.button !== 0) return
  arrastando.value = true
  ultimoPonteiro = { x: e.clientX, y: e.clientY }
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
}

function aoMoverTela(e: PointerEvent) {
  podeArrastar.value = !!entrada?.segurando(' ')
  if (!arrastando.value) return
  mundo.value?.arrastarCamera(e.clientX - ultimoPonteiro.x, e.clientY - ultimoPonteiro.y)
  ultimoPonteiro = { x: e.clientX, y: e.clientY }
}

function aoSoltarTela() {
  arrastando.value = false
}

function aoSoltarTecla(e: KeyboardEvent) {
  if (e.key === ' ') {
    arrastando.value = false
    podeArrastar.value = false
    mundo.value?.recentrarCamera()
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
      aoMudarRota: (nova, aviso) => {
        rota.value = nova
        if (aviso) mostrarAvisoRota(aviso)
        else if (nova) avisoRota.value = ''
      },
      aoQuadro,
    })
    instancia.direcaoDesejada = () => entrada!.direcao()
    instancia.trancadas = salasTrancadas.value
    entrada.aoTeclar('e', interagir)
    entrada.aoTeclar('g', () => instancia.gesto('acenar'))
    entrada.aoTeclar('b', () => instancia.gesto('dancar'))
    entrada.aoTeclar('l', alternarTranca)
    entrada.aoTeclar('v', alternarMediaStage)
    entrada.aoTeclar('m', () => { minimapaVisivel.value = !minimapaVisivel.value })
    entrada.aoTeclar('n', () => { mapaExpandido.value = !mapaExpandido.value })
    entrada.aoTeclar('?', () => { atalhosAbertos.value = !atalhosAbertos.value })
    mundo.value = instancia
    instancia.definirPixel(grafico.value.pixel, grafico.value.paleta)
    await instancia.definirMapa(mapa)
    mapaAtual.value = mapa
    instancia.definirHora(horaEfetiva.value)
    const salva = posicaoSalva()
    if (salva && instancia.estaLivre(salva.x, salva.y)) instancia.teleportar(salva.x, salva.y)
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
  ehSudo.value = !!perfil?.isAdmin
  if (ehSudo.value && new URLSearchParams(window.location.search).has('varredura')) {
    Object.assign(window, {
      kairosVarredura: {
        teleportar: (x: number, y: number) => mundo.value?.teleportar(x, y),
        interagir,
        fechar: closeModal,
        acao: () => interacao.value?.acao ?? null,
      },
    })
  }
  if (await precisaCriarPersonagem().catch(() => false)) {
    if (typeof invite === 'string' && invite) setPendingInvite(invite)
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
  offPuxado = onPuxado(({ x, y }) => {
    mundo.value?.cancelarRota()
    mundo.value?.teleportar(x, y)
  })
  offFesta = onFesta(() => mundo.value?.festa())
  relogio = window.setInterval(() => { horaAtual.value = horaDeSaoPaulo() }, 30_000)
  salasTimer = window.setInterval(atualizarSalasComGente, 500)
  posicaoTimer = window.setInterval(salvarPosicao, 5000)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', aoSoltarTecla)
  window.addEventListener('beforeunload', salvarPosicao)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', aoSoltarTecla)
  window.removeEventListener('beforeunload', salvarPosicao)
  salvarPosicao()
  offScreenShare?.()
  offPuxado?.()
  offFesta?.()
  window.clearInterval(relogio)
  window.clearInterval(salasTimer)
  window.clearInterval(posicaoTimer)
  window.clearTimeout(avisoTimer)
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

.gp-pixel { image-rendering: pixelated; }
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

.gp-arrastando { cursor: grabbing; }
.gp-pode-arrastar { cursor: grab; }

.gp-rota {
  top: 3.5rem;
  left: calc(50% + var(--barra-larg) / 2);
  transform: translateX(-50%);
  padding: 0.4375rem 0.75rem;
  background: var(--bg-1);
  border: 0.125rem solid var(--tinta);
  box-shadow: var(--ui-shadow);
  font-size: 0.8125rem;
  color: var(--text-2);
  z-index: 20;
}

.gp-rota b { color: var(--text); }

.gp-canto-dir {
  position: absolute;
  top: 0.875rem;
  right: 0.875rem;
  z-index: 15;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.gp-minimapa {
  padding: 0.25rem;
  background: var(--bg-1);
  border: 0.125rem solid var(--tinta);
  box-shadow: var(--ui-shadow);
}

.gp-controles {
  display: flex;
  align-items: stretch;
  background: var(--bg-1);
  border: 0.125rem solid var(--tinta);
  box-shadow: var(--ui-shadow);
}

.gp-hora {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0 0.625rem;
  font-family: var(--f-num);
  font-size: 0.8125rem;
  color: var(--text-2);
  border-right: 0.0625rem solid var(--border);
}

.gp-botao {
  appearance: none;
  cursor: pointer;
  min-width: 2rem;
  min-height: 2rem;
  display: grid;
  place-items: center;
  background: transparent;
  border: none;
  border-right: 0.0625rem solid var(--border);
  color: var(--text);
  font-weight: 700;
}

.gp-botao:last-child { border-right: none; }
.gp-botao:hover { background: var(--bg-2); }
.gp-botao-on { background: var(--accent); }

.gp-cartao {
  position: absolute;
  right: 0.875rem;
  top: 4rem;
  z-index: 25;
  width: min(20rem, calc(100% - 2rem));
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.gp-cartao-topo { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }

.gp-atalhos-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4375rem; }
.gp-atalhos-lista li { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem; color: var(--text-2); }

.gp-sudo-linha { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem; font-weight: 600; }
.gp-sudo-linha small { color: var(--text-3); font-weight: 400; }
.gp-sudo-faixa { flex-direction: column; align-items: stretch; gap: 0.25rem; }
.gp-sudo-acoes { display: flex; gap: 0.375rem; flex-wrap: wrap; }
.gp-sudo-pessoas { display: flex; flex-direction: column; gap: 0.25rem; max-height: 10rem; overflow-y: auto; }
.gp-sudo-pessoa { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; }
.gp-sudo-pessoa .ellipsis { flex: 1; min-width: 0; }

.gp-mapa-grande {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: calc(100vw - 2rem);
}

.gp-mapa-grande-corpo { display: flex; gap: 1rem; align-items: flex-start; }

.gp-mapa-salas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; width: 13rem; max-height: 70vh; overflow-y: auto; }

.gp-mapa-sala {
  appearance: none;
  cursor: pointer;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.5rem;
  background: var(--bg-2);
  border: 0.0625rem solid var(--border);
  color: var(--text);
  font-size: 0.8125rem;
  text-align: left;
}

.gp-mapa-sala:hover { border-color: var(--border-strong); background: var(--bg-3); }
.gp-mapa-sala .ellipsis { flex: 1; min-width: 0; }
.gp-mapa-sala-gente { font-family: var(--f-num); color: var(--text-3); }

@media (max-width: 48rem) {
  .gp-sidebar.gp-sidebar-open {
    left: 0;
    top: 0;
    bottom: 0;
    width: min(18rem, 80vw);
    z-index: 100;
    box-shadow: 0.5rem 0 1.5rem rgba(0, 0, 0, 0.5);
  }

  .gp-aviso-centro, .gp-sala, .gp-agir, .gp-perto, .gp-avisos-tela, .gp-rota { left: 50%; }
  .gp-minimapa { display: none; }
  .gp-mapa-grande-corpo { flex-direction: column; }
}
</style>
