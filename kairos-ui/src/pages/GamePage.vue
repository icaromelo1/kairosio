<template>
  <div class="gp-root" :class="{ 'gp-sidebar-open': gameStore.sidebarOpen }">
    <!-- Sidebar: servidores + mundos + pessoas (navegar não conecta) -->
    <aside class="gp-sidebar" :class="{ 'gp-sidebar-open': gameStore.sidebarOpen }">
      <ServerSidebar
        ref="sidebar"
        v-model:open="gameStore.sidebarOpen"
        :maps="maps"
        :current-map-id="currentId"
        :player-name="playerName"
        :look="look"
        :voice-on="voiceOn"
        :can-edit-current-world="!!currentMap && currentMap.ownerId === auth.userId"
        :is-guest="auth.isGuest"
        @select-world="selectMap"
        @server-changed="onServerChanged"
        @open-media="openMediaStage"
        @open-panel="openPanel"
        @open-friends="openFriends"
        @open-dm="openDm()"
        @join-voice="joinVoice"
        @leave="leave"
      />
    </aside>

    <!-- Stage (PixiJS) -->
    <div class="gp-stage">
      <div
        ref="host" class="gp-canvas-host"
        :class="espectadorOuPan ? (panDragging ? 'gp-cursor-grabbing' : 'gp-cursor-grab') : 'gp-cursor-default'"
        @wheel.prevent="onWheel"
        @pointerdown="onPanDown" @pointermove="onPanMove" @pointerup="onPanUp" @pointerleave="onPanUp"
        @contextmenu.prevent
      />
      <!-- HUD top-left -->
      <div v-if="hudVisible" class="gp-hud gp-hud-topleft row items-center q-gutter-sm">
        <div class="gp-avatar-box">
          <PixelAvatar :scale="1.6" v-bind="look" :shadow="false" />
        </div>
        <div class="column gp-hud-tight">
          <span class="gp-hud-name">{{ playerName }}</span>
          <span v-if="nomeDaSala" class="gp-hud-sala">{{ nomeDaSala }}</span>
          <span class="gp-hud-mapname">● {{ currentMap?.name || '…' }}</span>
          <span class="gp-hud-hora">{{ horario }}</span>
        </div>
      </div>

      <!-- Proximidade + voz -->
      <div v-if="nearby" class="gp-hud gp-nearby">
        perto de <strong>{{ nearby }}</strong>
      </div>

      <!-- Aviso de transmissão: vive AQUI e não no MediaStage porque alcança
           todo mundo do mapa, inclusive quem nunca abriu a janela de voz. Sem
           pointer-events e sem nada focável — o WASD segue respondendo. -->
      <div v-if="screenNotices.length" class="gp-screen-notices" aria-live="polite">
        <span v-for="notice in screenNotices" :key="notice.id" class="gp-screen-notice">
          <PixelIcon name="monitor" size="0.75rem" />
          <b>{{ notice.name }}</b> começou a compartilhar a tela
        </span>
      </div>

      <!-- Chat -->
      <div class="gp-chat">
        <div v-if="messages.length" ref="chatLog" class="gp-chat-log" @scroll="onChatScroll">
          <div v-for="(m, i) in messages" :key="i" class="gp-chat-msg">
            <span class="gp-chat-name" :style="{ color: chatColor(m) }">{{ m.name }}:</span>
            <span class="gp-chat-text"> {{ m.text }}</span>
          </div>
        </div>
        <div class="gp-chat-field">
          <div class="gp-chat-foot">
            <button v-if="chatUnread" class="gp-chat-jump" @click="scrollChatToEnd">novas mensagens ↓</button>
            <span
              v-if="chatInput.length > CHAT_COUNT_FROM"
              class="gp-chat-count"
              :class="{ 'gp-chat-count-max': chatInput.length >= CHAT_MAX_LEN }"
            >{{ chatInput.length }}/{{ CHAT_MAX_LEN }}</span>
          </div>
          <input
            v-model="chatInput" :maxlength="CHAT_MAX_LEN" placeholder="Conversar… (Enter)"
            class="gp-chat-input"
            @keydown.enter="sendChat"
          />
          <span v-if="chatCooldown" class="gp-chat-cooldown" />
        </div>
      </div>

      <!-- HUD bottom -->
      <div v-if="hudVisible" class="gp-hud gp-hud-bottom row items-center q-gutter-md">
        <span class="row items-center q-gutter-xs"><span class="k-key">W</span><span class="k-key">A</span><span class="k-key">S</span><span class="k-key">D</span><span class="gp-hud-hint">mover</span></span>
        <span class="gp-hud-sep">·</span>
        <span class="row items-center q-gutter-xs"><span class="k-key">B</span><span class="gp-hud-hint">dançar</span></span>
        <span class="gp-hud-sep">·</span>
        <span class="row items-center q-gutter-xs"><span class="k-key">G</span><span class="gp-hud-hint">acenar</span></span>
        <span class="gp-hud-sep">·</span>
        <span class="row items-center q-gutter-xs"><span class="k-key">V</span><span class="gp-hud-hint">voz</span></span>
        <template v-if="activeZone">
          <span class="gp-hud-sep">·</span>
          <span class="row items-center q-gutter-xs"><span class="k-key">E</span><span class="gp-hud-action">{{ activeZone.action }}</span></span>
        </template>
      </div>

      <!-- HUD separada por escopo: MUNDO (azul, sudo, escreve pra todos) em cima,
           EU (verde, só o meu avatar) embaixo. Largura travada e slot condicional
           com fantasma, senão a barra muda de tamanho sozinha. -->
      <div class="gp-hud gp-hud-ctl">
        <ClusterCard v-if="hudVisible && ehSudo" titulo="mundo · afeta todos" nota="sudo" escopo="mundo">
          <div class="gp-hud-linha">
            <div class="gp-hud-campo">
              <div class="gp-hud-topo">
                <span class="k-label gp-hud-cap">☀ hora do mundo</span>
                <span class="k-num">{{ horaLabel }}</span>
              </div>
              <NotchStepper
                v-model="horaEditavel" :min="0" :max="23.5" :step="0.5" :entalhes="24"
                rotulo="hora do mundo" :disabled="horaDoMundo === null && false"
                @commit="definirHora"
              />
            </div>
            <div class="gp-hud-campo gp-hud-slot">
              <span class="k-label gp-hud-cap">trava</span>
              <button
                class="k-btn k-btn-sm gp-hud-full"
                :class="{ 'k-active': horaDoMundo !== null }"
                :title="horaDoMundo !== null ? 'voltar a seguir a hora real' : 'travar a hora atual para todos'"
                @click="definirHora(horaDoMundo !== null ? null : horaEditavel)"
              >{{ horaDoMundo !== null ? 'auto' : 'travar' }}</button>
            </div>
          </div>
        </ClusterCard>

        <ClusterCard titulo="eu · só meu avatar" nota="h recolhe" escopo="eu">
          <template v-if="hudVisible">
            <div class="gp-hud-linha">
              <div class="gp-hud-campo">
                <div class="gp-hud-topo">
                  <span class="k-label gp-hud-cap">⇧ turbo</span>
                  <span class="k-num">{{ turboMult.toFixed(1) }}×</span>
                </div>
                <NotchStepper
                  v-model="turboMult" :min="TURBO_MIN" :max="TURBO_MAX" :step="0.1" :entalhes="9"
                  rotulo="velocidade turbo"
                />
              </div>
              <div class="gp-hud-campo gp-hud-slot">
                <span class="k-label gp-hud-cap">sala</span>
                <button
                  v-if="salaAtualId"
                  class="k-btn k-btn-sm gp-hud-full"
                  :class="{ 'k-active': salaTrancada }"
                  @click="toggleSalaTrancada"
                >{{ salaTrancada ? 'destrancar' : 'trancar' }}</button>
                <GhostSlot v-else label="fora de sala" />
              </div>
            </div>
          </template>
          <template v-else>
            <div class="gp-hud-recolhido">
              <span v-if="ehSudo" class="k-badge k-badge-info">{{ horaLabel }}</span>
              <span class="k-badge k-badge-dim">{{ turboMult.toFixed(1) }}×</span>
            </div>
          </template>

          <template #rodape>
            <button class="gp-hud-rodape" :title="hudVisible ? 'esconder dicas (H)' : 'mostrar dicas (H)'" @click="hudVisible = !hudVisible">
              <PixelIcon :name="hudVisible ? 'chevron-up' : 'chevron-down'" size="0.75rem" />dicas
            </button>
            <button class="gp-hud-rodape" title="atalhos do teclado" @click="atalhosAbertos = !atalhosAbertos">atalhos ?</button>
            <button
              v-if="ehSudo"
              class="gp-hud-rodape gp-hud-coroa" :class="{ 'gp-hud-rodape-on': sudoPanelOpen }"
              title="poderes de sudo" @click="sudoPanelOpen = !sudoPanelOpen"
            ><PixelIcon name="crown" size="0.75rem" /></button>
          </template>
        </ClusterCard>

        <AtivosBar v-if="ehSudo" :itens="poderesAtivos" @desligar="desligarPoder" />
      </div>

      <div v-if="atalhosAbertos" class="k-card gp-atalhos">
        <div class="row items-center justify-between">
          <span class="k-chip">atalhos</span>
          <button class="k-btn k-btn-ghost k-btn-sm" @click="atalhosAbertos = false">esc<PixelIcon name="close" size="0.75rem" /></button>
        </div>
        <ul class="gp-atalhos-lista">
          <li v-for="a in ATALHOS" :key="a.tecla"><span class="k-key">{{ a.tecla }}</span>{{ a.oque }}</li>
        </ul>
      </div>

      <div v-if="ehSudo && sudoPanelOpen" class="k-card gp-sudo-panel">
        <div class="row items-center justify-between">
          <span class="k-chip"><PixelIcon name="crown" size="0.6875rem" />poderes</span>
          <button class="k-btn k-btn-ghost k-btn-sm" @click="sudoPanelOpen = false">esc<PixelIcon name="close" size="0.75rem" /></button>
        </div>

        <!-- 1 · reversível: liga e desliga, sem consequência que sobreviva -->
        <span class="k-label gp-sudo-grupo">1 · reversível</span>
        <ToggleRow v-model="sudoNoclip" label="noclip" hint="atravessa paredes" />
        <ToggleRow :model-value="sudoInvisivel" label="invisível" hint="some do mapa, do minimapa e da lista" @update:model-value="alternarInvisivel" />
        <ToggleRow v-model="sudoEspectador" label="espectador" hint="câmera livre, sem avatar no mapa" />

        <div class="gp-hud-topo">
          <span class="k-label gp-hud-cap">escala</span>
          <span class="k-num">{{ sudoEscala.toFixed(1) }}×</span>
        </div>
        <NotchStepper v-model="sudoEscala" :min="0.4" :max="3" :step="0.1" :entalhes="14" rotulo="escala do avatar" />

        <div class="k-divider" />

        <!-- 2 · efêmero: roda uma animação e acaba -->
        <span class="k-label gp-sudo-grupo">2 · efêmero</span>
        <button class="k-btn k-btn-accent k-btn-sm gp-hud-full" @click="dispararFesta">
          <PixelIcon name="sparkles" size="0.75rem" />festa
        </button>
        <div class="gp-sudo-row">
          <button class="k-btn k-btn-ghost k-btn-sm" @click="dancarComo('giro')">girar</button>
          <button class="k-btn k-btn-ghost k-btn-sm" @click="dancarComo('pulo')">pular</button>
          <button class="k-btn k-btn-ghost k-btn-sm" @click="dancarComo('robo')">robô</button>
        </div>

        <!-- 3 · permanente: escreve no mapa pra todos e não desfaz. sai da caixa
             creme de propósito — não pode parecer igual a ligar noclip -->
        <div class="k-perigo">
          <div class="k-perigo-faixa" />
          <span class="k-label gp-sudo-perigo-tit">3 · permanente · sem desfazer</span>
          <p class="gp-sudo-perigo-txt">Aparece no mapa para todos e fica. Segure para confirmar.</p>
          <div class="gp-sudo-row gp-sudo-spawn">
            <select v-model="itemParaSpawnar" class="k-input gp-sudo-select" :disabled="spawnando">
              <option v-for="i in ITENS_SPAWN" :key="i.kind" :value="i.kind">{{ i.label }}</option>
            </select>
            <HoldButton
              rotulo="spawnar ▸ segure" :carregando="spawnando"
              @confirmar="spawnarItem"
            />
          </div>
          <p v-if="spawnErro" class="gp-sudo-erro">✕ {{ spawnErro }}</p>
        </div>

        <!-- 4 · sobre outras pessoas -->
        <div v-if="roomPeers.length" class="gp-sudo-pessoas">
          <div class="gp-hud-topo">
            <span class="k-label gp-sudo-grupo">4 · pessoas aqui</span>
            <span class="k-label gp-sudo-grupo">{{ roomPeers.length }} · rola</span>
          </div>
          <div class="gp-sudo-lista">
            <div v-for="p in roomPeers" :key="p.id" class="gp-sudo-pessoa">
              <span class="gp-sudo-pessoa-nome ellipsis">{{ p.name }}</span>
              <button class="k-btn k-btn-ghost k-btn-xs" @click="puxarPara(p.id)">puxar</button>
              <button class="k-btn k-btn-ghost k-btn-xs" @click="irAte(p.x, p.y)">ir até</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal de interação -->
      <div v-if="gameStore.isModalOpen && activeModal" class="gp-modal-overlay" @click="closeModal">
        <div class="k-card gp-modal-card column q-gutter-md" @click.stop>
          <div class="row items-center justify-between">
            <span class="k-chip">interação</span>
            <button class="k-btn k-btn-ghost gp-modal-close" @click="closeModal">esc<PixelIcon name="close" size="0.75rem" /></button>
          </div>
          <div>
            <h2 class="gp-modal-title">{{ activeModal.name }}</h2>
            <p class="gp-modal-subtitle">{{ activeModal.action }}</p>
          </div>
          <div class="gp-modal-body">
            Em breve. Esta estação será conectada à sua ferramenta ({{ activeModal.kind }}).
          </div>
        </div>
      </div>

      <!-- Sala de voz/vídeo (janela flutuante sobre o mapa) -->
      <MediaStage
        v-if="mediaStageOpen"
        ref="mediaStage"
        :self-name="playerName"
        :self-look="look"
        :peer-looks="peerLooks"
        :connecting="voiceConnecting"
        @close="mediaStageOpen = false"
        @connect="joinVoice"
        @leave="leaveVoice"
        @reconnect="reconnectVoice"
      />

      <!-- Painel do jukebox -->
      <JukeboxPanel v-if="jukeboxOpen" :area-atual="salaAtualId" :jukebox-id="jukeboxObjectId" @close="closeModal" />

      <TaskPanel v-if="taskOpen" :map-id="currentId" :object-id="taskObjectId" @close="closeModal" />
      <NotePanel v-if="noteOpen" :map-id="currentId" :object-id="noteObjectId" @close="closeModal" />
      <WhiteboardPanel v-if="boardOpen" :object-id="boardObjectId" @close="closeModal" />

      <ServersPanel v-if="panel === 'servidores'" :invite="panelInvite" @close="closeModal" @server-changed="onServerChanged" />
      <CharacterPanel v-if="panel === 'personagem'" :obrigatorio="precisaPersonagem" @close="aoFecharPersonagem" />
      <AdminPanel
        v-if="panel === 'admin'"
        @close="closeModal"
        @server-changed="onServerChanged"
        @open-servers="openPanel('servidores')"
      />
      <FeedbackPanel v-if="panel === 'feedback'" @close="closeModal" />
      <FriendsPanel
        v-if="friendsOpen"
        :maps="maps"
        @close="closeModal"
        @jump="jumpToFriend"
        @changed="sidebar?.reloadFriendRequests()"
        @dm="openDm"
      />
      <DmPanel v-if="dmOpen" :friend-id="dmFriendId" @close="closeModal" />

      <!-- Controles touch (mobile) -->
      <div class="touch-ctl gp-touch-ctl">
        <span></span>
        <button class="tbtn" aria-label="andar para cima" @pointerdown.prevent="pressKey('w')" @pointerup="releaseKey('w')" @pointerleave="releaseKey('w')"><PixelIcon name="chevron-up" size="1.25rem" /></button>
        <span></span>
        <button class="tbtn" aria-label="andar para a esquerda" @pointerdown.prevent="pressKey('a')" @pointerup="releaseKey('a')" @pointerleave="releaseKey('a')"><PixelIcon name="chevron-left" size="1.25rem" /></button>
        <button class="tbtn" aria-label="dançar" @pointerdown.prevent="dancing = !dancing"><PixelIcon name="music" size="1.25rem" /></button>
        <button class="tbtn" aria-label="andar para a direita" @pointerdown.prevent="pressKey('d')" @pointerup="releaseKey('d')" @pointerleave="releaseKey('d')"><PixelIcon name="chevron-right" size="1.25rem" /></button>
        <span></span>
        <button class="tbtn" aria-label="andar para baixo" @pointerdown.prevent="pressKey('s')" @pointerup="releaseKey('s')" @pointerleave="releaseKey('s')"><PixelIcon name="chevron-down" size="1.25rem" /></button>
        <button class="tbtn" aria-label="acenar" @pointerdown.prevent="emote()"><PixelIcon name="hand" size="1.25rem" /></button>
      </div>

      <div v-if="error" class="gp-error">{{ error }}</div>

      <!-- Sessão aberta em outra aba/dispositivo -->
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
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGameStore } from '@/stores/useGameStore'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { logoutApi } from '@/services/auth.api'
import { MapScene } from '@/game/pixi/scene'
import { AvatarPuppet, sanitizeLook, type AvatarLook, type Facing, type Pose as AvatarPose } from '@/game/pixi/avatar'
import type { Minimap } from '@/game/pixi/minimap'
import { isSolid, interactableObjects, type MapDef, type MapObject } from '@/game/maps'
import { fetchMaps, saveMap } from '@/services/maps.api'
import { getWorldState, saveWorldState } from '@/services/world.api'
import {
  connectPresence, disconnectPresence, emitMove, switchMap, remotePlayers, chatMessages, emitChat,
  estadoDoJukebox, salasTrancadas, emitSalaTrancar, horaDoMundo, emitDefinirHora, emitScreenShare,
  onScreenShare, sessionKicked, syncDmUnread, emitAvatarUpdate,
  sudoInvisivel, sudoNoclip, sudoEspectador, sudoEscala,
  emitSudoInvisivel, emitSudoFesta, emitSudoTeleporte, emitSudoPuxar, onPuxado, onFesta,
  type AvatarProps, type ChatMessage, type ScreenShareState,
} from '@/services/presence'
import { media } from '@/services/media'
import { ganhoDoPeer, salaDoPonto } from '@/game/audio/espacial'
import { callsDoMapa, historeseMidia } from '@/game/audio/calls'
import { jukeboxAudio } from '@/services/jukeboxAudio'
import { photoUrl } from '@/services/character.api'
import { precisaCriarPersonagem, panelFromQuery, type GamePanel } from '@/services/postAuth'
import { estadoDeLuz } from '@/game/lighting'
import { me } from '@/services/auth.api'
import PixelAvatar from '@/components/pixel/PixelAvatar.vue'
import NotchStepper from '@/components/pixel/NotchStepper.vue'
import ToggleRow from '@/components/pixel/ToggleRow.vue'
import ClusterCard from '@/components/pixel/ClusterCard.vue'
import GhostSlot from '@/components/pixel/GhostSlot.vue'
import AtivosBar, { type PoderAtivo } from '@/components/pixel/AtivosBar.vue'
import HoldButton from '@/components/pixel/HoldButton.vue'
import JukeboxPanel from '@/components/JukeboxPanel.vue'
import MediaStage from '@/components/MediaStage.vue'
import ServerSidebar from '@/components/ServerSidebar.vue'
import PixelIcon from '@/components/PixelIcon.vue'
import TaskPanel from '@/components/TaskPanel.vue'
import NotePanel from '@/components/NotePanel.vue'
import WhiteboardPanel from '@/components/WhiteboardPanel.vue'
import ServersPanel from '@/components/ServersPanel.vue'
import CharacterPanel from '@/components/CharacterPanel.vue'
import AdminPanel from '@/components/AdminPanel.vue'
import FeedbackPanel from '@/components/FeedbackPanel.vue'
import FriendsPanel from '@/components/FriendsPanel.vue'
import DmPanel from '@/components/DmPanel.vue'

