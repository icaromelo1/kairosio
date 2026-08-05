<template>
  <PanelShell title="conversas" icon="message" size="lg" @close="emit('close')">
    <div class="dm-body">
      <section v-if="auth.isGuest" class="dm-guest">
        <h3 class="dm-guest-title"><PixelIcon name="lock" size="0.9375rem" />Conversar precisa de conta</h3>
        <p class="k-hint-text">
          Convidado não tem amigos nem conversa: a conta é apagada quando você sai, e a mensagem
          ficaria guardada apontando pra alguém que deixou de existir. Com uma conta você ganha um
          <b>@nome</b> fixo, e a conversa fica salva.
        </p>
        <button class="k-btn k-btn-ghost k-btn-sm" @click="router.push('/register')">Criar conta →</button>
      </section>

      <template v-else>
        <p v-if="erro" class="dm-error">{{ erro }}</p>

        <div class="dm-cols">
          <aside class="dm-side">
            <ul class="dm-convs">
              <li v-for="linha in linhas" :key="linha.userId">
                <button
                  class="dm-conv"
                  :class="{ 'dm-conv-open': linha.userId === alvoUserId, 'dm-conv-unread': linha.naoLidas > 0 }"
                  @click="abrir(linha)"
                >
                  <span class="dm-conv-top">
                    <span class="dm-conv-name ellipsis">{{ linha.nome }}</span>
                    <span v-if="linha.naoLidas" class="dm-conv-badge">{{ linha.naoLidas }}</span>
                  </span>
                  <span class="dm-conv-handle ellipsis">{{ linha.handle }}</span>
                  <span class="dm-conv-previa ellipsis">{{ linha.previa || 'nunca conversaram' }}</span>
                </button>
              </li>

              <li v-if="!linhas.length && !carregando" class="dm-empty">
                Você ainda não tem amigos. Procure alguém pelo @nome no painel de amigos.
              </li>
              <li v-if="carregando" class="dm-empty">carregando…</li>
            </ul>
          </aside>

          <section class="dm-chat">
            <template v-if="alvo">
              <header class="dm-chat-head">
                <span class="dm-chat-name ellipsis">{{ alvo.nome }}</span>
                <span class="dm-chat-handle ellipsis">{{ alvo.handle }}</span>
              </header>

              <div ref="log" class="dm-log" @scroll="aoRolar">
                <button
                  v-if="cursor"
                  class="k-btn k-btn-ghost k-btn-xs dm-more"
                  :disabled="carregandoMais"
                  @click="carregarMais"
                >{{ carregandoMais ? 'carregando…' : 'mensagens antigas' }}</button>
                <p v-else-if="mensagens.length" class="dm-note">começo da conversa</p>

                <template v-for="(m, i) in mensagens" :key="m.id">
                  <p v-if="separador(i)" class="dm-day">{{ separador(i) }}</p>
                  <div class="dm-msg" :class="m.minha ? 'dm-msg-mine' : 'dm-msg-theirs'">
                    <span class="dm-msg-text">{{ m.texto }}</span>
                    <span class="dm-msg-time">{{ hora(m.enviadaEm) }}</span>
                  </div>
                </template>

                <p v-if="!mensagens.length" class="dm-note">
                  {{ carregandoHistorico ? 'carregando…' : 'Nada por aqui ainda. Escreva a primeira mensagem.' }}
                </p>
              </div>

              <div class="dm-foot">
                <button v-if="naoVista" class="dm-jump" @click="irParaOFim">
                  novas mensagens <PixelIcon name="arrow-down" size="0.6875rem" />
                </button>
                <span
                  v-if="rascunho.length > DM_CONTADOR_A_PARTIR"
                  class="dm-count"
                  :class="{ 'dm-count-max': rascunho.length >= DM_TEXTO_MAX }"
                >{{ rascunho.length }}/{{ DM_TEXTO_MAX }}</span>
              </div>

              <p v-if="erroEnvio" class="dm-error">{{ erroEnvio }}</p>

              <form class="dm-send" @submit.prevent="enviar">
                <textarea
                  v-model="rascunho"
                  class="k-input k-input-sm dm-input"
                  :maxlength="DM_TEXTO_MAX"
                  rows="2"
                  placeholder="Escreva… (Enter envia, Shift+Enter quebra linha)"
                  @keydown.enter.exact.prevent="enviar"
                />
                <button class="k-btn k-btn-primary k-btn-xs dm-send-btn" type="submit" :disabled="!podeEnviar">
                  <PixelIcon name="send" size="0.75rem" />{{ enviando ? '…' : 'enviar' }}
                </button>
              </form>
            </template>

            <p v-else class="dm-note dm-pick">Escolha um amigo ao lado pra abrir a conversa.</p>
          </section>
        </div>
      </template>
    </div>
  </PanelShell>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  DM_CONTADOR_A_PARTIR, DM_INTERVALO_MIN_MS, DM_TEXTO_MAX, DmError,
  dmHistory, listConversas, markDmRead, sendDm,
  type DmConversa, type DmMensagem,
} from '@/services/dm.api'
import { listFriends, type FriendUser, type FriendView } from '@/services/friend.api'
import { dmUnread, onDmMessage, setDmUnread, syncDmUnread, type DmEntrega } from '@/services/presence'
import { useAuthStore } from '@/stores/useAuthStore'
import PanelShell from '@/components/PanelShell.vue'
import PixelIcon from '@/components/PixelIcon.vue'

