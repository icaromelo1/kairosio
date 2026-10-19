<template>
  <div class="ch-root">
    <div class="ch-abas">
      <button
        class="ch-aba" :class="{ 'ch-aba-on': abaChat === 'mundo' }"
        @click="abaChat = 'mundo'"
      >mundo</button>
      <button
        v-if="salaDoChat"
        class="ch-aba" :class="{ 'ch-aba-on': abaChat === 'sala' }"
        @click="abaChat = 'sala'"
      >
        <span class="ellipsis">{{ salaDoChat.nome }}</span>
        <span v-if="naoLidasSala" class="ch-bolha">{{ naoLidasSala }}</span>
      </button>
      <span v-else class="ch-aba ch-aba-vazia">sem sala</span>
      <button
        v-if="abaDmDisponivel && alvoDm"
        class="ch-aba ch-aba-dm" :class="{ 'ch-aba-on': abaChat === 'dm' }"
        :title="`conversa com ${alvoDm.nome}`"
        @click="abrirAbaDm"
      >
        <span class="ellipsis">{{ alvoDm.nome }}</span>
        <span v-if="alvoDm.naoLidas" class="ch-bolha">{{ alvoDm.naoLidas }}</span>
      </button>
      <button
        class="ch-chip" :class="{ 'ch-chip-on': dmComoAba }"
        title="Mostrar conversas de amigos como abas aqui"
        @click="dmComoAba = !dmComoAba"
      >DMs {{ dmComoAba ? 'on' : 'off' }}</button>
    </div>
    <div v-if="abaChat === 'dm'" ref="dmLog" class="ch-log">
      <p v-if="!itensDm.length" class="ch-dm-nota">nada por aqui ainda</p>
      <template v-for="item in itensDm" :key="item.chave">
        <div
          v-if="item.tipo === 'msg'"
          class="ch-dm-msg" :class="{ 'ch-dm-msg-minha': item.minha }"
        >
          <span class="ch-dm-texto">{{ item.texto }}</span>
          <span v-if="item.hora" class="ch-dm-hora">{{ item.hora }}</span>
        </div>
        <p v-else class="ch-dm-nota">{{ item.texto }}</p>
      </template>
    </div>
    <div v-else-if="messages.length" ref="chatLog" class="ch-log" @scroll="onChatScroll">
      <div v-for="(m, i) in messages" :key="i" class="ch-msg">
        <span class="ch-nome" :style="{ color: chatColor(m) }">{{ m.name }}:</span>
        <span class="ch-texto"> {{ m.text }}</span>
      </div>
      <button
        v-if="chatUnread"
        class="k-btn k-btn-primary k-btn-sm ch-pular"
        @click="scrollChatToEnd"
      >novas mensagens ↓</button>
    </div>
    <div class="ch-campo">
      <div class="ch-rodape">
        <span
          v-if="textoDoCampo.length > contarAPartir"
          class="ch-contador"
          :class="{ 'ch-contador-max': textoDoCampo.length >= limiteDoCampo }"
        >{{ textoDoCampo.length }}/{{ limiteDoCampo }}</span>
      </div>
      <div class="ch-input-wrap">
        <span class="ch-prefixo ellipsis">{{ prefixoChat }}</span>
        <input
          v-model="textoDoCampo" :maxlength="limiteDoCampo" placeholder="mensagem… (Enter)"
          class="ch-input"
          @keydown.enter="sendChat"
        />
      </div>
      <span v-if="chatCooldown" class="ch-cooldown" />
    </div>
    <p class="k-label ch-contrato">esc volta · campo focado sequestra o teclado</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { chatMundo, chatSala, emitChat, salaDoChat, type ChatMessage } from '@/services/presence'
import {
  abertaId as dmAbertaId, alvo as alvoDm, enviar as enviarDm, itens as itensDm,
  marcarLida as marcarDmLida, rascunho as rascunhoDm,
} from '@/services/dm.state'
import { DM_TEXTO_MAX } from '@/services/dm.api'