const router = useRouter()
const route = useRoute()
const gameStore = useGameStore()
const characterStore = useCharacterStore()
const auth = useAuthStore()
// antes de qualquer filho montar: o rodapé da barra lateral desenha o estado do
// microfone já na primeira pintura, e o da conta anterior não vale pra esta
media.loadPrefs(auth.userId)
let stateTimer = 0

function persistState() {
  if (auth.isAuthenticated && currentId.value) {
    saveWorldState({ activeMap: currentId.value, playerX: pos.x, playerY: pos.y })
  }
}

const host = ref<HTMLElement | null>(null)
const sidebar = ref<InstanceType<typeof ServerSidebar> | null>(null)
const maps = ref<MapDef[]>([])
const currentId = ref('')
const error = ref('')
const activeZone = ref<MapObject | null>(null)
const activeModal = ref<MapObject | null>(null)
const jukeboxOpen = ref(false)
const jukeboxObjectId = ref('')
const taskOpen = ref(false)
const taskObjectId = ref('')
const noteOpen = ref(false)
const noteObjectId = ref('')
const boardOpen = ref(false)
const boardObjectId = ref('')
const panel = ref<GamePanel | null>(null)
const panelInvite = ref('')
const friendsOpen = ref(false)
const dmOpen = ref(false)
const dmFriendId = ref('')
const JUKEBOX_RADIUS = 6 // tiles — alcance do modo "proximidade"
const SELF_CALL_ID = '@me'