interface LinhaConversa {
  conversaId: string
  userId: string
  nome: string
  handle: string
  previa: string
  quando: number
  naoLidas: number
}

const props = defineProps<{ friendId?: string }>()

const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const auth = useAuthStore()

const conversas = ref<DmConversa[]>([])
const amigos = ref<FriendView[]>([])
const carregando = ref(false)
const erro = ref('')

const alvoUserId = ref('')
const abertaId = ref('')
const mensagens = ref<DmMensagem[]>([])
const cursor = ref<string | null>(null)
const carregandoHistorico = ref(false)
const carregandoMais = ref(false)

const rascunho = ref('')
const enviando = ref(false)
const travado = ref(false)
const erroEnvio = ref('')
const naoVista = ref(false)
const log = ref<HTMLElement | null>(null)

const FIM_FOLGA = 24
const TOPO_FOLGA = 48
const LEITURA_ESPERA_MS = 400

const MENSAGENS: Record<string, string> = {
  'dm-sem-amizade': 'Vocês não são mais amigos — a conversa foi fechada.',
  'dm-rapido-demais': 'Calma: espere um instante antes de mandar outra mensagem.',
  'dm-texto-longo': `Mensagem longa demais — o máximo é ${DM_TEXTO_MAX} caracteres.`,
  'dm-vazia': 'Escreva alguma coisa antes de enviar.',
  'dm-consigo': 'Essa conversa seria com você mesmo.',
  'dm-not-found': 'Essa conversa não existe mais.',
  'dm-cursor-invalido': 'Não deu pra seguir o histórico daqui. Reabra a conversa.',
  'guest-no-friends': 'Convidado não tem conversas. Crie uma conta pra conversar.',
}

function explicar(e: unknown): string {
  const code = e instanceof DmError ? e.code : ''
  return MENSAGENS[code] || (e as Error).message || 'Algo deu errado.'
}

function handleOf(user: FriendUser | null | undefined): string {
  return user?.username ? `@${user.username}` : '—'
}

function quandoDe(conversa: DmConversa): number {
  const data = conversa.ultimaMensagem?.enviadaEm ?? conversa.criadoEm
  const ms = data ? new Date(data).getTime() : 0
  return Number.isNaN(ms) ? 0 : ms
}

const linhas = computed<LinhaConversa[]>(() => {
  const porUsuario = new Map<string, LinhaConversa>()

  for (const conversa of conversas.value) {
    const usuario = conversa.usuario
    if (!usuario) continue
    const previa = conversa.ultimaMensagem
      ? `${conversa.ultimaMensagem.minha ? 'você: ' : ''}${conversa.ultimaMensagem.texto}`
      : ''
    porUsuario.set(usuario.id, {
      conversaId: conversa.id,
      userId: usuario.id,
      nome: usuario.nome || 'sem nome',
      handle: handleOf(usuario),
      previa,
      quando: quandoDe(conversa),
      naoLidas: dmUnread.get(conversa.id) ?? 0,
    })
  }

  for (const amigo of amigos.value) {
    const usuario = amigo.usuario
    if (!usuario || porUsuario.has(usuario.id)) continue
    porUsuario.set(usuario.id, {
      conversaId: '',
      userId: usuario.id,
      nome: usuario.nome || 'sem nome',
      handle: handleOf(usuario),
      previa: '',
      quando: 0,
      naoLidas: 0,
    })
  }

  return [...porUsuario.values()].sort((a, b) => b.quando - a.quando || a.nome.localeCompare(b.nome))
})