const CHAT_NAME_COLORS = 10
const CHAT_MAX_LEN = 255
const CHAT_COUNT_FROM = 200
const CONTADOR_FOLGA = CHAT_MAX_LEN - CHAT_COUNT_FROM
const CHAT_COOLDOWN_MS = 500
const CHAT_BOTTOM_SLACK = 24

const abaChat = ref<'mundo' | 'sala' | 'dm'>('mundo')
const naoLidasSala = ref(0)
const messages = computed(() => (abaChat.value === 'sala' ? chatSala : chatMundo))
const chatInput = ref('')

const dmComoAba = ref(localStorage.getItem('kairos_dm_aba') !== 'off')
watch(dmComoAba, (v) => localStorage.setItem('kairos_dm_aba', v ? 'on' : 'off'))
const abaDmDisponivel = computed(() => dmComoAba.value && !!alvoDm.value)

const prefixoChat = computed(() => {
  if (abaChat.value === 'dm') return alvoDm.value?.nome ?? 'conversa'
  return abaChat.value === 'sala' && salaDoChat.value ? salaDoChat.value.nome : 'mundo'
})

const textoDoCampo = computed({
  get: () => (abaChat.value === 'dm' ? rascunhoDm.value : chatInput.value),
  set: (v: string) => {
    if (abaChat.value === 'dm') rascunhoDm.value = v
    else chatInput.value = v
  },
})

watch(() => chatSala.length, (agora, antes) => {
  if (abaChat.value !== 'sala' && agora > (antes ?? 0)) naoLidasSala.value += agora - (antes ?? 0)
})
watch(abaChat, (v) => { if (v === 'sala') naoLidasSala.value = 0 })
watch(salaDoChat, (v) => {
  if (!v) { abaChat.value = 'mundo'; naoLidasSala.value = 0 }
})
watch(abaDmDisponivel, (v) => {
  if (!v && abaChat.value === 'dm') abaChat.value = 'mundo'
})

function abrirAbaDm() {
  abaChat.value = 'dm'
  const id = alvoDm.value?.conversaId || dmAbertaId.value
  if (id) void marcarDmLida(id)
}

watch(() => alvoDm.value?.naoLidas ?? 0, (n) => {
  if (n <= 0 || abaChat.value !== 'dm' || document.visibilityState !== 'visible') return
  const id = alvoDm.value?.conversaId || dmAbertaId.value
  if (id) void marcarDmLida(id)
})

const dmLog = ref<HTMLElement | null>(null)
watch([itensDm, abaChat], async () => {
  if (abaChat.value !== 'dm') return
  await nextTick()
  const el = dmLog.value
  if (el) el.scrollTop = el.scrollHeight
})

function chatColor(m: ChatMessage): string {
  const key = m.userId || m.name
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (Math.imul(hash, 31) + key.charCodeAt(i)) >>> 0
  return `var(--chat-name-${hash % CHAT_NAME_COLORS})`
}

const limiteDoCampo = computed(() => (abaChat.value === 'dm' ? DM_TEXTO_MAX : CHAT_MAX_LEN))
const contarAPartir = computed(() => limiteDoCampo.value - CONTADOR_FOLGA)
const chatLog = ref<HTMLElement | null>(null)
const chatCooldown = ref(false)
const chatUnread = ref(false)
let chatCooldownTimer = 0

function sendChat() {
  if (abaChat.value === 'dm') {
    void enviarDm()
    return
  }
  if (chatCooldown.value) return
  const t = chatInput.value.trim()
  if (!t) return
  emitChat(t, abaChat.value)
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

watch(messages, async () => {
  const stick = atChatBottom()
  await nextTick()
  if (stick) scrollChatToEnd()
  else chatUnread.value = true
})

onUnmounted(() => clearTimeout(chatCooldownTimer))
</script>

<style scoped>
.ch-root {
  position: static;
  width: min(17.5rem, calc(100vw - 2rem));
  z-index: 10;
}

.ch-log {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 11.25rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin-bottom: 0.375rem;
  padding: 0.5rem 0.5rem;
  background: var(--bg-2);
  background: color-mix(in srgb, var(--bg-2) 96%, transparent);
  border: var(--ui-border-style);
  box-shadow: var(--contorno-duplo);
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
}
.ch-log::-webkit-scrollbar { width: 0.375rem; }
.ch-log::-webkit-scrollbar-track { background: transparent; }
.ch-log::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: var(--r-sm); }
.ch-log::-webkit-scrollbar-thumb:hover { background: var(--text-4); }