const look = computed<AvatarLook>(() => ({
  hairStyle: characterStore.hairStyle,
  hairColor: characterStore.hairColor,
  skin: characterStore.skin,
  topColor: characterStore.topColor,
  pantsColor: characterStore.pantsColor,
  accessory: characterStore.accessory,
}))
// URL pública da foto (mesma pra todo mundo) — vai junto no avatar broadcast pro resto da sala
const myPhotoUrl = computed(() => (characterStore.photoFile ? photoUrl(characterStore.photoFile) : null))
const joinAvatarPayload = computed(() => ({ ...look.value, photoUrl: myPhotoUrl.value }))
const playerName = computed(() => auth.username || 'Sem nome')
const precisaPersonagem = ref(false)
const nomeDaSala = ref('')

const ITENS_SPAWN = [
  { kind: 'plant', label: 'planta', w: 1, h: 1, solid: true },
  { kind: 'flower', label: 'flor', w: 1, h: 1, solid: false },
  { kind: 'tree', label: 'árvore', w: 2, h: 2, solid: true },
  { kind: 'bench', label: 'banco', w: 2, h: 1, solid: true },
  { kind: 'desk', label: 'mesa', w: 2, h: 1, solid: true },
  { kind: 'rug', label: 'tapete', w: 2, h: 2, solid: false },
] as const

const itemParaSpawnar = ref<(typeof ITENS_SPAWN)[number]['kind']>('plant')
const spawnando = ref(false)
const spawnErro = ref('')

async function spawnarItem() {
  const map = currentMap.value
  const modelo = ITENS_SPAWN.find((i) => i.kind === itemParaSpawnar.value)
  if (!map || !modelo || spawnando.value) return
  spawnando.value = true
  spawnErro.value = ''
  try {
    const objeto = {
      id: crypto.randomUUID(),
      kind: modelo.kind,
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      w: modelo.w,
      h: modelo.h,
      solid: modelo.solid,
    }
    const salvo = await saveMap(map.id, { objects: [...map.objects, objeto] })
    const i = maps.value.findIndex((m) => m.id === map.id)
    if (i >= 0) maps.value[i] = salvo
    scene?.setMap(salvo)
  } catch {
    spawnErro.value = 'Não deu pra criar o item aqui.'
  } finally {
    spawnando.value = false
  }
}

function aoFecharPersonagem() {
  precisaPersonagem.value = false
  closeModal()
}
const currentMap = computed(() => maps.value.find((m) => m.id === currentId.value))
const roomPeers = computed(() => [...remotePlayers.values()].filter((p) => !p.map || p.map === currentId.value))

let scene: MapScene | null = null
const pos = reactive({ x: 11, y: 9 })
let facing: Facing = 'down'
let dancing = false as boolean
let sitting = false
let preSit: { x: number; y: number } | null = null
const keys = new Set<string>()
const chatInput = ref('')
const TURBO_MIN = 1.5
const TURBO_MAX = 5
const turboMult = ref(parseFloat(localStorage.getItem('kairos_turbo') || '') || 2.8)
const hudVisible = ref(localStorage.getItem('kairos_hud') !== 'off')
const horario = ref(estadoDeLuz().estagio)
const ehSudo = ref(false)
const horaEditavel = ref(12)
const sudoPanelOpen = ref(false)
const atalhosAbertos = ref(false)
const danceStyle = ref<AvatarPose>('dance')

const ATALHOS = [
  { tecla: 'WASD', oque: 'andar' },
  { tecla: 'E', oque: 'interagir com o que estiver perto' },
  { tecla: 'espaço', oque: 'olhar em volta sem sair do lugar' },
  { tecla: 'B', oque: 'dançar' },
  { tecla: 'G', oque: 'emote' },
  { tecla: 'V', oque: 'abrir a sala de voz' },
  { tecla: 'H', oque: 'recolher a HUD' },
]

const horaLabel = computed(() => {
  const h = Math.floor(horaEditavel.value)
  return `${String(h).padStart(2, '0')}h${horaEditavel.value % 1 ? '30' : '00'}`
})

// espelha o que está ligado quando o painel está fechado — dá pra sair andando
// invisível e esquecer, e o chip é o caminho de volta em um clique
const poderesAtivos = computed<PoderAtivo[]>(() => {
  const itens: PoderAtivo[] = []
  if (sudoNoclip.value) itens.push({ id: 'noclip', label: 'noclip' })
  if (sudoInvisivel.value) itens.push({ id: 'invisivel', label: 'invisível' })
  if (sudoEspectador.value) itens.push({ id: 'espectador', label: 'espectador' })
  if (sudoEscala.value !== 1) itens.push({ id: 'escala', label: `escala ${sudoEscala.value.toFixed(1)}×` })
  if (horaDoMundo.value !== null) itens.push({ id: 'hora', label: 'hora travada', escopo: 'mundo' })
  return itens
})

function desligarPoder(id: string) {
  if (id === 'noclip') sudoNoclip.value = false
  else if (id === 'invisivel') alternarInvisivel(false)
  else if (id === 'espectador') sudoEspectador.value = false
  else if (id === 'escala') sudoEscala.value = 1
  else if (id === 'hora') definirHora(null)
}