const alvo = computed(() => linhas.value.find((linha) => linha.userId === alvoUserId.value) ?? null)

const podeEnviar = computed(
  () => !!alvoUserId.value && !!rascunho.value.trim() && !enviando.value && !travado.value,
)

function noFim(): boolean {
  const el = log.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight <= FIM_FOLGA
}

function irParaOFim() {
  const el = log.value
  if (el) el.scrollTop = el.scrollHeight
  naoVista.value = false
}

function aoRolar() {
  const el = log.value
  if (!el) return
  if (noFim()) naoVista.value = false
  if (el.scrollTop <= TOPO_FOLGA) void carregarMais()
}

let pedido = 0

function adotar(lista: DmConversa[]) {
  conversas.value = lista
  syncDmUnread(lista)
  if (abertaId.value) setDmUnread(abertaId.value, 0)
}

async function carregarTudo() {
  carregando.value = true
  erro.value = ''
  try {
    const [lista, meusAmigos] = await Promise.all([listConversas(), listFriends()])
    adotar(lista)
    amigos.value = meusAmigos
  } catch (e) {
    erro.value = explicar(e)
  } finally {
    carregando.value = false
  }
}

async function carregarConversas() {
  try {
    adotar(await listConversas())
  } catch {}
}

async function abrir(linha: LinhaConversa) {
  if (linha.userId === alvoUserId.value) return
  const meu = ++pedido
  alvoUserId.value = linha.userId
  abertaId.value = linha.conversaId
  mensagens.value = []
  cursor.value = null
  naoVista.value = false
  erroEnvio.value = ''
  if (!linha.conversaId) return

  carregandoHistorico.value = true
  try {
    const pagina = await dmHistory(linha.conversaId)
    if (meu !== pedido) return
    mensagens.value = [...pagina.mensagens].reverse()
    cursor.value = pagina.proximoCursor
    await nextTick()
    irParaOFim()
    void marcarLida(linha.conversaId)
    if (cursor.value && log.value && log.value.scrollHeight <= log.value.clientHeight) {
      void carregarMais()
    }
  } catch (e) {
    if (meu !== pedido) return
    if (!fechouPorAmizade(e)) erro.value = explicar(e)
  } finally {
    if (meu === pedido) carregandoHistorico.value = false
  }
}

async function carregarMais() {
  const conversaId = abertaId.value
  if (!cursor.value || carregandoMais.value || !conversaId) return
  const meu = pedido
  carregandoMais.value = true
  try {
    const pagina = await dmHistory(conversaId, cursor.value)
    if (meu !== pedido || conversaId !== abertaId.value) return
    const el = log.value
    const alturaAntes = el ? el.scrollHeight : 0
    const topoAntes = el ? el.scrollTop : 0
    mensagens.value = [...[...pagina.mensagens].reverse(), ...mensagens.value]
    cursor.value = pagina.proximoCursor
    await nextTick()
    if (el) el.scrollTop = el.scrollHeight - alturaAntes + topoAntes
  } catch (e) {
    if (meu !== pedido) return
    if (!fechouPorAmizade(e)) erro.value = explicar(e)
  } finally {
    carregandoMais.value = false
  }
}

let leituraTimer = 0

function agendarLeitura(conversaId: string) {
  window.clearTimeout(leituraTimer)
  leituraTimer = window.setTimeout(() => { void marcarLida(conversaId) }, LEITURA_ESPERA_MS)
}

async function marcarLida(conversaId: string) {
  setDmUnread(conversaId, 0)
  try {
    await markDmRead(conversaId)
  } catch {}
}

let travaTimer = 0