.ch-msg {
  font-size: 0.75rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
  text-shadow: 0 0.0625rem 0.125rem var(--bg-0);
}
.ch-nome { font-weight: 600; }
.ch-texto { color: var(--text); }

.ch-campo { position: relative; }

.ch-rodape {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 0.25rem);
  display: flex;
  align-items: flex-end;
  gap: 0.375rem;
  pointer-events: none;
}

.ch-pular {
  position: sticky;
  bottom: 0;
  align-self: center;
  margin-top: 0.25rem;
  pointer-events: auto;
}

.ch-contador {
  margin-left: auto;
  font-family: var(--f-num);
  font-size: 0.75rem;
  color: var(--text-3);
  background: var(--bg-1);
  background: color-mix(in srgb, var(--bg-1) 70%, transparent);
  padding: 0.125rem 0.25rem;
}
.ch-contador-max { color: var(--warn); }

.ch-input-wrap {
  display: flex;
  align-items: stretch;
  width: 100%;
  box-sizing: border-box;
  background: var(--bg-2);
  border: var(--ui-border-style);
  box-shadow: var(--contorno-duplo);
}
.ch-input-wrap:focus-within { border-color: var(--tinta); box-shadow: var(--contorno-duplo), 0 0 0 0.1875rem var(--accent); }

.ch-prefixo {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  max-width: 5.5rem;
  margin: 0.1875rem 0 0.1875rem 0.1875rem;
  padding: 0 0.4375rem;
  background: var(--primary);
  color: var(--bg-2);
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.ch-input {
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  background: transparent;
  border: none;
  color: var(--text);
  padding: 0.5rem 0.625rem;
  font-size: 0.8125rem;
  font-family: inherit;
}
.ch-input::placeholder { color: var(--text-3); }
.ch-input:focus { outline: none; }

.ch-cooldown {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 0.125rem;
  background: var(--primary-hi);
  transform-origin: left center;
  pointer-events: none;
  animation: chCooldown 0.5s linear forwards;
}
@keyframes chCooldown {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

.ch-abas { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 0.25rem; }
.ch-aba {
  appearance: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  max-width: 9rem;
  min-height: 2rem;
  padding: 0.3125rem 0.5rem;
  background: var(--bg-1);
  border: 0.125rem solid var(--tinta);
  color: var(--text-2);
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.ch-aba-on { background: var(--primary); color: var(--bg-2); }
.ch-aba-vazia { opacity: 0.45; cursor: default; border-style: dashed; }
.ch-aba-dm { max-width: 11rem; }
.ch-bolha {
  background: var(--accent);
  color: var(--tinta);
  border: 0.125rem solid var(--tinta);
  padding: 0 0.25rem;
  font-size: 0.5rem;
}

.ch-chip {
  appearance: none;
  cursor: pointer;
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  min-width: 2rem;
  min-height: 2rem;
  padding: 0.3125rem 0.5rem;
  background: var(--bg-1);
  border: 0.125rem dashed var(--tinta);
  color: var(--text-3);
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.ch-chip:hover { background: var(--bg-2); }
.ch-chip-on { background: var(--accent); color: var(--tinta); border-style: solid; }

.ch-dm-msg {
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--text);
  overflow-wrap: anywhere;
  text-shadow: 0 0.0625rem 0.125rem var(--bg-0);
}
.ch-dm-msg-minha { justify-content: flex-end; }
.ch-dm-msg-minha .ch-dm-texto { color: var(--accent-texto); }
.ch-dm-texto { min-width: 0; }
.ch-dm-hora {
  flex-shrink: 0;
  font-family: var(--f-num);
  font-size: 0.625rem;
  color: var(--text-3);
}

.ch-dm-nota {
  margin: 0.25rem 0;
  text-align: center;
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-3);
}

.ch-contrato {
  margin: 0.375rem 0 0;
  color: var(--text-3);
}
</style>