function aplicarLuzDoMundo() {
  const h = horaDoMundo.value ?? undefined
  scene?.atualizarLuz(h)
  horario.value = estadoDeLuz(h).estagio
}

function definirHora(h: number | null) {
  emitDefinirHora(h)
}

watch(horaDoMundo, (h) => {
  if (h !== null) horaEditavel.value = h
  aplicarLuzDoMundo()
})
let relogioLuz = 0
const salaAtualId = computed(() => {
  const map = currentMap.value
  return map ? salaDoPonto(map, pos.x, pos.y) : null
})
const salaTrancada = computed(() => !!salaAtualId.value && salasTrancadas.value.has(salaAtualId.value))
function toggleSalaTrancada() {
  const id = salaAtualId.value
  if (!id) return
  emitSalaTrancar(id, !salasTrancadas.value.has(id))
}

watch(turboMult, (v) => localStorage.setItem('kairos_turbo', String(v)))
watch(hudVisible, (v) => localStorage.setItem('kairos_hud', v ? 'on' : 'off'))
const nearby = ref<string | null>(null)
let emoteUntil = 0
const messages = chatMessages
const CHAT_NAME_COLORS = 10

function chatColor(m: ChatMessage): string {
  const key = m.userId || m.name
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (Math.imul(hash, 31) + key.charCodeAt(i)) >>> 0
  return `var(--chat-name-${hash % CHAT_NAME_COLORS})`
}

const CHAT_MAX_LEN = 255
const CHAT_COUNT_FROM = 200
const CHAT_COOLDOWN_MS = 500
const CHAT_BOTTOM_SLACK = 24
const chatLog = ref<HTMLElement | null>(null)
const chatCooldown = ref(false)
const chatUnread = ref(false)
let chatCooldownTimer = 0
const voiceOn = computed(() => media.state.connected)
const voiceConnecting = computed(() => media.state.connecting)
// "estou sendo ouvido de verdade" — nem estar na sala nem a preferência bastam
const mediaStageOpen = ref(false)
const mediaStage = ref<InstanceType<typeof MediaStage> | null>(null)
// tudo daqui pra baixo que fala com a mídia é chaveado por userId (identity do
// LiveKit), nunca por socket.id — este continua sendo a chave de avatar/posição
// look dos participantes vem da presença (o LiveKit só conhece identity e nome)
const peerLooks = computed(() => {
  const out: Record<string, { name: string; look: AvatarLook }> = {}
  for (const p of roomPeers.value) {
    if (!p.userId) continue
    out[p.userId] = { name: p.name, look: sanitizeLook(p.avatar) }
  }
  return out
})

// ---- aviso de transmissão de tela (socket, não LiveKit) ----
const SCREEN_NOTICE_MS = 6000
const screenNotices = ref<{ id: number; userId: string; name: string }[]>([])
const screenNoticeTimers = new Set<number>()
let screenNoticeSeq = 0
let offScreenShare: (() => void) | null = null

function dropScreenNotice(id: number) {
  const index = screenNotices.value.findIndex((n) => n.id === id)
  if (index >= 0) screenNotices.value.splice(index, 1)
}

function onScreenShareState(state: ScreenShareState) {
  // o próprio anúncio volta pelo broadcast da sala: quem compartilhou já sabe
  if (state.userId && state.userId === auth.userId) return
  if (!state.on) {
    // parou antes do aviso expirar — some agora em vez de seguir mentindo
    for (const notice of screenNotices.value.filter((n) => n.userId === state.userId)) dropScreenNotice(notice.id)
    return
  }
  const id = ++screenNoticeSeq
  screenNotices.value.push({ id, userId: state.userId, name: state.name || 'alguém' })
  const timer = window.setTimeout(() => {
    screenNoticeTimers.delete(timer)
    dropScreenNotice(id)
  }, SCREEN_NOTICE_MS)
  screenNoticeTimers.add(timer)
}

// uma fonte só pro anúncio: a transição de screenOn cobre parar pela UI, parar
// pela barra do navegador e cair a conexão
watch(() => media.state.screenOn, (on) => emitScreenShare(on))

function openMediaStage() {
  mediaStageOpen.value = true
  void nextTick(() => mediaStage.value?.restore())
}

// fechar a janela em chamada esconderia um microfone aberto: com voz ativa o
// atalho minimiza (a tira segue mostrando quem fala) e só fecha desconectado
function toggleMediaStage() {
  if (!mediaStageOpen.value) {
    openMediaStage()
    return
  }
  if (voiceOn.value) {
    mediaStage.value?.toggleMinimized()
    return
  }
  mediaStageOpen.value = false
}

// sair da chamada é uma decisão explícita: vale até a pessoa pedir a voz de
// volta, senão a próxima troca de mundo a reconectaria sozinha
let voiceOptOut = false

// Mídia NUNCA segura a entrada no mundo: microfone negado, token recusado ou
// rede fora do ar só mudam o que o rodapé da barra lateral mostra. Por isso
// nada aqui escreve em `error`, que é o aviso do meio da tela.
async function enterVoice(mapId: string, serverChanged = false): Promise<void> {
  if (!mapId || voiceOptOut) return
  // trocar de servidor sem trocar de mundo mantém o mapId e muda a sala (o nome
  // dela é `${serverId}:${mapId}`): só o reconnect explícito tira da sala velha
  // — inclusive quando a conexão com o servidor anterior ainda está subindo
  if (serverChanged && (media.state.connected || media.state.connecting)) {
    await media.reconnect(mapId)
    return
  }
  await media.connect(mapId)
}

function joinVoice() {
  voiceOptOut = false
  void enterVoice(currentId.value)
}

async function leaveVoice() {
  voiceOptOut = true
  await media.disconnect()
}

async function reconnectVoice() {
  if (voiceConnecting.value) return
  voiceOptOut = false
  await media.reconnect(currentId.value)
}

const lastSent = { facing: 'down' as Facing, pose: 'idle' as AvatarPose, boost: false }
// ids dos avatares remotos presentes na cena
const peerIds = new Set<string>()

function onKeyDown(e: KeyboardEvent) {
  // digitando no chat/inputs → não mexe no jogo
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  // controles que não são input mas capturam o teclado (o stepper é um
  // div[role=slider]): declaram a intenção pelo atributo em vez de dependerem só
  // de stopPropagation, que uma refatoração futura silenciaria sem aviso
  if (e.target instanceof HTMLElement && e.target.closest('[data-captura-teclado]')) return
  const k = e.key.toLowerCase()
  if (e.key === ' ' || e.code === 'Space') {
    // Espaço entra no modo olhar (pan) — não rola a página nem reativa botão
    e.preventDefault()
    panMode.value = true
    return
  }
  // atalho da sala de voz não pode engolir Cmd/Ctrl+V (colar) nem Alt+V
  const voiceKey = k === 'v' && !e.ctrlKey && !e.metaKey && !e.altKey
  if (voiceKey || ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'e', 'b', 'g', 'h', 'escape'].includes(k)) e.preventDefault()
  if (k === 'e') { tryInteract(); return }
  if (k === 'b') { dancing = !dancing; danceStyle.value = 'dance'; return }
  if (k === 'g') { emote(); return }
  if (k === 'h') { hudVisible.value = !hudVisible.value; scene?.mostrarMinimapa(hudVisible.value); return }
  if (voiceKey) { toggleMediaStage(); return }
  if (k === 'escape') { closeModal(); return }
  keys.add(k)
}

// zera todas as teclas de movimento seguras — evita "andar sozinho pra sempre"
// quando o keyup nunca chega (janela perde foco: clique direito abrindo o menu
// de contexto do navegador, alt-tab, devtools, etc.)
function clearKeys() {
  keys.clear()
  panMode.value = false
  panDragging = false
  scene?.resetPan()
}

function emote() {
  emoteUntil = Date.now() + 2500
}

function sendChat() {
  if (chatCooldown.value) return
  const t = chatInput.value.trim()
  if (!t) return
  emitChat(t)
  chatInput.value = ''
  chatCooldown.value = true
  chatCooldownTimer = window.setTimeout(() => { chatCooldown.value = false }, CHAT_COOLDOWN_MS)
}

function atChatBottom() {
  const el = chatLog.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight <= CHAT_BOTTOM_SLACK
}

function scrollChatToEnd() {
  const el = chatLog.value
  if (el) el.scrollTop = el.scrollHeight
  chatUnread.value = false
}

function onChatScroll() {
  if (atChatBottom()) chatUnread.value = false
}

// mede o scroll ANTES da mensagem entrar no DOM (watcher pre-flush) e só decide
// depois do nextTick, quando a altura nova já foi calculada; sem isso a medida
// diria "está no fim" sempre. Watcher no array inteiro, não em .length: a lista
// é capada em 50 no presence.ts e o length para de mudar depois disso.
watch(messages, async () => {
  const stick = atChatBottom()
  await nextTick()
  if (stick) scrollChatToEnd()
  else chatUnread.value = true
})