function travar() {
  travado.value = true
  window.clearTimeout(travaTimer)
  travaTimer = window.setTimeout(() => { travado.value = false }, DM_INTERVALO_MIN_MS)
}

function fechouPorAmizade(e: unknown): boolean {
  const code = e instanceof DmError ? e.code : ''
  if (code !== 'dm-sem-amizade' && code !== 'dm-not-found') return false
  pedido += 1
  alvoUserId.value = ''
  abertaId.value = ''
  mensagens.value = []
  cursor.value = null
  erro.value = MENSAGENS[code]
  void carregarTudo()
  return true
}

async function enviar() {
  const texto = rascunho.value.trim()
  const destino = alvoUserId.value
  if (!texto || !destino || enviando.value || travado.value) return
  if (texto.length > DM_TEXTO_MAX) {
    erroEnvio.value = MENSAGENS['dm-texto-longo']
    return
  }
  const meu = pedido
  enviando.value = true
  erroEnvio.value = ''
  try {
    const mensagem = await sendDm(destino, texto)
    travar()
    if (meu !== pedido) return
    rascunho.value = ''
    if (!abertaId.value) abertaId.value = mensagem.conversaId
    if (mensagem.conversaId === abertaId.value && !mensagens.value.some((m) => m.id === mensagem.id)) {
      mensagens.value.push(mensagem)
    }
    aplicarPrevia(mensagem, true)
    await nextTick()
    irParaOFim()
  } catch (e) {
    if (meu !== pedido) return
    if (e instanceof DmError && e.code === 'dm-rapido-demais') travar()
    if (!fechouPorAmizade(e)) erroEnvio.value = explicar(e)
  } finally {
    enviando.value = false
  }
}

let desassinar: (() => void) | null = null

function aplicarPrevia(mensagem: DmMensagem, minha: boolean) {
  const conversa = conversas.value.find((row) => row.id === mensagem.conversaId)
  if (!conversa) {
    void carregarConversas()
    return
  }
  conversa.ultimaMensagem = {
    texto: mensagem.texto,
    autorId: mensagem.autorId,
    minha,
    enviadaEm: mensagem.enviadaEm,
  }
}

async function receber(entrega: DmEntrega) {
  aplicarPrevia(entrega.mensagem, false)
  if (!abertaId.value && entrega.de?.id === alvoUserId.value) abertaId.value = entrega.conversaId
  if (entrega.conversaId !== abertaId.value) return
  if (mensagens.value.some((m) => m.id === entrega.mensagem.id)) return

  const prender = noFim()
  mensagens.value.push(entrega.mensagem)
  setDmUnread(entrega.conversaId, 0)
  agendarLeitura(entrega.conversaId)
  await nextTick()
  if (prender) irParaOFim()
  else naoVista.value = true
}

function selecionarInicial() {
  const pedida = props.friendId
    ? linhas.value.find((linha) => linha.userId === props.friendId)
    : linhas.value.find((linha) => linha.naoLidas > 0)
  if (pedida) void abrir(pedida)
}

onMounted(() => {
  if (auth.isGuest) return
  desassinar = onDmMessage((entrega) => { void receber(entrega) })
  void carregarTudo().then(selecionarInicial)
})

onUnmounted(() => {
  desassinar?.()
  window.clearTimeout(leituraTimer)
  window.clearTimeout(travaTimer)
})

function mesmoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function hora(iso: string): string {
  const data = new Date(iso)
  return Number.isNaN(data.getTime()) ? '' : data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function separador(index: number): string {
  const atual = mensagens.value[index]
  if (!atual) return ''
  const data = new Date(atual.enviadaEm)
  if (Number.isNaN(data.getTime())) return ''
  const anterior = mensagens.value[index - 1]
  if (anterior && mesmoDia(new Date(anterior.enviadaEm), data)) return ''

  const hoje = new Date()
  if (mesmoDia(data, hoje)) return 'hoje'
  const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1)
  if (mesmoDia(data, ontem)) return 'ontem'
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.dm-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dm-guest {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  background: var(--bg-1);
  border: 0.0625rem solid var(--border);
  padding: 0.875rem;
}
.dm-guest-title {
  font-size: 0.9375rem;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dm-cols {
  display: flex;
  gap: 0.75rem;
  height: 58vh;
  min-height: 16rem;
  min-width: 0;
}

.dm-side {
  width: 14rem;
  flex: none;
  min-height: 0;
  overflow-y: auto;
  background: var(--bg-1);
  border: 0.0625rem solid var(--border);
}

.dm-convs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.dm-conv {
  appearance: none;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0.0625rem solid transparent;
  border-bottom-color: var(--border);
  color: var(--text-2);
  font-family: inherit;
  padding: 0.5rem 0.625rem;
  min-width: 0;
}
.dm-conv:hover { background: var(--bg-2); color: var(--text); }
.dm-conv-open { border-color: var(--primary-hi); background: rgba(44, 116, 65, 0.16); color: var(--text); }

.dm-conv-top {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
}
.dm-conv-name { flex: 1; min-width: 0; font-size: 0.8125rem; font-weight: 600; }
.dm-conv-unread .dm-conv-name { color: var(--primary-hi); }

.dm-conv-badge {
  flex: none;
  min-width: 1rem;
  padding: 0 0.25rem;
  background: var(--primary-hi);
  color: var(--bg-0);
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  line-height: 1rem;
  text-align: center;
}

.dm-conv-handle { font-family: var(--f-mono); font-size: 0.625rem; color: var(--text-3); }
.dm-conv-previa { font-size: 0.6875rem; color: var(--text-3); }
.dm-conv-unread .dm-conv-previa { color: var(--text-2); }

.dm-chat {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--bg-1);
  border: 0.0625rem solid var(--border);
  padding: 0.75rem;
}

.dm-chat-head {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  min-width: 0;
  flex: none;
  padding-bottom: 0.5rem;
  border-bottom: 0.0625rem solid var(--border);
}
.dm-chat-name { font-size: 0.875rem; font-weight: 700; min-width: 0; }
.dm-chat-handle { font-family: var(--f-mono); font-size: 0.6875rem; color: var(--text-3); min-width: 0; }

.dm-log {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding-right: 0.25rem;
}

.dm-more { align-self: center; }

.dm-note {
  margin: 0;
  align-self: center;
  font-size: 0.75rem;
  color: var(--text-4);
  text-align: center;
}
.dm-pick { margin: auto; }

.dm-day {
  margin: 0.25rem 0;
  align-self: center;
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-4);
}

.dm-msg {
  max-width: 82%;
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border: 0.0625rem solid var(--border);
  background: var(--bg-2);
  font-size: 0.8125rem;
  line-height: 1.4;
  min-width: 0;
}
.dm-msg-mine {
  align-self: flex-end;
  background: rgba(44, 116, 65, 0.2);
  border-color: var(--primary-glow);
  color: var(--text);
}
.dm-msg-theirs { align-self: flex-start; }

.dm-msg-text { min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.dm-msg-time {
  flex: none;
  font-family: var(--f-mono);
  font-size: 0.5625rem;
  color: var(--text-4);
}

.dm-foot {
  flex: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 1.125rem;
}

.dm-jump {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
  background: transparent;
  border: 0.0625rem solid var(--accent-lo);
  color: var(--accent-texto);
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.25rem 0.375rem;
}
.dm-jump:hover { background: rgba(251, 191, 36, 0.16); }

.dm-count {
  margin-left: auto;
  font-family: var(--f-mono);
  font-size: 0.625rem;
  color: var(--text-3);
}
.dm-count-max { color: var(--err); }

.dm-send {
  flex: none;
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}
.k-input.dm-input {
  flex: 1;
  min-width: 0;
  font-family: var(--f-sans);
  font-size: 0.8125rem;
  letter-spacing: normal;
  resize: none;
}
.dm-send-btn { flex: none; }

.dm-empty {
  color: var(--text-3);
  font-size: 0.75rem;
  padding: 0.75rem 0.625rem;
}

.dm-error { color: var(--err); font-size: 0.8125rem; margin: 0; }

button:disabled { opacity: 0.5; cursor: default; }

@media (max-width: 44rem) {
  .dm-cols {
    flex-direction: column;
    height: 66vh;
  }
  .dm-side { width: 100%; max-height: 8rem; }
  .dm-msg { max-width: 94%; }
}
</style>