// controles touch (mobile)
function pressKey(k: string) { keys.add(k) }
function releaseKey(k: string) { keys.delete(k) }

// zoom da câmera (+ persistir)
function zoomBy(factor: number) {
  if (!scene) return
  scene.setZoom(scene.getZoom() * factor)
  localStorage.setItem('kairos_zoom', String(scene.getZoom()))
}
function onWheel(e: WheelEvent) {
  zoomBy(e.deltaY < 0 ? 1.1 : 0.9)
}
function onKeyUp(e: KeyboardEvent) {
  if (e.key === ' ' || e.code === 'Space') {
    // soltou o Espaço → sai do modo olhar e recentra no personagem
    panMode.value = false
    panDragging = false
    scene?.resetPan()
    return
  }
  keys.delete(e.key.toLowerCase())
}

// ---- pan da câmera (B3.3): Espaço + arrastar com o botão esquerdo ----
const panMode = ref(false) // Espaço pressionado = "modo olhar"
const espectadorOuPan = computed(() => panMode.value || sudoEspectador.value)
let panDragging = false
let panLastX = 0
let panLastY = 0
function onPanDown(e: PointerEvent) {
  if (!espectadorOuPan.value || e.button !== 0) return
  panDragging = true
  panLastX = e.clientX
  panLastY = e.clientY
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
}
function onPanMove(e: PointerEvent) {
  if (!panDragging) return
  scene?.panBy(e.clientX - panLastX, e.clientY - panLastY)
  panLastX = e.clientX
  panLastY = e.clientY
}
function onPanUp() {
  panDragging = false
}

function tryInteract() {
  const z = activeZone.value
  if (!z || gameStore.isModalOpen) return
  // cadeira/sofá → sentar (em vez de modal); guarda de onde veio pra voltar
  // ao levantar — o objeto costuma ser sólido, levantar "dentro" dele travava
  if (z.sittable || z.kind === 'chair' || z.kind === 'sofa' || z.kind === 'bench') {
    if (!sitting) preSit = { x: pos.x, y: pos.y }
    sitting = true
    pos.x = z.x + z.w / 2
    pos.y = z.y + z.h / 2
    return
  }
  if (z.kind === 'jukebox') {
    jukeboxObjectId.value = z.id
    jukeboxOpen.value = true
    gameStore.isModalOpen = true
    return
  }
  if (z.kind === 'desk') {
    taskObjectId.value = z.id
    taskOpen.value = true
    gameStore.isModalOpen = true
    return
  }
  if (z.kind === 'shelf') {
    noteObjectId.value = z.id
    noteOpen.value = true
    gameStore.isModalOpen = true
    return
  }
  if (z.kind === 'board') {
    boardObjectId.value = z.id
    boardOpen.value = true
    gameStore.isModalOpen = true
    return
  }
  activeModal.value = z
  gameStore.isModalOpen = true
}
function closeModal() {
  gameStore.isModalOpen = false
  activeModal.value = null
  jukeboxOpen.value = false
  taskOpen.value = false
  noteOpen.value = false
  boardOpen.value = false
  panel.value = null
  panelInvite.value = ''
  friendsOpen.value = false
  dmOpen.value = false
  dmFriendId.value = ''
  sudoPanelOpen.value = false
}

function openPanel(next: GamePanel, invite = '') {
  closeModal()
  panel.value = next
  panelInvite.value = invite
  gameStore.isModalOpen = true
}

function openFriends() {
  closeModal()
  friendsOpen.value = true
  gameStore.isModalOpen = true
}

function openDm(friendId = '') {
  closeModal()
  dmFriendId.value = friendId
  dmOpen.value = true
  gameStore.isModalOpen = true
}

function jumpToFriend(serverId: string, mapId: string) {
  closeModal()
  void sidebar.value?.jumpTo(serverId, mapId)
}

watch([look, myPhotoUrl], () => {
  if (!scene?.avatar('me')) return
  scene.removeAvatar('me')
  const puppet = new AvatarPuppet(look.value)
  scene.addAvatar('me', puppet)
  puppet.setPhoto(myPhotoUrl.value)
  scene.placeAvatar('me', pos.x, pos.y)
})

function applyMap(map: MapDef) {
  currentId.value = map.id
  gameStore.activeMap = map.id
  scene?.setMap(map)
  pos.x = map.spawn.x
  pos.y = map.spawn.y
}

function selectMap(id: string) {
  // B2: já estou neste mundo → no-op. Re-entrar recriava a sessão (switchMap limpa
  // os peers e re-join), me deixando "sozinho" e exigindo F5 pra voltar.
  if (id === currentId.value) return
  const map = maps.value.find((m) => m.id === id)
  if (!scene || !map) return
  applyMap(map)
  switchMap(id)
  // entrar num mundo é entrar na conversa dele: sem voz ainda, conecta; com voz,
  // troca de sala (o media.ts compara o mundo e reconecta sozinho)
  void enterVoice(id)
}

// o servidor ativo já mudou no backend (a barra lateral chamou switchServer):
// aqui recarregam os mundos e a sessão. O socket lê o servidor no handshake e
// não tem como atualizá-lo, então tem de reconectar — sem isso o avatar
// continuaria na sala do servidor anterior.
async function onServerChanged(_serverId?: string, mapId?: string) {
  error.value = ''
  try {
    maps.value = await fetchMaps()
    const target = maps.value.find((m) => m.id === mapId)
      || maps.value.find((m) => m.id === currentId.value)
      || maps.value[0]
    if (!target) { error.value = 'Nenhum mundo disponível'; return }
    if (target.id !== currentId.value) applyMap(target)
    disconnectPresence()
    // o histórico é da sala do servidor anterior
    messages.splice(0)
    connectPresence({ avatar: joinAvatarPayload.value, map: target.id, x: pos.x, y: pos.y })
    void sidebar.value?.reloadServers()
    void enterVoice(target.id, true)
  } catch (e) {
    error.value = (e as Error).message
  }
}

// foto de peer vem da rede — só carrega se for o caminho canônico da nossa API,
// nunca uma URL externa arbitrária
const PEER_PHOTO_RE = /\/kairos-api\/character\/photo\/([a-f0-9-]+\.(?:jpg|png|webp))$/
function safePeerPhotoUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || raw.length > 300) return null
  const m = PEER_PHOTO_RE.exec(raw)
  return m ? photoUrl(m[1]) : null
}

// colisão entre personagens: bloqueia só se o movimento APROXIMA de quem já está perto
// (assim nunca "trava" dentro de outro — sempre dá pra se afastar/deslizar)
function peerBlocks(nx: number, ny: number, cx: number, cy: number): boolean {
  for (const peer of remotePlayers.values()) {
    if (peer.map && peer.map !== currentId.value) continue
    const dNew = Math.hypot(peer.x - nx, peer.y - ny)
    if (dNew < 0.7 && dNew < Math.hypot(peer.x - cx, peer.y - cy)) return true
  }
  return false
}

// água atravessável deixa o movimento mais lento
function onWater(map: MapDef, x: number, y: number): boolean {
  return map.objects.some((o) => o.kind === 'water' && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h)
}

function detectZone(map: MapDef) {
  let nearest: MapObject | null = null
  let best = 2.6
  for (const o of interactableObjects(map)) {
    const cx = o.x + o.w / 2
    const cy = o.y + o.h / 2
    const d = Math.hypot(cx - pos.x, cy - pos.y)
    if (d < best) { best = d; nearest = o }
  }
  activeZone.value = nearest
}

// qual jukebox tocar: dentro de uma área, só a que está nela (senão silêncio —
// não vaza pra fora); fora de área, a mais próxima entre as de fila "solta"
// (sem sala própria), senão silêncio
function jukeboxAtiva(map: MapDef): MapObject | null {
  const caixas = map.objects.filter((o) => o.kind === 'jukebox')
  if (!caixas.length) return null
  // alcance global quer dizer exatamente "ignore a geometria": tem que sair antes
  // dos filtros por sala, senão a caixa é descartada e ninguém chega a ler o flag
  const global = caixas.find((o) => estadoDoJukebox(o.id)?.alcanceGlobal)
  if (global) return global
  if (salaAtualId.value) {
    return caixas.find((o) => salaDoPonto(map, o.x + o.w / 2, o.y + o.h / 2) === salaAtualId.value) ?? null
  }
  let escolhida: MapObject | null = null
  let melhor = Infinity
  for (const o of caixas) {
    if (estadoDoJukebox(o.id)?.areaId) continue
    const d = Math.hypot(o.x + o.w / 2 - pos.x, o.y + o.h / 2 - pos.y)
    if (d < melhor) { melhor = d; escolhida = o }
  }
  return escolhida
}

function dentroDosLimites(map: MapDef, x: number, y: number): boolean {
  return x >= 1 && y >= 1 && x <= map.width - 2 && y <= map.height - 2
}

function minimapDoScene(): Minimap | null {
  return scene?.minimap ?? null
}

function aoClicarMinimapa(x: number, y: number) {
  if (!ehSudo.value) return
  pos.x = x
  pos.y = y
  emitSudoTeleporte(x, y)
}

function puxarPara(alvoId: string) {
  if (!ehSudo.value) return
  emitSudoPuxar(alvoId)
}

function irAte(x: number, y: number) {
  aoClicarMinimapa(x, y)
}

function alternarInvisivel(valor?: boolean) {
  sudoInvisivel.value = valor ?? !sudoInvisivel.value
  emitSudoInvisivel(sudoInvisivel.value)
}

const AVATAR_UPDATE_THROTTLE_MS = 1000
let lastAvatarUpdateEmit = 0
let avatarUpdateTimer = 0

function emitEscalaAoServidor(v: number) {
  const enviar = () => {
    lastAvatarUpdateEmit = Date.now()
    const payload = { ...joinAvatarPayload.value, escala: v }
    emitAvatarUpdate(payload)
  }
  const decorrido = Date.now() - lastAvatarUpdateEmit
  if (decorrido >= AVATAR_UPDATE_THROTTLE_MS) {
    enviar()
    return
  }
  window.clearTimeout(avatarUpdateTimer)
  avatarUpdateTimer = window.setTimeout(enviar, AVATAR_UPDATE_THROTTLE_MS - decorrido)
}

watch(sudoEscala, (v) => {
  scene?.avatar('me')?.setEscala(v)
  emitEscalaAoServidor(v)
})
watch(sudoInvisivel, (v) => scene?.avatar('me')?.setOculto(v))

watch(ehSudo, (v) => minimapDoScene()?.permitirClique(v))

const FESTA_DURACAO_MS = 5000
let festaTimer = 0

function aplicarFesta() {
  window.clearTimeout(festaTimer)
  dancing = true
  danceStyle.value = 'dance'
  festaTimer = window.setTimeout(() => { dancing = false }, FESTA_DURACAO_MS)
}

function dispararFesta() {
  emitSudoFesta()
  aplicarFesta()
}

function dancarComo(estilo: 'giro' | 'pulo' | 'robo') {
  dancing = true
  danceStyle.value = estilo
}

let offPuxado: (() => void) | null = null
let offFesta: (() => void) | null = null

onMounted(async () => {
  const asked = panelFromQuery(route.query)
  const invite = route.query.invite
  if (asked) openPanel(asked, typeof invite === 'string' ? invite : '')
  if (asked || invite) void router.replace({ path: '/game' })

  scene = new MapScene()
  await scene.init(host.value!)
  const savedZoom = parseFloat(localStorage.getItem('kairos_zoom') || '')
  if (savedZoom) scene.setZoom(savedZoom)
  scene.addAvatar('me', new AvatarPuppet(look.value))
  scene.avatar('me')?.setPhoto(myPhotoUrl.value)
  minimapDoScene()?.aoClicar(aoClicarMinimapa)
  relogioLuz = window.setInterval(aplicarLuzDoMundo, 30_000)
  me()
    .then((p) => {
      ehSudo.value = p.isAdmin
      auth.setUsername(p.username ?? null)
      void precisaCriarPersonagem().then((v) => {
        precisaPersonagem.value = v
        if (v && !asked) openPanel('personagem')
      })
    })
    .catch(() => { ehSudo.value = false })

  try {
    maps.value = await fetchMaps()
    // retoma último mundo + posição salvos (se logado)
    let startId = gameStore.activeMap
    let savedPos: { x: number; y: number } | null = null
    if (auth.isAuthenticated) {
      try {
        const st = await getWorldState()
        if (st && maps.value.find((m) => m.id === st.activeMap)) {
          startId = st.activeMap
          savedPos = { x: st.playerX, y: st.playerY }
        }
      } catch {
        // falha ao carregar estado salvo nunca bloqueia a entrada na sala
      }
    }
    const first = maps.value.find((m) => m.id === startId) || maps.value[0]
    if (!first) { error.value = 'Nenhum mundo disponível'; return }
    selectMap(first.id)
    if (savedPos) { pos.x = savedPos.x; pos.y = savedPos.y }
    connectPresence({ avatar: joinAvatarPayload.value, map: first.id, x: pos.x, y: pos.y })
    // a barra lateral já montou (e já pediu a lista de servidores) antes do
    // socket existir: o observador de presença só cola agora
    sidebar.value?.syncPresence()
  } catch (e) {
    error.value = (e as Error).message
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', clearKeys)
  offScreenShare = onScreenShare(onScreenShareState)
  offPuxado = onPuxado(({ x, y }) => { pos.x = x; pos.y = y })
  offFesta = onFesta(aplicarFesta)
  stateTimer = window.setInterval(persistState, 15000)

  scene.app.ticker.add((ticker) => {
    if (!scene) return
    const map = currentMap.value
    if (!map) return
    const dt = Math.min(ticker.deltaMS / 1000, 0.05)

    // ---- movimento local (com colisão) ----
    let dx = 0, dy = 0
    // boost (M2): Shift acelera ~1.8x — carrinho aparece sob o boneco enquanto anda
    const boosting = keys.has('shift')
    // Espaço (modo olhar/pan) congela o personagem — só a câmera se move.
    // Sessão derrubada (aberta em outro lugar) também congela — não faz
    // sentido continuar "andando" localmente já desconectado da sala.
    if (!gameStore.isModalOpen && !espectadorOuPan.value && !sessionKicked.value) {
      const sp = 5 * dt * (onWater(map, pos.x, pos.y) ? 0.5 : 1) * (boosting ? turboMult.value : 1)
      if (keys.has('w') || keys.has('arrowup')) dy -= sp
      if (keys.has('s') || keys.has('arrowdown')) dy += sp
      if (keys.has('a') || keys.has('arrowleft')) dx -= sp
      if (keys.has('d') || keys.has('arrowright')) dx += sp
    }
    const moving = dx !== 0 || dy !== 0
    if (moving && sitting) {
      // levantar devolve pra onde estava antes de sentar (senão fica dentro do sólido)
      sitting = false
      if (preSit) {
        pos.x = preSit.x
        pos.y = preSit.y
        preSit = null
      }
    }
    if (moving) {
      facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down')
      const nx = pos.x + dx
      const ny = pos.y + dy
      const salaAtual = salaDoPonto(map, pos.x, pos.y)
      // escape: se o tile ATUAL já é sólido (sentou/spawnou dentro), libera o
      // movimento — regra anti-travamento, nunca deixa o personagem preso
      const stuck = isSolid(map, Math.floor(pos.x), Math.floor(pos.y), salasTrancadas.value, salaAtual)
      const liberaX = sudoNoclip.value
        ? dentroDosLimites(map, Math.floor(nx), Math.floor(pos.y))
        : (stuck || !isSolid(map, Math.floor(nx), Math.floor(pos.y), salasTrancadas.value, salaAtual))
      const liberaY = sudoNoclip.value
        ? dentroDosLimites(map, Math.floor(pos.x), Math.floor(ny))
        : (stuck || !isSolid(map, Math.floor(pos.x), Math.floor(ny), salasTrancadas.value, salaAtual))
      if (liberaX && !peerBlocks(nx, pos.y, pos.x, pos.y)) pos.x = nx
      if (liberaY && !peerBlocks(pos.x, ny, pos.x, pos.y)) pos.y = ny
    }
    scene.posicionarLuzDoJogador(pos.x, pos.y)
    scene.atualizarMinimapa(
      pos,
      [...remotePlayers.values()].map((p) => ({ x: p.x, y: p.y, falando: media.peers.get(p.userId)?.speaking })),
      salasTrancadas.value,
    )
    const pessoasDoMapa = [{ id: SELF_CALL_ID, x: pos.x, y: pos.y }]
    for (const p of remotePlayers.values()) {
      if (p.map && p.map !== map.id) continue
      if (p.userId) pessoasDoMapa.push({ id: p.userId, x: p.x, y: p.y })
    }
    const calls = callsDoMapa(map, pessoasDoMapa)
    const minhaCall = calls.get(SELF_CALL_ID) ?? null

    for (const p of remotePlayers.values()) {
      const ganho = ganhoDoPeer({
        map,
        falante: { x: p.x, y: p.y },
        ouvinte: pos,
        trancadas: salasTrancadas.value,
        callFalante: p.userId ? calls.get(p.userId) ?? null : null,
        callOuvinte: minhaCall,
      })
      media.setPeerGain(p.userId, ganho)
    }

    const onCart = boosting && moving
    const emoting = Date.now() < emoteUntil
    const pose: AvatarPose = sitting ? 'sit' : moving ? 'walk' : emoting ? 'wave' : dancing ? danceStyle.value : 'idle'
    // emite estado quando se move ou quando pose/direção/boost mudam (dança parado conta)
    if (moving || pose !== lastSent.pose || facing !== lastSent.facing || onCart !== lastSent.boost) {
      emitMove(pos.x, pos.y, facing, pose, onCart)
      lastSent.pose = pose
      lastSent.facing = facing
      lastSent.boost = onCart
    }
    detectZone(map)

    const me = scene.avatar('me')
    if (me) {
      me.setFacing(facing)
      me.setPose(pose)
      me.setBoost(onCart)
      me.update(dt)
    }
    scene.placeAvatar('me', pos.x, pos.y)
    scene.follow(pos.x, pos.y)
    scene.cull()
    const sala = scene.nomeDaAreaAtual()
    if (sala !== nomeDaSala.value) nomeDaSala.value = sala

    // ---- avatares remotos ----
    syncRemotes(dt, map)
    scene.sortAvatars()

    // ---- proximidade: indicador + voz por proximidade ----
    let near: string | null = null
    let best = 3
    const voiceIds: string[] = []
    const videoIds: string[] = []
    const voiceLive = media.state.connected
    const minhaSala = salaDoPonto(map, pos.x, pos.y)
    for (const peer of remotePlayers.values()) {
      if (peer.map && peer.map !== map.id) continue
      const d = Math.hypot(peer.x - pos.x, peer.y - pos.y)
      if (d < best) { best = d; near = peer.name }
      const inRange = d <= 4 // raio de comunicação — mesmo alcance usado pra voz por proximidade
      // histerese na voz: assina a ≤4, mas quem já está assinado só cai a >5 —
      // sem isso, dançar na borda do raio gera assina/desassina em loop
      const keepConnected = voiceLive && media.isSubscribed(peer.userId) && d <= 5
      const mesmaCallDoPeer =
        !!peer.userId && minhaCall !== null && minhaCall === (calls.get(peer.userId) ?? null)
      // (userId vazio não deveria acontecer — o gateway recusa socket sem usuário —
      // mas se acontecer o peer só fica sem mídia, sem quebrar o frame)
      if (peer.userId && (inRange || keepConnected || mesmaCallDoPeer)) voiceIds.push(peer.userId)
      scene.avatar(peer.id)?.setNameVisible(inRange)

      if (peer.userId) {
        const salaDoPeer = salaDoPonto(map, peer.x, peer.y)
        const querVideo =
          minhaSala || salaDoPeer
            ? minhaSala !== null && minhaSala === salaDoPeer
            : historeseMidia(voiceLive && media.isVideoWanted(peer.userId), d)
        if (querVideo) videoIds.push(peer.userId)
      }
    }
    nearby.value = near
    if (voiceLive) {
      media.syncSubscriptions(voiceIds)
      media.syncVideoSubscriptions(videoIds)
    }

    // dentro da sala do jukebox o volume é cheio — é ambiente, não proximidade.
    // a queda por distância só vale para fila sem sala (mundo aberto).
    const caixaAtiva = jukeboxAtiva(map)
    const estadoJukeboxAtivo = estadoDoJukebox(caixaAtiva?.id ?? null)
    jukeboxAudio.setAreaDoOuvinte(salaAtualId.value)
    jukeboxAudio.sync(estadoJukeboxAtivo)
    scene.setJukeboxPlaying(!!estadoJukeboxAtivo?.current)
    if (estadoJukeboxAtivo?.current) {
      if (estadoJukeboxAtivo.alcanceGlobal || estadoJukeboxAtivo.areaId) {
        jukeboxAudio.setVolume(1, estadoJukeboxAtivo)
      } else if (caixaAtiva) {
        const d = Math.hypot(caixaAtiva.x + caixaAtiva.w / 2 - pos.x, caixaAtiva.y + caixaAtiva.h / 2 - pos.y)
        jukeboxAudio.setVolume(Math.max(0, 1 - d / JUKEBOX_RADIUS), estadoJukeboxAtivo)
      }
    }
  })
})

function syncRemotes(dt: number, map: MapDef) {
  if (!scene) return
  const seen = new Set<string>()
  for (const peer of remotePlayers.values()) {
    if (peer.map && peer.map !== map.id) continue
    seen.add(peer.id)
    let p = scene.avatar(peer.id)
    if (!p) {
      p = new AvatarPuppet(sanitizeLook(peer.avatar))
      p.setName(peer.name)
      p.setPhoto(safePeerPhotoUrl((peer.avatar as AvatarProps)?.photoUrl))
      scene.addAvatar(peer.id, p)
      peerIds.add(peer.id)
    }
    // pose e direção agora vêm sincronizadas da rede
    p.setFacing(peer.facing || 'down')
    p.setPose(peer.pose || 'idle')
    p.setBoost(!!peer.boost)
    p.setName(peer.name)
    p.setEscala((peer.avatar as AvatarProps)?.escala ?? 1)
    p.update(dt)
    scene.placeAvatar(peer.id, peer.x, peer.y)
  }
  // remove quem saiu / mudou de mapa
  for (const id of [...peerIds]) {
    if (!seen.has(id)) { scene.removeAvatar(id); peerIds.delete(id) }
  }
}

async function leave() {
  disconnectPresence()
  // precisa vir ANTES do logout() local — esse ainda usa o token pra avisar o
  // backend (se for convidado, apaga a conta inteira); depois de limpar o
  // token não teria mais como autenticar essa chamada
  await logoutApi()
  useAuthStore().logout()
  characterStore.$reset() // limpa nome/avatar em memória (não vaza pra próxima conta)
  syncDmUnread([])
  jukeboxAudio.stop()
  router.push('/login')
}

onUnmounted(() => {
  window.clearInterval(relogioLuz)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', clearKeys)
  clearInterval(stateTimer)
  clearTimeout(chatCooldownTimer)
  offScreenShare?.()
  offScreenShare = null
  offPuxado?.()
  offPuxado = null
  offFesta?.()
  offFesta = null
  window.clearTimeout(festaTimer)
  window.clearTimeout(avatarUpdateTimer)
  for (const timer of screenNoticeTimers) clearTimeout(timer)
  screenNoticeTimers.clear()
  persistState()
  // Room vazada = microfone continua ligado depois de sair da tela
  void media.disconnect()
  disconnectPresence()
  jukeboxAudio.stop()
  scene?.destroy()
  scene = null
})
</script>

<style scoped>
.gp-root {
  height: 100vh;
  display: grid;
  grid-template-columns: 3.5rem 1fr;
  background: var(--bg-0);
  overflow: hidden;
  transition: grid-template-columns 0.25s ease;
}
.gp-root.gp-sidebar-open {
  grid-template-columns: 18rem 1fr;
}

.gp-sidebar {
  background: var(--bg-2);
  border-right: 0.0625rem solid var(--border);
  display: flex;
  min-width: 0;
  overflow: hidden;
}

.gp-avatar-box {
  width: 2.25rem;
  height: 2.25rem;
  background: var(--bg-3);
  display: grid;
  place-items: center;
  overflow: hidden;
  flex-shrink: 0;
}

.gp-stage {
  position: relative;
  overflow: hidden;
  background: var(--bg-0);
}

.gp-canvas-host {
  position: absolute;
  inset: 0;
}
.gp-cursor-default { cursor: default; }
.gp-cursor-grab { cursor: grab; }
.gp-cursor-grabbing { cursor: grabbing; }

.gp-zoom {
  position: absolute;
  top: 4rem;
  right: 1rem;
  z-index: 10;
}
.gp-zoom-btn {
  cursor: pointer;
  width: 1.875rem;
  height: 1.875rem;
  font-size: 1rem;
}

.gp-hud {
  position: absolute;
  z-index: 10;
}

.gp-hud-topleft {
  top: 1rem;
  left: 1rem;
  display: inline-flex;
  background: var(--bg-1);
  border: 0.125rem solid var(--tinta);
  box-shadow: var(--ui-shadow);
  padding: 0.5rem 0.75rem 0.5rem 0.5rem;
}

.gp-hud-tight { line-height: 1.1; }
.gp-hud-name { font-size: 0.8125rem; font-weight: 600; }
.gp-hud-mapname {
  font-size: 0.625rem;
  color: var(--text-3);
  font-family: var(--f-mono);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.gp-nearby {
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(44, 116, 65, 0.2);
  border: 0.0625rem solid var(--primary-hi);
  backdrop-filter: blur(0.625rem);
  padding: 0.375rem 0.875rem;
  font-size: 0.75rem;
  color: var(--text);
}

/* abaixo do "perto de X" pra não brigar pelo topo-centro */
.gp-screen-notices {
  position: absolute;
  top: 3.75rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: grid;
  justify-items: center;
  gap: 0.25rem;
  max-width: min(26rem, calc(100% - 2rem));
  /* não captura clique nem foco: o jogo segue respondendo ao teclado embaixo */
  pointer-events: none;
}

.gp-screen-notice {
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
.gp-screen-notice b { color: var(--accent-texto); }

@media (prefers-reduced-motion: no-preference) {
  .gp-screen-notice {
    animation: gpScreenNotice 0.18s steps(3, jump-none) both;
  }
  @keyframes gpScreenNotice {
    from { opacity: 0; transform: translateY(-0.5rem); }
    to { opacity: 1; transform: translateY(0); }
  }
}

.gp-chat {
  position: absolute;
  bottom: 1rem;
  left: 1rem;
  width: min(17.5rem, calc(100vw - 2rem));
  z-index: 10;
}

.gp-chat-log {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 11.25rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin-bottom: 0.375rem;
  padding: 0.5rem 0.5rem;
  background: var(--bg-1);
  background: color-mix(in srgb, var(--bg-1) 55%, transparent);
  border: 0.0625rem solid var(--border);
  backdrop-filter: blur(0.1875rem);
  -webkit-backdrop-filter: blur(0.1875rem);
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
}
.gp-chat-log::-webkit-scrollbar { width: 0.375rem; }
.gp-chat-log::-webkit-scrollbar-track { background: transparent; }
.gp-chat-log::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: var(--r-sm); }
.gp-chat-log::-webkit-scrollbar-thumb:hover { background: var(--text-4); }

.gp-chat-msg {
  font-size: 0.75rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
  text-shadow: 0 0.0625rem 0.125rem var(--bg-0);
}
.gp-chat-name { font-weight: 600; }
.gp-chat-text { color: var(--text); }

.gp-chat-field {
  position: relative;
}

.gp-chat-foot {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 0.25rem);
  display: flex;
  align-items: flex-end;
  gap: 0.375rem;
  pointer-events: none;
}

.gp-chat-jump {
  pointer-events: auto;
  cursor: pointer;
  font-family: var(--f-pixel);
  font-size: 0.5625rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--bg-0);
  background: var(--primary-hi);
  border: 0.0625rem solid var(--primary-hi);
  border-radius: var(--r-sm);
  padding: 0.25rem 0.375rem;
}
.gp-chat-jump:hover { background: var(--accent-hi); border-color: var(--accent-hi); }

.gp-chat-count {
  margin-left: auto;
  font-family: var(--f-mono);
  font-size: 0.625rem;
  color: var(--text-3);
  background: var(--bg-1);
  background: color-mix(in srgb, var(--bg-1) 70%, transparent);
  padding: 0.125rem 0.25rem;
}
.gp-chat-count-max { color: var(--warn); }

.gp-chat-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--bg-1);
  background: color-mix(in srgb, var(--bg-1) 72%, transparent);
  backdrop-filter: blur(0.1875rem);
  -webkit-backdrop-filter: blur(0.1875rem);
  border: 0.0625rem solid var(--border-strong);
  color: var(--text);
  padding: 0.5rem 0.625rem;
  font-size: 0.8125rem;
  font-family: inherit;
}
.gp-chat-input:focus { outline: none; border-color: var(--primary-hi); }

.gp-chat-cooldown {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 0.125rem;
  background: var(--primary-hi);
  transform-origin: left center;
  pointer-events: none;
  /* duração casada com CHAT_COOLDOWN_MS no script */
  animation: gpChatCooldown 0.5s linear forwards;
}
@keyframes gpChatCooldown {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

.gp-hud-bottom {
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  background: var(--bg-1);
  border: 0.125rem solid var(--tinta);
  box-shadow: var(--ui-shadow);
  padding: 0.5rem 0.875rem;
  font-size: 0.6875rem;
  color: var(--text-2);
  letter-spacing: 0.06em;
}
.gp-hud-hint { color: var(--text-3); }
.gp-hud-sep { color: var(--text-4); }
.gp-hud-action { color: var(--accent-texto); }

.gp-hud-hora {
  font-family: var(--f-pixel);
  font-size: 0.5625rem;
  color: var(--text-3);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.gp-hud-ctl {
  position: absolute;
  right: 1.25rem;
  top: 8.5rem;
  width: 25.25rem;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.75rem;
  padding: 0;
  z-index: 15;
}

/* largura travada: o slot condicional reserva o espaço mesmo vazio, senão a
   barra muda de tamanho sozinha ao entrar e sair de uma sala */
.gp-hud-linha {
  display: grid;
  grid-template-columns: 1fr 6rem;
  gap: 0.625rem;
  align-items: end;
}
.gp-hud-campo { display: flex; flex-direction: column; gap: 0.375rem; min-width: 0; }
.gp-hud-slot { justify-content: flex-end; }
.gp-hud-topo { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.gp-hud-cap { margin: 0; }
.gp-hud-full { width: 100%; }
.gp-hud-recolhido { display: flex; gap: 0.375rem; align-items: center; }

.gp-hud-rodape {
  appearance: none;
  background: none;
  border: none;
  border-right: 0.125rem solid rgba(36, 28, 21, 0.18);
  min-height: 2.375rem;
  cursor: pointer;
  color: var(--text);
  font-family: var(--f-pixel);
  font-size: 0.5625rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
}
.gp-hud-rodape:last-child { border-right: none; }
.gp-hud-rodape:hover { background: var(--bg-2); }
.gp-hud-rodape-on { background: var(--accent); }
.gp-hud-coroa { max-width: 2.75rem; }

.gp-atalhos {
  position: absolute;
  right: 1.25rem;
  top: 8.5rem;
  z-index: 30;
  width: 18rem;
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}
.gp-atalhos-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4375rem; }
.gp-atalhos-lista li { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; color: var(--text-2); }

.gp-sudo-panel {
  position: absolute;
  /* ancorado à direita, embaixo da barra de controles: à esquerda ele cobria o
     nome do mundo e a lista de mundos */
  top: 8.5rem;
  right: 1.25rem;
  z-index: 30;
  width: 25.25rem;
  max-width: calc(100vw - 2.5rem);
  /* a lista de pessoas e os 4 grupos passam da tela em monitor baixo — sem teto
     o painel some por baixo do rodapé em vez de rolar */
  max-height: calc(100vh - 10rem);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 0.75rem;
}

.gp-sudo-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}
.gp-sudo-row .k-btn { flex: 1 1 auto; }
.gp-sudo-spawn { display: grid; grid-template-columns: 1fr 10.625rem; gap: 0.375rem; align-items: stretch; }
.gp-sudo-grupo { margin: 0; }
.gp-sudo-select { flex: 1; min-width: 0; }
.gp-sudo-perigo-tit { color: var(--err); margin: 0.25rem 0 0; }
.gp-sudo-perigo-txt { font-size: 0.6875rem; color: #7a4a3a; line-height: 1.4; margin: 0 0 0.125rem; }
.gp-sudo-pessoas { display: flex; flex-direction: column; gap: 0.375rem; }
/* a lista cresce com quem entra: sem teto ela empurra o resto do painel */
.gp-sudo-lista {
  max-height: 12.5rem;
  overflow-y: auto;
  border: 0.125rem solid var(--tinta);
  background: var(--bg-2);
}
.gp-sudo-pessoa {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.5rem;
  min-height: 2.5rem;
  border-bottom: 0.125rem solid rgba(36, 28, 21, 0.1);
}
.gp-sudo-pessoa:last-child { border-bottom: none; }
.gp-sudo-pessoa-nome { flex: 1; min-width: 0; font-size: 0.8125rem; font-weight: 700; }
.gp-sudo-erro {
  margin: 0.375rem 0 0;
  padding: 0.375rem 0.5rem;
  background: var(--err);
  color: var(--bg-2);
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
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

.gp-modal-close { padding: 0.375rem 0.625rem; gap: 0.375rem; }

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

.gp-modal-body {
  background: var(--bg-1);
  border: 0.0625rem solid var(--border);
  padding: 1rem;
  font-size: 0.8125rem;
  color: var(--text-2);
  line-height: 1.6;
}

.gp-touch-ctl {
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

.gp-error {
  position: absolute;
  top: 7rem;
  left: 50%;
  transform: translateX(-50%);
  color: var(--err);
  font-size: 0.8125rem;
  z-index: 10;
}

.tbtn {
  background: var(--bg-1);
  border: 0.125rem solid var(--tinta);
  color: var(--text);
  font-size: 1.125rem;
  display: grid;
  place-items: center;
  cursor: pointer;
  border-radius: 0.375rem;
  touch-action: none;
}
.tbtn:active {
  background: rgba(44, 116, 65, 0.32);
}
/* esconde os controles touch em dispositivos com mouse (desktop) */
@media (hover: hover) and (pointer: fine) {
  .touch-ctl {
    display: none !important;
  }
}

/* Telas estreitas (ou zoom alto do navegador, que reduz os mesmos px de CSS):
   a sidebar aberta virava um grid-column de 18rem e sobrava quase nada pro palco.
   Vira overlay flutuante em vez de empurrar o grid — o palco sempre ocupa o resto. */
@media (max-width: 48rem) {
  .gp-root.gp-sidebar-open {
    grid-template-columns: 3.5rem 1fr;
  }
  .gp-sidebar.gp-sidebar-open {
    position: fixed;
    top: 0;
    left: 0;
    width: min(18rem, 80vw);
    height: 100vh;
    z-index: 100;
    box-shadow: 0.5rem 0 1.5rem rgba(0, 0, 0, 0.5);
  }

  /* HUD: lista de quem está online ocupava um card próprio no topo-direita —
     em telas estreitas colide com o card do topo-esquerda. Esconde os nomes,
     mantém só a contagem (mais compacta). */

  .gp-chat {
    bottom: 0.75rem;
    left: 0.75rem;
  }
}

/* Muito estreito (celular em pé): dica de teclas (WASD/B/G) é redundante com
   os controles touch e brigava por espaço com chat/voz na mesma faixa vertical. */
@media (max-width: 30rem) {
  .gp-hud-bottom {
    display: none;
  }
}
</style>
